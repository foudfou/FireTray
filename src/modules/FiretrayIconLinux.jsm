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
Cu.import("resource://firetray/x11.jsm");
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
var firetray_filterWindowCb;

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
  MIN_FONT_SIZE: 4,
  X11: {},

  init: function() {
    try {
      // init tray icon, some variables
      this.trayIcon  = gtk.gtk_status_icon_new();
    } catch (x) {
      ERROR(x);
      return false;
    }

    firetray.Handler.setImageDefault();

    this._buildPopupMenu();

    firetray.Handler.setTooltipDefault();

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

    // TEST - should probably be done in Main.onLoad()
    this._initX11();
    let win = Services.wm.getMostRecentWindow(null);
    let gdkWin = this.getGdkWindowHandle(win);
    // TODO: register window here ? (and unregister in shutdown)
    try {
      let that = this;
      let filterData = gdkWin;
      firetray_filterWindowCb = gdk.GdkFilterFunc_t(that.filterWindow);
      gdk.gdk_window_add_filter(gdkWin, firetray_filterWindowCb, filterData);
    } catch(x) {
      ERROR(x);
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
       definition) because we need the args passed to it ! As a consequence, we
       need to abandon 'this' in popupMenu() */
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

  getGdkWindowHandle: function(win) {
    try {
      let gtkWin = firetray.IconLinux._getGtkWindowHandle(win);
      LOG("FOUND: "+gtk.gtk_window_get_title(gtkWin).readString());
      let gdkWin = this._getGdkWindowFromGtkWindow(gtkWin);
      if (!gdkWin.isNull()) {
        LOG("has window");
        return gdkWin;
      }
    } catch (x) {
      ERROR(x);
    }
    return null;
  },

  _initX11: function() {
    if (!isEmpty(this.X11))
      return true; // init only once

    this.X11.MAX_NET_WM_STATES = 12;
    try {
      let gdkDisplay = gdk.gdk_display_get_default();
      this.X11.Display = gdk.gdk_x11_display_get_xdisplay(gdkDisplay);
      this.X11.Atoms = {};
      let atoms = {
        WM_DELETE_WINDOW: "WM_DELETE_WINDOW",
        WM_STATE: "WM_STATE",
        _NET_CLOSE_WINDOW: "_NET_CLOSE_WINDOW",
        // don't forget to update firetray.IconLinux.X11.MAX_NET_WM_STATES
        _NET_WM_STATE: "_NET_WM_STATE",
        _NET_WM_STATE_MODAL: "_NET_WM_STATE_MODAL",
        _NET_WM_STATE_STICKY: "_NET_WM_STATE_STICKY",
        _NET_WM_STATE_MAXIMIZED_VERT: "_NET_WM_STATE_MAXIMIZED_VERT",
        _NET_WM_STATE_MAXIMIZED_HORZ: "_NET_WM_STATE_MAXIMIZED_HORZ",
        _NET_WM_STATE_SHADED: "_NET_WM_STATE_SHADED",
        _NET_WM_STATE_SKIP_TASKBAR: "_NET_WM_STATE_SKIP_TASKBAR",
        _NET_WM_STATE_SKIP_PAGER: "_NET_WM_STATE_SKIP_PAGER",
        _NET_WM_STATE_HIDDEN: "_NET_WM_STATE_HIDDEN",
        _NET_WM_STATE_FULLSCREEN: "_NET_WM_STATE_FULLSCREEN",
        _NET_WM_STATE_ABOVE: "_NET_WM_STATE_ABOVE",
        _NET_WM_STATE_BELOW: "_NET_WM_STATE_BELOW",
        _NET_WM_STATE_DEMANDS_ATTENTION: "_NET_WM_STATE_DEMANDS_ATTENTION"
      };
      for (let atomName in atoms) {
        this.X11.Atoms[atomName] = x11.XInternAtom(this.X11.Display, atoms[atomName], 0);
        LOG("X11.Atoms."+atomName+"="+this.X11.Atoms[atomName]);
      }
      return true;
    } catch (x) {
      ERROR(x);
      return false;
    }
  },

  filterWindow: function(xev, gdkEv, data) {
    if (!xev)
      return gdk.GDK_FILTER_CONTINUE;

    let gdkWin = ctypes.cast(data, gdk.GdkWindow.ptr);

    try {
      let xany = ctypes.cast(xev, x11.XAnyEvent.ptr);
      let xwin = xany.contents.window;

      switch (xany.contents.type) {
      case x11.MapNotify:
        LOG("MapNotify");
        break;

      case x11.UnmapNotify:
        LOG("UnmapNotify");

        let prop = firetray.IconLinux.X11.Atoms._NET_WM_STATE;
        LOG("prop="+prop);

/*
        // infos returned by XGetWindowProperty()
        let actual_type = new ctypes.unsigned_long; // FIXME: let actual_type = new x11.Atom;
        let actual_format = new ctypes.int;
        let nitems = new ctypes.unsigned_long;
        let bytes_after = new ctypes.unsigned_long;
        let prop_value = new ctypes.unsigned_char.ptr;

        let res = x11.XGetWindowProperty(
          firetray.IconLinux.X11.Display, xwin, prop, 0, firetray.IconLinux.X11.MAX_NET_WM_STATES, 0, x11.AnyPropertyType,
          actual_type.address(), actual_format.address(), nitems.address(), bytes_after.address(), prop_value.address());
        LOG("XGetWindowProperty res="+res+", actual_type="+actual_type.value+", actual_format="+actual_format.value+", bytes_after="+bytes_after.value+", nitems="+nitems.value);

        if (res.toString() !== x11.Success.toString()) {
          ERROR("XGetWindowProperty failed");
          break;
        }
        if (actual_type.value.toString() === x11.None.toString()) {
          WARN("property does not exist");
          break;
        }

        LOG("prop_value="+prop_value);
        // LOG("prop_value.str="+prop_value.readString());
        // LOG("prop_value.size="+prop_value.size);
        LOG("size="+ctypes.uint32_t.array(nitems.value).size);
        let props;
        // if (actual_format == 32)
        //   props = ctypes.cast(prop_value, ctypes.uint32_t.array(nitems.value));
        // LOG("props="+props);
        // for (let i=0; i<nitems.value; ++i) {
        //   // LOG(props[i]);
        //   // let p = props[i];
        //   // let p_ulong = ctypes.cast(p, ctypes.unsigned_long);
        //   // LOG(p_ulong);
        // }
*/

        break;

      case x11.ClientMessage:
        LOG("ClientMessage");
        let xclient = ctypes.cast(xev, x11.XClientMessageEvent.ptr);
        LOG("xclient.contents.data="+xclient.contents.data);
        // NOTE: need toString() for comparison !
        if (xclient.contents.data[0].toString() ===
            firetray.IconLinux.X11.Atoms.WM_DELETE_WINDOW.toString()) {
          LOG("Delete Window prevented");
          return gdk.GDK_FILTER_REMOVE;
        }
        break;

      default:
        // LOG("xany.type="+xany.contents.type);
        break;
      }
    } catch(x) {
      ERROR(x);
    }

    return gdk.GDK_FILTER_CONTINUE;
  }

}; // firetray.IconLinux


