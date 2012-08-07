/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = [ "firetray" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://firetray/ctypes/linux/gtk.jsm");
Cu.import("resource://firetray/commons.js");
firetray.Handler.subscribeLibsForClosing([gtk]);

if ("undefined" == typeof(firetray.StatusIcon))
  F.ERROR("This module MUST be imported from/after StatusIcon !");


firetray.GtkIcons = {
  initialized: false,

  GTK_THEME_ICON_PATH: null,

  init: function() {
    try {
      if (this.initialized) return true;

      this.loadDefaultTheme();
      this.initialized = true;
      return true;
    } catch (x) {
      F.ERROR(x);
      return false;
    }
  },

  shutdown: function() {
    this.initialized = false;
  },

  loadDefaultTheme: function() {
    this.GTK_THEME_ICON_PATH = firetray.Utils.chromeToPath("chrome://firetray/skin/linux/icons");
    F.LOG(this.GTK_THEME_ICON_PATH);
    let gtkIconTheme = gtk.gtk_icon_theme_get_default();
    F.LOG("gtkIconTheme="+gtkIconTheme);
    gtk.gtk_icon_theme_append_search_path(gtkIconTheme, this.GTK_THEME_ICON_PATH);
  }

};
