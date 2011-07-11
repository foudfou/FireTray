/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = ["LibGtkStatusIcon"];

const LIB_GTK = "libgtk-x11-2.0.so";

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyGetter(this, "libgtk", function() {
  var libgtk = ctypes.open(LIB_GTK);
  if (!libgtk)
    throw "libgtk is unavailable";

  return libgtk;
});

// Types
XPCOMUtils.defineLazyGetter(this, "GtkStatusIcon", function() {
  return ctypes.StructType("GtkStatusIcon");
});

// Functions
XPCOMUtils.defineLazyGetter(this, "gtk_status_icon_new", function() {
  var gtk_status_icon_new = libgtk.declare(
    "gtk_status_icon_new",
    ctypes.default_abi,
    this.GtkStatusIcon.ptr
  );

  if (!gtk_status_icon_new)
    throw "gtk_status_icon_new is unavailable";

  return gtk_status_icon_new;
});

XPCOMUtils.defineLazyGetter(this, "gtk_status_icon_set_from_file", function() {
    var gtk_status_icon_set_from_file = libgtk.declare(
      "gtk_status_icon_set_from_file",
      ctypes.default_abi,
      ctypes.void_t,
      this.GtkStatusIcon.ptr,
      ctypes.char.ptr
    );

  if (!gtk_status_icon_new)
    throw "gtk_status_icon_set_from_file is unavailable";

  return gtk_status_icon_set_from_file;
});

XPCOMUtils.defineLazyGetter(this, "gtk_status_icon_set_tooltip_text", function() {
    var gtk_status_icon_set_tooltip_text = libgtk.declare(
      "gtk_status_icon_set_tooltip_text",
      ctypes.default_abi,
      ctypes.void_t,
      this.GtkStatusIcon.ptr,
      ctypes.char.ptr
    );

  if (!gtk_status_icon_set_tooltip_text)
    throw "gtk_status_icon_set_tooltip_text is unavailable";

  return gtk_status_icon_set_tooltip_text;
});

var LibGtkStatusIcon = {
  /*
   * FIXME: for now, we manually close the lib, but m_conley said: well, the
   * first idea that comes to mind is to add an "unload" or "shutdown" function
   * to the main MessagingMenu object that listens for an xpcom shutdown event,
   * and then unloads the library
   */
  shutdown: function() {
    if (libgtk) libgtk.close();
  },

  // Types
  GtkStatusIcon: GtkStatusIcon,

  // Constants
  // INDICATOR_MESSAGES_SERVER_TYPE: "message",

  // Functions
  gtk_status_icon_new: gtk_status_icon_new,
  gtk_status_icon_set_from_file: gtk_status_icon_set_from_file,
  gtk_status_icon_set_tooltip_text: gtk_status_icon_set_tooltip_text,
};
