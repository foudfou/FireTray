/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

/*
 * should contain our business logic in JSM, available through service objects,
 * and keep chrome scripts limited to handle presentation logic.
 * http://developer.mozilla.org/en/XUL_School/JavaScript_Object_Management.html
 */

var EXPORTED_SYMBOLS = [ "mozt" ];

const Cc = Components.classes;
const Ci = Components.interfaces;

/**
 * mozt namespace.
 */
if ("undefined" == typeof(mozt)) {
  var mozt = {
    DEBUG_MODE: true,
  };
};

mozt.Debug = {
  _initialized: false,

  /**
   * Object constructor.
   */
  init: function() {
    if (this._initialized) return;
    this._consoleService = Cc['@mozilla.org/consoleservice;1'].getService(Ci.nsIConsoleService);
    this.dump("Moztray Debug initialized");
    this._initialized = true;
  },

  /* Console logging functions */
  /* NOTE: Web Console inappropriates: doesn't catch all messages */
  /*
   * CAUTION: dump() dumpObj() may be stripped from .js files during xpi build.
   * IT'S IMPORTANT THAT DEBUG CALLS ARE WRITTEN ON A SINGLE LINE !
   */
  dump: function(message) { // Debuging function -- prints to javascript console
    if(!mozt.DEBUG_MODE) return;
    this._consoleService.logStringMessage(message);
  },

  dumpObj: function(obj) {
    if(!mozt.DEBUG_MODE) return;
    var str = "";
    for(i in obj) {
      try {
        str += "obj["+i+"]: " + obj[i] + "\n";
      } catch(e) {
        str += "obj["+i+"]: Unavailable\n";
      }
    }
    this.dump(str);
  },

};
// build it !
mozt.Debug.init();


mozt.Utils = {

  prefService: Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService)
    .getBranch("extensions.moztray."),

};
