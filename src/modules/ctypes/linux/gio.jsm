/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = [ "gio" ];

const GIO_LIBNAME = "gio-2.0";
const GIO_ABIS    = [ "0" ];

const Cu = Components.utils;
const Cc = Components.classes;
const Ci = Components.interfaces;

Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://firetray/ctypes/ctypes-utils.jsm");
Cu.import("resource://firetray/ctypes/linux/gobject.jsm");

function gio_defines(lib) {
  this.GIcon = ctypes.StructType("GIcon");
  this.GThemedIcon = ctypes.StructType("GThemedIcon");

  lib.lazy_bind("g_themed_icon_new", this.GIcon.ptr, ctypes.char.ptr);
  lib.lazy_bind("g_themed_icon_new_from_names", this.GIcon.ptr, ctypes.char.ptr.ptr, ctypes.int);
  lib.lazy_bind("g_themed_icon_get_names", gobject.gchar.ptr.ptr, this.GThemedIcon.ptr);

}

new ctypes_library(GIO_LIBNAME, GIO_ABIS, gio_defines, this);
