/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = [ "mozt" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/ctypes.jsm");
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

// pointers to JS functions. should *not* be eaten by GC ("Running global
// cleanup code from study base classes" ?)
var mozt_iconActivateCb;
var mozt_popupMenuCb;
var mozt_menuItemQuitActivateCb;

/**
 * Singleton object for tray icon management
 */
// NOTE: modules work outside of the window scope. Unlike scripts in the
// chrome, modules don't have access to objects such as window, document, or
// other global functions
// (https://developer.mozilla.org/en/XUL_School/JavaScript_Object_Management)
mozt.Handler = {
  initialized: false,
  strings: null,
  tryIcon: null,
  menu: null,

  _windowsHidden: false,
  _handledDOMWindows: [],
  _inMailApp: false,

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
      LOG(ex);
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
    LOG("_updateHandledDOMWindows");
    this._handledDOMWindows = [];
    var windowsEnumerator = Services.wm.getEnumerator(null); // returns a nsIDOMWindow
    while (windowsEnumerator.hasMoreElements()) {
      this._handledDOMWindows[this._handledDOMWindows.length] =
        windowsEnumerator.getNext();
    }
  },

  // FIXME: parameters may not be needed !! see LibGObject.GCallback_t
  showHideToTray: function(a1, a2, a3) {
    LOG("showHideToTray");

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
    LOG("nb Windows: " + this._handledDOMWindows.length);

    for(let i=0; i<this._handledDOMWindows.length; i++) {
      let bw = this._getBaseOrXULWindowFromDOMWindow(
        this._handledDOMWindows[i], "BaseWindow");

      LOG('isHidden: ' + this._windowsHidden);
      LOG("bw.visibility: " + bw.visibility);
      try {
        if (this._windowsHidden) { // show

          // correct position
          let x = this._handledDOMWindows[i].rememberedX;
          let y = this._handledDOMWindows[i].rememberedY;
          LOG("set bw.position: " + x + ", " + y);
          bw.setPosition(x, y);

          bw.visibility = true;

        } else {                // hide

          // remember position
          let x = {}, y = {};
          bw.getPosition(x, y);
          LOG("remember bw.position: " + x.value + ", " + y.value);
          this._handledDOMWindows[i].rememberedX = x.value;
          this._handledDOMWindows[i].rememberedY = y.value;
          // var windowID = win.QueryInterface(Ci.nsIInterfaceRequestor)
          //   .getInterface(Ci.nsIDOMWindowUtils).outerWindowID;

          bw.visibility = false;
        }

      } catch (x) {
        LOG(x);
      }
      LOG("bw.visibility: " + bw.visibility);
      LOG("bw.title: " + bw.title);
    }

    if (this._windowsHidden) {
      this._windowsHidden = false;
    } else {
      this._windowsHidden = true;
    }

  }, // showHideToTray

  popupMenu: function(icon, button, activateTime, menu) {
    LOG("MENU POPUP");
    LOG("ARGS="+icon+", "+button+", "+activateTime+", "+menu);

    try {
      LibGtkStatusIcon.init(); // before anything !!!
      var gtkMenuPtr = ctypes.cast(menu, LibGtkStatusIcon.GtkMenu.ptr);
      var iconGpointer = ctypes.cast(icon, LibGObject.gpointer);
      LibGtkStatusIcon.gtk_menu_popup(
        gtkMenuPtr, null, null, LibGtkStatusIcon.gtk_status_icon_position_menu,
        iconGpointer, button, activateTime);
      LibGtkStatusIcon.shutdown();
    } catch (x) {
      LOG(x);
    }
  },

  quitApplication: function() {
    try {
      let appStartup = Cc['@mozilla.org/toolkit/app-startup;1']
        .getService(Ci.nsIAppStartup);
      appStartup.quit(Components.interfaces.nsIAppStartup.eAttemptQuit);
    } catch (x) {
      Components.utils.reportError(x);
      return;
    }
  },

  init: function() {            // creates icon

    // initialize l10n
    this.strings = Services.strings
      .createBundle("chrome://moztray/locale/overlay.properties");

    // platform checks
    let runtimeOS = Services.appinfo.OS; // "WINNT", "Linux", "Darwin"
    // version checked during install, so we shouldn't need to care
    let xulVer = Services.appinfo.platformVersion; // Services.vc.compare(xulVer,"2.0a")>=0
    LOG("OS=" + runtimeOS + ", XULrunner=" + xulVer);
    if (runtimeOS != "Linux") {
      Components.utils.reportError("MOZTRAY: only Linux platform supported at this time. Moztray not loaded");
      return false;
      // Cu.import("resource://moztray/MoztHandler-Linux.jsm");
    }

    // init all handled windows
    this._updateHandledDOMWindows();

    try {

      // instanciate tray icon
      LibGtkStatusIcon.init();
      this.trayIcon  = LibGtkStatusIcon.gtk_status_icon_new();
      let mozApp = Services.appinfo.name.toLowerCase();
      let iconFilename = MOZT_ICON_DIR + mozApp + MOZT_ICON_SUFFIX;
      LibGtkStatusIcon.gtk_status_icon_set_from_file(this.trayIcon,
                                                     iconFilename);

      // build icon popup menu
      this.menu = LibGtkStatusIcon.gtk_menu_new();
      // shouldn't need to convert to utf8 thank to js-ctypes
		  var menuItemQuitLabel = this.strings.GetStringFromName("popupMenu.itemLabel.Quit");
      var menuItemQuit = LibGtkStatusIcon.gtk_image_menu_item_new_with_label(
        menuItemQuitLabel);
      var menuItemQuitIcon = LibGtkStatusIcon.gtk_image_new_from_stock(
        "gtk-quit", LibGtkStatusIcon.GTK_ICON_SIZE_MENU);
      LibGtkStatusIcon.gtk_image_menu_item_set_image(menuItemQuit, menuItemQuitIcon);
      var menuShell = ctypes.cast(this.menu, LibGtkStatusIcon.GtkMenuShell.ptr);
      LibGtkStatusIcon.gtk_menu_shell_append(menuShell, menuItemQuit);

      mozt_menuItemQuitActivateCb = LibGObject.GCallback_t(
        function(){mozt.Handler.quitApplication();});
      LibGObject.g_signal_connect(menuItemQuit, "activate",
                                  mozt_menuItemQuitActivateCb, null);

      var menuWidget = ctypes.cast(this.menu, LibGtkStatusIcon.GtkWidget.ptr);
      LibGtkStatusIcon.gtk_widget_show_all(menuWidget);

      // here we do use a function handler because we need the args passed to
      // it ! But we need to abandon 'this' in popupMenu()
      mozt_popupMenuCb =
        LibGtkStatusIcon.GCallbackMenuPopup_t(mozt.Handler.popupMenu);
      LibGObject.g_signal_connect(this.trayIcon, "popup-menu",
                                  mozt_popupMenuCb, this.menu);

      // set tooltip. bugs on hover:
      // Gdk-CRITICAL **: IA__gdk_window_get_root_coords: assertion `GDK_IS_WINDOW (window)' failed
      LibGtkStatusIcon.gtk_status_icon_set_tooltip_text(this.trayIcon,
                                                        mozApp);

      // close lib
      LibGtkStatusIcon.shutdown();

      // watch out for binding problems ! here we prefer to keep 'this' in
      // showHideToTray() and abandon the args.
      mozt_iconActivateCb = LibGObject.GCallback_t(
        function(){mozt.Handler.showHideToTray();});
      LibGObject.g_signal_connect(this.trayIcon, "activate",
                                  mozt_iconActivateCb, null);

    } catch (x) {
      Components.utils.reportError(x);
      return false;
    }

    // check if in mail app
    var mozAppId = Services.appinfo.ID;
    if (mozAppId === THUNDERBIRD_ID || mozAppId === SEAMONKEY_ID) {
      this._inMailApp = true;
      try {
        Cu.import("resource://moztray/MoztMessaging.jsm");
        mozt.Messaging.enable();
      } catch (x) {
        ERROR(x);
        return false;
      }

      // init unread messages count
      mozt.Messaging.updateUnreadMsgCount();
    }

    this.initialized = true;
    return true;
  },

  shutdown: function() {        // NOT USED YET
      if (this._inMailApp)
        mozt.Messaging.disable();
  }

}; // mozt.Handler
