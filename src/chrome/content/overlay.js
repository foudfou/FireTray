/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

Components.utils.import("resource://moztray/commons.js");
Components.utils.import("resource://moztray/LibGtkStatusIcon.js");

const MOZT_ICON_DIR = "chrome/skin/";
const MOZT_ICON_FIREFOX = "firefox32.png";

moztray.Main = {

  onLoad: function() {
    // initialization code
    this.initialized = null;
    this.strings = document.getElementById("moztray-strings");

    try {
      // Set up preference change observer
      moztray.Utils.prefService.QueryInterface(Ci.nsIPrefBranch2);
      // must stay out of _toggle()
      moztray.Utils.prefService.addObserver("", this, false);
    }
    catch (ex) {
      Components.utils.reportError(ex);
      return false;
    }

    LibGtkStatusIcon.init();
    this.tray_icon  = LibGtkStatusIcon.gtk_status_icon_new();
    var icon_filename = MOZT_ICON_DIR + MOZT_ICON_FIREFOX;
    LibGtkStatusIcon.gtk_status_icon_set_from_file(this.tray_icon,
                                                   icon_filename);

    moztray.Debug.dump('Moztray LOADED !');
    this.initialized = true;
    return true;
  },

  onQuit: function() {
    // Remove observer
    moztray.Utils.prefService.removeObserver("", this);
    LibGtkStatusIcon.shutdown();

    moztray.Debug.dump('Moztray UNLOADED !');
    this.initialized = false;
  },

  observe: function(subject, topic, data) {
    // Observer for pref changes
    if (topic != "nsPref:changed") return;
    moztray.Debug.dump('Pref changed: '+data);

    switch(data) {
    case 'enabled':
      var enable = moztray.Utils.prefService.getBoolPref('enabled');
      this._toggle(enable);
      break;
    }
  },

};


// should be sufficient for a delayed Startup (no need for window.setTimeout())
// https://developer.mozilla.org/en/Extensions/Performance_best_practices_in_extensions
// https://developer.mozilla.org/en/XUL_School/JavaScript_Object_Management.html
window.addEventListener("load", function (e) { moztray.Main.onLoad(); }, false);
window.addEventListener("unload", function(e) { moztray.Main.onQuit(); }, false);
