/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = [ "firetray" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://firetray/ctypes/gobject.jsm");
Cu.import("resource://firetray/ctypes/gtk.jsm");
Cu.import("resource://firetray/commons.js");

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
  initialized: false,
  appNameOriginal: null,
  FILENAME_DEFAULT: null,
  FILENAME_SUFFIX: "32.png",
  FILENAME_BLANK: null,
  FILENAME_NEWMAIL: null,
  runtimeOS: null,
  mozAppId: null,
  inMailApp: false,
  inBrowserApp: false,
  windows: {},
  windowsCount: 0,
  visibleWindowsCount: 0,

  init: function() {            // does creates icon
    this.appNameOriginal = Services.appinfo.name;
    this.FILENAME_DEFAULT = firetray.Utils.chromeToPath(
      "chrome://firetray/skin/" +  this.appNameOriginal.toLowerCase() + this.FILENAME_SUFFIX);
    this.FILENAME_BLANK = firetray.Utils.chromeToPath(
      "chrome://firetray/skin/blank-icon.png");
    this.FILENAME_NEWMAIL = firetray.Utils.chromeToPath(
      "chrome://firetray/skin/message-mail-new.png");

    this.runtimeABI = Services.appinfo.XPCOMABI;
    this.runtimeOS = Services.appinfo.OS; // "WINNT", "Linux", "Darwin"
    // version checked during install, so we shouldn't need to care
    let xulVer = Services.appinfo.platformVersion; // Services.vc.compare(xulVer,"2.0a")>=0
    LOG("OS=" + this.runtimeOS + ", ABI=" + this.runtimeABI + ", XULrunner=" + xulVer);
    switch (this.runtimeOS) {
    case "Linux":
      Cu.import("resource://firetray/gtk2/FiretrayStatusIcon.jsm");
      LOG('FiretrayStatusIcon imported');
      Cu.import("resource://firetray/gtk2/FiretrayWindow.jsm");
      LOG('FiretrayWindow imported');
      break;
    default:
      ERROR("FIRETRAY: only Linux platform supported at this time. Firetray not loaded");
      return false;
    }

    this.mozAppId = Services.appinfo.ID;
    if (this.mozAppId === THUNDERBIRD_ID || this.mozAppId === SEAMONKEY_ID)
      this.inMailApp = true;
    if (this.mozAppId === FIREFOX_ID || this.mozAppId === SEAMONKEY_ID)
      this.inBrowserApp = true;
    LOG('inMailApp: '+this.inMailApp+', inBrowserApp: '+this.inBrowserApp);

    firetray.StatusIcon.init();
    LOG('StatusIcon initialized');

    if (this.inMailApp) {
      try {
        Cu.import("resource://firetray/FiretrayMessaging.jsm");
        let prefMailNotification = firetray.Utils.prefService.getIntPref("mail_notification");
        if (prefMailNotification !== FT_NOTIFICATION_DISABLED) {
          firetray.Messaging.init();
          firetray.Messaging.updateUnreadMsgCount();
        }
      } catch (x) {
        ERROR(x);
        return false;
      }
    }

    Services.obs.addObserver(this, this.getAppStartupTopic(this.mozAppId), false);

    this.initialized = true;
    return true;
  },

  shutdown: function() {
    if (this.inMailApp)
      firetray.Messaging.shutdown();

    switch (this.runtimeOS) {
    case "Linux":
      firetray.StatusIcon.shutdown();
      break;
    default:
      ERROR("runtimeOS unknown or undefined.");
      return false;
    }

    Services.obs.removeObserver(this, this.getAppStartupTopic(this.mozAppId), false);

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
      var timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
      timer.initWithCallback(function() {
        firetray.Handler.appStarted = true;
        LOG("*** appStarted ***");
      }, FIRETRAY_BROWSER_STARTUP_DELAY_MILLISECONDS, Ci.nsITimer.TYPE_ONE_SHOT);
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

  // these get overridden in OS-specific Window handlers
  setImage: function(filename) {},
  setImageDefault: function() {},
  setText: function(text, color) {},
  setTooltip: function(localizedMessage) {},
  setTooltipDefault: function() {},
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

  /** nsIBaseWindow, nsIXULWindow, ... */
  getWindowInterface: function(win, iface) {
    let winInterface, winOut;
    try {                       // thx Neil Deakin !!
      winOut =  win.QueryInterface(Ci.nsIInterfaceRequestor)
        .getInterface(Ci.nsIWebNavigation)
        .QueryInterface(Ci.nsIDocShellTreeItem)
        .treeOwner
        .QueryInterface(Ci.nsIInterfaceRequestor)[iface];
    } catch (ex) {
      // ignore no-interface exception
      ERROR(ex);
      return null;
    }

    return winOut;
  },

  _getBrowserProperties: function() {
    if (firetray.Handler.mozAppId === FIREFOX_ID)
      return "chrome://branding/locale/browserconfig.properties";
    else if (firetray.Handler.mozAppId === SEAMONKEY_ID)
      return "chrome://navigator-region/locale/region.properties";
    else return null;
  },

  _getHomePage: function() {
    var prefDomain = "browser.startup.homepage";
    var url;
    try {
      url = Services.prefs.getComplexValue(prefDomain,
        Components.interfaces.nsIPrefLocalizedString).data;
    } catch (e) {
    }

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
      var timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
      timer.initWithCallback(function() {
        for(var key in firetray.Handler.windows) break;
        firetray.Handler.windows[key].chromeWin.open(home);
      }, FIRETRAY_BROWSER_NEW_WINDOW_DELAY_MILLISECONDS, Ci.nsITimer.TYPE_ONE_SHOT);
    } catch (x) { ERROR(x); }
  },

  openMailMessage: function() {
    try {
      var aURI = Services.io.newURI("mailto:", null, null);
      var msgComposeService = Cc["@mozilla.org/messengercompose;1"]
        .getService(Ci.nsIMsgComposeService);
      msgComposeService.OpenComposeWindowWithURI (null, aURI);
    } catch (x) { ERROR(x); }
  },

  quitApplication: function() {
    try {
      let appStartup = Cc['@mozilla.org/toolkit/app-startup;1']
        .getService(Ci.nsIAppStartup);
      appStartup.quit(Components.interfaces.nsIAppStartup.eAttemptQuit);
    } catch (x) {
      ERROR(x);
      return;
    }
  }

}; // firetray.Handler
