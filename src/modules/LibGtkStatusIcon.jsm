/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = ["LibGtkStatusIcon"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

const LIB_GTK = "libgtk-x11-2.0.so.0";

var LibGtkStatusIcon = {

  _lib: null,

  init: function() {
    // If ctypes doesn't exist, try to get it
    Cu.import("resource://gre/modules/ctypes.jsm");
    // If we still don't have ctypes, this isn't going to work...
    if (typeof(ctypes) == "undefined") {
      throw ("Could not load JS-Ctypes");
    }

    Cu.import("resource://moztray/LibGObject.jsm");
    Cu.import("resource://moztray/LibGdkWindow.jsm");

    try {
      // Try to start up dependencies - if they fail, they'll throw
      // exceptions. ex: LibGObject.init();

      this._lib = ctypes.open(LIB_GTK);
      if (!this._lib)
        throw ("Could not load " + LIB_GTK);

    } catch (e) {
      this.shutdown();
      throw(e);
    }

    // Ok, we got everything - let's declare.
    this._declare();
  },

  shutdown: function() {
    // Close our connection to the library.
    if (this._lib)
      this._lib.close();
  },

  _declare: function() {
    // Types

    this.GtkStatusIcon = ctypes.StructType("GtkStatusIcon");

    this.GtkStyle = ctypes.StructType("GtkStyle");
    this.GtkRequisition = ctypes.StructType(
      "GtkRequisition", [
        { width: LibGObject.gint },
        { height: LibGObject.gint }
      ]);
    this.GtkAllocation = ctypes.StructType(
      "GtkAllocation", [
        { x: LibGObject.gint },
        { y: LibGObject.gint },
        { width: LibGObject.gint },
        { height: LibGObject.gint }
      ]);

    /* NOTE: recursive struct needs define() and included structs MUST be
     * defined ! */
    this.GtkWidget = ctypes.StructType("GtkWidget");
    this.GtkWidget.define([
        { "style": this.GtkStyle.ptr },
        { "requisition": this.GtkRequisition },
        { "allocation": this.GtkAllocation },
        { "window": LibGdkWindow.GdkWindow.ptr },
        { "parent": this.GtkWidget.ptr }
      ]);

    this.GtkMenu = ctypes.StructType("GtkMenu");

    this.GtkMenuShell = ctypes.StructType("GtkMenuShell");
    // use ctypes.cast(menu, LibGtkStatusIcon.GtkMenuShell.ptr);

    this.GtkMenuPositionFunc = ctypes.FunctionType(
      ctypes.default_abi, ctypes.void_t,
      [this.GtkMenu.ptr, LibGObject.gint.ptr, LibGObject.gint.ptr,
       LibGObject.gboolean.ptr, LibGObject.gpointer]).ptr;

    this.GCallbackMenuPopup_t = ctypes.FunctionType(
      ctypes.default_abi, ctypes.void_t,
      [this.GtkStatusIcon.ptr, LibGObject.guint, LibGObject.guint,
       LibGObject.gpointer]).ptr;

    // Consts
    // this.INDICATOR_MESSAGES_SERVER_TYPE = "message";

    // Functions

    this.gtk_status_icon_new = this._lib.declare(
      "gtk_status_icon_new", ctypes.default_abi, this.GtkStatusIcon.ptr);

    this.gtk_status_icon_set_from_file = this._lib.declare(
      "gtk_status_icon_set_from_file", ctypes.default_abi, ctypes.void_t,
      this.GtkStatusIcon.ptr, ctypes.char.ptr);

    this.gtk_status_icon_set_tooltip_text = this._lib.declare(
      "gtk_status_icon_set_tooltip_text", ctypes.default_abi, ctypes.void_t,
      this.GtkStatusIcon.ptr, ctypes.char.ptr);

    this.gtk_menu_new = this._lib.declare(
      "gtk_menu_new", ctypes.default_abi, this.GtkMenu.ptr);

    this.gtk_image_menu_item_new_with_label = this._lib.declare(
      "gtk_image_menu_item_new_with_label", ctypes.default_abi, this.GtkWidget.ptr,
      LibGObject.gchar.ptr);

    this.gtk_menu_shell_append = this._lib.declare(
      "gtk_menu_shell_append", ctypes.default_abi, ctypes.void_t,
      this.GtkMenuShell.ptr, this.GtkWidget.ptr);

    this.gtk_widget_show_all = this._lib.declare(
      "gtk_widget_show_all", ctypes.default_abi, ctypes.void_t,
      this.GtkWidget.ptr);

    this.gtk_menu_popup = this._lib.declare(
      "gtk_menu_popup", ctypes.default_abi, ctypes.void_t,
      this.GtkMenu.ptr, this.GtkWidget.ptr, this.GtkWidget.ptr,
      this.GtkMenuPositionFunc, LibGObject.gpointer, LibGObject.guint,
      LibGObject.guint);

    this.gtk_status_icon_position_menu = this._lib.declare(
      "gtk_status_icon_position_menu", ctypes.default_abi, ctypes.void_t,
      this.GtkMenu.ptr, LibGObject.gint.ptr, LibGObject.gint.ptr,
      LibGObject.gboolean.ptr, LibGObject.gpointer);

  }

};
