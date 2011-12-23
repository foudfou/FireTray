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

  onLoad: function() {
    window.removeEventListener('load', arguments.callee, true);

    // initialization code
    this.strings = document.getElementById("firetray-strings");

    try {
      // Set up preference change observer
      firetray.Utils.prefService.QueryInterface(Ci.nsIPrefBranch2);
      firetray.Utils.prefService.addObserver("", firetray.Main, false);
    }
    catch (ex) {
      ERROR(ex);
      return false;
    }

    let init = firetray.Handler.initialized || firetray.Handler.init();
    firetray.Handler.registerWindow(window);

    // update unread messages count
    if (firetray.Handler.inMailApp && firetray.Messaging.initialized)
      firetray.Messaging.updateUnreadMsgCount();

    // prevent window closing.
    window.addEventListener('close', firetray.Main.onClose, true);
    // NOTE: each new window gets a new firetray.Main, and hence listens to pref
    // changes

    LOG('Firetray LOADED: ' + init);
    return true;
  },

  onQuit: function(e) {
    window.removeEventListener('unload', arguments.callee, true);

    // Remove observer
    firetray.Utils.prefService.removeObserver("", firetray.Main);

    firetray.Handler.unregisterWindow(window);

    /* NOTE: don't firetray.Handler.initialized=false here, otherwise after a
     window close, a new window will create a new handler (and hence, a new
     tray icon) */
    LOG('Firetray UNLOADED !');
  },

  // TODO: prevent preceding warning about closing multiple tabs (browser.tabs.warnOnClose)
  onClose: function(event) {
    LOG('Firetray CLOSE');
    let hides_on_close = firetray.Utils.prefService.getBoolPref('hides_on_close');
    let hides_single_window = firetray.Utils.prefService.getBoolPref('hides_single_window');
    LOG('hides_on_close: '+hides_on_close+', hides_single_window='+hides_single_window);
    LOG('event.originalTarget: '+event.originalTarget);
    if (hides_on_close) {
      if (hides_single_window)
        firetray.Window.hideWindow(window);
      else
        firetray.Handler.hideAllWindows(window);
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
window.addEventListener('load', firetray.Main.onLoad, false);
window.addEventListener('unload', firetray.Main.onQuit, false);
