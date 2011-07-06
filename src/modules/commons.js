/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

/*
 * should contain our business logic in JSM, available through service objects,
 * and keep chrome scripts limited to handle presentation logic.
 * http://developer.mozilla.org/en/XUL_School/JavaScript_Object_Management.html
 */

var EXPORTED_SYMBOLS = [ "mozt", "Cc", "Ci" ];

const Cc = Components.classes;
const Ci = Components.interfaces;

const FIREFOX_ID = "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}";
const THUNDERBIRD_ID = "{3550f703-e582-4d05-9a08-453d09bdfdc6}";
const SONGBIRD_ID = "songbird@songbirdnest.com";
const SUNBIRD_ID = "{718e30fb-e89b-41dd-9da7-e25a45638b28}";
const SEAMONKEY_ID = "{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}";
const CHATZILLA_ID = "{59c81df5-4b7a-477b-912d-4e0fdf64e5f2}";

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

  appInfoService: Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo), // appInfoService.name.toLower

};
