/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = [ "firetray" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://firetray/cairo.jsm");
Cu.import("resource://firetray/gobject.jsm");
Cu.import("resource://firetray/gdk.jsm");
Cu.import("resource://firetray/gtk.jsm");
Cu.import("resource://firetray/libc.jsm");
Cu.import("resource://firetray/pango.jsm");
Cu.import("resource://firetray/commons.js");

const Services2 = {};
XPCOMUtils.defineLazyServiceGetter(
  Services2,
  "uuid",
  "@mozilla.org/uuid-generator;1",
  "nsIUUIDGenerator"
);

if ("undefined" == typeof(firetray.Handler))
  ERROR("FiretrayIcon*.jsm MUST be imported from/after FiretrayHandler !");

// pointers to JS functions. should *not* be eaten by GC ("Running global
// cleanup code from study base classes" ?)
var firetray_iconActivateCb;
var firetray_popupMenuCb;
var firetray_menuItemQuitActivateCb;
var firetray_findGtkWindowByTitleCb;

/**
 * custum type used to pass data in to and out of firetray_findGtkWindowByTitleCb
 */
var _find_data_t = ctypes.StructType("_find_data_t", [
  { inTitle: ctypes.char.ptr },
  { outWindow: gtk.GtkWindow.ptr }
]);


firetray.IconLinux = {
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
      this.FILENAME_DEFAULT = firetray.Utils.chromeToPath(
        "chrome://firetray/skin/" +  this.appName + this.FILENAME_SUFFIX);
      this.FILENAME_NEWMAIL = firetray.Utils.chromeToPath(
        "chrome://firetray/skin/newmail.png");
    } catch (x) {
      ERROR(x);
      return false;
    }

    this.setImageDefault();

    this._buildPopupMenu();

    this.setTooltipDefault();

    // attach popupMenu to trayIcon
    try {
      // watch out for binding problems ! here we prefer to keep 'this' in
      // showHideToTray() and abandon the args.
      firetray_iconActivateCb = gobject.GCallback_t(
        function(){firetray.Handler.showHideToTray();});
      gobject.g_signal_connect(this.trayIcon, "activate",
                               firetray_iconActivateCb, null);
    } catch (x) {
      ERROR(x);
      return false;
    }

    return true;
  },

  shutdown: function() {
    cairo.close();
    // glib.close();
    gobject.close();
    gdk.close();
    gtk.close();
    pango.close();
  },

  _buildPopupMenu: function() {
    this.menu = gtk.gtk_menu_new();
    // shouldn't need to convert to utf8 thank to js-ctypes
		var menuItemQuitLabel = firetray.Utils.strings.GetStringFromName("popupMenu.itemLabel.Quit");
    var menuItemQuit = gtk.gtk_image_menu_item_new_with_label(
      menuItemQuitLabel);
    var menuItemQuitIcon = gtk.gtk_image_new_from_stock(
      "gtk-quit", gtk.GTK_ICON_SIZE_MENU);
    gtk.gtk_image_menu_item_set_image(menuItemQuit, menuItemQuitIcon);
    var menuShell = ctypes.cast(this.menu, gtk.GtkMenuShell.ptr);
    gtk.gtk_menu_shell_append(menuShell, menuItemQuit);

    firetray_menuItemQuitActivateCb = gobject.GCallback_t(
      function(){firetray.Handler.quitApplication();});
    gobject.g_signal_connect(menuItemQuit, "activate",
                             firetray_menuItemQuitActivateCb, null);

    var menuWidget = ctypes.cast(this.menu, gtk.GtkWidget.ptr);
    gtk.gtk_widget_show_all(menuWidget);

    /* NOTE: here we do use a function handler (instead of a function
     * definition) because we need the args passed to it ! On the other hand
     * we need to abandon 'this' in popupMenu() */
    let that = this;
    firetray_popupMenuCb =
      gtk.GCallbackMenuPopup_t(that.popupMenu);
    gobject.g_signal_connect(this.trayIcon, "popup-menu",
                             firetray_popupMenuCb, this.menu);
  },

  popupMenu: function(icon, button, activateTime, menu) {
    LOG("MENU POPUP");
    LOG("ARGS="+icon+", "+button+", "+activateTime+", "+menu);

    try {
      var gtkMenuPtr = ctypes.cast(menu, gtk.GtkMenu.ptr);
      var iconGpointer = ctypes.cast(icon, gobject.gpointer);
      gtk.gtk_menu_popup(
        gtkMenuPtr, null, null, gtk.gtk_status_icon_position_menu,
        iconGpointer, button, activateTime);
    } catch (x) {
      LOG(x);
    }

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

    try {
      gtk.gtk_status_icon_set_tooltip_text(this.trayIcon,
                                           toolTipStr);
    } catch (x) {
      ERROR(x);
      return false;
    }
    return true;
  },

  setTooltipDefault: function() {
    if (!this.appName)
      throw "application name not initialized";
    this.setTooltip(this.appName);
  },

  setText: function(text, color) { // TODO: split into smaller functions;
    LOG("setText");
    if (typeof(text) != "string" )
      throw new TypeError();

    try {
      // build background from image
      let specialIcon = gdk.gdk_pixbuf_new_from_file(this.FILENAME_NEWMAIL, null); // GError **error);
      let dest = gdk.gdk_pixbuf_copy(specialIcon);
      let w = gdk.gdk_pixbuf_get_width(specialIcon);
      let h = gdk.gdk_pixbuf_get_height(specialIcon);

      // prepare colors/alpha
      let colorMap = gdk.gdk_screen_get_system_colormap(gdk.gdk_screen_get_default());
      let visual = gdk.gdk_colormap_get_visual(colorMap);
      let visualDepth = gdk.gdk_visual_get_depth(visual);
      LOG("colorMap="+colorMap+" visual="+visual+" visualDepth="+visualDepth);
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
    } catch (x) {
      ERROR(x);
      return false;
    }

    return true;
  },

  /**
   * Iterate over all Gtk toplevel windows to find a window. We rely on
   * Service.wm to watch windows correctly: we should find only one window.
   *
   * @author Nils Maier (stolen from MiniTrayR)
   * @param window nsIDOMWindow from Services.wm
   * @return a gtk.GtkWindow.ptr
   */
  _getGtkWindowHandle: function(window) {
    let baseWindow = window
      .QueryInterface(Ci.nsIInterfaceRequestor)
      .getInterface(Ci.nsIWebNavigation)
      .QueryInterface(Ci.nsIBaseWindow);

    // Tag the base window
    let oldTitle = baseWindow.title;
    baseWindow.title = Services2.uuid.generateUUID().toString();

    try {
      // Search the window by the *temporary* title
      let widgets = gtk.gtk_window_list_toplevels();
      let that = this;
      firetray_findGtkWindowByTitleCb = gobject.GFunc_t(that._findGtkWindowByTitle);
      var userData = new _find_data_t(
        ctypes.char.array()(baseWindow.title),
        null
      ).address();
      LOG("userData="+userData);
      gobject.g_list_foreach(widgets, firetray_findGtkWindowByTitleCb, userData);
      gobject.g_list_free(widgets);

      if (userData.contents.outWindow.isNull()) {
        throw new Error("Window not found!");
      }
      LOG("found window: "+userData.contents.outWindow);
    } catch (x) {
      ERROR(x);
    } finally {
      // Restore
      baseWindow.title = oldTitle;
    }

    return userData.contents.outWindow;
  },

  /**
   * compares a GtkWindow's title with a string passed in userData
   * @param gtkWidget: GtkWidget from gtk_window_list_toplevels()
   * @param userData: _find_data_t
   */
  _findGtkWindowByTitle: function(gtkWidget, userData) {
    LOG("GTK Window: "+gtkWidget+", "+userData);

    let data = ctypes.cast(userData, _find_data_t.ptr);
    let inTitle = data.contents.inTitle;
    LOG("inTitle="+inTitle.readString());

    let gtkWin = ctypes.cast(gtkWidget, gtk.GtkWindow.ptr);
    let winTitle = gtk.gtk_window_get_title(gtkWin);

    try {
      if (!winTitle.isNull()) {
        LOG(inTitle+" = "+winTitle);
        if (libc.strcmp(inTitle, winTitle) == 0)
          data.contents.outWindow = gtkWin;
      }
    } catch (x) {
      ERROR(x);
    }
  },

  _getGdkWindowFromGtkWindow: function(gtkWin) {
    try {
      let gtkWid = ctypes.cast(gtkWin, gtk.GtkWidget.ptr);
      var gdkWin = gtk.gtk_widget_get_window(gtkWid);
    } catch (x) {
      ERROR(x);
    }
    return gdkWin;
  },

  // NOTE: doesn't work during initialization probably since windows aren't
  // fully realized (?)
  testWindowHandle: function() {
    try {
      let win = Services.wm.getMostRecentWindow(null);
      let gtkWin = firetray.IconLinux._getGtkWindowHandle(win);
      LOG("FOUND: "+gtk.gtk_window_get_title(gtkWin).readString());
      gtk.gtk_window_set_decorated(gtkWin, false);

      let gdkWin = this._getGdkWindowFromGtkWindow(gtkWin);
      if (!gdkWin.isNull()) {
        LOG("has window");
        LOG(gdk.gdk_window_get_width(gdkWin));
        gdk.gdk_window_iconify(gdkWin);
      }
    } catch (x) {
      ERROR(x);
    }
  }

}; // firetray.IconLinux
