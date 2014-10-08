/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = [ "firetray" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://firetray/ctypes/linux/gobject.jsm");
Cu.import("resource://firetray/ctypes/linux/gtk.jsm");
Cu.import("resource://firetray/commons.js");
firetray.Handler.subscribeLibsForClosing([gobject, gtk]);

let log = firetray.Logging.getLogger("firetray.PopupMenu");

if ("undefined" == typeof(firetray.StatusIcon))
  log.error("This module MUST be imported from/after StatusIcon !");


firetray.PopupMenu = {
  initialized: false,
  callbacks: {menuItemWindowActivate: {}}, // FIXME: try to store them into a ctypes array/struct.
  menu: null,
  menuShell: null,
  menuSeparatorWindows: null,

  init: function() {
    this.menu = gtk.gtk_menu_new();
    this.menuShell = ctypes.cast(this.menu, gtk.GtkMenuShell.ptr);
    var addMenuSeparator = false;

    if (firetray.Handler.inMailApp) {
      this.addItem("ResetIcon", "gtk-apply", "activate",
                   firetray.Handler.setIconImageDefault);
      this.addItem("NewMessage", "gtk-edit", "activate",
                   firetray.Handler.openMailMessage);
      addMenuSeparator = true;
    }

    if (firetray.Handler.inBrowserApp) {
      this.addItem("NewWindow", "gtk-new", "activate",
                   firetray.Handler.openBrowserWindow);
      addMenuSeparator = true;
    }

    var menuSeparator;
    if (addMenuSeparator) {
      menuSeparator = gtk.gtk_separator_menu_item_new();
      gtk.gtk_menu_shell_append(this.menuShell, ctypes.cast(menuSeparator,
                                                            gtk.GtkWidget.ptr));
    }

    this.addItem("Preferences", "gtk-preferences", "activate",
                 firetray.Handler.openPrefWindow);
    menuSeparator = gtk.gtk_separator_menu_item_new();
    gtk.gtk_menu_shell_append(this.menuShell, ctypes.cast(menuSeparator,
                                                          gtk.GtkWidget.ptr));

    this.addItem("Quit", "gtk-quit", "activate",
                 firetray.Handler.quitApplication);

    var menuWidget = ctypes.cast(this.menu, gtk.GtkWidget.ptr);
    gtk.gtk_widget_show_all(menuWidget);

    var menuSeparatorWindows = gtk.gtk_separator_menu_item_new();
    gtk.gtk_menu_shell_prepend(this.menuShell, ctypes.cast(menuSeparatorWindows,
                                                           gtk.GtkWidget.ptr));
    this.menuSeparatorWindows = menuSeparatorWindows;

    this.initialized = true;
    return true;
  },

  shutdown: function() {
    log.debug("Disabling PopupMenu");
    this.initialized = false;
  },

  addItem: function(itemName, iconName, action, callback) {
    var menuItemLabel = firetray.Utils.strings.GetStringFromName("popupMenu.itemLabel."+itemName); // shouldn't need to convert to utf8 later thank to js-ctypes
    var menuItem = gtk.gtk_image_menu_item_new_with_label(menuItemLabel);
    var menuItemIcon = gtk.gtk_image_new_from_stock(iconName, gtk.GTK_ICON_SIZE_MENU);
    gtk.gtk_image_menu_item_set_image(menuItem, menuItemIcon);
    gtk.gtk_menu_shell_append(this.menuShell, ctypes.cast(menuItem, gtk.GtkWidget.ptr));

    function capitalizeFirst(str) {
      return str.charAt(0).toUpperCase() + str.substring(1);
    }

    let cbName = "menuItem"+capitalizeFirst(itemName)+capitalizeFirst(action);
    log.debug("cbName="+cbName);
    this.callbacks[cbName] = gobject.GCallback_t(callback); // void return, no sentinel
    gobject.g_signal_connect(menuItem, action,
                             firetray.PopupMenu.callbacks[cbName], null);
  },

  popup: function(icon, button, activateTime, menu) {
    log.debug("menu-popup");
    log.debug("ARGS="+icon+", "+button+", "+activateTime+", "+menu);

    var gtkMenuPtr = ctypes.cast(menu, gtk.GtkMenu.ptr);
    var iconGpointer = ctypes.cast(icon, gobject.gpointer);
    gtk.gtk_menu_popup(
      gtkMenuPtr, null, null, gtk.gtk_status_icon_position_menu,
      iconGpointer, button, activateTime);

    let stopPropagation = false;
    return stopPropagation;
  },

  // we'll be creating menuItems for windows (and not showing them) even if
  // hides_single_window is false, because if hides_single_window becomes true,
  // we'll just have to show the menuItems
  addWindowItem: function(xid) { // on registerWindow
    log.warn("addWindowItem");
    var menuItemWindow = this.createAndAddItemToMenu();
    firetray.Handler.gtkPopupMenuWindowItems.insert(xid, menuItemWindow);
    this.setWindowItemLabel(menuItemWindow, xid.toString()); // default to xid

    let callback = gobject.GCallback_t(
      function(){firetray.Handler.showWindow(xid);}, null, FIRETRAY_CB_SENTINEL); // void return, no sentinel
    this.callbacks.menuItemWindowActivate[xid] = callback,
    gobject.g_signal_connect(menuItemWindow, "activate", callback, null);

    log.debug("added gtkPopupMenuWindowItems: "+firetray.Handler.gtkPopupMenuWindowItems.count);
  },

  createAndAddItemToMenu: function() {
    var menuItem = gtk.gtk_image_menu_item_new();
    gtk.gtk_menu_shell_prepend(this.menuShell, ctypes.cast(menuItem,
                                                           gtk.GtkWidget.ptr));
    return menuItem;
  },

  removeWindowItem: function(xid) { // on unregisterWindow
    let menuItemWindow = firetray.Handler.gtkPopupMenuWindowItems.get(xid);
    firetray.Handler.gtkPopupMenuWindowItems.remove(xid);
    this.removeItem(menuItemWindow);
    log.debug("remove gtkPopupMenuWindowItems: "+firetray.Handler.gtkPopupMenuWindowItems.count);
  },
  removeItem: function(item) {
    gtk.gtk_widget_destroy(ctypes.cast(item, gtk.GtkWidget.ptr));
  },

  showAllWindowItemsOnlyVisibleWindows: function() {
    for (let xid in firetray.Handler.windows)
      if (!firetray.Handler.windows[xid].visible)
        this.showWindowItem(xid);
  },

  showWindowItem: function(xid) {
    if (!this.windowItemsHandled())
      return;

    log.debug("showWindowItem");
    let menuItemWindow = firetray.Handler.gtkPopupMenuWindowItems.get(xid);
    this.showItem(menuItemWindow);
    this.setWindowItemLabel(menuItemWindow, firetray.Window.getWindowTitle(xid));
    this.showWindowSeparator();
  },

  showItem: function(menuItem) {
    gtk.gtk_widget_show(ctypes.cast(menuItem, gtk.GtkWidget.ptr));
  },

  setWindowItemLabel: function(menuItem, label) {
    log.debug("about to set title: "+label);
    if (label)
      gtk.gtk_menu_item_set_label(ctypes.cast(menuItem, gtk.GtkMenuItem.ptr), label);
  },

  hideAllWindowItems: function() {
    for (let xid in firetray.Handler.windows)
      this.hideWindowItemAndSeparator(xid);
  },

  hideWindowItemAndSeparator: function(xid) {
    this.hideWindowItem(xid);
    this.hideWindowSeparator();
  },

  hideWindowItemAndSeparatorMaybe: function(xid) {
    if (!this.windowItemsHandled()) return;

    this.hideWindowItem(xid);
    if (firetray.Handler.visibleWindowsCount === firetray.Handler.windowsCount)
      this.hideWindowSeparator();
  },

  hideWindowItem: function(xid) {
    log.debug("hideWindowItem");
    let menuItemWindow = firetray.Handler.gtkPopupMenuWindowItems.get(xid);
    this.hideItem(menuItemWindow);
  },

  hideItem: function(menuItem) {
    gtk.gtk_widget_hide(ctypes.cast(menuItem, gtk.GtkWidget.ptr));
  },

  showWindowSeparator: function() {
    log.debug("showing menuSeparatorWindows");
    gtk.gtk_widget_show(ctypes.cast(this.menuSeparatorWindows, gtk.GtkWidget.ptr));
  },
  hideWindowSeparator: function() {
    log.debug("hiding menuSeparatorWindows");
    gtk.gtk_widget_hide(ctypes.cast(this.menuSeparatorWindows, gtk.GtkWidget.ptr));
  },

  showHideWindowItems: function() {
    if (this.windowItemsHandled())
      this.showAllWindowItemsOnlyVisibleWindows();
    else
      this.hideAllWindowItems();
  },

  windowItemsHandled: function() {
    return firetray.Utils.prefService.getBoolPref('hides_single_window');
  }

}; // firetray.PopupMenu

firetray.Handler.showHidePopupMenuItems =
  firetray.PopupMenu.showHideWindowItems.bind(firetray.PopupMenu);
