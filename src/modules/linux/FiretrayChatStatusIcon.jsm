/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = [ "firetray" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://firetray/ctypes/ctypesMap.jsm");
Cu.import("resource://firetray/ctypes/linux/gobject.jsm");
Cu.import("resource://firetray/ctypes/linux/gio.jsm");
Cu.import("resource://firetray/ctypes/linux/gdk.jsm");
Cu.import("resource://firetray/ctypes/linux/gtk.jsm");
Cu.import("resource://firetray/linux/FiretrayWindow.jsm");
Cu.import("resource://firetray/commons.js");
firetray.Handler.subscribeLibsForClosing([gobject, gio, gtk]);

if ("undefined" == typeof(firetray.Handler))
  log.error("This module MUST be imported from/after FiretrayHandler !");

let log = firetray.Logging.getLogger("firetray.ChatStatusIcon");


firetray.ChatStatusIcon = {
  GTK_THEME_ICON_PATH: null,

  initialized: false,
  trayIcon: null,
  appId:      (function(){return Services.appinfo.ID;})(),
  themedIcons: (function(){let o = {};
    o[FIRETRAY_IM_STATUS_AVAILABLE] = null;
    o[FIRETRAY_IM_STATUS_AWAY] = null;
    o[FIRETRAY_IM_STATUS_BUSY] = null;
    o[FIRETRAY_IM_STATUS_OFFLINE] = null;
    return o;
  })(),
  themedIconNameCurrent: null,
  timers: {},

  init: function() {
    if (!firetray.Handler.inMailApp) throw "ChatStatusIcon for mail app only";
    if (!firetray.GtkIcons.initialized) throw "GtkIcons should have been initialized by StatusIcon";

    this.trayIcon = gtk.gtk_status_icon_new();
    this.loadThemedIcons();
    this.setIconImage(FIRETRAY_IM_STATUS_OFFLINE);
    this.setIconTooltipDefault();

    this.initialized = true;
    return true;
  },

  shutdown: function() {
    this.destroyIcons();
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
    if (!firetray.ChatStatusIcon.trayIcon || !gicon)
      log.error("Icon missing");
    gtk.gtk_status_icon_set_from_gicon(firetray.ChatStatusIcon.trayIcon, gicon);
  },

  setIconImage: function(name) {
    this.themedIconNameCurrent = name;
    this.setIconImageFromGIcon(this.themedIcons[name]);
  },

  setIconVoid: function() {
    gtk.gtk_status_icon_set_from_pixbuf(this.trayIcon, null);
  },

  startIconBlinking: function() { // gtk_status_icon_set_blinking() deprecated
    this.on = true;
    firetray.ChatStatusIcon.timers['blink'] = firetray.Utils.timer(
      500, Ci.nsITimer.TYPE_REPEATING_SLACK, function() {
        if (firetray.ChatStatusIcon.on)
          firetray.ChatStatusIcon.setIconVoid();
        else
          firetray.ChatStatusIcon.setIconImage(firetray.ChatStatusIcon.themedIconNameCurrent);
        firetray.ChatStatusIcon.on = !firetray.ChatStatusIcon.on;
      });
  },

  stopIconBlinking: function() {
    this.timers['blink'].cancel();
    this.setIconImage(firetray.ChatStatusIcon.themedIconNameCurrent);
    this.on = false;
  },

  setIconTooltip: function(txt) {
    if (!this.trayIcon) return false;
    gtk.gtk_status_icon_set_tooltip_text(this.trayIcon, txt);
    return true;
  },

  setIconTooltipDefault: function() {
    this.setIconTooltip(firetray.Handler.appName+" Chat");
  }

  // FIXME: TODO: onclick/activate -> chatHandler.showCurrentConversation()

}; // firetray.ChatStatusIcon
