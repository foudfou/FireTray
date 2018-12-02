/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = [ "firetray" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = ChromeUtils;

Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://firetray/commons.js"); // first for Handler.app !
Cu.import("resource://firetray/ctypes/linux/cairo.jsm");
Cu.import("resource://firetray/ctypes/linux/gio.jsm");
Cu.import("resource://firetray/ctypes/linux/gobject.jsm");
Cu.import("resource://firetray/ctypes/linux/"+firetray.Handler.app.widgetTk+"/gdk.jsm");
Cu.import("resource://firetray/ctypes/linux/"+firetray.Handler.app.widgetTk+"/gtk.jsm");
Cu.import("resource://firetray/ctypes/linux/pango.jsm");
Cu.import("resource://firetray/ctypes/linux/pangocairo.jsm");
Cu.import("resource://firetray/linux/FiretrayGtkIcons.jsm");
firetray.Handler.subscribeLibsForClosing([cairo, gdk, gio, gobject, gtk, pango,
  pangocairo]);

let log = firetray.Logging.getLogger("firetray.GtkStatusIcon");

if ("undefined" == typeof(firetray.Handler))
  log.error("This module MUST be imported from/after FiretrayStatusIcon !");


firetray.GtkStatusIcon = {
  MIN_FONT_SIZE: 4,
  FILENAME_BLANK: null,
  GTK_THEME_ICON_PATH: null,

  initialized: false,
  callbacks: {},
  trayIcon: null,
  themedIconApp: null,
  themedIconNewMail: null,

  init: function() {
    this.FILENAME_BLANK = firetray.Utils.chromeToPath(
      "chrome://firetray/skin/icons/blank-icon.png");

    firetray.GtkIcons.init();
    this.loadThemedIcons();

    this.trayIcon = gtk.gtk_status_icon_new();
    firetray.Handler.setIconImageDefault();
    firetray.Handler.setIconTooltipDefault();
    this.addCallbacks();

    this.initialized = true;
    return true;
  },

  shutdown: function() {
    log.debug("Disabling GtkStatusIcon");
    firetray.GtkIcons.shutdown();
    // FIXME: XXX destroy icon here
    this.initialized = false;
  },

  loadThemedIcons: function() {
    if (firetray.Handler.inMailApp) {
      let newMailIconNames = firetray.StatusIcon.getNewMailIconNames();
      if (this.themedIconNewMail) gobject.g_object_unref(this.themedIconNewMail);
      this.themedIconNewMail = this.initThemedIcon(newMailIconNames);
    }
    let appIconNames = firetray.StatusIcon.getAppIconNames();
    if (this.themedIconApp) gobject.g_object_unref(this.themedIconApp);
    this.themedIconApp = this.initThemedIcon(appIconNames);
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
    Cu.import("resource://firetray/linux/FiretrayPopupMenu.jsm");
    /* NOTE: here we do use a function handler (instead of a function
     definition) because we need the args passed to it ! As a consequence, we
     need to abandon 'this' in PopupMenu.popup() */
    this.callbacks.menuPopup = gtk.GCallbackMenuPopup_t(firetray.PopupMenu.popup); // void return, no sentinel
    gobject.g_signal_connect(this.trayIcon, "popup-menu",
      firetray.GtkStatusIcon.callbacks.menuPopup, firetray.PopupMenu.menu);
    this.callbacks.onScroll = gtk.GCallbackOnScroll_t(
      firetray.GtkStatusIcon.onScroll, null, FIRETRAY_CB_SENTINEL);
    gobject.g_signal_connect(this.trayIcon, "scroll-event",
      firetray.GtkStatusIcon.callbacks.onScroll, null);

    log.debug("showHideAllWindows: "+firetray.Handler.hasOwnProperty("showHideAllWindows"));
    this.callbacks.iconActivate = gtk.GCallbackStatusIconActivate_t(
      firetray.GtkStatusIcon.onClick, null, FIRETRAY_CB_SENTINEL);
    let handlerId = gobject.g_signal_connect(firetray.GtkStatusIcon.trayIcon,
      "activate", firetray.GtkStatusIcon.callbacks.iconActivate, null);
    log.debug("g_connect activate="+handlerId);

    this.attachMiddleClickCallback();
  },

  attachMiddleClickCallback: function() {
    this.callbacks.iconMiddleClick = gtk.GCallbackStatusIconMiddleClick_t(
      firetray.GtkStatusIcon.onButtonPressCb, null, FIRETRAY_CB_SENTINEL);
    let iconMiddleClickId = gobject.g_signal_connect(
      firetray.GtkStatusIcon.trayIcon,
      "button-press-event", firetray.GtkStatusIcon.callbacks.iconMiddleClick,
      null);
    log.debug("g_connect middleClick="+iconMiddleClickId);
  },

  onScroll: function(icon, event, data) {
    let gdkEventScroll = ctypes.cast(event, gdk.GdkEventScroll.ptr);
    let direction = gdkEventScroll.contents.direction;

    firetray.StatusIcon.onScroll(direction);

    let stopPropagation = false;
    return stopPropagation;
  },

  onClick: function(gtkStatusIcon, userData) {
    firetray.Handler.showHideAllWindows();
    let stopPropagation = true;
    return stopPropagation;
  },

  onButtonPressCb: function(widget, event, data) {
    let gdkEventButton = ctypes.cast(event, gdk.GdkEventButton.ptr);
    if (gdkEventButton.contents.button === 2 &&
        gdkEventButton.contents.type === gdk.GDK_BUTTON_PRESS)
    {
      log.debug("MIDDLE CLICK");
      let pref = firetray.Utils.prefService.getIntPref("middle_click");
      if (pref === FIRETRAY_MIDDLE_CLICK_ACTIVATE_LAST) {
        firetray.Handler.showAllWindowsAndActivate();
      } else if (pref === FIRETRAY_MIDDLE_CLICK_SHOW_HIDE) {
        firetray.Handler.showHideAllWindows();
      } else {
        log.error("Unknown pref value for 'middle_click': "+pref);
      }
    }

    let stopPropagation = false;
    return stopPropagation;
  },

  setIconImageFromFile: function(filename) {
    if (!firetray.GtkStatusIcon.trayIcon)
      log.error("Icon missing");
    log.debug(filename);
    gtk.gtk_status_icon_set_from_file(firetray.GtkStatusIcon.trayIcon,
                                      filename);
  },

  setIconImageFromGIcon: function(gicon) {
    if (!firetray.GtkStatusIcon.trayIcon || !gicon)
      log.error("Icon missing");
    log.debug(gicon);
    gtk.gtk_status_icon_set_from_gicon(firetray.GtkStatusIcon.trayIcon, gicon);
  },

  setIconImageCustom: function(prefname) {
    let prefCustomIconPath = firetray.Utils.prefService.getCharPref(prefname);
    firetray.GtkStatusIcon.setIconImageFromFile(prefCustomIconPath);
  },

};                              // GtkStatusIcon

firetray.StatusIcon.initImpl = firetray.GtkStatusIcon.init
  .bind(firetray.GtkStatusIcon);

firetray.StatusIcon.shutdownImpl = firetray.GtkStatusIcon.shutdown
  .bind(firetray.GtkStatusIcon);


firetray.Handler.loadIcons = firetray.GtkStatusIcon.loadThemedIcons
  .bind(firetray.GtkStatusIcon);

firetray.Handler.setIconImageDefault = function() {
  log.debug("setIconImageDefault");
  if (!firetray.GtkStatusIcon.themedIconApp)
    throw "Default application themed icon not set";
  let appIconType = firetray.Utils.prefService.getIntPref("app_icon_type");
  if (appIconType === FIRETRAY_APPLICATION_ICON_TYPE_THEMED) {
    firetray.GtkStatusIcon.setIconImageFromGIcon(
      firetray.GtkStatusIcon.themedIconApp);
  } else if (appIconType === FIRETRAY_APPLICATION_ICON_TYPE_CUSTOM) {
    firetray.GtkStatusIcon.setIconImageCustom("app_icon_custom");
  }
};

firetray.Handler.setIconImageNewMail = function() {
  firetray.GtkStatusIcon.setIconImageFromGIcon(
    firetray.GtkStatusIcon.themedIconNewMail);
};

firetray.Handler.setIconImageCustom = firetray.GtkStatusIcon.setIconImageCustom;

// GTK bug: Gdk-CRITICAL **: IA__gdk_window_get_root_coords: assertion `GDK_IS_WINDOW (window)' failed
firetray.Handler.setIconTooltip = function(toolTipStr) {
  if (!firetray.GtkStatusIcon.trayIcon)
    return false;

  log.debug("setIconTooltip, toolTipStr="+toolTipStr);
  try {
    gtk.gtk_status_icon_set_tooltip_text(firetray.GtkStatusIcon.trayIcon,
                                         toolTipStr);
  } catch (x) {
    log.error(x);
    return false;
  }
  return true;
};

firetray.Handler.setIconText = function(text, color) {
  log.debug("setIconText, color="+color);
  if (typeof(text) != "string")
    throw new TypeError();

  try {
    // build background from image
    //let specialIcon = gdk.gdk_pixbuf_new_from_file(
    //  firetray.GtkStatusIcon.FILENAME_BLANK, null); // GError **error);
    //let dest = gdk.gdk_pixbuf_copy(specialIcon);
    //let w = gdk.gdk_pixbuf_get_width(specialIcon);
    //let h = gdk.gdk_pixbuf_get_height(specialIcon);
    // workaround: loading from packed xpi fails, draw light gray bordered square with cairo
    let w = 32;
    let h = 32;
    let stroke = 2;
    var mysurface = cairo.cairo_image_surface_create(cairo.CAIRO_FORMAT_ARGB32, w, h);
    var mycr = cairo.cairo_create(mysurface);
    cairo.cairo_rectangle(mycr, stroke, stroke, w - (stroke * 2), h - (stroke * 2));
    cairo.cairo_set_source_rgb(mycr, 0.85, 0.85, 0.85);
    cairo.cairo_fill_preserve(mycr);
    cairo.cairo_set_line_width(mycr, stroke);
    cairo.cairo_set_source_rgb(mycr, 0.4, 0.4, 0.4);
    cairo.cairo_stroke(mycr);
    let dest = gdk.gdk_pixbuf_get_from_surface(mysurface, 0, 0, w, h);
    // prepare colors/alpha
/* FIXME: draw everything with cairo when dropping gtk2 support. Use
 gdk_pixbuf_get_from_surface(). */
if (firetray.Handler.app.widgetTk == "gtk2") {
    var colorMap = gdk.gdk_screen_get_system_colormap(gdk.gdk_screen_get_default());
    var visual = gdk.gdk_colormap_get_visual(colorMap);
    var visualDepth = visual.contents.depth;
    log.debug("colorMap="+colorMap+" visual="+visual+" visualDepth="+visualDepth);
}
    let fore = new gdk.GdkColor;
    fore.pixel = fore.red = fore.green = fore.blue = 0;
    let alpha  = new gdk.GdkColor;
    alpha.pixel = alpha.red = alpha.green = alpha.blue = 0xFFFF;
    if (!fore || !alpha)
      log.warn("Undefined fore or alpha GdkColor");
    gdk.gdk_color_parse(color, fore.address());
    if(fore.red == alpha.red && fore.green == alpha.green && fore.blue == alpha.blue) {
      alpha.red=0; // make sure alpha is different from fore
    }
if (firetray.Handler.app.widgetTk == "gtk2") {
    gdk.gdk_colormap_alloc_color(colorMap, fore.address(), true, true);
    gdk.gdk_colormap_alloc_color(colorMap, alpha.address(), true, true);
}

    // build text rectangle
    let cr;
if (firetray.Handler.app.widgetTk == "gtk2") {
    var pm = gdk.gdk_pixmap_new(null, w, h, visualDepth);
    var pmDrawable = ctypes.cast(pm, gdk.GdkDrawable.ptr);
    cr = gdk.gdk_cairo_create(pmDrawable);
} else {
    // FIXME: gtk3 text position is incorrect.
    var surface = cairo.cairo_image_surface_create(cairo.CAIRO_FORMAT_ARGB32, w, h);
    cr = cairo.cairo_create(surface);
}
    gdk.gdk_cairo_set_source_color(cr, alpha.address());
    cairo.cairo_rectangle(cr, 0, 0, w, h);
    cairo.cairo_set_source_rgb(cr, 1, 1, 1);
    cairo.cairo_fill(cr);

    // build text
    let scratch = gtk.gtk_window_new(gtk.GTK_WINDOW_TOPLEVEL);
    let layout = gtk.gtk_widget_create_pango_layout(scratch, null);
    gtk.gtk_widget_destroy(scratch);
    let fnt = pango.pango_font_description_from_string("Sans 32");
    pango.pango_font_description_set_weight(fnt, pango.PANGO_WEIGHT_SEMIBOLD);
    pango.pango_layout_set_spacing(layout, 0);
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
      if (sz < firetray.GtkStatusIcon.MIN_FONT_SIZE) {
        sz = firetray.GtkStatusIcon.MIN_FONT_SIZE;
        break;
      }
      sz -= pango.PANGO_SCALE;
      pango.pango_font_description_set_size(fnt, sz);
      pango.pango_layout_set_font_description(layout, fnt);
      pango.pango_layout_get_pixel_size(layout, tw.address(), th.address());
    }
    log.debug("tw="+tw.value+" th="+th.value+" sz="+sz);
    pango.pango_font_description_free(fnt);
    // center text
    let px = (w-tw.value)/2;
    let py = (h-th.value)/2;
    log.debug("px="+px+" py="+py);

    // draw text on pixmap
    gdk.gdk_cairo_set_source_color(cr, fore.address());
    cairo.cairo_move_to(cr, px, py);
    pangocairo.pango_cairo_show_layout(cr, layout);
    cairo.cairo_destroy(cr);
    gobject.g_object_unref(layout);

    let buf = null;
if (firetray.Handler.app.widgetTk == "gtk2") {
    buf = gdk.gdk_pixbuf_get_from_drawable(null, pmDrawable, null, 0, 0, 0, 0, w, h);
    gobject.g_object_unref(pm);
}
else {
    buf = gdk.gdk_pixbuf_get_from_surface(surface, 0, 0, w, h);
    cairo.cairo_surface_destroy(surface);
}
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
    gtk.gtk_status_icon_set_from_pixbuf(firetray.GtkStatusIcon.trayIcon, dest);
  } catch (x) {
    log.error(x);
    return false;
  }

  return true;
};

firetray.Handler.setIconVisibility = function(visible) {
  if (!firetray.GtkStatusIcon.trayIcon)
    return false;
  gtk.gtk_status_icon_set_visible(firetray.GtkStatusIcon.trayIcon, visible);
  return true;
};
