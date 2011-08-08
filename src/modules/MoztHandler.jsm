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

  _getBaseWindow: function(win) {
    var bw;
    try { // thx Neil Deakin !!
      bw = win.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
        .getInterface(Components.interfaces.nsIWebNavigation)
        .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
        .treeOwner
        .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
        .getInterface(Components.interfaces.nsIBaseWindow);
    } catch (ex) {
      bw = null;
      setTimeout(function() {throw ex; }, 0);
      // ignore no-interface exception
    }
    return bw;
  },

  _getAllWindows: function() {
    mozt.Debug.debug("_getAllWindows");
    var baseWindows = new Array();
    var e = Services.wm.getEnumerator(null);
    while (e.hasMoreElements()) {
      var w = e.getNext();
      baseWindows[baseWindows.length] = this._getBaseWindow(w);
    }
    return baseWindows;
  },

  /*
   * might need to remember position...
   * var outX = {}, outY = {}, outCX = {}, outCY = {};
   * bw.getPositionAndSize(outX, outY, outCX, outCY);
   * mozt.Debug.debug("pos: "
   *                  + outX.value + ", "
   *                  + outY.value + ", "
   *                  + outCX.value + ", "
   *                  + outCY.value
   *                 );
   */
  showHideToTray: function(a1, a2, a3) {
    mozt.Debug.debug("showHideToTray");

    var baseWindows;
    try {
      baseWindows = this._getAllWindows();
    } catch (x) {
      mozt.Debug.debug(x);
    }
    mozt.Debug.debug("baseWindows: " + baseWindows.length);
    for(var i=0; i<baseWindows.length; i++) {
      var bw = baseWindows[i];

      mozt.Debug.debug('isHidden: ' + this._windowsHidden);
      mozt.Debug.debug("bw.visibility: " + bw.visibility);
      try {
        if (this._windowsHidden) {
          bw.visibility = true;
        } else {
          bw.visibility = false;
        }
      } catch (x) {
        mozt.Debug.debug(x);
      }
      mozt.Debug.debug("bw.visibility: " + bw.visibility);

      mozt.Debug.debug("bw.title: " + bw.title);
      mozt.Debug.debug("bw.parentNativeWindow: " + bw.parentNativeWindow);
    }

    if (this._windowsHidden) {
      this._windowsHidden = false;
    } else {
      this._windowsHidden = true;
    }

  },

  init: function() {            // creates icon
    try {

      // instanciate tray icon
      LibGtkStatusIcon.init();
      this.tray_icon  = LibGtkStatusIcon.gtk_status_icon_new();
      var mozApp = Services.appinfo.name.toLowerCase();
      var iconFilename = MOZT_ICON_DIR + mozApp + MOZT_ICON_SUFFIX;
      LibGtkStatusIcon.gtk_status_icon_set_from_file(this.tray_icon,
                                                     iconFilename);

      // set tooltip.
      // TODO: produces:
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
