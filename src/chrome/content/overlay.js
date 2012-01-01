/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

Components.utils.import("resource://firetray/commons.js");
Components.utils.import("resource://firetray/FiretrayHandler.jsm");

if ("undefined" == typeof(Cc)) var Cc = Components.classes;
if ("undefined" == typeof(Ci)) var Ci = Components.interfaces;
if ("undefined" == typeof(Cu)) var Cu = Components.utils;

// https://groups.google.com/group/mozilla.dev.extensions/browse_thread/thread/e89e9c2a834ff2b6#
var firetrayChrome = {

  onLoad: function(win) {
    // strings a chrome-specific
    this.strings = document.getElementById("firetray-strings");

    try {
      // Set up preference change observer
      firetray.Utils.prefService.QueryInterface(Ci.nsIPrefBranch2);
      firetray.Utils.prefService.addObserver("", firetrayChrome, false);
    }
    catch (ex) {
      ERROR(ex);
      return false;
    }

    LOG("Handler initialized: "+firetray.Handler.initialized);
    let init = firetray.Handler.initialized || firetray.Handler.init();

    LOG("ONLOAD"); firetray.Handler.dumpWindows();
    firetray.Handler.registerWindow(win);

    // update unread messages count
    if (firetray.Handler.inMailApp && firetray.Messaging.initialized)
      firetray.Messaging.updateUnreadMsgCount();

    // prevent window closing.
    win.addEventListener('close', firetrayChrome.onClose, true);
    // NOTE: each new window gets a new firetrayChrome, and hence listens to
    // pref changes

    LOG('Firetray LOADED: ' + init);
    return true;
  },

  onQuit: function(win) {
    // Remove observer
    firetray.Utils.prefService.removeObserver("", firetrayChrome);

    firetray.Handler.unregisterWindow(win);

    /* NOTE: don't firetray.Handler.initialized=false here, otherwise after a
     window close, a new window will create a new handler (and hence, a new
     tray icon) */
    LOG('Firetray UNLOADED !');
  },

  // TODO: prevent preceding warning about closing multiple tabs (browser.tabs.warnOnClose)
  onClose: function(event) {
    LOG('Firetray CLOSE');
    let win = event.originalTarget;
    if (!win instanceof ChromeWindow)
      throw new TypeError('originalTarget not a ChromeWindow');

    let hides_on_close = firetray.Utils.prefService.getBoolPref('hides_on_close');
    let hides_single_window = firetray.Utils.prefService.getBoolPref('hides_single_window');
    LOG('hides_on_close: '+hides_on_close+', hides_single_window='+hides_single_window);
    if (hides_on_close) {
      if (hides_single_window) {
        let winId = firetray.Handler.getWindowIdFromChromeWindow(win);
        firetray.Handler.hideSingleWindow(winId);
      } else
        firetray.Handler.hideAllWindows();
      event && event.preventDefault(); // no event when called directly (xul)
    }
  },

  observe: function(subject, topic, data) {
    // Observer for pref changes
    if (topic != "nsPref:changed") return;
    LOG('Pref changed: '+data);
    // switch(data) { ...
  }

};

// should be sufficient for a delayed Startup (no need for window.setTimeout())
// https://developer.mozilla.org/en/XUL_School/JavaScript_Object_Management.html
// https://developer.mozilla.org/en/Extensions/Performance_best_practices_in_extensions#Removing_Event_Listeners
window.addEventListener(
  'load', function (e) {
    removeEventListener('load', arguments.callee, true);
    firetrayChrome.onLoad(this); },
  false);
window.addEventListener(
  'unload', function (e) {
    removeEventListener('unload', arguments.callee, true);
    firetrayChrome.onQuit(this); },
  false);
