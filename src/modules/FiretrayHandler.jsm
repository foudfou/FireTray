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

/**
 * Singleton object and abstraction for windows and tray icon management.
 */
// NOTE: modules work outside of the window scope. Unlike scripts in the
// chrome, modules don't have access to objects such as window, document, or
// other global functions
// (https://developer.mozilla.org/en/XUL_School/JavaScript_Object_Management)
firetray.Handler = {
  FILENAME_BLANK: null,

  initialized: false,
  inMailApp: false,
  inBrowserApp: false,
  appStarted: false,
  windows: {},
  windowsCount: 0,
  visibleWindowsCount: 0,

  appId:      (function(){return Services.appinfo.ID;})(),
  appName:    (function(){return Services.appinfo.name;})(),
  runtimeABI: (function(){return Services.appinfo.XPCOMABI;})(),
  runtimeOS:  (function(){return Services.appinfo.OS;})(), // "WINNT", "Linux", "Darwin"
  addonRootDir: (function(){
    let uri = Services.io.newURI(Components.stack.filename, null, null);
    if (uri instanceof Ci.nsIFileURL) {
      F.LOG("_directory="+uri.file.parent.parent.path);
      return uri.file.parent.parent;
    }
    throw new Error("not resolved");
  })(),

  init: function() {            // does creates icon
    firetray.PrefListener.register(false);

    // version checked during install, so we shouldn't need to care
    let xulVer = Services.appinfo.platformVersion; // Services.vc.compare(xulVer,"2.0a")>=0
    F.LOG("OS=" + this.runtimeOS + ", ABI=" + this.runtimeABI + ", XULrunner=" + xulVer);
    switch (this.runtimeOS) {
    case "Linux":
      Cu.import("resource://firetray/linux/FiretrayStatusIcon.jsm");
      F.LOG('FiretrayStatusIcon imported');
      Cu.import("resource://firetray/linux/FiretrayWindow.jsm");
      F.LOG('FiretrayWindow imported');
      break;
    default:
      F.ERROR("FIRETRAY: only Linux platform supported at this time. Firetray not loaded");
      return false;
    }

    if (this.appId === F.THUNDERBIRD_ID || this.appId === F.SEAMONKEY_ID)
      this.inMailApp = true;
    if (this.appId === F.FIREFOX_ID || this.appId === F.SEAMONKEY_ID)
      this.inBrowserApp = true;
    F.LOG('inMailApp: '+this.inMailApp+', inBrowserApp: '+this.inBrowserApp);

    this.FILENAME_BLANK = firetray.Utils.chromeToPath(
      "chrome://firetray/skin/blank-icon.png");

    VersionChange.init(FIRETRAY_ID, FIRETRAY_VERSION, FIRETRAY_PREF_BRANCH);
    VersionChange.addHook(["install", "upgrade", "reinstall"], firetray.VersionChangeHandler.showReleaseNotes);
    VersionChange.addHook(["upgrade", "reinstall"], firetray.VersionChangeHandler.tryEraseOldOptions);
    VersionChange.addHook(["upgrade", "reinstall"], firetray.VersionChangeHandler.correctMailNotificationType);
    VersionChange.addHook(["upgrade", "reinstall"], firetray.VersionChangeHandler.addIMServerTypePrefMaybe);
    VersionChange.applyHooksAndWatchUninstall();

    firetray.StatusIcon.init();
    firetray.Handler.showHideIcon();
    F.LOG('StatusIcon initialized');

    if (this.inMailApp) {
      try {
        Cu.import("resource://firetray/FiretrayMessaging.jsm");
        if (firetray.Utils.prefService.getBoolPref("mail_notification_enabled")) {
          firetray.Messaging.init();
          firetray.Messaging.updateMsgCountWithCb();
        }
      } catch (x) {
        F.ERROR(x);
        return false;
      }
    }

    Services.obs.addObserver(this, this.getAppStartupTopic(this.appId), false);
    Services.obs.addObserver(this, "xpcom-will-shutdown", false);
    Services.obs.addObserver(this, "profile-change-teardown", false);

    this.preventWarnOnClose();

    this.initialized = true;
    return true;
  },

  shutdown: function() {
    firetray.PrefListener.unregister();

    if (this.inMailApp)
      firetray.Messaging.shutdown();
    firetray.StatusIcon.shutdown();
    firetray.Window.shutdown();
    // watchout order and sufficiency of lib closings (tryCloseLibs())

    Services.obs.removeObserver(this, this.getAppStartupTopic(this.appId), false);
    Services.obs.removeObserver(this, "xpcom-will-shutdown", false);
    Services.obs.removeObserver(this, "profile-change-teardown", false);

    this.appStarted = false;
    this.initialized = false;
    return true;
  },

  observe: function(subject, topic, data) {
    switch (topic) {
    case "sessionstore-windows-restored":
    case "mail-startup-done":
    case "final-ui-startup":
      F.LOG("RECEIVED: "+topic+", launching timer");
      // sessionstore-windows-restored does not come after the realization of
      // all windows... so we wait a little
      firetray.Utils.timer(function() {
        firetray.Handler.appStarted = true;
        F.LOG("*** appStarted ***");
      }, FIRETRAY_DELAY_BROWSER_STARTUP_MILLISECONDS, Ci.nsITimer.TYPE_ONE_SHOT);
      break;
    case "xpcom-will-shutdown":
      F.LOG("xpcom-will-shutdown");
      this.shutdown();
      break;
    case "profile-change-teardown":
      if (data === 'shutdown-persist')
        this.restoreWarnOnClose();
      break;
    default:
    }
  },

  getAppStartupTopic: function(id) {
    switch (id) {
    case F.FIREFOX_ID:
    case F.SEAMONKEY_ID:
      return 'sessionstore-windows-restored';
    case F.THUNDERBIRD_ID:
      return 'mail-startup-done';
    default:
      return 'final-ui-startup';
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
  startupHideWindow: function(winId) {},
  showWindow: function(winId) {},
  showHideAllWindows: function() {},
  activateLastWindow: function(gtkStatusIcon, gdkEvent, userData) {},

  showAllWindows: function() {
    F.LOG("showAllWindows");
    for (let winId in firetray.Handler.windows) {
      if (!firetray.Handler.windows[winId].visible)
        firetray.Handler.showWindow(winId);
    }
  },
  hideAllWindows: function() {
    F.LOG("hideAllWindows");
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
      F.ERROR(ex);
      return null;
    }

    if (iface == "nsIBaseWindow")
      winOut = winInterface[iface];
    else if (iface == "nsIXULWindow")
      winOut = winInterface.getInterface(Ci.nsIXULWindow);
    else {
      F.ERROR("unknown iface '" + iface + "'");
      return null;
    }

    return winOut;
  },

  _getBrowserProperties: function() {
    if (firetray.Handler.appId === F.FIREFOX_ID)
      return "chrome://branding/locale/browserconfig.properties";
    else if (firetray.Handler.appId === F.SEAMONKEY_ID)
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
      F.LOG("home="+home);

      // FIXME: obviously we need to wait to avoid seg fault on jsapi.cpp:827
      // 827         if (t->data.requestDepth) {
      firetray.Utils.timer(function() {
        for(var key in firetray.Handler.windows) break;
        firetray.Handler.windows[key].chromeWin.open(home);
      }, FIRETRAY_DELAY_NOWAIT_MILLISECONDS, Ci.nsITimer.TYPE_ONE_SHOT);
    } catch (x) { F.ERROR(x); }
  },

  openMailMessage: function() {
    try {
      var aURI = Services.io.newURI("mailto:", null, null);
      var msgComposeService = Cc["@mozilla.org/messengercompose;1"]
        .getService(Ci.nsIMsgComposeService);
      msgComposeService.OpenComposeWindowWithURI(null, aURI);
    } catch (x) { F.ERROR(x); }
  },

  quitApplication: function() {
    try {
      firetray.Utils.timer(function() {
        let appStartup = Cc['@mozilla.org/toolkit/app-startup;1']
          .getService(Ci.nsIAppStartup);
        appStartup.quit(Ci.nsIAppStartup.eAttemptQuit);
      }, FIRETRAY_DELAY_NOWAIT_MILLISECONDS, Ci.nsITimer.TYPE_ONE_SHOT);
    } catch (x) { F.ERROR(x); }
  },

  preventWarnOnClose: function() {
    if (!this.inBrowserApp) return;
    let generalTabsPrefs = Services.prefs.getBranch("browser.tabs.");
    this.warnOnCloseTmp = generalTabsPrefs.getBoolPref('warnOnClose');
    F.LOG("warnOnClose saved. was: "+this.warnOnCloseTmp);
    generalTabsPrefs.setBoolPref('warnOnClose', false);
  },
  restoreWarnOnClose: function() {
    if (!this.inBrowserApp && !this.warnOnCloseTmp) return;
    let generalTabsPrefs = Services.prefs.getBranch("browser.tabs.");
    generalTabsPrefs.setBoolPref('warnOnClose', this.warnOnCloseTmp);
    F.LOG("warnOnClose restored to: "+this.warnOnCloseTmp);
  }

}; // firetray.Handler


