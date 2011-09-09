/* -*- Mode: javascript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = ["LibGLib"];

const LIB_GLIB = "libglib-2.0.so.0";

const Cu = Components.utils;
const Cc = Components.classes;
const Ci = Components.interfaces;

Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyGetter(this, "libglib", function() {
  var libglib = ctypes.open(LIB_GLIB);
  if (!libglib)
    throw "libglib is unavailable";
  return libglib;
});

XPCOMUtils.defineLazyGetter(this, "GError", function() {
  return ctypes.StructType("GError");
});


var LibGLib = {
  GError: GError
}
