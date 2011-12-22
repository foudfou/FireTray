/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

Components.utils.import("resource://firetray/commons.js");
Components.utils.import("resource://firetray/FiretrayHandler.jsm");

if ("undefined" == typeof(Cc)) var Cc = Components.classes;
if ("undefined" == typeof(Ci)) var Ci = Components.interfaces;
if ("undefined" == typeof(Cu)) var Cu = Components.utils;

/**
 * firetray namespace.
 */
if ("undefined" == typeof(firetray)) {
  var firetray = {};
};

firetray.Main = {

  onLoad: function(win) {
    // initialization code
    this.strings = document.getElementById("firetray-strings");

    try {
      // Set up preference change observer
      firetray.Utils.prefService.QueryInterface(Ci.nsIPrefBranch2);
      let that = this;
      firetray.Utils.prefService.addObserver("", that, false);
    }
    catch (ex) {
      ERROR(ex);
      return false;
    }

    let init = firetray.Handler.initialized || firetray.Handler.init();
    firetray.Handler.registerWindow(win);

    // update unread messages count
    if (firetray.Handler.inMailApp && firetray.Messaging.initialized)
      firetray.Messaging.updateUnreadMsgCount();

/* GTK TEST
    // prevent window closing.
    let that = this;
    window.addEventListener('close', that.onClose, true);
    // NOTE: each new window gets a new firetray.Main, and hence listens to pref
    // changes
*/

    LOG('Firetray LOADED: ' + init);
    return true;
  },

  onQuit: function(win) {
    // Remove observer
    let that = this;
    firetray.Utils.prefService.removeObserver("", that);

    firetray.Handler.unregisterWindow(win);

    /* NOTE: don't firetray.Handler.initialized=false here, otherwise after a
     window close, a new window will create a new handler (and hence, a new
     tray icon) */
    LOG('Firetray UNLOADED !');
  },

/* GTK TEST
  // TODO: prevent preceding warning about closing multiple tabs (browser.tabs.warnOnClose)
  onClose: function(event) {
    LOG('Firetray CLOSE');
    let hides_on_close = firetray.Utils.prefService.getBoolPref('hides_on_close');
    LOG('hides_on_close: '+hides_on_close);
    if (hides_on_close) {
      firetray.Handler.showHideToTray();
      event && event.preventDefault(); // no event when called directly (xul)
    }
  },
*/

  observe: function(subject, topic, data) {
    // Observer for pref changes
    if (topic != "nsPref:changed") return;
    LOG('Pref changed: '+data);
    // switch(data) { ...
  }

};

// should be sufficient for a delayed Startup (no need for window.setTimeout())
// https://developer.mozilla.org/en/Extensions/Performance_best_practices_in_extensions
// https://developer.mozilla.org/en/XUL_School/JavaScript_Object_Management.html
// https://developer.mozilla.org/en/Extensions/Performance_best_practices_in_extensions#Removing_Event_Listeners
let thatWindow = window;
window.addEventListener(
  'load', function (e) {
    removeEventListener('load', arguments.callee, true);
    firetray.Main.onLoad(thatWindow); },
  false);
window.addEventListener(
  'unload', function (e) {
    removeEventListener('unload', arguments.callee, true);
    firetray.Main.onQuit(thatWindow); },
  false);
