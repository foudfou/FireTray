/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = [ "firetray" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://firetray/ctypes/linux/gobject.jsm");
Cu.import("resource://firetray/ctypes/linux/gio.jsm");
Cu.import("resource://firetray/ctypes/linux/gtk.jsm");
Cu.import("resource://firetray/commons.js");

if ("undefined" == typeof(firetray.Handler))
  F.ERROR("This module MUST be imported from/after FiretrayHandler !");


firetray.IMStatusIcon = {
  GTK_THEME_ICON_PATH: null,

  initialized: false,
  trayIcon: null,
  themedIcons: {
    "user-available": null,
    "user-away": null,
    "user-busy": null,
    "user-offline": null
  },

  init: function() {
    if (!firetray.Handler.inMailApp) throw "IMStatusIcon for mail app only";
    if (!firetray.GtkIcons.initialized) throw "GtkIcons should have been initialized by StatusIcon";

    this.trayIcon = gtk.gtk_status_icon_new();
    this.loadThemedIcons();
    this.setIconImageFromGIcon(this.themedIcons["user-offline"]);

    this.initialized = true;
    return true;
  },

  shutdown: function() {
    this.destroyIcons();
    // FIXME: tryCloseLibs should be done by Handler only, submodules should
    // just pass the imported ctypes modules to it
    // firetray.Utils.tryCloseLibs([gobject, gio, gtk]);
    this.initialized = false;
  },

  loadThemedIcons: function() {
    for (let name in this.themedIcons)
      this.themedIcons[name] = gio.g_themed_icon_new(name);
  },

  destroyIcons: function() {
    for (let name in this.themedIcons) {
      let gicon = this.themedIcons[name];
      gicon = gobject.g_object_unref(gicon);
    }
    gobject.g_object_unref(this.trayIcon);
  },

  setIconImageFromGIcon: function(gicon) {
    if (!firetray.IMStatusIcon.trayIcon || !gicon)
      F.ERROR("Icon missing");
    F.LOG(gicon);
    gtk.gtk_status_icon_set_from_gicon(firetray.IMStatusIcon.trayIcon, gicon);
  }

}; // firetray.IMStatusIcon
