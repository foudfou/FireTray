/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = ["LibGtkStatusIcon"];

const LIB_GTK = "libgtk-x11-2.0.so.0";

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://moztray/LibGObject.jsm");
Cu.import("resource://moztray/LibGdkWindow.jsm");


XPCOMUtils.defineLazyGetter(this, "libgtk", function() {
  var libgtk = ctypes.open(LIB_GTK);
  if (!libgtk)
    throw "libgtk is unavailable";
  return libgtk;
});


// Structures

XPCOMUtils.defineLazyGetter(this, "GCallback", function() {
  return ctypes.void_t.ptr;
});

XPCOMUtils.defineLazyGetter(this, "GtkStatusIcon", function() {
  return ctypes.StructType("GtkStatusIcon");
});

XPCOMUtils.defineLazyGetter(this, "GtkStyle", function() {
  return ctypes.StructType("GtkStyle");
});

XPCOMUtils.defineLazyGetter(this, "GtkRequisition", function() {
  return ctypes.StructType(
    "GtkRequisition", [
      { width: LibGObject.gint },
      { height: LibGObject.gint }
    ]);
});

XPCOMUtils.defineLazyGetter(this, "GtkAllocation", function() {
  return  ctypes.StructType(
    "GtkAllocation", [
      { x: LibGObject.gint },
      { y: LibGObject.gint },
      { width: LibGObject.gint },
      { height: LibGObject.gint }
    ]);
});

/* NOTE: recursive struct needs define() and included structs MUST be
 * defined ! */
XPCOMUtils.defineLazyGetter(this, "GtkWidget", function() {
  var GtkWidget = ctypes.StructType("GtkWidget");
  GtkWidget.define([
    { "style": GtkStyle.ptr },
    { "requisition": GtkRequisition },
    { "allocation": GtkAllocation },
    { "window": LibGdkWindow.GdkWindow.ptr },
    { "parent": GtkWidget.ptr }
  ]);
  return GtkWidget;
});

XPCOMUtils.defineLazyGetter(this, "GtkMenu", function() {
  return ctypes.StructType("GtkMenu");
});

// use ctypes.cast(menu, LibGtkStatusIcon.GtkMenuShell.ptr);
XPCOMUtils.defineLazyGetter(this, "GtkMenuShell", function() {
  return ctypes.StructType("GtkMenuShell");
});

XPCOMUtils.defineLazyGetter(this, "GtkImageMenuItem", function() {
  return ctypes.StructType("GtkImageMenuItem");
});

XPCOMUtils.defineLazyGetter(this, "GtkMenuPositionFunc", function() {
  return ctypes.FunctionType(
    ctypes.default_abi, ctypes.void_t,
    [GtkMenu.ptr, LibGObject.gint.ptr, LibGObject.gint.ptr,
     LibGObject.gboolean.ptr, LibGObject.gpointer]).ptr;
});

XPCOMUtils.defineLazyGetter(this, "GCallbackMenuPopup_t", function() {
  return ctypes.FunctionType(
    ctypes.default_abi, ctypes.void_t,
    [GtkStatusIcon.ptr, LibGObject.guint, LibGObject.guint,
     LibGObject.gpointer]).ptr;
});


// Functions

XPCOMUtils.defineLazyGetter(this, "gtk_status_icon_new", function() {
  var gtk_status_icon_new = libgtk.declare(
      "gtk_status_icon_new", ctypes.default_abi, GtkStatusIcon.ptr);
  if (!gtk_status_icon_new)
    throw "gtk_status_icon_new is unavailable";
  return gtk_status_icon_new;
});

XPCOMUtils.defineLazyGetter(this, "gtk_status_icon_set_from_file", function() {
  var gtk_status_icon_set_from_file = libgtk.declare(
      "gtk_status_icon_set_from_file", ctypes.default_abi, ctypes.void_t,
      GtkStatusIcon.ptr, ctypes.char.ptr);
  if (!gtk_status_icon_set_from_file)
    throw "gtk_status_icon_set_from_file is unavailable";
  return gtk_status_icon_set_from_file;
});

XPCOMUtils.defineLazyGetter(this, "gtk_status_icon_set_tooltip_text", function() {
  var gtk_status_icon_set_tooltip_text = libgtk.declare(
    "gtk_status_icon_set_tooltip_text", ctypes.default_abi, ctypes.void_t,
    GtkStatusIcon.ptr, ctypes.char.ptr);
  if (!gtk_status_icon_set_tooltip_text)
    throw "gtk_status_icon_set_tooltip_text unavailable";
  return gtk_status_icon_set_tooltip_text;
});

XPCOMUtils.defineLazyGetter(this, "gtk_menu_new", function() {
  var gtk_menu_new = libgtk.declare(
    "gtk_menu_new", ctypes.default_abi, GtkMenu.ptr);
  if (!gtk_menu_new)
    throw "gtk_menu_new is unavailable";
  return gtk_menu_new;
});

