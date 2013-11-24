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

  updateVisibility: function(winId, visibility) {
    let win = firetray.Handler.windows[winId];
    if (win.visible === visibility)
      log.warn("window (winId="+winId+") was already visible="+win.visible);

    firetray.Handler.visibleWindowsCount = visibility ?
      firetray.Handler.visibleWindowsCount + 1 :
      firetray.Handler.visibleWindowsCount - 1 ;

    win.visible = visibility; // nsIBaseWin.visibility always true :-(
  },

};
