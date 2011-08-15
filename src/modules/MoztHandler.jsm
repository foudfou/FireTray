/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = [ "mozt" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/ctypes.jsm");
/* Cu.import("resource://moztray/LibC.jsm"); */
Cu.import("resource://moztray/LibGObject.jsm");
Cu.import("resource://moztray/LibGtkStatusIcon.jsm");
Cu.import("resource://moztray/commons.js");

const MOZT_ICON_DIR = "chrome/skin/";
const MOZT_ICON_SUFFIX = "32.png";

/**
 * mozt namespace.
 */
if ("undefined" == typeof(mozt)) {
  var mozt = {};
};

var mozt_activateCb;            // pointer to JS function. should not be eaten
                                // by GC ("Running global cleanup code from
                                // study base classes" ?)
/**
 * Singleton object for tray icon management
 */
// NOTE: modules work outside of the window scope. Unlike scripts in the
// chrome, modules don't have access to objects such as window, document, or
// other global functions
// (https://developer.mozilla.org/en/XUL_School/JavaScript_Object_Management)
mozt.Handler = {
  initialized: false,
  _windowsHidden: false,
  _handledDOMWindows: [],

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
      mozt.Debug.debug(ex);
      Components.utils.reportError(ex);
      return null;
    }

    if (winType == "BaseWindow")
      winOut = winInterface.getInterface(Ci.nsIBaseWindow);
    else if (winType == "XUL")
      winOut = winInterface.getInterface(Ci.nsIXULWindow);
    else {
      Components.utils.reportError("MOZTRAY: unknown winType '" + winType + "'");
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
    mozt.Debug.debug("_updateHandledDOMWindows");
    this._handledDOMWindows = [];
    var windowsEnumerator = Services.wm.getEnumerator(null); // returns a nsIDOMWindow
    while (windowsEnumerator.hasMoreElements()) {
      this._handledDOMWindows[this._handledDOMWindows.length] =
        windowsEnumerator.getNext();
    }
  },

  showHideToTray: function(a1, a2, a3) {
    mozt.Debug.debug("showHideToTray");

    /*
     * we update _handledDOMWindows only when hiding, because remembered{X,Y}
     * properties are attached to them, and we suppose there won't be
     * created/delete windows when all are hidden.
     *
     * NOTE: this may not be a good design if we want to show/hide one window
     * at a time...
     */
    if (!this._windowsHidden)   // hide
      this._updateHandledDOMWindows();
    mozt.Debug.debug("nb Windows: " + this._handledDOMWindows.length);

    for(let i=0; i<this._handledDOMWindows.length; i++) {
      let bw = this._getBaseOrXULWindowFromDOMWindow(
        this._handledDOMWindows[i], "BaseWindow");

      mozt.Debug.debug('isHidden: ' + this._windowsHidden);
      mozt.Debug.debug("bw.visibility: " + bw.visibility);
      try {
        if (this._windowsHidden) { // show

          // correct position
          let x = this._handledDOMWindows[i].rememberedX;
          let y = this._handledDOMWindows[i].rememberedY;
          mozt.Debug.debug("set bw.position: " + x + ", " + y);
          bw.setPosition(x, y);

          bw.visibility = true;

        } else {                // hide

          // remember position
          let x = {}, y = {};
          bw.getPosition(x, y);
          mozt.Debug.debug("remember bw.position: " + x.value + ", " + y.value);
          this._handledDOMWindows[i].rememberedX = x.value;
          this._handledDOMWindows[i].rememberedY = y.value;
          // var windowID = win.QueryInterface(Ci.nsIInterfaceRequestor)
          //   .getInterface(Ci.nsIDOMWindowUtils).outerWindowID;

          bw.visibility = false;
        }

      } catch (x) {
        mozt.Debug.debug(x);
      }
      mozt.Debug.debug("bw.visibility: " + bw.visibility);
      mozt.Debug.debug("bw.title: " + bw.title);
    }

    if (this._windowsHidden) {
      this._windowsHidden = false;
    } else {
      this._windowsHidden = true;
    }

  },

  init: function() {            // creates icon

    // platform checks
    let runtimeOS = Services.appinfo.OS; // "WINNT", "Linux", "Darwin"
    let xulVer = Services.appinfo.platformVersion; // Services.vc.compare(xulVer,"2.0a")>=0 will be checked ing install, so we shouldn't need to care
    mozt.Debug.debug("OS=" + runtimeOS + ", XULrunner=" + xulVer);
    if (runtimeOS != "Linux") {
      Components.utils.reportError("MOZTRAY: only Linux platform supported at this time. Moztray not loaded");
      return;
      // Cu.import("resource://moztray/MoztHandler-Linux.jsm");
    }

    // init all handled windows
    this._updateHandledDOMWindows();

    try {

      // instanciate tray icon
      LibGtkStatusIcon.init();
      this.tray_icon  = LibGtkStatusIcon.gtk_status_icon_new();
      var mozApp = Services.appinfo.name.toLowerCase();
      var iconFilename = MOZT_ICON_DIR + mozApp + MOZT_ICON_SUFFIX;
      LibGtkStatusIcon.gtk_status_icon_set_from_file(this.tray_icon,
                                                     iconFilename);

      // set tooltip.
      // GTK bug:
      // (firefox-bin:5302): Gdk-CRITICAL **: IA__gdk_window_get_root_coords: assertion `GDK_IS_WINDOW (window)' failed
      // (thunderbird-bin:5380): Gdk-CRITICAL **: IA__gdk_window_get_root_coords: assertion `GDK_IS_WINDOW (window)' failed
      LibGtkStatusIcon.gtk_status_icon_set_tooltip_text(this.tray_icon,
                                                        mozApp);

      // close lib
      LibGtkStatusIcon.shutdown();

      // watch out for binding problems !
      mozt_activateCb = LibGObject.GCallback_t(
        function(){mozt.Handler.showHideToTray();});
      LibGObject.g_signal_connect(this.tray_icon, "activate",
                                  mozt_activateCb, null);

    } catch (x) {
      Components.utils.reportError(x);
      return false;
    }

/*
    try {
      // Experimental stuff... needs
      // Components.utils.import("resource://moztray/LibGdkWindow.js");

      var gdkScreen = LibGdkWindow.GdkScreenGetDefault();
      var tl = LibGdkWindow.GdkScreenGetToplevelWindows(gdkScreen);
      mozt.Debug.debug(tl);

      // gboolean            gdk_window_is_visible               (GdkWindow *window);
      mozt_func = LibGObject.GFunc_t(mozt_funcGdkJS);
      LibGObject.g_list_foreach(tl, mozt_func, null);
      var gdkWinCount = LibGObject.g_list_length(tl);
      mozt.Debug.debug('gdkWinCount: ' + gdkWinCount);

      var pid = LibC.getpid();
      mozt.Debug.debug(pid);

      tl = LibGtkStatusIcon.gtk_window_list_toplevels();
      mozt_func = LibGObject.GFunc_t(mozt_funcGtkJS);
      LibGObject.g_list_foreach(tl, mozt_func, null);
      var gtkWinCount = LibGObject.g_list_length(tl);
      mozt.Debug.debug('gtkWinCount: ' + gtkWinCount);

    } catch (x) {
      mozt.Debug.debug(x);
    }
*/

    this.initialized = true;
    return true;
  },

}; // mozt.Handler