firetray.Handler.setImage = function(filename) {
  if (!firetray.IconLinux.trayIcon)
    return false;
  LOG(filename);

  try {
    gtk.gtk_status_icon_set_from_file(firetray.IconLinux.trayIcon,
                                      filename);
  } catch (x) {
    ERROR(x);
    return false;
  }
  return true;
};

firetray.Handler.setImageDefault = function() {
  if (!this.FILENAME_DEFAULT)
    throw "Default application icon filename not set";
  this.setImage(this.FILENAME_DEFAULT);
};

// GTK bug: Gdk-CRITICAL **: IA__gdk_window_get_root_coords: assertion `GDK_IS_WINDOW (window)' failed
firetray.Handler.setTooltip = function(toolTipStr) {
  if (!firetray.IconLinux.trayIcon)
    return false;

  try {
    gtk.gtk_status_icon_set_tooltip_text(firetray.IconLinux.trayIcon,
                                         toolTipStr);
  } catch (x) {
    ERROR(x);
    return false;
  }
  return true;
};

firetray.Handler.setTooltipDefault = function() {
  if (!this.appName)
    throw "application name not initialized";
  this.setTooltip(this.appName);
};

firetray.Handler.setText = function(text, color) { // TODO: split into smaller functions;
  LOG("setText, color="+color);
  if (typeof(text) != "string")
    throw new TypeError();

  try {
    // build background from image
    let specialIcon = gdk.gdk_pixbuf_new_from_file(this.FILENAME_BLANK, null); // GError **error);
    let dest = gdk.gdk_pixbuf_copy(specialIcon);
    let w = gdk.gdk_pixbuf_get_width(specialIcon);
    let h = gdk.gdk_pixbuf_get_height(specialIcon);

    // prepare colors/alpha
    let colorMap = gdk.gdk_screen_get_system_colormap(gdk.gdk_screen_get_default());
    let visual = gdk.gdk_colormap_get_visual(colorMap);
    let visualDepth = visual.contents.depth;
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
      if(sz < firetray.IconLinux.MIN_FONT_SIZE) {
        sz = firetray.IconLinux.MIN_FONT_SIZE;
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

    gtk.gtk_status_icon_set_from_pixbuf(firetray.IconLinux.trayIcon, dest);
  } catch (x) {
    ERROR(x);
    return false;
  }

  return true;
};
