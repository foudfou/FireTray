/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = [ "firetray" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://firetray/ctypes/linux/gobject.jsm");
Cu.import("resource://firetray/ctypes/linux/gtk.jsm");
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
  ICON_FILENAME_SUFFIX: "22.png",
  ICON_FILENAME_BLANK: null,

  initialized: false,
  appNameOriginal: null,
  appStarted: false,
  appId: null,
  runtimeOS: null,
  inMailApp: false,
  inBrowserApp: false,
  windows: {},
  windowsCount: 0,
  visibleWindowsCount: 0,

  init: function() {            // does creates icon
    firetray.PrefListener.register(false);

    this.appNameOriginal = Services.appinfo.name;
    this.ICON_FILENAME_BLANK = firetray.Utils.chromeToPath(
      "chrome://firetray/skin/blank-icon.png");

    this.runtimeABI = Services.appinfo.XPCOMABI;
    this.runtimeOS = Services.appinfo.OS; // "WINNT", "Linux", "Darwin"
    // version checked during install, so we shouldn't need to care
    let xulVer = Services.appinfo.platformVersion; // Services.vc.compare(xulVer,"2.0a")>=0
    LOG("OS=" + this.runtimeOS + ", ABI=" + this.runtimeABI + ", XULrunner=" + xulVer);
    switch (this.runtimeOS) {
    case "Linux":
      Cu.import("resource://firetray/linux/FiretrayStatusIcon.jsm");
      LOG('FiretrayStatusIcon imported');
      Cu.import("resource://firetray/linux/FiretrayWindow.jsm");
      LOG('FiretrayWindow imported');
      break;
    default:
      ERROR("FIRETRAY: only Linux platform supported at this time. Firetray not loaded");
      return false;
    }

    this.appId = Services.appinfo.ID;
    if (this.appId === THUNDERBIRD_ID || this.appId === SEAMONKEY_ID)
      this.inMailApp = true;
    if (this.appId === FIREFOX_ID || this.appId === SEAMONKEY_ID)
      this.inBrowserApp = true;
    LOG('inMailApp: '+this.inMailApp+', inBrowserApp: '+this.inBrowserApp);

    firetray.StatusIcon.init();
    firetray.Handler.showHideIcon();
    LOG('StatusIcon initialized');

    if (this.inMailApp) {
      try {
        Cu.import("resource://firetray/FiretrayMessaging.jsm");
        if (firetray.Utils.prefService.getBoolPref("mail_notification_enabled")) {
          firetray.Messaging.init();
          firetray.Messaging.updateMsgCount();
        }
      } catch (x) {
        ERROR(x);
        return false;
      }
    }

    Services.obs.addObserver(this, this.getAppStartupTopic(this.appId), false);
    Services.obs.addObserver(this, "xpcom-will-shutdown", false);

    let welcome = function(ver) {
      firetray.Handler.openTab(FIRETRAY_SPLASH_PAGE+"#"+ver);
      firetray.Handler.tryEraseOldOptions();
      firetray.Handler.correctMailNotificationType();
    };
    VersionChange.setInstallHook(welcome);
    VersionChange.setUpgradeHook(welcome);
    VersionChange.setReinstallHook(welcome);
    VersionChange.watch();

    this.initialized = true;
    return true;
  },

  shutdown: function() {
    firetray.PrefListener.unregister();

    if (this.inMailApp)
      firetray.Messaging.shutdown();
    firetray.StatusIcon.shutdown();
    firetray.Window.shutdown();

    firetray.Utils.tryCloseLibs([gobject, glib, gtk]);

    Services.obs.removeObserver(this, this.getAppStartupTopic(this.appId), false);
    Services.obs.removeObserver(this, "xpcom-will-shutdown", false);

    this.appStarted = false;
    this.initialized = false;
    return true;
  },

  observe: function(subject, topic, data) {
    switch (topic) {
    case "sessionstore-windows-restored":
    case "mail-startup-done":
    case "final-ui-startup":
      LOG("RECEIVED: "+topic+", launching timer");
      // sessionstore-windows-restored does not come after the realization of
      // all windows... so we wait a little
      firetray.Utils.timer(function() {
        firetray.Handler.appStarted = true;
        LOG("*** appStarted ***");
      }, FIRETRAY_DELAY_BROWSER_STARTUP_MILLISECONDS, Ci.nsITimer.TYPE_ONE_SHOT);
      break;
    case "xpcom-will-shutdown":
      LOG("xpcom-will-shutdown");
      this.shutdown();
      break;
    default:
    }
  },

  getAppStartupTopic: function(id) {
    switch (id) {
    case FIREFOX_ID:
    case SEAMONKEY_ID:
      return 'sessionstore-windows-restored';
    case THUNDERBIRD_ID:
      return 'mail-startup-done';
    default:
      return 'final-ui-startup';
    }
  },

  // these get overridden in OS-specific Icon/Window handlers
  setIconImage: function(icon) {},
  setIconImageFromFile: function(filename) {},
  setIconImageDefault: function() {},
  setIconText: function(text, color) {},
  setIconTooltip: function(localizedMessage) {},
  setIconTooltipDefault: function() {},
  setIconVisibility: function(visible) {},
  registerWindow: function(win) {},
  unregisterWindow: function(win) {},
  getWindowIdFromChromeWindow: function(win) {},
  hideSingleWindow: function(winId) {},
  showSingleWindow: function(winId) {},
  showHideAllWindows: function() {},

  showAllWindows: function() {
    LOG("showAllWindows");
    for (let winId in firetray.Handler.windows) {
      if (!firetray.Handler.windows[winId].visibility)
        firetray.Handler.showSingleWindow(winId);
    }
  },
  hideAllWindows: function() {
    LOG("hideAllWindows");
    for (let winId in firetray.Handler.windows) {
      if (firetray.Handler.windows[winId].visibility)
        firetray.Handler.hideSingleWindow(winId);
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
      ERROR(ex);
      return null;
    }

    if (iface == "nsIBaseWindow")
      winOut = winInterface[iface];
    else if (iface == "nsIXULWindow")
      winOut = winInterface.getInterface(Ci.nsIXULWindow);
    else {
      ERROR("unknown iface '" + iface + "'");
      return null;
    }

    return winOut;
  },

  _getBrowserProperties: function() {
    if (firetray.Handler.appId === FIREFOX_ID)
      return "chrome://branding/locale/browserconfig.properties";
    else if (firetray.Handler.appId === SEAMONKEY_ID)
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
      LOG("home="+home);

      // FIXME: obviously we need to wait to avoid seg fault on jsapi.cpp:827
      // 827         if (t->data.requestDepth) {
      firetray.Utils.timer(function() {
        for(var key in firetray.Handler.windows) break;
        firetray.Handler.windows[key].chromeWin.open(home);
      }, FIRETRAY_DELAY_NOWAIT_MILLISECONDS, Ci.nsITimer.TYPE_ONE_SHOT);
    } catch (x) { ERROR(x); }
  },

  openMailMessage: function() {
    try {
      var aURI = Services.io.newURI("mailto:", null, null);
      var msgComposeService = Cc["@mozilla.org/messengercompose;1"]
        .getService(Ci.nsIMsgComposeService);
      msgComposeService.OpenComposeWindowWithURI(null, aURI);
    } catch (x) { ERROR(x); }
  },

  openTab: function(url) {
    let appId = Services.appinfo.ID;
    if (appId === THUNDERBIRD_ID)
      this.openMailTab(url);
    else if (appId === FIREFOX_ID || appId === SEAMONKEY_ID)
      this.openBrowserTab(url);
    else
      ERROR("unsupported application");
  },

  openMailTab: function(url) {
    let mail3PaneWindow = Services.wm.getMostRecentWindow("mail:3pane");
    if (mail3PaneWindow) {
      var tabmail = mail3PaneWindow.document.getElementById("tabmail");
      mail3PaneWindow.focus();
    }

    if (tabmail) {
      firetray.Utils.timer(function() {
        LOG("openMailTab");
        tabmail.openTab("contentTab", {contentPage: url});
      }, FIRETRAY_DELAY_BROWSER_STARTUP_MILLISECONDS, Ci.nsITimer.TYPE_ONE_SHOT);
    }
  },

  openBrowserTab: function(url) {
    let win = Services.wm.getMostRecentWindow("navigator:browser");
    LOG("WIN="+win);
    if (win) {
      var mainWindow = win.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
            .getInterface(Components.interfaces.nsIWebNavigation)
            .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
            .rootTreeItem
            .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
            .getInterface(Components.interfaces.nsIDOMWindow);

      mainWindow.setTimeout(function(win){
        LOG("openBrowser");
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
        firetray.Utils.prefService.clearUserPref(oldOptions[i]);
      } catch (x) {}
    }
  },

  correctMailNotificationType: function() {
    if (firetray.Utils.prefService.getIntPref('message_count_type') ===
        FIRETRAY_MESSAGE_COUNT_TYPE_NEW)
      firetray.Utils.prefService.setIntPref('mail_notification_type',
        FIRETRAY_NOTIFICATION_NEWMAIL_ICON);
  },

  quitApplication: function() {
    try {
      firetray.Utils.timer(function() {
        let appStartup = Cc['@mozilla.org/toolkit/app-startup;1']
          .getService(Ci.nsIAppStartup);
        appStartup.quit(Ci.nsIAppStartup.eAttemptQuit);
      }, FIRETRAY_DELAY_NOWAIT_MILLISECONDS, Ci.nsITimer.TYPE_ONE_SHOT);
    } catch (x) { ERROR(x); }
  }

}; // firetray.Handler


firetray.PrefListener = new PrefListener(
  "extensions.firetray.",
  function(branch, name) {
    LOG('Pref changed: '+name);
    switch (name) {
    case 'hides_single_window':
      firetray.Handler.showHidePopupMenuItems();
      break;
    case 'show_icon_on_hide':
      firetray.Handler.showHideIcon();
      break;
    case 'message_count_type':
      firetray.Messaging.updateMsgCount();
      break;
    default:
    }
  });
