/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

/*
 * should contain our business logic in JSM, available through service objects,
 * and keep chrome scripts limited to handle presentation logic.
 * http://developer.mozilla.org/en/XUL_School/JavaScript_Object_Management.html
 */

var EXPORTED_SYMBOLS = [ "moztray" ];

const Cc = Components.classes;
const Ci = Components.interfaces;

/**
 * moztray namespace.
 */
if ("undefined" == typeof(moztray)) {
  var moztray = {
    DEBUG_MODE: true,
  };
};

moztray.Debug = {
  initialized: false,

  /**
   * Object constructor.
   */
  init: function() {
    if (this.initialized) return;
    this.consoleService = Cc['@mozilla.org/consoleservice;1'].getService(Ci.nsIConsoleService);
    this.dump("Moztray Debug initialized");
    this.initialized = true;
  },

  /* Console logging functions */
  /* NOTE: Web Console inappropriates: doesn't catch all messages */
  /*
   * CAUTION: dump() dumpObj() may be stripped from .js files during xpi build.
   * IT'S IMPORTANT THAT DEBUG CALLS ARE WRITTEN ON A SINGLE LINE !
   */
  dump: function(message) { // Debuging function -- prints to javascript console
    if(!moztray.DEBUG_MODE) return;
    this.consoleService.logStringMessage(message);
  },

  dumpObj: function(obj) {
    if(!moztray.DEBUG_MODE) return;
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
moztray.Debug.init();


moztray.Utils = {

  prefService: Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService)
    .getBranch("extensions.moztray."),

};
