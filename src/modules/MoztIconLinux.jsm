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

if ("undefined" == typeof(mozt.Handler))
  ERROR("MoztIcon*.jsm MUST be imported from/after MoztHandler !");

// pointers to JS functions. should *not* be eaten by GC ("Running global
// cleanup code from study base classes" ?)
var mozt_iconActivateCb;
var mozt_popupMenuCb;
var mozt_menuItemQuitActivateCb;

mozt.IconLinux = {
  tryIcon: null,
  menu: null,
  appName: null,
  ICON_FILENAME_DEFAULT: null,
  ICON_SUFFIX: "32.png",

  init: function() {

    try {

      // init tray icon, some variables
      this.trayIcon  = LibGtkStatusIcon.gtk_status_icon_new();
      this.appName = Services.appinfo.name.toLowerCase();
      this.ICON_FILENAME_DEFAULT = mozt.Utils.chromeToPath(
        "chrome://moztray/skin/" +  this.appName + this.ICON_SUFFIX);

      this.setDefaultImage();

      // build icon popup menu
      this.menu = LibGtkStatusIcon.gtk_menu_new();
      // shouldn't need to convert to utf8 thank to js-ctypes
		  var menuItemQuitLabel = mozt.Utils.strings.GetStringFromName("popupMenu.itemLabel.Quit");
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

      this.setDefaultTooltip();

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

    return true;
  },

  setImage: function(filename) {
    if (!this.trayIcon)
      return false;
    LOG(filename);

    try {
      LibGtkStatusIcon.gtk_status_icon_set_from_file(this.trayIcon,
                                                     filename);
    } catch (x) {
      ERROR(x);
      return false;
    }
    return true;
  },

  setDefaultImage: function() {
    if (!this.ICON_FILENAME_DEFAULT)
      throw "Default application icon filename not set";
    this.setImage(this.ICON_FILENAME_DEFAULT);
  },

  // GTK bug: Gdk-CRITICAL **: IA__gdk_window_get_root_coords: assertion `GDK_IS_WINDOW (window)' failed
  setTooltip: function(toolTipStr) {
    if (!this.trayIcon)
      return false;
    LibGtkStatusIcon.gtk_status_icon_set_tooltip_text(this.trayIcon,
                                                      toolTipStr);
    return true;
  },

  setDefaultTooltip: function() {
    if (!this.appName)
      throw "application name not initialized";
    this.setTooltip(this.appName);
  }

}; // mozt.IconLinux
