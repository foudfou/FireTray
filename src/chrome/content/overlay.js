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
      ERROR(ex);
      return false;
    }

    let init = mozt.Handler.initialized || mozt.Handler.init();

    // update unread messages count
    if (mozt.Handler._inMailApp)
      mozt.Messaging.updateUnreadMsgCount();

    // prevent window closing.
    let that = this;
    window.addEventListener('close', that.onClose, true);
    // NOTE: each new window gets a new mozt.Main, and hence listens to pref
    // changes

    LOG('Moztray LOADED: ' + init);
    return true;
  },

  onQuit: function(e) {
    // Remove observer
    let that = this;
    mozt.Utils.prefService.removeObserver("", that);
    LOG('Moztray UNLOADED !');
    /* NOTE: don't mozt.Handler.initialized=false here, otherwise after a
     window close, a new window will create a new handler (and hence, a new
     tray icon) */
  },

  // TODO: prevent preceding warning about closing multiple tabs
  // (browser.tabs.warnOnClose)
  onClose: function(event) {
    LOG('Moztray CLOSE');
    let close_hides = mozt.Utils.prefService.getBoolPref('close_hides');
    LOG('close_hides: '+close_hides);
    if (close_hides) {
      mozt.Handler.showHideToTray();
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

// // TEST - can we catch minimize event ?
// window.addEventListener(
//   'DOMAttrModified', function (e) { // focus
//     removeEventListener('deactivate', arguments.callee, true);
//     WARN("Got deactivated: "+e.originalTarget.windowState); // Ci.nsIDOMChromeWindow.STATE_MINIMIZED|STATE_NORMAL
//     WARN("attrName: "+e.attrName);
//   },
//   false);
