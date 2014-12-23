/* -*- Mode: javascript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = [ "glib" ];

const GLIB_LIBNAME = "glib-2.0";
const GLIB_ABIS    = [ 0 ];

const Cu = Components.utils;
const Cc = Components.classes;
const Ci = Components.interfaces;

Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://firetray/ctypes/ctypes-utils.jsm");

function glib_defines(lib) {
  /* mutual inclusion not possible */
  this.GQuark = ctypes.uint32_t; // this.GQuark = gobject.guint32;
  this.GError = ctypes.StructType("GError", [
    { domain: this.GQuark },
    { code: ctypes.int },        // gint
    { message: ctypes.char.ptr } // gchar.ptr
  ]);
  lib.lazy_bind("g_error_free", ctypes.void_t, this.GError.ptr);
  lib.lazy_bind("g_strfreev", ctypes.void_t, ctypes.char.ptr.ptr);
};

new ctypes_library(GLIB_LIBNAME, GLIB_ABIS, glib_defines, this);
