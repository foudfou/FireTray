/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = [ "firetray" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://firetray/gobject.jsm");
Cu.import("resource://firetray/gtk.jsm");
Cu.import("resource://firetray/commons.js");

/**
 * firetray namespace.
 */
if ("undefined" == typeof(firetray)) {
  var firetray = {};
};

/**
 * Singleton object and abstraction for tray icon management.
 */
// NOTE: modules work outside of the window scope. Unlike scripts in the
// chrome, modules don't have access to objects such as window, document, or
// other global functions
// (https://developer.mozilla.org/en/XUL_School/JavaScript_Object_Management)
firetray.Handler = {
  initialized: false,
  appName: null,
  FILENAME_DEFAULT: null,
  FILENAME_SUFFIX: "32.png",
  FILENAME_BLANK: null,
  FILENAME_NEWMAIL: null,
  runtimeOS: null,
  inMailApp: false,

  _windowsHidden: false,
  _handledDOMWindows: [],

  init: function() {            // creates icon
    this.appName = Services.appinfo.name.toLowerCase();
    this.FILENAME_DEFAULT = firetray.Utils.chromeToPath(
      "chrome://firetray/skin/" +  this.appName + this.FILENAME_SUFFIX);
    this.FILENAME_BLANK = firetray.Utils.chromeToPath(
      "chrome://firetray/skin/blank-icon.png");
    this.FILENAME_NEWMAIL = firetray.Utils.chromeToPath(
      "chrome://firetray/skin/message-mail-new.png");

    // init all handled windows
    this._updateHandledDOMWindows();

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

      // instanciate tray icon
      firetray.StatusIcon.init();
      LOG('StatusIcon initialized');

      break;
    default:
      ERROR("FIRETRAY: only Linux platform supported at this time. Firetray not loaded");
      return false;
    }

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

  // these get overridden in OS-specific Icon handlers
  setImage: function(filename) {},
  setImageDefault: function() {},
  setText: function(text, color) {},
  setTooltip: function(localizedMessage) {},
  setTooltipDefault: function() {},

  _getBaseOrXULWindowFromDOMWindow: function(win, winType) {
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

    if (winType == "BaseWindow")
      winOut = winInterface.getInterface(Ci.nsIBaseWindow);
    else if (winType == "XUL")
      winOut = winInterface.getInterface(Ci.nsIXULWindow);
    else {
      ERROR("FIRETRAY: unknown winType '" + winType + "'");
      return null;
    }

    return winOut;
  },

  /*
   * DAMN IT ! getZOrderDOMWindowEnumerator doesn't work on Linux :-(
   * https://bugzilla.mozilla.org/show_bug.cgi?id=156333, and all windows
   * seem to have the same zlevel ("normalZ") which is different from the
   * z-order. There seems to be no means to get/set the z-order at this
   * time...
   */
  _updateHandledDOMWindows: function() {
    LOG("_updateHandledDOMWindows");
    this._handledDOMWindows = [];
    var windowsEnumerator = Services.wm.getEnumerator(null); // returns a nsIDOMWindow
    while (windowsEnumerator.hasMoreElements()) {
      this._handledDOMWindows[this._handledDOMWindows.length] =
        windowsEnumerator.getNext();
    }
  },

/* GTK TEST */
  // showHideToTray: function(a1) { // unused param
  //   LOG("showHideToTray");

  //   /*
  //    * we update _handledDOMWindows only when hiding, because remembered{X,Y}
  //    * properties are attached to them, and we suppose there won't be
  //    * created/delete windows when all are hidden.
  //    *
  //    * NOTE: this may not be a good design if we want to show/hide one window
  //    * at a time... might need win.QueryInterface(Ci.nsIInterfaceRequestor)
  //    * .getInterface(Ci.nsIDOMWindowUtils).outerWindowID;
  //    */
  //   if (!this._windowsHidden)   // hide
  //     this._updateHandledDOMWindows();
  //   LOG("nb Windows: " + this._handledDOMWindows.length);

  //   for(let i=0; i<this._handledDOMWindows.length; i++) {
  //     let bw = this._getBaseOrXULWindowFromDOMWindow(
  //       this._handledDOMWindows[i], "BaseWindow");

  //     LOG('isHidden: ' + this._windowsHidden);
  //     LOG("bw.visibility: " + bw.visibility);
  //     try {
  //       if (this._windowsHidden) { // show

  //         // correct position, size and state
  //         let x = this._handledDOMWindows[i].rememberedX;
  //         let y = this._handledDOMWindows[i].rememberedY;
  //         let cx = this._handledDOMWindows[i].rememberedWidth;
  //         let cy = this._handledDOMWindows[i].rememberedHeight;
  //         LOG("set bw.position: " + x + ", " + y + ", " + cx + ", " + cy);
  //         let windowState = this._handledDOMWindows[i].rememberedState;
  //         LOG("set windowState: " + windowState);

  //         switch (windowState) {
  //         case Ci.nsIDOMChromeWindow.STATE_MAXIMIZED: // 1
  //           this._handledDOMWindows[i].QueryInterface(Ci.nsIDOMChromeWindow).maximize();
  //           break;
  //         case Ci.nsIDOMChromeWindow.STATE_MINIMIZED: // 2
  //           let prefHidesOnMinimize = firetray.Utils.prefService.getBoolPref("hides_on_minimize");
  //           if (!prefHidesOnMinimize)
  //             this._handledDOMWindows[i].QueryInterface(Ci.nsIDOMChromeWindow).minimize();
  //           break;
  //         case Ci.nsIDOMChromeWindow.STATE_NORMAL: // 3
  //           bw.setPositionAndSize(x, y, cx, cy, false); // repaint
  //           break;
  //         case Ci.nsIDOMChromeWindow.STATE_FULLSCREEN: // 4
  //           // FIXME: NOT IMPLEMENTED YET
  //         default:
  //         }
  //         LOG("maximize after: " + this._handledDOMWindows[i].QueryInterface(Ci.nsIDOMChromeWindow).windowState);

  //         bw.visibility = true;

  //       } else {                // hide

  //         // remember position and size
  //         let x = {}, y = {}, cx = {}, cy = {};
  //         bw.getPositionAndSize(x, y, cx, cy);
  //         LOG("remember bw.position: " + x.value + ", " + y.value + ", " + cx.value + ", " + cy.value);
  //         this._handledDOMWindows[i].rememberedX = x.value;
  //         this._handledDOMWindows[i].rememberedY = y.value;
  //         this._handledDOMWindows[i].rememberedWidth = cx.value;
  //         this._handledDOMWindows[i].rememberedHeight = cy.value;
  //         this._handledDOMWindows[i].rememberedState = this._handledDOMWindows[i]
  //           .QueryInterface(Ci.nsIDOMChromeWindow).windowState;
  //         LOG("maximized: " + this._handledDOMWindows[i].rememberedState);

  //         bw.visibility = false;
  //       }

  //     } catch (x) {
  //       LOG(x);
  //     }
  //     LOG("bw.visibility: " + bw.visibility);
  //     LOG("bw.title: " + bw.title);
  //   }

  //   if (this._windowsHidden) {
  //     this._windowsHidden = false;
  //   } else {
  //     this._windowsHidden = true;
  //   }

  // }, // showHideToTray

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