firetray.PrefListener = new PrefListener(
  "extensions.firetray.",
  function(branch, name) {
    F.LOG('Pref changed: '+name);
    switch (name) {
    case 'hides_single_window':
      firetray.Handler.showHidePopupMenuItems();
      break;
    case 'show_icon_on_hide':
      firetray.Handler.showHideIcon();
      break;
    case 'new_mail_icon_names':
      firetray.StatusIcon.loadThemedIcons();
    case 'message_count_type':
    case 'folder_count_recursive':
      firetray.Messaging.updateMsgCountWithCb();
      break;
    case 'app_mail_icon_names':
    case 'app_browser_icon_names':
    case 'app_default_icon_names':
      firetray.StatusIcon.loadThemedIcons();
    case 'app_icon_type':
      if (firetray.Handler.inMailApp)
        firetray.Messaging.updateMsgCountWithCb();
      else
        firetray.Handler.setIconImageDefault();
      break;
    default:
    }
  });


firetray.VersionChangeHandler = {

  showReleaseNotes: function() {
    firetray.VersionChangeHandler.openTab(FIRETRAY_SPLASH_PAGE+"#v"+FIRETRAY_VERSION);
    firetray.VersionChangeHandler.tryEraseOldOptions();
    firetray.VersionChangeHandler.correctMailNotificationType();
  },

  openTab: function(url) {
    if (firetray.Handler.appId === F.THUNDERBIRD_ID)
      this.openMailTab(url);
    else if (firetray.Handler.appId === F.FIREFOX_ID ||
             firetray.Handler.appId === F.SEAMONKEY_ID)
      this.openBrowserTab(url);
    else
      F.ERROR("unsupported application");
  },

  openMailTab: function(url) {
    let mail3PaneWindow = Services.wm.getMostRecentWindow("mail:3pane");
    if (mail3PaneWindow) {
      var tabmail = mail3PaneWindow.document.getElementById("tabmail");
      mail3PaneWindow.focus();
    }

    if (tabmail) {
      firetray.Utils.timer(function() {
        F.LOG("openMailTab");
        tabmail.openTab("contentTab", {contentPage: url});
      }, FIRETRAY_DELAY_BROWSER_STARTUP_MILLISECONDS, Ci.nsITimer.TYPE_ONE_SHOT);
    }
  },

  openBrowserTab: function(url) {
    let win = Services.wm.getMostRecentWindow("navigator:browser");
    F.LOG("WIN="+win);
    if (win) {
      var mainWindow = win.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
            .getInterface(Components.interfaces.nsIWebNavigation)
            .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
            .rootTreeItem
            .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
            .getInterface(Components.interfaces.nsIDOMWindow);

      mainWindow.setTimeout(function(win){
        F.LOG("openBrowser");
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
    if (firetray.Utils.prefService.getIntPref('message_count_type') ===
        FIRETRAY_MESSAGE_COUNT_TYPE_NEW) {
      firetray.Utils.prefService.setIntPref('mail_notification_type',
        FIRETRAY_NOTIFICATION_NEWMAIL_ICON);
      F.WARN("mail notification type set to newmail icon.");
    }
  },

  addIMServerTypePrefMaybe: function() {
    let mailAccounts = firetray.Utils.getObjPref('mail_accounts');
    let serverTypes = mailAccounts["serverTypes"];

    if (!serverTypes["im"])
      serverTypes["im"] = {"order":6,"excluded":true};

    let prefObj = {"serverTypes":serverTypes, "excludedAccounts":mailAccounts["excludedAccounts"]};
    firetray.Utils.setObjPref('mail_accounts', prefObj);

    F.WARN("server type 'im' added to prefs.");
  }

};
