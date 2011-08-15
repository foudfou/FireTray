/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

Components.utils.import("resource://moztray/commons.js");
Components.utils.import("resource://moztray/MoztHandler.jsm");

mozt.Main = {

  onLoad: function(e) {
    // initialization code
    this.strings = document.getElementById("moztray-strings");

    try {
      // Set up preference change observer
      mozt.Utils.prefService.QueryInterface(Ci.nsIPrefBranch2);
      mozt.Utils.prefService.addObserver("", this, false);
    }
    catch (ex) {
      Components.utils.reportError(ex);
      return false;
    }

    if (!mozt.Handler.initialized)
      var initOK = mozt.Handler.init();

    // prevent window closing.
    if (mozt.Utils.prefService.getBoolPref('close_hides'))
      window.addEventListener(
        'close', function(event){mozt.Main.onClose(event);}, true);

    mozt.Debug.debug('Moztray LOADED: ' + initOK);
    return true;
  },

  onQuit: function(e) {
    // Remove observer
    mozt.Utils.prefService.removeObserver("", this);

    mozt.Debug.debug('Moztray UNLOADED !');
    /*
     *  NOTE: don't mozt.Handler.initialized=false here, otherwise after a
     *  window close, a new window will create a new handler (and hence, a new
     *  tray icon)
     */
  },

  onClose: function(event) {
    mozt.Debug.debug('Moztray CLOSE');
    mozt.Handler.showHideToTray();
    event.preventDefault();
  },

  observe: function(subject, topic, data) {
    // Observer for pref changes
    if (topic != "nsPref:changed") return;
    mozt.Debug.debug('Pref changed: '+data);

    switch(data) {
    case 'close_hides':         // prevent window closing.
      // TODO: apply to all windows !!
      if (mozt.Utils.prefService.getBoolPref('close_hides'))
        window.addEventListener(
          'close', function(event){mozt.Main.onClose(event);}, true);
      else
        window.removeEventListener(
          'close', function(event){mozt.Main.onClose(event);}, true);
      break;
    }
  },

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
