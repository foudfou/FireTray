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
  inMailApp: false,
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

    // OS/platform checks
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

    // instanciate tray icon
    firetray.StatusIcon.init();
    LOG('StatusIcon initialized');

    // check if in mail app
    var mozAppId = Services.appinfo.ID;
    if (mozAppId === THUNDERBIRD_ID || mozAppId === SEAMONKEY_ID) {
      this.inMailApp = true;
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
    LOG('inMailApp: '+this.inMailApp);

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

    return true;
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
