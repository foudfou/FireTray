/* -*- Mode: javascript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = [ "xinerama" ];

const XINERAMA_LIBNAME = "Xinerama";
const XINERAMA_ABIS    = [ 1 ];

const Cu = Components.utils;
const Cc = Components.classes;
const Ci = Components.interfaces;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://firetray/ctypes/ctypes-utils.jsm");
Cu.import("resource://firetray/logging.jsm");
Cu.import("resource://firetray/ctypes/x11.jsm");


function xinerama_defines(lib) {
  lib.lazy_bind("XineramaIsActive", x11.Bool, x11.Display.ptr);
}

new ctypes_library(XINERAMA_LIBNAME, XINERAMA_ABIS, xinerama_defines, this);
