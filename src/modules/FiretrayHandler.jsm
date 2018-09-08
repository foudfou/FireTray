/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
"use strict";

var EXPORTED_SYMBOLS = [ "firetray" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = ChromeUtils;

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
  timers: {},
  inBrowserApp: false,
  inMailApp: false,
  appHasChat: false,
  appStarted: false,
  useAppind: false,             // initialized in StatusIcon
  windows: {},
  get windowsCount() {return Object.keys(this.windows).length;},
  get visibleWindowsCount() {
    let count = 0;
    for (let wid in firetray.Handler.windows) {
      if (firetray.Handler.windows[wid].visible) count += 1;
    }
    return count;
  },
  observedTopics: {},
  ctypesLibs: {},               // {"lib1": lib1, "lib2": lib2}

  app: (function(){return {
    id: Services.appinfo.ID,
    name: Services.appinfo.name,
    // Services.vc.compare(version,"2.0a")>=0
    version: Services.appinfo.platformVersion,
    ABI: Services.appinfo.XPCOMABI,
    OS: Services.appinfo.OS.toLowerCase(), // "WINNT", "Linux", "Darwin"
    widgetTk: Services.appinfo.widgetToolkit,
  };})(),

  support: {chat: false, winnt: false},

  init: function() {            // does creates icon
    firetray.PrefListener.register(false);
    firetray.MailChatPrefListener.register(false);

    log.info("OS=" + this.app.OS +
             ", ABI=" + this.app.ABI +
             ", platformVersion=" + this.app.version +
             ", widgetToolkit=" + this.app.widgetTk);
    if (FIRETRAY_OS_SUPPORT.indexOf(this.app.OS) < 0) {
      let platforms = FIRETRAY_OS_SUPPORT.join(", ");
      log.error("Only "+platforms+" platform(s) supported at this time. Firetray not loaded");
      return false;
    } else if (this.app.OS == "winnt" &&
               Services.vc.compare(this.app.version,"27.0") < 0) {
      log.error("FireTray needs Gecko 27 and above on Windows.");
      return false;
    } else if (this.app.OS == "freebsd") {
      this.app.OS = "linux";
    }

    Cu.import("resource://firetray/"+this.app.OS+"/FiretrayStatusIcon.jsm");
    log.debug("FiretrayStatusIcon "+this.app.OS+" imported");
    log.info("useAppind="+firetray.Handler.useAppind);
    Cu.import("resource://firetray/"+this.app.OS+"/FiretrayWindow.jsm");
    log.debug("FiretrayWindow "+this.app.OS+" imported");

    this.support['chat']  =
      ['linux'].indexOf(this.app.OS) > -1 && !this.useAppind;
    this.support['winnt'] =
      ['winnt'].indexOf(firetray.Handler.app.OS) > -1;

    if (this.app.id === FIRETRAY_APP_DB['thunderbird']['id'] ||
        this.app.id === FIRETRAY_APP_DB['seamonkey']['id'])
      this.inMailApp = true;
    if (this.app.id === FIRETRAY_APP_DB['firefox']['id'] ||
        this.app.id === FIRETRAY_APP_DB['seamonkey']['id'])
      this.inBrowserApp = true;
    if (this.app.id === FIRETRAY_APP_DB['thunderbird']['id'] &&
        Services.vc.compare(this.app.version,"15.0")>=0)
      this.appHasChat = true;
    log.info('inMailApp='+this.inMailApp+', inBrowserApp='+this.inBrowserApp+
      ', appHasChat='+this.appHasChat);

    firetray.Window.init();
    firetray.StatusIcon.init();
    firetray.Handler.showHideIcon();
    log.debug('StatusIcon initialized');

    if (this.inMailApp) {
      try {
        Cu.import("resource:///modules/mailServices.js");
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

    let chatIsProvided = this.isChatProvided();
    log.info('isChatProvided='+chatIsProvided);
    if (chatIsProvided) {
      if (this.support['chat']) {
        Cu.import("resource://firetray/FiretrayMessaging.jsm"); // needed for existsChatAccount
        Cu.import("resource://firetray/"+this.app.OS+"/FiretrayChat.jsm");
        firetray.Utils.addObservers(firetray.Handler, [
          "account-added", "account-removed"]);
        if (firetray.Utils.prefService.getBoolPref("chat_icon_enable") &&
            this.existsChatAccount())
          firetray.Chat.init();
      } else {
        log.warn("Chat not supported for this environment. Chat not loaded");
      }
    }

    firetray.Utils.addObservers(firetray.Handler,
      [ "xpcom-will-shutdown", "profile-change-teardown" ]);
    if (this.app.id === FIRETRAY_APP_DB['firefox']['id'] ||
        this.app.id === FIRETRAY_APP_DB['seamonkey']['id']) {
      firetray.Utils.addObservers(firetray.Handler, [ "sessionstore-windows-restored" ]);
    } else if (this.app.id === FIRETRAY_APP_DB['thunderbird']['id']) {
      this.restoredWindowsCount = this.readTBRestoreWindowsCount();
      log.info("restoredWindowsCount="+this.restoredWindowsCount);
      if (!this.restoredWindowsCount) {
        log.warn("session file could not be read");
        this.restoredWindowsCount = 1; // default
      }
      firetray.Utils.addObservers(firetray.Handler, [ "mail-startup-done" ]);
    } else {
      firetray.Utils.addObservers(firetray.Handler, [ "final-ui-startup" ]);
    }

    this.disablePrefsTmp();

    VersionChange.init(FIRETRAY_ID, FIRETRAY_VERSION, FIRETRAY_PREF_BRANCH);
    let vc = VersionChange, vch = firetray.VersionChangeHandler;
    vc.addHook(["install", "upgrade", "reinstall"], vch.showReleaseNotes);
    vc.addHook(["upgrade", "reinstall"], vch.deleteOrRenameOldOptions);
    vc.addHook(["upgrade", "reinstall"], vch.correctMailNotificationType);
    vc.addHook(["upgrade", "reinstall"], vch.correctMailServerTypes);
    if (this.inMailApp) {
      vc.addHook(["upgrade", "reinstall"], firetray.Messaging.cleanExcludedAccounts);
    }
    vc.applyHooksAndWatchUninstall();

    this.initialized = true;
    return true;
  },

  shutdown: function() {
    log.debug("Disabling Handler");
    if (firetray.Handler.isChatProvided() && firetray.Handler.support['chat']
        && firetray.Chat.initialized)
      firetray.Chat.shutdown();

    if (this.inMailApp)
      firetray.Messaging.shutdown();
    firetray.StatusIcon.shutdown();
    firetray.Window.shutdown();
    this.tryCloseLibs();

    firetray.Utils.removeAllObservers(this);

    firetray.MailChatPrefListener.unregister(false);
    firetray.PrefListener.unregister();

    this.appStarted = false;
    this.initialized = false;
    return true;
  },

  isChatEnabled: function() {
    return this.isChatProvided() &&
      firetray.Utils.prefService.getBoolPref("chat_icon_enable");
  },

  isChatProvided: function() {
    return this.appHasChat && Services.prefs.getBoolPref("mail.chat.enabled");
  },

  subscribeLibsForClosing: function(libs) {
    for (let i=0, len=libs.length; i<len; ++i) {
      let lib = libs[i];
      if (!this.ctypesLibs.hasOwnProperty(lib.name))
        this.ctypesLibs[lib.name] = lib;
    }
  },

  tryCloseLibs: function() {
    try {
      for (let libName in this.ctypesLibs) {
        let lib = this.ctypesLibs[libName];
        if (lib.available())
          lib.close();
      };
    } catch(x) { log.error(x); }
  },

  readTBRestoreWindowsCount: function() {
    Cu.import("resource:///modules/IOUtils.js");
    let sessionFile = Services.dirsvc.get("ProfD", Ci.nsIFile);
    sessionFile.append("session.json");
    var initialState = null;
    if (sessionFile.exists()) {
      let data = IOUtils.loadFileToString(sessionFile);
      if (!data) return null;
      try {
        initialState = JSON.parse(data);
      } catch(x) {}
      if (!initialState) return null;

      return  initialState.windows.length;
    }
    return null;
  },

  // FIXME: this should definetely be done in Chat, but IM accounts
  // seem not be initialized at early stage (Exception... "'TypeError:
  // this._items is undefined' when calling method:
  // [nsISimpleEnumerator::hasMoreElements]"), and we're unsure if we should
  // initAccounts() ourselves...
  existsChatAccount: function() {
    let accounts = firetray.Messaging.Accounts();
    for (let accountServer of accounts)
      if (accountServer.type === FIRETRAY_ACCOUNT_SERVER_TYPE_IM)  {
        log.debug("found im server: "+accountServer.prettyName);
        return true;
      }

    return false;
  },

  startupDone: function() {
    firetray.Handler.timers['startup-done'] =
      firetray.Utils.timer(FIRETRAY_DELAY_STARTUP_MILLISECONDS,
        Ci.nsITimer.TYPE_ONE_SHOT, function() {
          firetray.Handler.appStarted = true;
          log.info("*** appStarted ***");

          if (firetray.Handler.inMailApp) {
            firetray.Messaging.addPrefObserver();
          }
        });
  },

  observe: function(subject, topic, data) {
    switch (topic) {

    case "sessionstore-windows-restored":
      // sessionstore-windows-restored does not come after the realization of
      // all windows... so we wait a little
    case "final-ui-startup":    // subject=ChromeWindow
      log.debug(topic+": "+subject+","+data);
      firetray.Utils.removeObservers(firetray.Handler, [ topic ]);
      firetray.Handler.startupDone();
      break;

    case "mail-startup-done": // or xul-window-visible, mail-tabs-session-restored ?
      log.debug(topic+": "+subject+","+data);
      if (firetray.Handler.restoredWindowsCount &&
          !--firetray.Handler.restoredWindowsCount) {
        firetray.Utils.removeObservers(firetray.Handler, [ topic ]);
        firetray.Handler.startupDone();
      }
      break;

    case "xpcom-will-shutdown":
      log.debug("xpcom-will-shutdown");
      this.shutdown();
      break;
    case "profile-change-teardown": // also found "quit-application-granted"
      if (data === 'shutdown-persist')
        this.restorePrefsTmp();
      break;

    case "account-removed":     // emitted by IM
      if (!this.existsChatAccount())
        firetray.Handler.toggleChat(false);
      break;
    case "account-added":       // emitted by IM
      if (!firetray.Chat.initialized)
        firetray.Handler.toggleChat(true);
      break;

    default:
      log.warn("unhandled topic: "+topic);
    }
  },

  toggleChat: function(enabled) {
    log.debug("Chat icon enable="+enabled);

    if (enabled) {
      firetray.Chat.init();
      for (let winId in firetray.Handler.windows) {
        firetray.Chat.attachSelectListeners(firetray.Handler.windows[winId].chromeWin);
      }

    } else {
      for (let winId in firetray.Handler.windows) {
        firetray.Chat.detachSelectListeners(firetray.Handler.windows[winId].chromeWin);
      }
      firetray.Chat.shutdown();
    }
  },

  // these get overridden in OS-specific Icon/Window handlers
  loadIcons: function() {},
  loadImageCustom: function(prefname) {},
  setIconImageDefault: function() {},
  setIconImageNewMail: function() {},
  setIconImageCustom: function(prefname) {},
  setIconText: function(text, color) {},
  setIconTooltip: function(localizedMessage) {},
  setIconTooltipDefault: function() {},
  setIconVisibility: function(visible) {},
  registerWindow: function(win) {},
  unregisterWindow: function(win) {},
  hideWindow: function(winId) {},
  showWindow: function(winId) {},
  showAllWindowsAndActivate:function() {}, // linux
  getActiveWindow: function() {},
  windowGetAttention: function(winId) {},
  showHidePopupMenuItems: function() {}, // linux
  addPopupWindowItemAndSeparatorMaybe: function(wid) {}, // winnt
  removePopupWindowItemAndSeparatorMaybe: function(wid) {}, // winnt

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

  showHideAllWindows: function() {
    log.debug("showHideAllWindows");
    log.debug("  visibleWindowsCount="+firetray.Handler.visibleWindowsCount+" / windowsCount="+firetray.Handler.windowsCount);
    let visibilityRate = firetray.Handler.visibleWindowsCount /
          firetray.Handler.windowsCount;
    log.debug("  visibilityRate="+visibilityRate);
    if ((0.5 < visibilityRate) && (visibilityRate < 1)
        || visibilityRate === 0) { // TODO: should be configurable
      firetray.Handler.showAllWindows();
    } else {
      firetray.Handler.hideAllWindows();
    }
  },

  onMinimize: function(wid) {
    log.debug("onMinimize");
    let hidden = false;
    if (firetray.Utils.prefService.getBoolPref('hides_on_minimize')) {
      if (firetray.Utils.prefService.getBoolPref('hides_single_window'))
        firetray.Handler.hideWindow(wid);
      else
        firetray.Handler.hideAllWindows();
      hidden = true;
    }
    return hidden;
  },

  showHideIcon: function(msgCount) {
    let allWindowsVisible = true;
    if (firetray.Utils.prefService.getBoolPref('show_icon_on_hide')) {
      allWindowsVisible =
        (firetray.Handler.visibleWindowsCount !== firetray.Handler.windowsCount);
    }

    let msgCountPositive = true;
    if (firetray.Utils.prefService.getBoolPref('nomail_hides_icon') &&
        ("undefined" !== typeof(msgCount))) {
      msgCountPositive = (msgCount > 0);
      log.info("__msgCountPositive="+msgCountPositive);
    }

    log.debug("allWindowsVisible="+allWindowsVisible+" msgCountPositive="+msgCountPositive);
    firetray.Handler.setIconVisibility(allWindowsVisible && msgCountPositive);
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
    if (firetray.Handler.app.id === FIRETRAY_APP_DB['firefox']['id'])
      return "chrome://branding/locale/browserconfig.properties";
    else if (firetray.Handler.app.id === FIRETRAY_APP_DB['seamonkey']['id'])
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

    if (url) {
      try {
        Services.io.newURI(url, null, null);
      } catch (e) {
        url = "http://" + url;
      }
    }
    else {
      var SBS = Cc["@mozilla.org/intl/stringbundle;1"].getService(Ci.nsIStringBundleService);
      var configBundle = SBS.createBundle(firetray.Handler._getBrowserProperties());
      url = configBundle.GetStringFromName(prefDomain);
    }

    return url;
  },

  openPrefWindow: function() {
    if (null == firetray.Handler._preferencesWindow ||
        firetray.Handler._preferencesWindow.closed) {
      for(var first in firetray.Handler.windows) break;
      firetray.Handler._preferencesWindow =
        firetray.Handler.windows[first].chromeWin.openDialog(
          "chrome://firetray/content/options.xul", null,
          "chrome,titlebar,toolbar,centerscreen", null);
    }

    firetray.Handler._preferencesWindow.focus();
  },

  openBrowserWindow: function() {
    try {
      var home = firetray.Handler._getHomePage();
      log.debug("home="+home);

      // FIXME: obviously we need to wait to avoid seg fault on jsapi.cpp:827
      // 827         if (t->data.requestDepth) {
      firetray.Handler.timers['open-browser-window'] =
        firetray.Utils.timer(FIRETRAY_DELAY_NOWAIT_MILLISECONDS,
          Ci.nsITimer.TYPE_ONE_SHOT, function() {
            for(var first in firetray.Handler.windows) break;
            firetray.Handler.windows[first].chromeWin.open(home);
          });
    } catch (x) { log.error(x); }
  },

  openMailMessage: function() {
    try {
      var aURI = Services.io.newURI("mailto:", null, null);
      MailServices.compose.OpenComposeWindowWithURI(null, aURI);
    } catch (x) { log.error(x); }
  },

  quitApplication: function() {
    try {
      firetray.Handler.timers['quit-application'] =
        firetray.Utils.timer(FIRETRAY_DELAY_NOWAIT_MILLISECONDS,
          Ci.nsITimer.TYPE_ONE_SHOT, function() {
            let appStartup = Cc['@mozilla.org/toolkit/app-startup;1']
                  .getService(Ci.nsIAppStartup);
            appStartup.quit(Ci.nsIAppStartup.eAttemptQuit);
          });
    } catch (x) { log.error(x); }
  },

  prefsDisable: [
    {cond: function(){return firetray.Handler.inBrowserApp;},
     branch: "browser.tabs.", pref: "warnOnClose", bak:null},
    {cond: function(){return firetray.Handler.inMailApp;},
     branch: "mail.biff.", pref: "show_tray_icon", bak:null}
  ],
  disablePrefsTmp: function() {
    this.prefsDisable.forEach(function(pref){
      if (!pref.cond()) return;
      try {
        let branch = Services.prefs.getBranch(pref.branch);
        pref.bak = branch.getBoolPref(pref.pref);
        log.debug(pref.pref+" saved. was: "+pref.bak);
        branch.setBoolPref(pref.pref, false);
      } catch(x) {}
    });
  },
  restorePrefsTmp: function() {
    this.prefsDisable.forEach(function(pref){
      if (!pref.cond() || !pref.bak) return;
      let branch = Services.prefs.getBranch(pref.branch);
      branch.setBoolPref(pref.pref, pref.bak);
      log.debug(pref.pref+" restored to: "+pref.bak);
    });
  },

  excludeOtherShowIconPrefs: function(prefName) {
    if (prefName !== 'nomail_hides_icon')
      firetray.Utils.prefService.setBoolPref('nomail_hides_icon', false);
    if (prefName !== 'show_icon_on_hide')
      firetray.Utils.prefService.setBoolPref('show_icon_on_hide', false);
  }

}; // firetray.Handler


// FIXME: since prefs can also be changed from config editor, we need to
// 1. observe *all* firetray prefs, and 2. change options' UI accordingly !
firetray.PrefListener = new PrefListener(
  FIRETRAY_PREF_BRANCH,
  function(branch, name) {
    log.debug('____Pref changed: '+name);
    switch (name) {
    case 'hides_single_window':
      firetray.Handler.showHidePopupMenuItems();
      break;
    case 'show_icon_on_hide':
      if (firetray.Utils.prefService.getBoolPref(name))
        firetray.Handler.excludeOtherShowIconPrefs(name);
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
    case 'mail_notification_type':
    case 'icon_text_color':
      firetray.Messaging.updateIcon();
      break;
    case 'new_mail_icon_names':
      firetray.Handler.loadIcons();
    case 'excluded_folders_flags':
    case 'folder_count_recursive':
    case 'mail_accounts':
    case 'message_count_type':
    case 'only_favorite_folders':
      firetray.Messaging.updateMsgCountWithCb();
      break;
    case 'nomail_hides_icon':
      if (firetray.Utils.prefService.getBoolPref(name))
        firetray.Handler.excludeOtherShowIconPrefs(name);
      else
        firetray.Handler.setIconVisibility(true);
      firetray.Messaging.updateMsgCountWithCb();
      break;
    case 'app_mail_icon_names':
    case 'app_browser_icon_names':
    case 'app_default_icon_names':
      firetray.Handler.loadIcons(); // linux
    case 'app_icon_custom':
    case 'mail_icon_custom':
      firetray.Handler.loadImageCustom(name); // winnt
      firetray.Handler.setIconImageCustom(name);
    case 'app_icon_type':
      firetray.Handler.setIconImageDefault();
      if (firetray.Handler.inMailApp)
        firetray.Messaging.updateMsgCountWithCb();
      break;

    case 'chat_icon_enable':
      firetray.Handler.toggleChat(firetray.Handler.isChatEnabled());
      break;

    case 'chat_icon_blink':
      if (!firetray.ChatStatusIcon.isBlinking)
        return;
      let startBlinking = firetray.Utils.prefService.getBoolPref('chat_icon_blink');
      if (startBlinking) {
        firetray.Chat.startGetAttention();
      } else {
        firetray.Chat.stopGetAttention();
      }
      break;

    case 'chat_icon_blink_style':
      if (!firetray.Utils.prefService.getBoolPref('chat_icon_blink') ||
          !firetray.ChatStatusIcon.isBlinking)
        break;

      firetray.ChatStatusIcon.toggleBlinkStyle(
        firetray.Utils.prefService.getIntPref("chat_icon_blink_style"));
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
      let enableChatCond =
            (firetray.Handler.appHasChat &&
             firetray.Utils.prefService.getBoolPref("chat_icon_enable") &&
             firetray.Handler.support['chat']);
      if (!enableChatCond) return;

      if (Services.prefs.getBoolPref("mail.chat.enabled")) {
        if (!firetray.Chat) {
          Cu.import("resource://firetray/FiretrayMessaging.jsm"); // needed for existsChatAccount
          Cu.import("resource://firetray/linux/FiretrayChat.jsm");
          firetray.Utils.addObservers(firetray.Handler, [
            "account-added", "account-removed"]);
        }
        if (firetray.Handler.existsChatAccount())
          firetray.Handler.toggleChat(true);

      } else {
        firetray.Handler.toggleChat(false);
      }
      break;
    default:
    }
  });

firetray.VersionChangeHandler = {

  showReleaseNotes: function() {
    firetray.VersionChangeHandler.openTab(FIRETRAY_SPLASH_PAGE+"#release-notes");
  },

  openTab: function(url) {
    log.info("app.id="+firetray.Handler.app.id);
    if (firetray.Handler.app.id === FIRETRAY_APP_DB['thunderbird']['id'])
      this.openMailTab(url);

    else if (firetray.Handler.app.id === FIRETRAY_APP_DB['firefox']['id'] ||
             firetray.Handler.app.id === FIRETRAY_APP_DB['seamonkey']['id'])
      this.openBrowserTab(url);

    else if (firetray.Handler.app.id === FIRETRAY_APP_DB['zotero']['id']) {
      let win = null;
      if (win = Services.wm.getMostRecentWindow("zotero:basicViewer")) {
        win.loadURI(uri);
      } else if (win = Services.wm.getMostRecentWindow("navigator:browser")) {
        win.openDialog("chrome://zotero/content/standalone/basicViewer.xul",
                       "basicViewer",
                       "chrome,resizable,centerscreen,menubar,scrollbars", url);
      } else
        log.error("Zotero main-window not found");

    } else {
      this.openSystemBrowser(url);
    }
  },

  openMailTab: function(url) {
    let mail3PaneWindow = Services.wm.getMostRecentWindow("mail:3pane");
    if (mail3PaneWindow) {
      var tabmail = mail3PaneWindow.document.getElementById("tabmail");
      mail3PaneWindow.focus();
    }

    if (tabmail) {
      firetray.Handler.timers['open-mail-tab'] =
        firetray.Utils.timer(FIRETRAY_DELAY_STARTUP_MILLISECONDS,
          Ci.nsITimer.TYPE_ONE_SHOT, function() {
            log.debug("openMailTab");
            tabmail.openTab("contentTab", {contentPage: url});
          });
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

  openSystemBrowser: function(url) {
    log.debug("openSystemBrowser");
    try {
      var uri = Services.io.newURI(url, null, null);
      var handler = Cc['@mozilla.org/uriloader/external-protocol-service;1']
            .getService(Ci.nsIExternalProtocolService)
            .getProtocolHandlerInfo('http');
      handler.preferredAction = Ci.nsIHandlerInfo.useSystemDefault;
      handler.launchWithURI(uri, null);
    } catch (e) {log.error(e);}
  },

  deleteOrRenameOldOptions: function() {
    let v0_3_Opts = [
      "close_to_tray", "minimize_to_tray", "start_minimized", "confirm_exit",
      "restore_to_next_unread", "mail_count_type", "show_mail_count",
      "dont_count_spam", "dont_count_archive", "dont_count_drafts",
      "dont_count_sent", "dont_count_templates", "show_mail_notification",
      "show_icon_only_minimized", "use_custom_normal_icon",
      "use_custom_special_icon", "custom_normal_icon", "custom_special_icon",
      "text_color", "scroll_to_hide", "scroll_action", "grab_multimedia_keys",
      "hide_show_mm_key", "accounts_to_exclude" ];
    let v0_4_0b2_Opts = [ 'mail_notification' ];
    let oldOpts = v0_3_Opts.concat(v0_4_0b2_Opts);

    for (let i=0, len=oldOpts.length; i<len; ++i) {
      try {
        let option = oldOpts[i];
        firetray.Utils.prefService.clearUserPref(option);
      } catch (x) {}
    }

    let v0_5_0b1_Renames = {
      'mail_urgency_hint': 'mail_get_attention',
      'app_icon_filename': 'app_icon_custom',
      'custom_mail_icon': 'mail_icon_custom'
    };
    oldOpts = v0_5_0b1_Renames;

    let prefSrv = firetray.Utils.prefService;
    for (let opt in oldOpts) {
      log.debug("opt rename: "+opt);
      if (prefSrv.prefHasUserValue(opt)) {
        let prefType = prefSrv.getPrefType(opt);
        switch (prefType) {
        case Ci.nsIPrefBranch.PREF_STRING:
          prefSrv.setCharPref(oldOpts[opt], prefSrv.getCharPref(opt));
          break;
        case Ci.nsIPrefBranch.PREF_INT:
          prefSrv.setIntPref(oldOpts[opt], prefSrv.getIntPref(opt));
          break;
        case Ci.nsIPrefBranch.PREF_BOOL:
          prefSrv.setBoolPref(oldOpts[opt], prefSrv.getBoolPref(opt));
          break;
        default:
          log.error("Unknow pref type: "+prefType);
        }
      }
      try { prefSrv.clearUserPref(opt); } catch (x) {}
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
