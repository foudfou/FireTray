/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = ["LibGtkStatusIcon"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

const LIB_GTK = "libgtk-x11-2.0.so";

var LibGtkStatusIcon = {

  _lib: null,

  init: function() {
    // If ctypes doesn't exist, try to get it
    Cu.import("resource://gre/modules/ctypes.jsm");
    // If we still don't have ctypes, this isn't going to work...
    if (typeof(ctypes) == "undefined") {
      throw ("Could not load JS-Ctypes");
    }

    Cu.import("resource://moztray/LibGObject.js");
    Cu.import("resource://moztray/LibGdkWindow.js");

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
    this.GtkStatusIconRef = ctypes.PointerType(this.GtkStatusIcon);

    this.GtkWindow = ctypes.StructType(
      "GtkWindow", [
      ]);

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

    // Consts
    // this.INDICATOR_MESSAGES_SERVER_TYPE = "message";

    // Functions

    this.gtk_status_icon_new = this._lib.declare(
      "gtk_status_icon_new",
      ctypes.default_abi,
      this.GtkStatusIconRef
    );

    this.gtk_status_icon_set_from_file = this._lib.declare(
      "gtk_status_icon_set_from_file",
      ctypes.default_abi,
      ctypes.void_t,
      this.GtkStatusIconRef,
      ctypes.char.ptr
    );

    this.gtk_status_icon_set_tooltip_text = this._lib.declare(
      "gtk_status_icon_set_tooltip_text",
      ctypes.default_abi,
      ctypes.void_t,
      this.GtkStatusIconRef,
      ctypes.char.ptr
    );

/*
    this.gtk_window_list_toplevels = this._lib.declare(
      "gtk_window_list_toplevels", ctypes.default_abi, LibGObject.GList.ptr
    );

    this.gtk_widget_show = this._lib.declare(
      "gtk_widget_show", ctypes.default_abi, ctypes.void_t,
      this.GtkWidget.ptr
    );

    this.gtk_widget_hide = this._lib.declare(
      "gtk_widget_hide", ctypes.default_abi, ctypes.void_t,
      this.GtkWidget.ptr
    );
*/

  }

};
