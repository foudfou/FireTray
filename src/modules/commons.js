/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = [ "mozt", "Cc", "Ci", "Cu", "LOG", "WARN", "ERROR" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");

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
  var mozt = {};
};

// about:config extensions.logging.enabled
["LOG", "WARN", "ERROR"].forEach(function(aName) {
  this.__defineGetter__(aName, function() {
    Components.utils.import("resource://gre/modules/AddonLogging.jsm");
    LogManager.getLogger("moztray", this);
    return this[aName];
  });
}, this);

mozt.Utils = {
  prefService: Services.prefs.getBranch("extensions.moztray.")
};
