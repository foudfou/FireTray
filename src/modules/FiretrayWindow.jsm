/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
// https://developer.mozilla.org/en/Code_snippets/Preferences

var EXPORTED_SYMBOLS = [ "FiretrayWindow" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://firetray/commons.js");

let log = firetray.Logging.getLogger("firetray.FiretrayWindow");

if ("undefined" == typeof(firetray.Handler))
  log.error("This module MUST be imported from/after FiretrayHandler !");

function FiretrayWindow () {}
FiretrayWindow.prototype = {

  getRegisteredWinIdFromChromeWindow: function(win) {
    for (let wid in firetray.Handler.windows)
      if (firetray.Handler.windows[wid].chromeWin === win) return wid;
    log.error("unknown window while lookup");
    return null;
  },

};