XPCOMUtils.defineLazyGetter(this, "gtk_image_menu_item_new_with_label", function() {
  var gtk_image_menu_item_new_with_label = libgtk.declare(
    "gtk_image_menu_item_new_with_label", ctypes.default_abi, GtkImageMenuItem.ptr,
    LibGObject.gchar.ptr);
  if (!gtk_image_menu_item_new_with_label)
    throw "gtk_image_menu_item_new_with_label is unavailable";
  return gtk_image_menu_item_new_with_label;
});

XPCOMUtils.defineLazyGetter(this, "gtk_image_new_from_stock", function() {
  var gtk_image_new_from_stock = libgtk.declare(
    "gtk_image_new_from_stock", ctypes.default_abi, GtkWidget.ptr,
    LibGObject.gchar.ptr, ctypes.int); // enum
  if (!gtk_image_new_from_stock)
    throw "gtk_image_new_from_stock is unavailable";
  return gtk_image_new_from_stock;
});

XPCOMUtils.defineLazyGetter(this, "gtk_image_menu_item_set_image", function() {
  var gtk_image_menu_item_set_image = libgtk.declare(
    "gtk_image_menu_item_set_image", ctypes.default_abi, ctypes.void_t,
    GtkImageMenuItem.ptr, GtkWidget.ptr);
  if (!gtk_image_menu_item_set_image)
    throw "gtk_image_menu_item_set_image is unavailable";
  return gtk_image_menu_item_set_image;
});

XPCOMUtils.defineLazyGetter(this, "gtk_menu_shell_append", function() {
  var gtk_menu_shell_append = libgtk.declare(
    "gtk_menu_shell_append", ctypes.default_abi, ctypes.void_t,
    GtkMenuShell.ptr, GtkImageMenuItem.ptr);
  if (!gtk_menu_shell_append)
    throw "gtk_menu_shell_append is unavailable";
  return gtk_menu_shell_append;
});

XPCOMUtils.defineLazyGetter(this, "gtk_widget_show_all", function() {
  var gtk_widget_show_all = libgtk.declare(
    "gtk_widget_show_all", ctypes.default_abi, ctypes.void_t,
    GtkWidget.ptr);
  if (!gtk_widget_show_all)
    throw "gtk_widget_show_all is unavailable";
  return gtk_widget_show_all;
});

XPCOMUtils.defineLazyGetter(this, "gtk_menu_popup", function() {
  var gtk_menu_popup = libgtk.declare(
    "gtk_menu_popup", ctypes.default_abi, ctypes.void_t,
    GtkMenu.ptr, GtkWidget.ptr, GtkWidget.ptr,
    GtkMenuPositionFunc, LibGObject.gpointer, LibGObject.guint,
    LibGObject.guint);
  if (!gtk_menu_popup)
    throw "gtk_menu_popup is unavailable is unavailable";
  return gtk_menu_popup;
});

XPCOMUtils.defineLazyGetter(this, "gtk_status_icon_position_menu", function() {
  var gtk_status_icon_position_menu = libgtk.declare(
    "gtk_status_icon_position_menu", ctypes.default_abi, ctypes.void_t,
    GtkMenu.ptr, LibGObject.gint.ptr, LibGObject.gint.ptr,
    LibGObject.gboolean.ptr, LibGObject.gpointer);
  if (!gtk_status_icon_position_menu)
    throw "gtk_status_icon_position_menu is unavailable";
  return gtk_status_icon_position_menu;
});

var LibGtkStatusIcon = {
  GTK_ICON_SIZE_MENU: 1,
  libgtk: libgtk,
  GCallback: GCallback,
  GtkStatusIcon: GtkStatusIcon,
  GtkStyle: GtkStyle,
  GtkRequisition: GtkRequisition,
  GtkAllocation: GtkAllocation,
  GtkWidget: GtkWidget,
  GtkMenu: GtkMenu,
  GtkMenuShell: GtkMenuShell,
  GtkImageMenuItem: GtkImageMenuItem,
  GtkMenuPositionFunc: GtkMenuPositionFunc,
  GCallbackMenuPopup_t: GCallbackMenuPopup_t,
  gtk_status_icon_new: gtk_status_icon_new,
  gtk_status_icon_set_from_file: gtk_status_icon_set_from_file,
  gtk_status_icon_set_tooltip_text: gtk_status_icon_set_tooltip_text,
  gtk_menu_new: gtk_menu_new,
  gtk_image_menu_item_new_with_label: gtk_image_menu_item_new_with_label,
  gtk_image_new_from_stock: gtk_image_new_from_stock,
  gtk_image_menu_item_set_image: gtk_image_menu_item_set_image,
  gtk_menu_shell_append: gtk_menu_shell_append,
  gtk_widget_show_all: gtk_widget_show_all,
  gtk_menu_popup: gtk_menu_popup,
  gtk_status_icon_position_menu: gtk_status_icon_position_menu
};
