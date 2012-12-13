/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = [ "firetray" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://firetray/commons.js");
Cu.import("resource://firetray/PrefListener.jsm");
Cu.import("resource://firetray/VersionChange.jsm");

/**
 * firetray namespace.
 */
if ("undefined" == typeof(firetray)) {
  var firetray = {};
};

let log = firetray.Logging.getLogger("firetray.Handler");

/**
 * Singleton object and abstraction for windows and tray icon management.
 */
// NOTE: modules work outside of the window scope. Unlike scripts in the
// chrome, modules don't have access to objects such as window, document, or
// other global functions
// (https://developer.mozilla.org/en/XUL_School/JavaScript_Object_Management)
firetray.Handler = {

  initialized: false,
  inBrowserApp: false,
  inMailApp: false,
  appHasChat: false,
  appStarted: false,
  windows: {},
  windowsCount: 0,
  visibleWindowsCount: 0,
  observedTopics: {},
  ctypesLibs: {},               // {"lib1": lib1, "lib2": lib2}

  appId:      (function(){return Services.appinfo.ID;})(),
  appName:    (function(){return Services.appinfo.name;})(),
  runtimeABI: (function(){return Services.appinfo.XPCOMABI;})(),
  runtimeOS:  (function(){return Services.appinfo.OS;})(), // "WINNT", "Linux", "Darwin"
  addonRootDir: (function(){
    let uri = Services.io.newURI(Components.stack.filename, null, null);
    if (uri instanceof Ci.nsIFileURL) {
      log.debug("_directory="+uri.file.parent.parent.path);
      return uri.file.parent.parent;
    }
    throw new Error("not resolved");
  })(),

  init: function() {            // does creates icon
    firetray.PrefListener.register(false);
    firetray.MailChatPrefListener.register(false);

    // version checked during install, so we shouldn't need to care
    let xulVer = Services.appinfo.platformVersion; // Services.vc.compare(xulVer,"2.0a")>=0
    log.info("OS=" + this.runtimeOS + ", ABI=" + this.runtimeABI + ", XULrunner=" + xulVer);
    switch (this.runtimeOS) {
    case "Linux":
      Cu.import("resource://firetray/linux/FiretrayStatusIcon.jsm");
      log.debug('FiretrayStatusIcon imported');
      Cu.import("resource://firetray/linux/FiretrayWindow.jsm");
      log.debug('FiretrayWindow imported');
      break;
    default:
      log.error("FIRETRAY: only Linux platform supported at this time. Firetray not loaded");
      return false;
    }

    if (this.appId === FIRETRAY_THUNDERBIRD_ID || this.appId === FIRETRAY_SEAMONKEY_ID)
      this.inMailApp = true;
    if (this.appId === FIRETRAY_FIREFOX_ID || this.appId === FIRETRAY_SEAMONKEY_ID)
      this.inBrowserApp = true;
    if (this.appId === FIRETRAY_THUNDERBIRD_ID && Services.vc.compare(xulVer,"15.0")>=0)
      this.appHasChat = true;
    log.info('inMailApp='+this.inMailApp+', inBrowserApp='+this.inBrowserApp+', appHasChat='+this.appHasChat);

    VersionChange.init(FIRETRAY_ID, FIRETRAY_VERSION, FIRETRAY_PREF_BRANCH);
    VersionChange.addHook(["install", "upgrade", "reinstall"], firetray.VersionChangeHandler.showReleaseNotes);
    VersionChange.addHook(["upgrade", "reinstall"], firetray.VersionChangeHandler.tryEraseOldOptions);
    VersionChange.addHook(["upgrade", "reinstall"], firetray.VersionChangeHandler.correctMailNotificationType);
    VersionChange.addHook(["upgrade", "reinstall"], firetray.VersionChangeHandler.correctMailServerTypes);
    VersionChange.applyHooksAndWatchUninstall();

    firetray.Window.init();
    firetray.StatusIcon.init();
    firetray.Handler.showHideIcon();
    log.debug('StatusIcon initialized');

    if (this.inMailApp) {
      try {
        Cu.import("resource://firetray/FiretrayMessaging.jsm");
        if (firetray.Utils.prefService.getBoolPref("mail_notification_enabled")) {
          firetray.Messaging.init();
          firetray.Messaging.updateMsgCountWithCb();
        }
      } catch (x) {
        log.error(x);
        return false;
      }
    }

    if (this.isChatEnabled()) {
      Cu.import("resource://firetray/FiretrayMessaging.jsm"); // needed for existsChatAccount
      Cu.import("resource://firetray/FiretrayChat.jsm");
      firetray.Utils.addObservers(firetray.Handler, [
        "account-added", "account-removed"]);
      if (this.existsChatAccount())
        firetray.Chat.init();
    }

    firetray.Utils.addObservers(firetray.Handler,
    [ "before-first-paint", "xpcom-will-shutdown", "profile-change-teardown" ]);

    this.preventWarnOnClose();

    this.initialized = true;
    return true;
  },

  shutdown: function() {
    log.debug("Disabling Handler");
    if (firetray.Handler.isChatEnabled()) firetray.Chat.shutdown();

    if (this.inMailApp)
      firetray.Messaging.shutdown();
    firetray.StatusIcon.shutdown();
    firetray.Window.shutdown();
    this.tryCloseLibs();

    firetray.Utils.removeAllObservers(this);

    firetray.MailChatPrefListener.register(false);
    firetray.PrefListener.unregister();

    this.appStarted = false;
    this.initialized = false;
    return true;
  },

  isChatEnabled: function() {
    let chatIsEnabled = (this.appHasChat &&
                         Services.prefs.getBoolPref("mail.chat.enabled") &&
                         firetray.Utils.prefService.getBoolPref("chat_icon_enable"));
    log.info('isChatEnabled='+chatIsEnabled);
    return chatIsEnabled;
  },

  tryCloseLibs: function() {
    try {
      for (libName in this.ctypesLibs) {
        let lib = this.ctypesLibs[libName];
        if (lib.available())
          lib.close();
      };
    } catch(x) { log.error(x); }
  },

  subscribeLibsForClosing: function(libs) {
    for (let i=0, len=libs.length; i<len; ++i) {
      let lib = libs[i];
      if (!this.ctypesLibs.hasOwnProperty(lib.name))
        this.ctypesLibs[lib.name] = lib;
    }
  },

  // FIXME: this should definetely be done in Chat, but IM accounts
  // seem not be initialized at early stage (Exception... "'TypeError:
  // this._items is undefined' when calling method:
  // [nsISimpleEnumerator::hasMoreElements]"), and we're unsure if we should
  // initAccounts() ourselves...
  existsChatAccount: function() {
    let accounts = new firetray.Messaging.Accounts();
    for (let accountServer in accounts)
      if (accountServer.type === FIRETRAY_ACCOUNT_SERVER_TYPE_IM)  {
        log.debug("found im server: "+accountServer.prettyName);
        return true;
      }

    return false;
  },

  observe: function(subject, topic, data) {
    switch (topic) {

    case "before-first-paint":
      log.debug("before-first-paint: "+subject.baseURI);
      firetray.Utils.removeObservers(firetray.Handler, [ "before-first-paint" ]);
      firetray.Utils.timer(function() {

        if (firetray.Utils.prefService.getBoolPref('start_hidden')) {
          log.debug("start_hidden");
          firetray.Handler.hideAllWindows();
        }

        firetray.Handler.appStarted = true;
        log.debug("*** appStarted ***");
      }, FIRETRAY_DELAY_BROWSER_STARTUP_MILLISECONDS, Ci.nsITimer.TYPE_ONE_SHOT);
      break;

    case "xpcom-will-shutdown":
      log.debug("xpcom-will-shutdown");
      this.shutdown();
      break;
    case "profile-change-teardown": // also found "quit-application-granted"
      if (data === 'shutdown-persist')
        this.restoreWarnOnClose();
      break;

    case "account-removed":     // emitted by IM
      if (!this.existsChatAccount())
        firetray.Chat.shutdown();
      break;
    case "account-added":       // emitted by IM
      if (!firetray.Chat.initialized)
        firetray.Chat.init();
      break;

    default:
      log.warn("unhandled topic: "+topic);
    }
  },

  // these get overridden in OS-specific Icon/Window handlers
  setIconImageDefault: function() {},
  setIconImageNewMail: function() {},
  setIconImageFromFile: function(filename) {},
  setIconText: function(text, color) {},
  setIconTooltip: function(localizedMessage) {},
  setIconTooltipDefault: function() {},
  setIconVisibility: function(visible) {},
  registerWindow: function(win) {},
  unregisterWindow: function(win) {},
  getWindowIdFromChromeWindow: function(win) {},
  hideWindow: function(winId) {},
  showWindow: function(winId) {},
  showHideAllWindows: function() {},
  activateLastWindow: function(gtkStatusIcon, gdkEvent, userData) {},
  findActiveWindow: function() {},

  showAllWindows: function() {
    log.debug("showAllWindows");
    for (let winId in firetray.Handler.windows) {
      if (!firetray.Handler.windows[winId].visible)
        firetray.Handler.showWindow(winId);
    }
  },
  hideAllWindows: function() {
    log.debug("hideAllWindows");
    for (let winId in firetray.Handler.windows) {
      if (firetray.Handler.windows[winId].visible)
        firetray.Handler.hideWindow(winId);
    }
  },

  showHideIcon: function() {
    if (firetray.Utils.prefService.getBoolPref('show_icon_on_hide'))
      firetray.Handler.setIconVisibility(
        (firetray.Handler.visibleWindowsCount !== firetray.Handler.windowsCount));
    else
      firetray.Handler.setIconVisibility(true);
  },

  /** nsIBaseWindow, nsIXULWindow, ... */
  getWindowInterface: function(win, iface) {
    let winInterface, winOut;
    try {                       // thx Neil Deakin !!
      winInterface =  win.QueryInterface(Ci.nsIInterfaceRequestor)
        .getInterface(Ci.nsIWebNavigation)
        .QueryInterface(Ci.nsIDocShellTreeItem)
        .treeOwner
        .QueryInterface(Ci.nsIInterfaceRequestor);
    } catch (ex) {
      // ignore no-interface exception
      log.error(ex);
      return null;
    }

    if (iface == "nsIBaseWindow")
      winOut = winInterface[iface];
    else if (iface == "nsIXULWindow")
      winOut = winInterface.getInterface(Ci.nsIXULWindow);
    else {
      log.error("unknown iface '" + iface + "'");
      return null;
    }

    return winOut;
  },

  _getBrowserProperties: function() {
    if (firetray.Handler.appId === FIRETRAY_FIREFOX_ID)
      return "chrome://branding/locale/browserconfig.properties";
    else if (firetray.Handler.appId === FIRETRAY_SEAMONKEY_ID)
      return "chrome://navigator-region/locale/region.properties";
    else return null;
  },

  _getHomePage: function() {
    var prefDomain = "browser.startup.homepage";
    var url;
    try {
      url = Services.prefs.getComplexValue(prefDomain,
        Components.interfaces.nsIPrefLocalizedString).data;
    } catch (e) {}

    // use this if we can't find the pref
    if (!url) {
      var SBS = Cc["@mozilla.org/intl/stringbundle;1"].getService(Ci.nsIStringBundleService);
      var configBundle = SBS.createBundle(firetray.Handler._getBrowserProperties());
      url = configBundle.GetStringFromName(prefDomain);
    }

    return url;
  },

  openBrowserWindow: function() {
    try {
      var home = firetray.Handler._getHomePage();
      log.debug("home="+home);

      // FIXME: obviously we need to wait to avoid seg fault on jsapi.cpp:827
      // 827         if (t->data.requestDepth) {
      firetray.Utils.timer(function() {
        for(var key in firetray.Handler.windows) break;
        firetray.Handler.windows[key].chromeWin.open(home);
      }, FIRETRAY_DELAY_NOWAIT_MILLISECONDS, Ci.nsITimer.TYPE_ONE_SHOT);
    } catch (x) { log.error(x); }
  },

  openMailMessage: function() {
    try {
      var aURI = Services.io.newURI("mailto:", null, null);
      var msgComposeService = Cc["@mozilla.org/messengercompose;1"]
        .getService(Ci.nsIMsgComposeService);
      msgComposeService.OpenComposeWindowWithURI(null, aURI);
    } catch (x) { log.error(x); }
  },

  quitApplication: function() {
    try {
      firetray.Utils.timer(function() {
        let appStartup = Cc['@mozilla.org/toolkit/app-startup;1']
          .getService(Ci.nsIAppStartup);
        appStartup.quit(Ci.nsIAppStartup.eAttemptQuit);
      }, FIRETRAY_DELAY_NOWAIT_MILLISECONDS, Ci.nsITimer.TYPE_ONE_SHOT);
    } catch (x) { log.error(x); }
  },

  preventWarnOnClose: function() {
    if (!this.inBrowserApp) return;
    let generalTabsPrefs = Services.prefs.getBranch("browser.tabs.");
    this.warnOnCloseTmp = generalTabsPrefs.getBoolPref('warnOnClose');
    log.debug("warnOnClose saved. was: "+this.warnOnCloseTmp);
    generalTabsPrefs.setBoolPref('warnOnClose', false);
  },
  restoreWarnOnClose: function() {
    if (!this.inBrowserApp && !this.warnOnCloseTmp) return;
    let generalTabsPrefs = Services.prefs.getBranch("browser.tabs.");
    generalTabsPrefs.setBoolPref('warnOnClose', this.warnOnCloseTmp);
    log.debug("warnOnClose restored to: "+this.warnOnCloseTmp);
  }

}; // firetray.Handler


// FIXME: since prefs can also be changed from config editor, we need to
// observe *all* firetray prefs !
firetray.PrefListener = new PrefListener(
  FIRETRAY_PREF_BRANCH,
  function(branch, name) {
    log.debug('Pref changed: '+name);
    switch (name) {
    case 'hides_single_window':
      firetray.Handler.showHidePopupMenuItems();
      break;
    case 'show_icon_on_hide':
      firetray.Handler.showHideIcon();
      break;
    case 'mail_notification_enabled':
      if (firetray.Utils.prefService.getBoolPref('mail_notification_enabled')) {
        firetray.Messaging.init();
        firetray.Messaging.updateMsgCountWithCb();
      } else {
        firetray.Messaging.shutdown();
        firetray.Handler.setIconImageDefault();
      }
      break;
    case 'new_mail_icon_names':
      firetray.StatusIcon.loadThemedIcons();
    case 'only_favorite_folders':
    case 'message_count_type':
    case 'folder_count_recursive':
      firetray.Messaging.updateMsgCountWithCb();
      break;
    case 'app_mail_icon_names':
    case 'app_browser_icon_names':
    case 'app_default_icon_names':
    case 'app_icon_type':
      firetray.StatusIcon.loadThemedIcons();
    case 'app_icon_filename':
      firetray.Handler.setIconImageDefault();
      if (firetray.Handler.inMailApp)
        firetray.Messaging.updateMsgCountWithCb();
      break;
    default:
    }
  });

firetray.MailChatPrefListener = new PrefListener(
  "mail.chat.",
  function(branch, name) {
    log.debug('MailChat pref changed: '+name);
    switch (name) {
    case 'enabled':
      let doEnableChat = (firetray.Handler.appHasChat &&
                          firetray.Utils.prefService.getBoolPref("chat_icon_enable"));
      if (!doEnableChat) return;

      if (Services.prefs.getBoolPref("mail.chat.enabled")) {
        if (!firetray.Chat) {
          Cu.import("resource://firetray/FiretrayMessaging.jsm"); // needed for existsChatAccount
          Cu.import("resource://firetray/FiretrayChat.jsm");
          firetray.Utils.addObservers(firetray.Handler, [
            "account-added", "account-removed"]);
        }
        if (firetray.Handler.existsChatAccount())
          firetray.Chat.init();
      } else {
        firetray.Chat.shutdown();
      }
      break;
    default:
    }
  });

firetray.VersionChangeHandler = {

  showReleaseNotes: function() {
    firetray.VersionChangeHandler.openTab(FIRETRAY_SPLASH_PAGE+"#v"+FIRETRAY_VERSION);
  },

  openTab: function(url) {
    log.info("appId="+firetray.Handler.appId);
    if (firetray.Handler.appId === FIRETRAY_THUNDERBIRD_ID)
      this.openMailTab(url);
    else if (firetray.Handler.appId === FIRETRAY_FIREFOX_ID ||
             firetray.Handler.appId === FIRETRAY_SEAMONKEY_ID)
      this.openBrowserTab(url);
    else
      log.error("unsupported application");
  },

  openMailTab: function(url) {
    let mail3PaneWindow = Services.wm.getMostRecentWindow("mail:3pane");
    if (mail3PaneWindow) {
      var tabmail = mail3PaneWindow.document.getElementById("tabmail");
      mail3PaneWindow.focus();
    }

    if (tabmail) {
      firetray.Utils.timer(function() {
        log.debug("openMailTab");
        tabmail.openTab("contentTab", {contentPage: url});
      }, FIRETRAY_DELAY_BROWSER_STARTUP_MILLISECONDS, Ci.nsITimer.TYPE_ONE_SHOT);
    }
  },

  openBrowserTab: function(url) {
    let win = Services.wm.getMostRecentWindow("navigator:browser");
    log.debug("WIN="+win);
    if (win) {
      var mainWindow = win.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
            .getInterface(Components.interfaces.nsIWebNavigation)
            .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
            .rootTreeItem
            .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
            .getInterface(Components.interfaces.nsIDOMWindow);

      mainWindow.setTimeout(function(win){
        log.debug("openBrowser");
        mainWindow.gBrowser.selectedTab = mainWindow.gBrowser.addTab(url);
      }, 1000);
    }
  },

  tryEraseOldOptions: function() {
    let v03Options = [
      "close_to_tray", "minimize_to_tray", "start_minimized", "confirm_exit",
      "restore_to_next_unread", "mail_count_type", "show_mail_count",
      "dont_count_spam", "dont_count_archive", "dont_count_drafts",
      "dont_count_sent", "dont_count_templates", "show_mail_notification",
      "show_icon_only_minimized", "use_custom_normal_icon",
      "use_custom_special_icon", "custom_normal_icon", "custom_special_icon",
      "text_color", "scroll_to_hide", "scroll_action", "grab_multimedia_keys",
      "hide_show_mm_key", "accounts_to_exclude" ];
    let v040b2Options = [ 'mail_notification' ];
    let oldOptions = v03Options.concat(v040b2Options);

    for (let i = 0, length = oldOptions.length; i<length; ++i) {
      try {
        let option = oldOptions[i];
        firetray.Utils.prefService.clearUserPref(option);
      } catch (x) {}
    }
  },

  correctMailNotificationType: function() {
    let msgCountType = firetray.Utils.prefService.getIntPref('message_count_type');
    let mailNotificationType = firetray.Utils.prefService.getIntPref('mail_notification_type');
    if (msgCountType === FIRETRAY_MESSAGE_COUNT_TYPE_NEW &&
        mailNotificationType === FIRETRAY_NOTIFICATION_MESSAGE_COUNT) {
      firetray.Utils.prefService.setIntPref('mail_notification_type',
        FIRETRAY_NOTIFICATION_NEWMAIL_ICON);
      log.warn("mail notification type set to newmail icon.");
    }
  },

  correctMailServerTypes: function() {
    let mailAccounts = firetray.Utils.getObjPref('mail_accounts');
    let serverTypes = mailAccounts["serverTypes"];
    if (!serverTypes["exquilla"]) {
      serverTypes["exquilla"] = {"order":6,"excluded":true};
      let prefObj = {"serverTypes":serverTypes, "excludedAccounts":mailAccounts["excludedAccounts"]};
      firetray.Utils.setObjPref('mail_accounts', prefObj);
      log.warn("mail server types corrected");
    }
  }

};
