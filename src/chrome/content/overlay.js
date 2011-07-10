/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

// TODO: Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://moztray/commons.js");
Components.utils.import("resource://moztray/LibGtkStatusIcon.js");
Components.utils.import("resource://moztray/LibGObject.js");

const MOZT_ICON_DIR = "chrome/skin/";
const MOZT_ICON_SUFFIX = "32.png";


var mozt_hideWinCb;
/* NOTE: arguments come obviously from the GCallbackFunction definition:
 * [gpointer, guint, gpointer]
 */
var mozt_hideWinJs = function(aInstance, aTimestamp, aUserData) {
  try {
    alert("Hide");
  } catch(e) {Cu.reportError(ex);}
};

mozt.Main = {

  onLoad: function() {
    // initialization code
    this.initialized = null;
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

    LibGtkStatusIcon.init();
    this.tray_icon  = LibGtkStatusIcon.gtk_status_icon_new();
    var mozApp = mozt.Utils.appInfoService.name.toLowerCase();
    var icon_filename = MOZT_ICON_DIR + mozApp + MOZT_ICON_SUFFIX;
    LibGtkStatusIcon.gtk_status_icon_set_from_file(this.tray_icon,
                                                   icon_filename);
        // gtk_status_icon_set_tooltip(tray_icon,
        //                             "Example Tray Icon");
        // gtk_status_icon_set_visible(tray_icon, TRUE);

    mozt_hideWinCb = LibGObject.GCallbackFunction(mozt_hideWinJs);

    LibGObject.g_signal_connect(this.tray_icon, "activate",
                                mozt_hideWinCb, null);


    mozt.Debug.dump('Moztray LOADED !');
    this.initialized = true;
    return true;
  },

  onQuit: function() {
    // Remove observer
    mozt.Utils.prefService.removeObserver("", this);
    LibGtkStatusIcon.shutdown();

    mozt.Debug.dump('Moztray UNLOADED !');
    this.initialized = false;
  },

  observe: function(subject, topic, data) {
    // Observer for pref changes
    if (topic != "nsPref:changed") return;
    mozt.Debug.dump('Pref changed: '+data);

    switch(data) {
    // case 'enabled':
    //   var enable = mozt.Utils.prefService.getBoolPref('enabled');
    //   this._toggle(enable);
    //   break;
    }
  },

};


// should be sufficient for a delayed Startup (no need for window.setTimeout())
// https://developer.mozilla.org/en/Extensions/Performance_best_practices_in_extensions
// https://developer.mozilla.org/en/XUL_School/JavaScript_Object_Management.html
window.addEventListener("load", function (e) { mozt.Main.onLoad(); }, false);
window.addEventListener("unload", function(e) { mozt.Main.onQuit(); }, false);
