/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = [ "firetray" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/ctypes.jsm");
// Cu.import("resource://firetray/ctypes/linux/pangocairo.jsm");
Cu.import("resource://firetray/commons.js");
// firetray.Handler.subscribeLibsForClosing([pangocairo]);

let log = firetray.Logging.getLogger("firetray.StatusIcon");

if ("undefined" == typeof(firetray.Handler))
  log.error("This module MUST be imported from/after FiretrayHandler !");


firetray.StatusIcon = {
  initialized: false,
  callbacks: {}, // pointers to JS functions. MUST LIVE DURING ALL THE EXECUTION
  trayIcon: null,
  themedIconApp: null,
  themedIconNewMail: null,
  prefAppIconNames: null,
  prefNewMailIconNames: null,
  defaultAppIconName: null,
  defaultNewMailIconName: null,

  init: function() {
    this.FILENAME_BLANK = firetray.Utils.chromeToPath(
      "chrome://firetray/skin/blank-icon.png");

    log.warn("YEAH! From Windobe!");

    this.initialized = true;
    return true;
  },

  shutdown: function() {
    log.debug("Disabling StatusIcon");
    this.initialized = false;
  },
}; // firetray.StatusIcon

firetray.Handler.setIconImageDefault = function() {
  log.debug("setIconImageDefault");
};

firetray.Handler.setIconImageNewMail = function() {
};

// firetray.Handler.setIconImageFromFile = firetray.StatusIcon.setIconImageFromFile;

firetray.Handler.setIconTooltip = function(toolTipStr) {
};

firetray.Handler.setIconTooltipDefault = function() {
};

firetray.Handler.setIconText = function(text, color) { // FIXME: function too long
};

firetray.Handler.setIconVisibility = function(visible) {
};
