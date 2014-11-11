/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = [ "firetray" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://firetray/ctypes/linux/cairo.jsm");
Cu.import("resource://firetray/ctypes/linux/gobject.jsm");
Cu.import("resource://firetray/ctypes/linux/gdk.jsm");
Cu.import("resource://firetray/ctypes/linux/gio.jsm");
Cu.import("resource://firetray/ctypes/linux/glib.jsm");
Cu.import("resource://firetray/ctypes/linux/gtk.jsm");
Cu.import("resource://firetray/ctypes/linux/pango.jsm");
Cu.import("resource://firetray/ctypes/linux/pangocairo.jsm");
Cu.import("resource://firetray/commons.js");
firetray.Handler.subscribeLibsForClosing([cairo, gobject, gdk, gio, gtk, pango, pangocairo]);

let log = firetray.Logging.getLogger("firetray.StatusIcon");

if ("undefined" == typeof(firetray.Handler))
  log.error("This module MUST be imported from/after FiretrayHandler !");


firetray.StatusIcon = {
  MIN_FONT_SIZE: 4,
  FILENAME_BLANK: null,

  initialized: false,
  callbacks: {}, // pointers to JS functions. MUST LIVE DURING ALL THE EXECUTION
  trayIcon: null,
  themedIconApp: null,
  themedIconNewMail: null,
  prefAppIconNames: null,
  prefNewMailIconNames: null,
  defaultAppIconName: null,
  defaultNewMailIconName: null,
  inidicator: null,

  init: function() {
    this.FILENAME_BLANK = firetray.Utils.chromeToPath(
      "chrome://firetray/skin/icons/blank-icon.png");

    Cu.import("resource://firetray/linux/FiretrayGtkIcons.jsm");
    firetray.GtkIcons.init();
    this.defineIconNames();
    this.loadThemedIcons();

    Cu.import("resource://firetray/linux/FiretrayPopupMenu.jsm");
    if (!firetray.PopupMenu.init())
      return false;

    // FIXME: we may want to split into 2 separate modules: GtkStatusIcon and
    // AppIndicator.
    Cu.import("resource://firetray/ctypes/linux/appindicator.jsm");
    if (appind3.available() && this.dbusNotificationWatcherReady()) {
      firetray.Handler.subscribeLibsForClosing([appind3]);
      this.indicatorInit();
    } else {
      this.trayIcon = gtk.gtk_status_icon_new();
      firetray.Handler.setIconImageDefault();
      firetray.Handler.setIconTooltipDefault();
      this.addCallbacks();
    }

    this.initialized = true;
    return true;
  },

  shutdown: function() {
    log.debug("Disabling StatusIcon");
    firetray.PopupMenu.shutdown();
    // FIXME: should destroy/hide icon here
    firetray.GtkIcons.shutdown();
    this.initialized = false;
  },

  indicatorInit: function() {
    this.indicator = appind3.app_indicator_new(
      FIRETRAY_APPINDICATOR_ID,
      'firefox',
      appind3.APP_INDICATOR_CATEGORY_COMMUNICATIONS
    );
    appind3.app_indicator_set_status(this.indicator, appind3.APP_INDICATOR_STATUS_ACTIVE);
    appind3.app_indicator_set_menu(this.indicator, firetray.PopupMenu.menu); // mandatory
    log.warn("indicator="+this.indicator);
    /*
     let gval = new gobject.gboolean;
     gobject.g_object_get(
     ctypes.cast(this.indicator, gobject.gpointer),
     "connected",
     gval.address(),
     ctypes.voidptr_t(null)
     );
     log.warn("gval="+gval+" true? "+!firetray.js.strEquals(gval, gobject.FALSE));
     */
    this.callbacks.indicator = appind3.AppIndicatorConnectionChangedCb_t(
      firetray.StatusIcon.onAppIndicatorConnectionChanged); // void return, no sentinel
    gobject.g_signal_connect(this.indicator, "connection-changed",
                             firetray.StatusIcon.callbacks.indicator, null);
    log.warn("status="+appind3.app_indicator_get_status(this.indicator));
  },

  defineIconNames: function() {
    this.prefAppIconNames = (function() {
      if (firetray.Handler.inMailApp) {
        return "app_mail_icon_names";
      } else if (firetray.Handler.inBrowserApp) {
        return "app_browser_icon_names";
      } else {
        return "app_default_icon_names";
      }
    })();
    this.defaultAppIconName = firetray.Handler.appName.toLowerCase();

    this.prefNewMailIconNames = "new_mail_icon_names";
    this.defaultNewMailIconName = "mail-unread";
  },

  loadThemedIcons: function() {
    if (firetray.Handler.inMailApp) {
      let newMailIconNames = this.getNewMailIconNames();
      if (this.themedIconNewMail) gobject.g_object_unref(this.themedIconNewMail);
      this.themedIconNewMail = this.initThemedIcon(newMailIconNames);
    }
    let appIconNames = this.getAppIconNames();
    if (this.themedIconApp) gobject.g_object_unref(this.themedIconApp);
    this.themedIconApp = this.initThemedIcon(appIconNames);
  },

  loadImageCustom: function() { }, // done in setIconImageCustom

  getAppIconNames: function() {
    let appIconNames = firetray.Utils.getArrayPref(this.prefAppIconNames);
    appIconNames.push(this.defaultAppIconName);
    return appIconNames;
  },
  getNewMailIconNames: function() {
    let newMailIconNames = firetray.Utils.getArrayPref(this.prefNewMailIconNames);
    newMailIconNames.push(this.defaultNewMailIconName);
    return newMailIconNames;
  },

  initThemedIcon: function(names) {
    if (!firetray.js.isArray(names)) throw new TypeError();
    log.debug("themedIconNames="+names);
    let namesLen = names.length;
    log.debug("themedIconNamesLen="+namesLen);
    let themedIconNames = ctypes.char.ptr.array(namesLen)();
    for (let i=0; i<namesLen; ++i)
      themedIconNames[i] = ctypes.char.array()(names[i]);
    log.debug("themedIconNames="+themedIconNames);
    let themedIcon = gio.g_themed_icon_new_from_names(themedIconNames, namesLen);
    log.debug("themedIcon="+themedIcon);
    return themedIcon;
  },

  addCallbacks: function() {
    /* NOTE: here we do use a function handler (instead of a function
     definition) because we need the args passed to it ! As a consequence, we
     need to abandon 'this' in PopupMenu.popup() */
    this.callbacks.menuPopup = gtk.GCallbackMenuPopup_t(firetray.PopupMenu.popup); // void return, no sentinel
    gobject.g_signal_connect(this.trayIcon, "popup-menu",
      firetray.StatusIcon.callbacks.menuPopup, firetray.PopupMenu.menu);
    this.callbacks.onScroll = gtk.GCallbackOnScroll_t(
      firetray.StatusIcon.onScroll, null, FIRETRAY_CB_SENTINEL);
    gobject.g_signal_connect(this.trayIcon, "scroll-event",
      firetray.StatusIcon.callbacks.onScroll, null);

    log.debug("showHideAllWindows: "+firetray.Handler.hasOwnProperty("showHideAllWindows"));
    this.callbacks.iconActivate = gtk.GCallbackStatusIconActivate_t(
      firetray.StatusIcon.onClick, null, FIRETRAY_CB_SENTINEL);
    let handlerId = gobject.g_signal_connect(firetray.StatusIcon.trayIcon,
      "activate", firetray.StatusIcon.callbacks.iconActivate, null);
    log.debug("g_connect activate="+handlerId);

    this.callbacks.iconMiddleClick = gtk.GCallbackStatusIconMiddleClick_t(
      firetray.Handler.activateLastWindowCb, null, FIRETRAY_CB_SENTINEL);
    handlerId = gobject.g_signal_connect(firetray.StatusIcon.trayIcon,
      "button-press-event", firetray.StatusIcon.callbacks.iconMiddleClick, null);
    log.debug("g_connect middleClick="+handlerId);
  },

  onScroll: function(icon, event, data) {
    if (!firetray.Utils.prefService.getBoolPref("scroll_hides"))
      return false;

    let iconGpointer = ctypes.cast(icon, gobject.gpointer);
    let gdkEventScroll = ctypes.cast(event, gdk.GdkEventScroll.ptr);
    let scroll_mode = firetray.Utils.prefService.getCharPref("scroll_mode");

    let direction = gdkEventScroll.contents.direction;
    switch(direction) {
    case gdk.GDK_SCROLL_UP:
      log.debug("SCROLL UP");
      if (scroll_mode === "down_hides")
        firetray.Handler.showAllWindows();
      else if (scroll_mode === "up_hides")
        firetray.Handler.hideAllWindows();
      break;
    case gdk.GDK_SCROLL_DOWN:
      log.debug("SCROLL DOWN");
      if (scroll_mode === "down_hides")
        firetray.Handler.hideAllWindows();
      else if (scroll_mode === "up_hides")
        firetray.Handler.showAllWindows();
      break;
    default:
      log.error("SCROLL UNKNOWN");
    }

    let stopPropagation = false;
    return stopPropagation;
  },

  onClick: function(gtkStatusIcon, userData) {
    firetray.Handler.showHideAllWindows();
    let stopPropagation = true;
    return stopPropagation;
  },

  setIconImageFromFile: function(filename) {
    if (!firetray.StatusIcon.trayIcon)
      log.error("Icon missing");
    log.debug(filename);
    gtk.gtk_status_icon_set_from_file(firetray.StatusIcon.trayIcon,
                                      filename);
  },

  setIconImageFromGIcon: function(gicon) {
    if (!firetray.StatusIcon.trayIcon || !gicon)
      log.error("Icon missing");
    log.debug(gicon);
    gtk.gtk_status_icon_set_from_gicon(firetray.StatusIcon.trayIcon, gicon);
  },

  onAppIndicatorConnectionChanged: function(indicator, connected, data) {
    log.warn("AppIndicator connection-changed: "+connected);
  },

  dbusNotificationWatcherReady: function() {
    let watcherReady = false;

    function error(e) {
      if (!e.isNull()) {
        log.error(e.contents.message);
        glib.g_error_free(e);
      }
    }

    let conn = new gio.GDBusConnection.ptr;
    let err = new glib.GError.ptr(null);
    conn = gio.g_bus_get_sync(gio.G_BUS_TYPE_SESSION, null, err.address());
    if (error(err)) return watcherReady;

    if (!conn.isNull()) {
      let flags = gio.G_DBUS_PROXY_FLAGS_DO_NOT_AUTO_START |
            gio.G_DBUS_PROXY_FLAGS_DO_NOT_LOAD_PROPERTIES |
            gio.G_DBUS_PROXY_FLAGS_DO_NOT_CONNECT_SIGNALS;

      let proxy = gio.g_dbus_proxy_new_for_bus_sync(
        gio.G_BUS_TYPE_SESSION,
        flags,
        null, /* GDBusInterfaceInfo */
        appind3.NOTIFICATION_WATCHER_DBUS_ADDR,
        appind3.NOTIFICATION_WATCHER_DBUS_OBJ,
        appind3.NOTIFICATION_WATCHER_DBUS_IFACE,
        null, /* GCancellable */
        err.address());
      if (error(err)) return watcherReady;

      if (!proxy.isNull()) {
        let owner = gio.g_dbus_proxy_get_name_owner(proxy);
        if (!owner.isNull()) {
          watcherReady = true;
        }
        gobject.g_object_unref(proxy);
      }

      gobject.g_object_unref(conn);
    }

    return watcherReady;
  }

}; // firetray.StatusIcon

firetray.Handler.setIconImageDefault = function() {
  log.debug("setIconImageDefault");
  if (!firetray.StatusIcon.themedIconApp)
    throw "Default application themed icon not set";
  let appIconType = firetray.Utils.prefService.getIntPref("app_icon_type");
  if (appIconType === FIRETRAY_APPLICATION_ICON_TYPE_THEMED)
    firetray.StatusIcon.setIconImageFromGIcon(firetray.StatusIcon.themedIconApp);
  else if (appIconType === FIRETRAY_APPLICATION_ICON_TYPE_CUSTOM)
    firetray.Handler.setIconImageCustom("app_icon_custom");
};

firetray.Handler.setIconImageNewMail = function() {
  firetray.StatusIcon.setIconImageFromGIcon(firetray.StatusIcon.themedIconNewMail);
};

firetray.Handler.setIconImageCustom = function(prefname) {
  let prefCustomIconPath = firetray.Utils.prefService.getCharPref(prefname);
  firetray.StatusIcon.setIconImageFromFile(prefCustomIconPath);
};

// GTK bug: Gdk-CRITICAL **: IA__gdk_window_get_root_coords: assertion `GDK_IS_WINDOW (window)' failed
firetray.Handler.setIconTooltip = function(toolTipStr) {
  if (!firetray.StatusIcon.trayIcon)
    return false;

  try {
    gtk.gtk_status_icon_set_tooltip_text(firetray.StatusIcon.trayIcon,
                                         toolTipStr);
  } catch (x) {
    log.error(x);
    return false;
  }
  return true;
};

firetray.Handler.setIconTooltipDefault = function() {
  if (!this.appName)
    throw "application name not initialized";
  this.setIconTooltip(this.appName);
};

firetray.Handler.setIconText = function(text, color) { // FIXME: function too long
  log.debug("setIconText, color="+color);
  if (typeof(text) != "string")
    throw new TypeError();

  try {
    // build background from image
    let specialIcon = gdk.gdk_pixbuf_new_from_file(
      firetray.StatusIcon.FILENAME_BLANK, null); // GError **error);
    let dest = gdk.gdk_pixbuf_copy(specialIcon);
    let w = gdk.gdk_pixbuf_get_width(specialIcon);
    let h = gdk.gdk_pixbuf_get_height(specialIcon);

    // prepare colors/alpha
    let colorMap = gdk.gdk_screen_get_system_colormap(gdk.gdk_screen_get_default());
    let visual = gdk.gdk_colormap_get_visual(colorMap);
    let visualDepth = visual.contents.depth;
    log.debug("colorMap="+colorMap+" visual="+visual+" visualDepth="+visualDepth);
    let fore = new gdk.GdkColor;
    fore.pixel = fore.red = fore.green = fore.blue = 0;
    let alpha  = new gdk.GdkColor;
    alpha.pixel = alpha.red = alpha.green = alpha.blue = 0xFFFF;
    if (!fore || !alpha)
      log.warn("Undefined GdkColor fore or alpha");
    gdk.gdk_color_parse(color, fore.address());
    if(fore.red == alpha.red && fore.green == alpha.green && fore.blue == alpha.blue) {
      alpha.red=0; // make sure alpha is different from fore
    }
    gdk.gdk_colormap_alloc_color(colorMap, fore.address(), true, true);
    gdk.gdk_colormap_alloc_color(colorMap, alpha.address(), true, true);

    // build pixmap with rectangle
    let pm = gdk.gdk_pixmap_new(null, w, h, visualDepth);
    let pmDrawable = ctypes.cast(pm, gdk.GdkDrawable.ptr);
    let cr = gdk.gdk_cairo_create(pmDrawable);
    gdk.gdk_cairo_set_source_color(cr, alpha.address());
    cairo.cairo_rectangle(cr, 0, 0, w, h);
    cairo.cairo_set_source_rgb(cr, 1, 1, 1);
    cairo.cairo_fill(cr);

    // build text
    let scratch = gtk.gtk_window_new(gtk.GTK_WINDOW_TOPLEVEL);
    let layout = gtk.gtk_widget_create_pango_layout(scratch, null);
    gtk.gtk_widget_destroy(scratch);
    let fnt = pango.pango_font_description_from_string("Sans 18");
    pango.pango_font_description_set_weight(fnt,pango.PANGO_WEIGHT_SEMIBOLD);
    pango.pango_layout_set_spacing(layout,0);
    pango.pango_layout_set_font_description(layout, fnt);
    log.debug("layout="+layout);
    log.debug("text="+text);
    pango.pango_layout_set_text(layout, text,-1);
    let tw = new ctypes.int;
    let th = new ctypes.int;
    let sz;
    let border = 4;
    pango.pango_layout_get_pixel_size(layout, tw.address(), th.address());
    log.debug("tw="+tw.value+" th="+th.value);
    // fit text to the icon by decreasing font size
    while ( tw.value > (w - border) || th.value > (h - border) ) {
      sz = pango.pango_font_description_get_size(fnt);
      if(sz < firetray.StatusIcon.MIN_FONT_SIZE) {
        sz = firetray.StatusIcon.MIN_FONT_SIZE;
        break;
      }
      sz -= pango.PANGO_SCALE;
      pango.pango_font_description_set_size(fnt,sz);
      pango.pango_layout_set_font_description(layout, fnt);
      pango.pango_layout_get_pixel_size(layout, tw.address(), th.address());
    }
    log.debug("tw="+tw.value+" th="+th.value);
    pango.pango_font_description_free(fnt);
    // center text
    let px = (w-tw.value)/2;
    let py = (h-th.value)/2;

    // draw text on pixmap
    gdk.gdk_cairo_set_source_color(cr, fore.address());
    cairo.cairo_move_to(cr, px, py);
    pangocairo.pango_cairo_show_layout(cr, layout);
    cairo.cairo_destroy(cr);
    gobject.g_object_unref(layout);

    let buf = gdk.gdk_pixbuf_get_from_drawable(null, pmDrawable, null, 0, 0, 0, 0, w, h);
    gobject.g_object_unref(pm);
    log.debug("alpha="+alpha);
    let alphaRed = gobject.guint16(alpha.red);
    let alphaRed_guchar = ctypes.cast(alphaRed, gobject.guchar);
    let alphaGreen = gobject.guint16(alpha.green);
    let alphaGreen_guchar = ctypes.cast(alphaGreen, gobject.guchar);
    let alphaBlue = gobject.guint16(alpha.blue);
    let alphaBlue_guchar = ctypes.cast(alphaBlue, gobject.guchar);
    let bufAlpha = gdk.gdk_pixbuf_add_alpha(buf, true, alphaRed_guchar, alphaGreen_guchar, alphaBlue_guchar);
    gobject.g_object_unref(buf);

    // merge the rendered text on top
    gdk.gdk_pixbuf_composite(bufAlpha,dest,0,0,w,h,0,0,1,1,gdk.GDK_INTERP_BILINEAR,255);
    gobject.g_object_unref(bufAlpha);

    log.debug("gtk_status_icon_set_from_pixbuf="+dest);
    gtk.gtk_status_icon_set_from_pixbuf(firetray.StatusIcon.trayIcon, dest);
  } catch (x) {
    log.error(x);
    return false;
  }

  return true;
};

firetray.Handler.setIconVisibility = function(visible) {
  if (!firetray.StatusIcon.trayIcon)
    return false;
  gtk.gtk_status_icon_set_visible(firetray.StatusIcon.trayIcon, visible);
  return true;
};
