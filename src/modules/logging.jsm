/* -*- Mode: javascript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = [ "firetray" ];

if ("undefined" == typeof(firetray)) {
  var firetray = {};
};

// about:config extensions.logging.enabled
["LOG", "WARN", "ERROR"].forEach(function(aName) {
  this.__defineGetter__(aName, function() {
    Components.utils.import("resource://gre/modules/AddonLogging.jsm");
    LogManager.getLogger("firetray", this);
    return this[aName];
  });
}, firetray);
