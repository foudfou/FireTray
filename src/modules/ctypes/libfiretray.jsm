/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = ["libfiretray"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://firetray/logging.jsm");

const _path = (function(){
  var uri = Services.io.newURI('resource://firetray-lib', null, null);
  if (uri instanceof Ci.nsIFileURL)
    return uri.file.path;
  throw new Error("path not resolved");
})();

var libfiretray = {

  _lib: null,

  init: function() {
    // If ctypes doesn't exist, try to get it
    Cu.import("resource://gre/modules/ctypes.jsm");
    // If we still don't have ctypes, this isn't going to work...
    if (typeof(ctypes) == "undefined") {
      throw ("Could not load JS-Ctypes");
    }

    try {
      // Try to start up dependencies - if they fail, they'll throw
      // exceptions. ex: GObjectLib.init();

      this._lib = ctypes.open(_path);
      if (!this._lib)
        throw ("Could not load " + _path);

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
    this.gdk_is_window = this._lib.declare("gdk_is_window", ctypes.default_abi, ctypes.int, ctypes.void_t.ptr);
  }

};
