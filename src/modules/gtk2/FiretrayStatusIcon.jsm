/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = [ "firetray" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://firetray/ctypes/cairo.jsm");
Cu.import("resource://firetray/ctypes/gobject.jsm");
Cu.import("resource://firetray/ctypes/gdk.jsm");
Cu.import("resource://firetray/ctypes/gtk.jsm");
Cu.import("resource://firetray/ctypes/libc.jsm");
Cu.import("resource://firetray/ctypes/pango.jsm");
Cu.import("resource://firetray/ctypes/pangocairo.jsm");
Cu.import("resource://firetray/ctypes/x11.jsm");
Cu.import("resource://firetray/commons.js");

if ("undefined" == typeof(firetray.Handler))
  ERROR("This module MUST be imported from/after FiretrayHandler !");


firetray.StatusIcon = {
  initialized: false,
  // pointers to JS functions. MUST LIVE DURING ALL THE EXECUTION
  callbacks: {menuItemWindowActivate: {}},
  trayIcon: null,
  menu: null,
  menuSeparatorWindows: null,
  MIN_FONT_SIZE: 4,

  init: function() {
    try {
      // init tray icon, some variables
      this.trayIcon  = gtk.gtk_status_icon_new();
    } catch (x) {
      ERROR(x);
      return false;
    }

    firetray.Handler.setIconImageDefault();

    this._buildPopupMenu();

    firetray.Handler.setIconTooltipDefault();

    LOG("showHideAllWindows: "+firetray.Handler.hasOwnProperty("showHideAllWindows"));
    this.callbacks.iconActivate = gtk.GCallbackStatusIconActivate_t(
      firetray.Handler.showHideAllWindows);
    let handlerId = gobject.g_signal_connect(firetray.StatusIcon.trayIcon,
      "activate", firetray.StatusIcon.callbacks.iconActivate, null);
    LOG("g_connect activate="+handlerId);

    this.initialized = true;
    return true;
  },

  shutdown: function() {
    firetray.Utils.tryCloseLibs([cairo, gobject, gdk, gtk, pango, pangocairo]);
    this.initialized = false;
  },

  _buildPopupMenu: function() { // FIXME: function too long
    this.menu = gtk.gtk_menu_new();
    var menuShell = ctypes.cast(this.menu, gtk.GtkMenuShell.ptr);
    var addMenuSeparator = false;

    if (firetray.Handler.inBrowserApp) {
		  var menuItemNewWindowLabel = firetray.Utils.strings.GetStringFromName("popupMenu.itemLabel.NewWindow");
      var menuItemNewWindow = gtk.gtk_image_menu_item_new_with_label(
        menuItemNewWindowLabel);
      var menuItemNewWindowIcon = gtk.gtk_image_new_from_stock(
        "gtk-new", gtk.GTK_ICON_SIZE_MENU);
      gtk.gtk_image_menu_item_set_image(menuItemNewWindow, menuItemNewWindowIcon);
      gtk.gtk_menu_shell_append(menuShell, ctypes.cast(menuItemNewWindow, gtk.GtkWidget.ptr));

      this.callbacks.menuItemNewWindowActivate = gobject.GCallback_t(
        firetray.Handler.openBrowserWindow);
      gobject.g_signal_connect(menuItemNewWindow, "activate",
        firetray.StatusIcon.callbacks.menuItemNewWindowActivate, null);

      addMenuSeparator = true;
    }

    if (firetray.Handler.inMailApp) {
		  var menuItemNewMessageLabel = firetray.Utils.strings.GetStringFromName("popupMenu.itemLabel.NewMessage");
      var menuItemNewMessage = gtk.gtk_image_menu_item_new_with_label(
        menuItemNewMessageLabel);
      var menuItemNewMessageIcon = gtk.gtk_image_new_from_stock(
        "gtk-edit", gtk.GTK_ICON_SIZE_MENU);
      gtk.gtk_image_menu_item_set_image(menuItemNewMessage, menuItemNewMessageIcon);
      gtk.gtk_menu_shell_append(menuShell, ctypes.cast(menuItemNewMessage, gtk.GtkWidget.ptr));

      this.callbacks.menuItemNewMessageActivate = gobject.GCallback_t(
        firetray.Handler.openMailMessage);
      gobject.g_signal_connect(menuItemNewMessage, "activate",
        firetray.StatusIcon.callbacks.menuItemNewMessageActivate, null);

      addMenuSeparator = true;
    }

    if (addMenuSeparator) {
      var menuSeparator = gtk.gtk_separator_menu_item_new();
      gtk.gtk_menu_shell_append(menuShell, ctypes.cast(menuSeparator, gtk.GtkWidget.ptr));
    }

    // shouldn't need to convert to utf8 thank to js-ctypes
		var menuItemQuitLabel = firetray.Utils.strings.GetStringFromName("popupMenu.itemLabel.Quit");
    var menuItemQuit = gtk.gtk_image_menu_item_new_with_label(
      menuItemQuitLabel);
    var menuItemQuitIcon = gtk.gtk_image_new_from_stock(
      "gtk-quit", gtk.GTK_ICON_SIZE_MENU);
    gtk.gtk_image_menu_item_set_image(menuItemQuit, menuItemQuitIcon);
    gtk.gtk_menu_shell_append(menuShell, ctypes.cast(menuItemQuit, gtk.GtkWidget.ptr));

    this.callbacks.menuItemQuitActivate = gobject.GCallback_t(
      firetray.Handler.quitApplication);
    gobject.g_signal_connect(menuItemQuit, "activate",
      firetray.StatusIcon.callbacks.menuItemQuitActivate, null);

    var menuWidget = ctypes.cast(this.menu, gtk.GtkWidget.ptr);
    gtk.gtk_widget_show_all(menuWidget);

    /* NOTE: here we do use a function handler (instead of a function
       definition) because we need the args passed to it ! As a consequence, we
       need to abandon 'this' in popupMenu() */
    let that = this;
    this.callbacks.popupMenu = gtk.GCallbackMenuPopup_t(that.popupMenu);
    gobject.g_signal_connect(this.trayIcon, "popup-menu",
      firetray.StatusIcon.callbacks.popupMenu, this.menu);
    this.callbacks.onScroll = gtk.GCallbackOnScroll_t(that.onScroll);
    gobject.g_signal_connect(this.trayIcon, "scroll-event",
      firetray.StatusIcon.callbacks.onScroll, null);

    var menuSeparatorWindows = gtk.gtk_separator_menu_item_new();
    gtk.gtk_menu_shell_prepend(menuShell, ctypes.cast(menuSeparatorWindows, gtk.GtkWidget.ptr));
    firetray.StatusIcon.menuSeparatorWindows = menuSeparatorWindows;

  },

  popupMenu: function(icon, button, activateTime, menu) {
    LOG("menu-popup");
    LOG("ARGS="+icon+", "+button+", "+activateTime+", "+menu);

    try {
      var gtkMenuPtr = ctypes.cast(menu, gtk.GtkMenu.ptr);
      var iconGpointer = ctypes.cast(icon, gobject.gpointer);
      gtk.gtk_menu_popup(
        gtkMenuPtr, null, null, gtk.gtk_status_icon_position_menu,
        iconGpointer, button, activateTime);
    } catch (x) {
      ERROR(x);
    }
  },

  // we keep the definition here, as it is(?) specific to the
  // platform-dependant StatusIcon (there might be no popup menu in other
  // platforms)
  popupMenuWindowItemsHandled: function() {
    return (firetray.Handler.inBrowserApp &&
            firetray.Utils.prefService.getBoolPref('hides_single_window'));
  },

  // we'll be creating menuItems for windows (and not showing them) even if
  // hides_single_window is false, because if hides_single_window becomes true,
  // we'll just have to show the menuItems
  addPopupMenuWindowItem: function(xid) { // on registerWindow
    var menuItemWindow = gtk.gtk_image_menu_item_new();
    firetray.Handler.gtkPopupMenuWindowItems.insert(xid, menuItemWindow);
    this.setPopupMenuWindowItemLabel(menuItemWindow, xid);

    var menuShell = ctypes.cast(firetray.StatusIcon.menu, gtk.GtkMenuShell.ptr);
    gtk.gtk_menu_shell_prepend(menuShell,
                               ctypes.cast(menuItemWindow, gtk.GtkWidget.ptr));

    this.callbacks.menuItemWindowActivate[xid] = gobject.GCallback_t(
      function(){firetray.Handler.showSingleWindow(xid);});
    gobject.g_signal_connect(menuItemWindow, "activate",
      firetray.StatusIcon.callbacks.menuItemWindowActivate[xid], null);

    LOG("add gtkPopupMenuWindowItems: "+firetray.Handler.gtkPopupMenuWindowItems.count);
  },

  setPopupMenuWindowItemLabel: function(menuItem, xid) {
    let title = firetray.Handler.windows[xid].baseWin.title;
    let tailIndex = title.indexOf(" - Mozilla "+firetray.Handler.appNameOriginal);
    if (tailIndex !== -1)
      title = title.substring(0, tailIndex);
    gtk.gtk_menu_item_set_label(ctypes.cast(menuItem, gtk.GtkMenuItem.ptr), title);
  },

  removePopupMenuWindowItem: function(xid) { // on unregisterWindow
    let menuItemWindow = firetray.Handler.gtkPopupMenuWindowItems.get(xid);
    firetray.Handler.gtkPopupMenuWindowItems.remove(xid);
    gtk.gtk_widget_destroy(ctypes.cast(menuItemWindow, gtk.GtkWidget.ptr));

    LOG("remove gtkPopupMenuWindowItems: "+firetray.Handler.gtkPopupMenuWindowItems.count);
  },

  showAllPopupMenuWindowItems: function(filterVisibleWindows) {
    for (let xid in firetray.Handler.windows)
      if (!filterVisibleWindows || !firetray.Handler.windows[xid].visibility)
        this.showSinglePopupMenuWindowItem(xid);
  },

  showSinglePopupMenuWindowItem: function(xid) {
    LOG("showSinglePopupMenuWindowItem");
    let menuItemWindow = firetray.Handler.gtkPopupMenuWindowItems.get(xid);
    gtk.gtk_widget_show(ctypes.cast(menuItemWindow, gtk.GtkWidget.ptr));
    this.showPopupMenuWindowSeparator();
  },

  hideAllPopupMenuWindowItems: function(forceHideSeparator) {
    for (let xid in firetray.Handler.windows)
      this.hideSinglePopupMenuWindowItem(xid, forceHideSeparator);
  },

  hideSinglePopupMenuWindowItem: function(xid, forceHideSeparator) {
    LOG("hideSinglePopupMenuWindowItem");
    let menuItemWindow = firetray.Handler.gtkPopupMenuWindowItems.get(xid);
    gtk.gtk_widget_hide(ctypes.cast(menuItemWindow, gtk.GtkWidget.ptr)); // on hideSingleWindow

    if (!forceHideSeparator || (firetray.Handler.visibleWindowsCount === firetray.Handler.windowsCount)) {
      this.hidePopupMenuWindowSeparator();
    }
  },

  showPopupMenuWindowSeparator: function() {
    LOG("showing menuSeparatorWindows");
    gtk.gtk_widget_show(ctypes.cast(firetray.StatusIcon.menuSeparatorWindows, gtk.GtkWidget.ptr));
  },
  hidePopupMenuWindowSeparator: function() {
    LOG("hiding menuSeparatorWindows");
    gtk.gtk_widget_hide(ctypes.cast(firetray.StatusIcon.menuSeparatorWindows, gtk.GtkWidget.ptr));
  },

  onScroll: function(icon, event, data) {
    let iconGpointer = ctypes.cast(icon, gobject.gpointer);
    let gdkEventScroll = ctypes.cast(event, gdk.GdkEventScroll.ptr);
    let scroll_mode = firetray.Utils.prefService.getCharPref("scroll_mode");

    let direction = gdkEventScroll.contents.direction;
    switch(direction) {
    case gdk.GDK_SCROLL_UP:
	    LOG("SCROLL UP");
      if (scroll_mode === "down_hides")
        firetray.Handler.showAllWindows();
      else if (scroll_mode === "up_hides")
        firetray.Handler.hideAllWindows();
	    break;
    case gdk.GDK_SCROLL_DOWN:
	    LOG("SCROLL DOWN");
      if (scroll_mode === "down_hides")
        firetray.Handler.hideAllWindows();
      else if (scroll_mode === "up_hides")
        firetray.Handler.showAllWindows();
	    break;
    default:
	    ERROR("SCROLL UNKNOWN");
    }
  }

}; // firetray.StatusIcon


firetray.Handler.setIconImage = function(filename) {
  if (!firetray.StatusIcon.trayIcon)
    return false;
  LOG(filename);

  try {
    gtk.gtk_status_icon_set_from_file(firetray.StatusIcon.trayIcon,
                                      filename);
  } catch (x) {
    ERROR(x);
    return false;
  }
  return true;
};

firetray.Handler.setIconImageDefault = function() {
  if (!this.FILENAME_DEFAULT)
    throw "Default application icon filename not set";
  this.setIconImage(this.FILENAME_DEFAULT);
};

// GTK bug: Gdk-CRITICAL **: IA__gdk_window_get_root_coords: assertion `GDK_IS_WINDOW (window)' failed
firetray.Handler.setIconTooltip = function(toolTipStr) {
  if (!firetray.StatusIcon.trayIcon)
    return false;

  try {
    gtk.gtk_status_icon_set_tooltip_text(firetray.StatusIcon.trayIcon,
                                         toolTipStr);
  } catch (x) {
    ERROR(x);
    return false;
  }
  return true;
};

firetray.Handler.setIconTooltipDefault = function() {
  if (!this.appNameOriginal)
    throw "application name not initialized";
  this.setIconTooltip(this.appNameOriginal);
};

firetray.Handler.setIconText = function(text, color) { // FIXME: function too long
  LOG("setIconText, color="+color);
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
      if(sz < firetray.StatusIcon.MIN_FONT_SIZE) {
        sz = firetray.StatusIcon.MIN_FONT_SIZE;
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

    gtk.gtk_status_icon_set_from_pixbuf(firetray.StatusIcon.trayIcon, dest);
  } catch (x) {
    ERROR(x);
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
