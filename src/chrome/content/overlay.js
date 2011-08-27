/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

Components.utils.import("resource://moztray/commons.js");
Components.utils.import("resource://moztray/MoztHandler.jsm");

/**
 * mozt namespace.
 */
if ("undefined" == typeof(mozt)) {
  var mozt = {};
};

mozt.Main = {

  onLoad: function(e) {
    // initialization code
    this.strings = document.getElementById("moztray-strings");

    try {
      // Set up preference change observer
      mozt.Utils.prefService.QueryInterface(Ci.nsIPrefBranch2);
      let that = this;
      mozt.Utils.prefService.addObserver("", that, false);
    }
    catch (ex) {
      Components.utils.reportError(ex);
      return false;
    }

    let init = mozt.Handler.initialized || mozt.Handler.init();

    // prevent window closing.
    if (mozt.Utils.prefService.getBoolPref('close_hides')) {
      mozt.Debug.debug('close_hides set');
      let that = this;
      window.addEventListener('close', that.onClose, true);
    }

    mozt.Debug.debug('Moztray LOADED: ' + init);
    return true;
  },

  onQuit: function(e) {
    // Remove observer
    let that = this;
    mozt.Utils.prefService.removeObserver("", that);
    mozt.Debug.debug('Moztray UNLOADED !');
    /*
     *  NOTE: don't mozt.Handler.initialized=false here, otherwise after a
     *  window close, a new window will create a new handler (and hence, a new
     *  tray icon)
     */
  },

  // TODO: prevent preceding warning about closing multiple tabs
  onClose: function(event) {
    mozt.Debug.debug('Moztray CLOSE');
    mozt.Handler.showHideToTray();
    event.preventDefault();
  },

  // NOTE: each new window gets a new mozt.Main, and hence listens to pref
  // changes
  observe: function(subject, topic, data) {
    // Observer for pref changes
    if (topic != "nsPref:changed") return;
    mozt.Debug.debug('Pref changed: '+data);

    switch(data) {
    case 'close_hides':         // prevent window closing.
      let close_hides = mozt.Utils.prefService.getBoolPref('close_hides');
      let that = this;
      if (close_hides) {
        mozt.Debug.debug('close_hides: '+close_hides);
        window.addEventListener('close', that.onClose, true); // mozt.Main.onClose;
      } else {
        mozt.Debug.debug('close_hides: '+close_hides);
        window.removeEventListener('close', that.onClose, true);
      }
      break;
    }
  }

};

// should be sufficient for a delayed Startup (no need for window.setTimeout())
// https://developer.mozilla.org/en/Extensions/Performance_best_practices_in_extensions
// https://developer.mozilla.org/en/XUL_School/JavaScript_Object_Management.html
// https://developer.mozilla.org/en/Extensions/Performance_best_practices_in_extensions#Removing_Event_Listeners
window.addEventListener(
  'load', function (e) {
    removeEventListener('load', arguments.callee, true);
    mozt.Main.onLoad(); },
  false);
window.addEventListener(
  'unload', function (e) {
    removeEventListener('unload', arguments.callee, true);
    mozt.Main.onQuit(); },
  false);
