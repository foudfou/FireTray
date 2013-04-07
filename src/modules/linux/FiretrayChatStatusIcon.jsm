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
Cu.import("resource://firetray/promise.js");
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
    gtk.gtk_status_icon_set_from_gicon(firetray.ChatStatusIcon.trayIcon, gicon);
  },

  setIconImage: function(name) {
    this.themedIconNameCurrent = name;
    this.setIconImageFromGIcon(this.themedIcons[name]);
  },

  setIconVoid: function() {
    gtk.gtk_status_icon_set_from_pixbuf(this.trayIcon, null);
  },

  /**
   * EXPERIMENTAL fancy blinking.
   * TODO: how to wait for last fade in to restore themedIconNameCurrent
   */
  crossFade: function() {

    /* borrowed from mozmill utils.js*/
    function sleep(milliseconds) {
      var timeup = false;
      function wait() { timeup = true; }
      let timer = Components.classes["@mozilla.org/timer;1"]
            .createInstance(Components.interfaces.nsITimer);
      timer.initWithCallback(wait, milliseconds, Components.interfaces.nsITimer.TYPE_ONE_SHOT);

      var thread = Components.classes["@mozilla.org/thread-manager;1"].
        getService().currentThread;
      while(!timeup) {
        thread.processNextEvent(true);
      }
    }

    let icon_theme = gtk.gtk_icon_theme_get_for_screen(gdk.gdk_screen_get_default());
    firetray.ChatStatusIcon.timers['cross-fade'] = firetray.Utils.timer(
      500, Ci.nsITimer.TYPE_REPEATING_SLACK, function() {

        // get pixbuf
        let arry = gobject.gchar.ptr.array()(2);
        arry[0] = gobject.gchar.array()(firetray.ChatStatusIcon.themedIconNameCurrent);
        arry[1] = null;
        log.debug("theme="+icon_theme+", arry="+arry);
        let icon_info = gtk.gtk_icon_theme_choose_icon(icon_theme, arry, 22, gtk.GTK_ICON_LOOKUP_FORCE_SIZE);

        // create pixbuf
        let pixbuf = gdk.gdk_pixbuf_copy(gtk.gtk_icon_info_load_icon(icon_info, null));
        gtk.gtk_icon_info_free(icon_info);   // gobject.g_object_unref(icon_info) in 3.8

        // checks
        if (gdk.gdk_pixbuf_get_colorspace(pixbuf) != gdk.GDK_COLORSPACE_RGB)
          log.error("wrong colorspace for pixbuf");
        if (gdk.gdk_pixbuf_get_bits_per_sample(pixbuf) != 8)
          log.error("wrong bits_per_sample for pixbuf");
        if (!gdk.gdk_pixbuf_get_has_alpha(pixbuf))
          log.error("pixbuf doesn't have alpha");
        let n_channels = gdk.gdk_pixbuf_get_n_channels(pixbuf);
        if (n_channels != 4)
          log.error("wrong nb of channels for pixbuf");

        // init transform
        let width = gdk.gdk_pixbuf_get_width(pixbuf);
        let height = gdk.gdk_pixbuf_get_height(pixbuf);
        log.warn("width="+width+", height="+height);
        let rowstride = gdk.gdk_pixbuf_get_rowstride(pixbuf);
        log.warn("rowstride="+rowstride);
        let length = width*height*n_channels;
        let pixels = ctypes.cast(gdk.gdk_pixbuf_get_pixels(pixbuf),
                                 gobject.guchar.array(length).ptr);
        log.warn("pixels="+pixels);

        // backup alpha for later fade-in
        let buffer = new ArrayBuffer(width*height);
        let alpha_bak = new Uint8Array(buffer);
        for (let i=3; i<length; i+=n_channels)
          alpha_bak[(i-3)/n_channels] = pixels.contents[i];

        const ALPHA_STEP = 5;

        // fade out
        for (let a=255; a>0; a-=ALPHA_STEP) {
          for(let i=3; i<length; i+=n_channels)
            if (pixels.contents[i]-ALPHA_STEP>0)
              pixels.contents[i] -= ALPHA_STEP;
          gtk.gtk_status_icon_set_from_pixbuf(firetray.ChatStatusIcon.trayIcon, pixbuf);
          sleep(10);
        }

        // fade in
        for (let a=255; a>0; a-=ALPHA_STEP) {
          for(let i=3; i<length; i+=n_channels)
            if (pixels.contents[i]+ALPHA_STEP<=alpha_bak[(i-3)/n_channels]) {
              pixels.contents[i] += ALPHA_STEP;
            }
          gtk.gtk_status_icon_set_from_pixbuf(firetray.ChatStatusIcon.trayIcon, pixbuf);
          sleep(10);
        }

        gobject.g_object_unref(pixbuf);
      });
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
      gtk.GCallbackWidgetFocusEvent_t(firetray.ChatStatusIcon.onFocusIn);
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
