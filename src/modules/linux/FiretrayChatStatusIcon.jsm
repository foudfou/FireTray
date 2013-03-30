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
  signals: {'focus-in': {callback: {}, handler: {}}},
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
    log.debug(gicon);
    gtk.gtk_status_icon_set_from_gicon(firetray.ChatStatusIcon.trayIcon, gicon);
  },

  setIconImage: function(name) {
    this.themedIconNameCurrent = name;
    this.setIconImageFromGIcon(this.themedIcons[name]);
  },

  startIconBlinking: function() { // gtk_status_icon_set_blinking deprecated
    this.on = true;
    firetray.ChatStatusIcon.timers['blink'] = firetray.Utils.timer(
      500, Ci.nsITimer.TYPE_REPEATING_SLACK, function() {
        if (firetray.ChatStatusIcon.on)
          gtk.gtk_status_icon_set_from_pixbuf(firetray.ChatStatusIcon.trayIcon, null);
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

  setUrgency: function(xid, urgent) {
    gtk.gtk_window_set_urgency_hint(firetray.Handler.gtkWindows.get(xid), urgent);
  },

  setIconTooltip: function(txt) {
    if (!this.trayIcon) return false;
    gtk.gtk_status_icon_set_tooltip_text(this.trayIcon, txt);
    return true;
  },

  setIconTooltipDefault: function() {
    this.setIconTooltip(firetray.Handler.appName+" Chat");
  },

  attachOnFocusInCallback: function(xid) {
    log.debug("attachOnFocusInCallback xid="+xid);
    this.signals['focus-in'].callback[xid] =
      gtk.GCallbackWidgetFocuEvent_t(firetray.ChatStatusIcon.onFocusIn);
    this.signals['focus-in'].handler[xid] = gobject.g_signal_connect(
      firetray.Handler.gtkWindows.get(xid), "focus-in-event",
      firetray.ChatStatusIcon.signals['focus-in'].callback[xid], null);
    log.debug("focus-in handler="+this.signals['focus-in'].handler[xid]);
  },

  detachOnFocusInCallback: function(xid) {
    log.debug("detachOnFocusInCallback xid="+xid);
    let gtkWin = firetray.Handler.gtkWindows.get(xid);
    gobject.g_signal_handler_disconnect(gtkWin, this.signals['focus-in'].handler[xid]);
    delete this.signals['focus-in'].callback[xid];
    delete this.signals['focus-in'].handler[xid];
  },

  // NOTE: fluxbox issues a FocusIn event when switching workspace
  // by hotkey, which means 2 FocusIn events when switching to a moz app :(
  // (http://sourceforge.net/tracker/index.php?func=detail&aid=3190205&group_id=35398&atid=413960)
  onFocusIn: function(widget, event, data) {
    log.debug("onFocusIn");
    let xid = firetray.Window.getXIDFromGtkWidget(widget);
    log.debug("xid="+xid);
    firetray.Chat.stopGetAttentionMaybe(xid);
  }

  // FIXME: TODO: onclick/activate -> chatHandler.showCurrentConversation()

}; // firetray.ChatStatusIcon
