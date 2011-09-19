/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = [ "mozt" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://moztray/cairo.jsm");
Cu.import("resource://moztray/gobject.jsm");
Cu.import("resource://moztray/gdk.jsm");
Cu.import("resource://moztray/gtk.jsm");
Cu.import("resource://moztray/pango.jsm");
Cu.import("resource://moztray/commons.js");

if ("undefined" == typeof(mozt.Handler))
  ERROR("MoztIcon*.jsm MUST be imported from/after MoztHandler !");

// pointers to JS functions. should *not* be eaten by GC ("Running global
// cleanup code from study base classes" ?)
var mozt_iconActivateCb;
var mozt_popupMenuCb;
var mozt_menuItemQuitActivateCb;

mozt.IconLinux = {
  tryIcon: null,
  menu: null,
  appName: null,
  FILENAME_DEFAULT: null,
  FILENAME_SUFFIX: "32.png",
  FILENAME_NEWMAIL: "newmail.png",
  MIN_FONT_SIZE: 4,

  init: function() {

    try {

      // init tray icon, some variables
      this.trayIcon  = gtk.gtk_status_icon_new();
      this.appName = Services.appinfo.name.toLowerCase();
      this.FILENAME_DEFAULT = mozt.Utils.chromeToPath(
        "chrome://moztray/skin/" +  this.appName + this.FILENAME_SUFFIX);
      this.FILENAME_NEWMAIL = mozt.Utils.chromeToPath(
        "chrome://moztray/skin/newmail.png");

      this.setImageDefault();

      // build icon popup menu
      this.menu = gtk.gtk_menu_new();
      // shouldn't need to convert to utf8 thank to js-ctypes
		  var menuItemQuitLabel = mozt.Utils.strings.GetStringFromName("popupMenu.itemLabel.Quit");
      var menuItemQuit = gtk.gtk_image_menu_item_new_with_label(
        menuItemQuitLabel);
      var menuItemQuitIcon = gtk.gtk_image_new_from_stock(
        "gtk-quit", gtk.GTK_ICON_SIZE_MENU);
      gtk.gtk_image_menu_item_set_image(menuItemQuit, menuItemQuitIcon);
      var menuShell = ctypes.cast(this.menu, gtk.GtkMenuShell.ptr);
      gtk.gtk_menu_shell_append(menuShell, menuItemQuit);

      mozt_menuItemQuitActivateCb = gobject.GCallback_t(
        function(){mozt.Handler.quitApplication();});
      gobject.g_signal_connect(menuItemQuit, "activate",
                                  mozt_menuItemQuitActivateCb, null);

      var menuWidget = ctypes.cast(this.menu, gtk.GtkWidget.ptr);
      gtk.gtk_widget_show_all(menuWidget);

      // here we do use a function handler because we need the args passed to
      // it ! But we need to abandon 'this' in popupMenu()
      mozt_popupMenuCb =
        gtk.GCallbackMenuPopup_t(mozt.Handler.popupMenu);
      gobject.g_signal_connect(this.trayIcon, "popup-menu",
                                  mozt_popupMenuCb, this.menu);

      this.setTooltipDefault();

      // watch out for binding problems ! here we prefer to keep 'this' in
      // showHideToTray() and abandon the args.
      mozt_iconActivateCb = gobject.GCallback_t(
        function(){mozt.Handler.showHideToTray();});
      gobject.g_signal_connect(this.trayIcon, "activate",
                                  mozt_iconActivateCb, null);

    } catch (x) {
      ERROR(x);
      return false;
    }

    return true;
  },

  shutdown: function() {
    gobject.close();
    gdk.close();
    gtk.close();
    // glib.close();
  },

  setImage: function(filename) {
    if (!this.trayIcon)
      return false;
    LOG(filename);

    try {
      gtk.gtk_status_icon_set_from_file(this.trayIcon,
                                        filename);
    } catch (x) {
      ERROR(x);
      return false;
    }
    return true;
  },

  setImageDefault: function() {
    if (!this.FILENAME_DEFAULT)
      throw "Default application icon filename not set";
    this.setImage(this.FILENAME_DEFAULT);
  },

  // GTK bug: Gdk-CRITICAL **: IA__gdk_window_get_root_coords: assertion `GDK_IS_WINDOW (window)' failed
  setTooltip: function(toolTipStr) {
    if (!this.trayIcon)
      return false;
    gtk.gtk_status_icon_set_tooltip_text(this.trayIcon,
                                         toolTipStr);
    return true;
  },

  setTooltipDefault: function() {
    if (!this.appName)
      throw "application name not initialized";
    this.setTooltip(this.appName);
  },

  setText: function(text, color) { // TODO: split into smaller functions;
    LOG("setText");
    if (typeof(text) != "string" ) {
      ERROR("'text' arguement must be toString()'d: ");
      return false;
    }

    // build background from image
    let specialIcon = gdk.gdk_pixbuf_new_from_file(this.FILENAME_NEWMAIL, null); // GError **error);
    let dest = gdk.gdk_pixbuf_copy(specialIcon);
    let w = gdk.gdk_pixbuf_get_width(specialIcon);
    let h = gdk.gdk_pixbuf_get_height(specialIcon);

    // prepare colors/alpha
    let colorMap = gdk.gdk_screen_get_system_colormap(gdk.gdk_screen_get_default());
    let visual = gdk.gdk_colormap_get_visual(colorMap);
    let screenDepth = 24; // = visual.depth; // FIXME: was visual->depth
    let fore = new gdk.GdkColor;
    fore.pixel = fore.red = fore.green = fore.blue = 0;
    let alpha  = new gdk.GdkColor;
    alpha.pixel = alpha.red = alpha.green = alpha.blue = 0xFFFF;
    if (!fore || !alpha)
      WARN("Undefined GdkColor fore or alpha");
    gdk.gdk_color_parse(color, fore.address());
    if(fore.red == alpha.red && fore.green == alpha.green && fore.blue == alpha.blue) {
      alpha.red=0; // make sure alpha is different from fore
    }
    gdk.gdk_colormap_alloc_color(colorMap, fore.address(), true, true);
    gdk.gdk_colormap_alloc_color(colorMap, alpha.address(), true, true);

    // build pixmap with rectangle
    let pm = gdk.gdk_pixmap_new(null, w, h, screenDepth);
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
    LOG("layout="+layout);
    LOG("text="+text);
    pango.pango_layout_set_text(layout, text,-1);
    let tw = new ctypes.int;
    let th = new ctypes.int;
    let sz;
    let border = 4;
    pango.pango_layout_get_pixel_size(layout, tw.address(), th.address());
    LOG("tw="+tw.value+" th="+th.value);
    // fit text to the icon by decreasing font size
    while ( tw.value > (w - border) || th.value > (h - border) ) {
      sz = pango.pango_font_description_get_size(fnt);
      if(sz < this.MIN_FONT_SIZE) {
        sz = this.MIN_FONT_SIZE;
        break;
      }
      sz -= pango.PANGO_SCALE;
      pango.pango_font_description_set_size(fnt,sz);
      pango.pango_layout_set_font_description(layout, fnt);
      pango.pango_layout_get_pixel_size(layout, tw.address(), th.address());
    }
    LOG("tw="+tw.value+" th="+th.value);
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
    LOG("alpha="+alpha);
    let alphaRed = gobject.guint16(alpha.red);
    let alphaRed_guchar = ctypes.cast(alphaRed, gobject.guchar);
    let alphaGreen = gobject.guint16(alpha.green);
    let alphaGreen_guchar = ctypes.cast(alphaGreen, gobject.guchar);
    let alphaBlue = gobject.guint16(alpha.blue);
    let alphaBlue_guchar = ctypes.cast(alphaBlue, gobject.guchar);
    let bufAlpha = gdk.gdk_pixbuf_add_alpha(buf, true, alphaRed_guchar, alphaGreen_guchar, alphaBlue_guchar);
    gobject.g_object_unref(buf);

    // merge the rendered text on top
    gdk.gdk_pixbuf_composite(bufAlpha,dest,0,0,w,h,0,0,1,1,gdk.GDK_INTERP_NEAREST,255);
    gobject.g_object_unref(bufAlpha);

    gtk.gtk_status_icon_set_from_pixbuf(this.trayIcon, dest);
  }

}; // mozt.IconLinux
