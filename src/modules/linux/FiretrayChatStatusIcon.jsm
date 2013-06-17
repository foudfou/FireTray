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

const ALPHA_STEP                    = 5;
const ALPHA_STEP_SLEEP_MILLISECONDS = 10;
const FADE_OVER_SLEEP_MILLISECONDS  = 500;


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
  events: {},
  generators: {},
  pixBuffer: {},
  convsToAcknowledge: {
    ids: {},
    length: function(){return Object.keys(this.ids).length;}
  },
  get isBlinking () {return (this.convsToAcknowledge.length() > 0);},

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

    let blinkStyle = firetray.Utils.prefService.getIntPref("chat_icon_blink_style");
    if (blinkStyle === FIRETRAY_CHAT_ICON_BLINK_STYLE_FADE &&
        this.isBlinking) {
      this.events['icon-changed'] = true;
      return;
    }

    this.setIconImageFromGIcon(this.themedIcons[name]);
  },

  setIconVoid: function() {
    gtk.gtk_status_icon_set_from_pixbuf(this.trayIcon, null);
  },

  buildPixBuf: function() {
    let icon_theme = gtk.gtk_icon_theme_get_for_screen(gdk.gdk_screen_get_default());

    // get pixbuf
    let arry = gobject.gchar.ptr.array()(2);
    arry[0] = gobject.gchar.array()(firetray.ChatStatusIcon.themedIconNameCurrent);
    arry[1] = null;
    log.debug("icon name="+firetray.ChatStatusIcon.themedIconNameCurrent+", theme="+icon_theme+", arry="+arry);
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
    log.debug("width="+width+", height="+height);
    let length = width*height*n_channels;
    let pixels = ctypes.cast(gdk.gdk_pixbuf_get_pixels(pixbuf),
                             gobject.guchar.array(length).ptr);
    log.debug("pixels="+pixels);

    // backup alpha for later fade-in
    let buffer = new ArrayBuffer(width*height);
    let alpha_bak = new Uint8Array(buffer);
    for (let i=3; i<length; i+=n_channels)
      alpha_bak[(i-3)/n_channels] = pixels.contents[i];

    log.debug("pixbuf created");
    this.pixBuffer = {
      pixbuf: pixbuf,           // TO BE UNREFED WITH to g_object_unref() !!
      width: width,
      height: height,
      length: length,
      n_channels: n_channels,
      pixels: pixels,
      buffer: buffer,
      alpha_bak: alpha_bak
    };
  },
  dropPixBuf: function() {
    gobject.g_object_unref(this.pixBuffer.pixbuf);
    log.debug("pixbuf unref'd");
    this.pixBuffer = {};
  },

  fadeGenerator: function() {
    let pixbuf = firetray.ChatStatusIcon.pixBuffer;

    for (let a=255; a>0; a-=ALPHA_STEP) {
      for(let i=3; i<pixbuf.length; i+=pixbuf.n_channels)
        if (pixbuf.pixels.contents[i]-ALPHA_STEP>0)
          pixbuf.pixels.contents[i] -= ALPHA_STEP;
      gtk.gtk_status_icon_set_from_pixbuf(firetray.ChatStatusIcon.trayIcon, pixbuf.pixbuf);
      yield true;
    }

    for (let a=255; a>0; a-=ALPHA_STEP) {
      for(let i=3; i<pixbuf.length; i+=pixbuf.n_channels)
        if (pixbuf.pixels.contents[i]+ALPHA_STEP<=pixbuf.alpha_bak[(i-3)/pixbuf.n_channels]) {
          pixbuf.pixels.contents[i] += ALPHA_STEP;
        }
      gtk.gtk_status_icon_set_from_pixbuf(firetray.ChatStatusIcon.trayIcon, pixbuf.pixbuf);
      yield true;
    }
  },

  fadeStep: function() {
    try {
      if (firetray.ChatStatusIcon.generators['fade'].next())
        firetray.ChatStatusIcon.timers['fade-step'] = firetray.Utils.timer(
          ALPHA_STEP_SLEEP_MILLISECONDS, Ci.nsITimer.TYPE_ONE_SHOT,
          firetray.ChatStatusIcon.fadeStep);
    } catch (e if e instanceof StopIteration) {

      log.warn("stop-fade 1:"+firetray.ChatStatusIcon.events['stop-fade']);
      if (firetray.ChatStatusIcon.events['stop-fade']) {
        log.debug("stop-fade");
        delete firetray.ChatStatusIcon.events['stop-fade'];
        delete firetray.ChatStatusIcon.generators['fade'];
        delete firetray.ChatStatusIcon.timers['fade-step'];
        delete firetray.ChatStatusIcon.timers['fade-loop'];
        firetray.ChatStatusIcon.setIconImage(firetray.ChatStatusIcon.themedIconNameCurrent);
        firetray.ChatStatusIcon.dropPixBuf(p);
        return;
      }

      if (firetray.ChatStatusIcon.events['icon-changed']) {
        delete firetray.ChatStatusIcon.events['icon-changed'];
        firetray.ChatStatusIcon.dropPixBuf();
        firetray.ChatStatusIcon.buildPixBuf();
        firetray.ChatStatusIcon.timers['fade-loop'] = firetray.Utils.timer(
          FADE_OVER_SLEEP_MILLISECONDS, Ci.nsITimer.TYPE_ONE_SHOT, function(){
            firetray.ChatStatusIcon.fadeLoop();}
        );

      } else {
        log.warn("fadeLoop else -> 0");
        firetray.ChatStatusIcon.timers['fade-loop'] = firetray.Utils.timer(
          FADE_OVER_SLEEP_MILLISECONDS, Ci.nsITimer.TYPE_ONE_SHOT, function(){
            log.warn("fadeLoop else -> 1");
            firetray.ChatStatusIcon.fadeLoop();}
        );
      }
    };
  },

  fadeLoop: function() {
    log.warn("stop-fade 0:"+firetray.ChatStatusIcon.events['stop-fade']);
    firetray.ChatStatusIcon.generators['fade'] = firetray.ChatStatusIcon.fadeGenerator();
    firetray.ChatStatusIcon.fadeStep();
  },

  startFading: function() {
    log.debug("startFading");
    this.buildPixBuf();
    this.fadeLoop();
  },

  stopFading: function() {
    log.debug("stopFading");
    this.events['stop-fade'] = true;
  },

  startBlinking: function() { // gtk_status_icon_set_blinking() deprecated
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

  stopBlinking: function() {
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

  // TODO: onclick/activate -> chatHandler.showCurrentConversation()

}; // firetray.ChatStatusIcon
