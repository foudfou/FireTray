/* -*- Mode: javascript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = ["LibC"];

const LIB_C = "libc.so.6";

const Cu = Components.utils;
const Cc = Components.classes;
const Ci = Components.interfaces;

Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyGetter(this, "libc", function() {
  var libc = ctypes.open(LIB_C);
  if (!libc)
    throw "libc is unavailable";

  return libc;
});

XPCOMUtils.defineLazyGetter(this, "FILE", function() {
  return ctypes.StructType("FILE");
});

XPCOMUtils.defineLazyGetter(this, "pid_t", function() {
  return ctypes.int;
});

XPCOMUtils.defineLazyGetter(this, "fdopen", function() {
  var fdopen = libc.declare(
    "fdopen", ctypes.default_abi, FILE.ptr,
    ctypes.int,
    ctypes.char.ptr
  );

  if (!fdopen)
    throw "fdopen is unavailable";

  return fdopen;
});


XPCOMUtils.defineLazyGetter(this, "puts", function() {
  var puts = libc.declare(
    "puts", ctypes.default_abi, ctypes.int32_t,
    ctypes.char.ptr
  );

  if (!puts)
    throw "puts is unavailable";

  return puts;
});

XPCOMUtils.defineLazyGetter(this, "fputs", function() {
  var fputs = libc.declare(
    "fputs", ctypes.default_abi, ctypes.int32_t,
    ctypes.char.ptr,
    FILE.ptr
  );

  if (!fputs)
    throw "fputs is unavailable";

  return fputs;
});

XPCOMUtils.defineLazyGetter(this, "fflush", function() {
  var fflush = libc.declare(
    "fflush", ctypes.default_abi, ctypes.int32_t,
    FILE.ptr
  );

  if (!fflush)
    throw "fflush is unavailable";

  return fflush;
});

// pid_t getpid(void);
XPCOMUtils.defineLazyGetter(this, "getpid", function() {
  var getpid = libc.declare(
    "getpid", ctypes.default_abi, pid_t
  );

  if (!getpid)
    throw "getpid is unavailable";

  return getpid;
});

var LibC = {
  stderr: this.fdopen(2, "a"),

  FILE: FILE,
  pid_t: pid_t,

  fdopen: fdopen,
  puts: puts,
  fputs: fputs,
  fflush: fflush,
  getpid: getpid,
}
