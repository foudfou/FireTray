/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

/* GdkWindow and GtkWindow are totally different things. A GtkWindow is a
 "standalone" window. A GdkWindow is just a region on the screen that can
 capture events and has certain attributes (such as a cursor, and a coordinate
 system). Basically a GdkWindow is an X window, in the Xlib sense, and
 GtkWindow is a widget used for a particular UI effect.
 (http://mail.gnome.org/archives/gtk-app-devel-list/1999-January/msg00138.html) */

var EXPORTED_SYMBOLS = [ "firetray" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://firetray/gobject.jsm");
Cu.import("resource://firetray/gdk.jsm");
Cu.import("resource://firetray/gtk.jsm");
Cu.import("resource://firetray/libc.jsm");
Cu.import("resource://firetray/commons.js");

const Services2 = {};
XPCOMUtils.defineLazyServiceGetter(
  Services2,
  "uuid",
  "@mozilla.org/uuid-generator;1",
  "nsIUUIDGenerator"
);

if ("undefined" == typeof(firetray.Handler))
  ERROR("This module MUST be imported from/after FiretrayHandler !");

/**
 * custum type used to pass data in to and out of findGtkWindowByTitleCb
 */
var _find_data_t = ctypes.StructType("_find_data_t", [
  { inTitle: ctypes.char.ptr },
  { outWindow: gtk.GtkWindow.ptr }
]);


firetray.Handler.registerWindow = function(win) {
  LOG("register window");
  let that = this;

  // register
  let [gtkWin, gdkWin, xid] = firetray.Window.getWindowsFromChromeWindow(win);
  this.windows[xid] = {};
  this.windows[xid].win = win;
  this.windows[xid].gtkWin = gtkWin;
  this.windows[xid].gdkWin = gdkWin;
  LOG("window "+xid+" registered");
  /* NOTE: it should not be necessary to gtk_widget_add_events(gtkWin,
   gdk.GDK_ALL_EVENTS_MASK); */

  try {
    /* NOTE: we could try to catch the "delete-event" here and block
       delete_event_cb (in gtk2/nsWindow.cpp), but we prefer to use the
       provided "close" JS event */

    /* we'll catch minimize events with Gtk:
     http://stackoverflow.com/questions/8018328/what-is-the-gtk-event-called-when-a-window-minimizes */
    this.windows[xid].windowStateCb = gtk.GCallbackWindowStateEvent_t(firetray.Window.windowState);
    this.windows[xid].windowStateCbId = gobject.g_signal_connect(gtkWin, "window-state-event", this.windows[xid].windowStateCb, null);
    LOG("g_connect window-state-event="+this.windows[xid].windowStateCbId);

  } catch (x) {
    this._unregisterWindowByXID(xid);
    ERROR(x);
    return false;
  }

  return true;
};

firetray.Handler.unregisterWindow = function(win) {
  LOG("unregister window");

  try {
    let xid = firetray.Window.getXIDFromChromeWindow(win);
    return this._unregisterWindowByXID(xid);
  } catch (x) {
    ERROR(x);
  }
  return false;
};

firetray.Handler._unregisterWindowByXID = function(xid) {
  try {
    if (this.windows.hasOwnProperty(xid))
      delete this.windows[xid];
    else {
      ERROR("can't unregister unknown window "+xid);
      return false;
    }
  } catch (x) {
    ERROR(x);
    return false;
  }
  LOG("window "+xid+" unregistered");
  return true;
};

firetray.Handler.showSingleWindow = function(xid) {
    try {
      // keep z-order - and try to restore previous state
      LOG("gdkWin="+firetray.Handler.windows[xid].gdkWin);
      gdk.gdk_window_show_unraised(firetray.Handler.windows[xid].gdkWin);
      // need to restore *after* showing for correction
      // firetray.Window._restoreWindowPositionSizeState(xid);
    } catch (x) {
      ERROR(x);
    }
};

firetray.Handler.showHideAllWindows = function(gtkStatusIcon, userData) {
  LOG("showHideAllWindows: "+userData);

  // NOTE: showHideAllWindows being a callback, we need to use 'firetray.Handler'
  // explicitely instead of 'this'
  for (let xid in firetray.Handler.windows) {
    LOG("show xid="+xid);
    firetray.Handler.showSingleWindow(xid);
  }

  let stopPropagation = true;
  return stopPropagation;
};


firetray.Window = {

  /**
   * Iterate over all Gtk toplevel windows to find a window. We rely on
   * Service.wm to watch windows correctly: we should find only one window.
   *
   * @author Nils Maier (stolen from MiniTrayR)
   * @param window nsIDOMWindow from Services.wm
   * @return a gtk.GtkWindow.ptr
   */
  getGtkWindowHandle: function(window) {
    let baseWindow = window
      .QueryInterface(Ci.nsIInterfaceRequestor)
      .getInterface(Ci.nsIWebNavigation)
      .QueryInterface(Ci.nsIBaseWindow);

    // Tag the base window
    let oldTitle = baseWindow.title;
    LOG("oldTitle="+oldTitle);
    baseWindow.title = Services2.uuid.generateUUID().toString();

    try {
      // Search the window by the *temporary* title
      let widgets = gtk.gtk_window_list_toplevels();
      let that = this;
      let findGtkWindowByTitleCb = gobject.GFunc_t(that._findGtkWindowByTitle);
      var userData = new _find_data_t(
        ctypes.char.array()(baseWindow.title),
        null
      ).address();
      LOG("userData="+userData);
      gobject.g_list_foreach(widgets, findGtkWindowByTitleCb, userData);
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
    // LOG("GTK Window: "+gtkWidget+", "+userData);

    let data = ctypes.cast(userData, _find_data_t.ptr);
    let inTitle = data.contents.inTitle;
    // LOG("inTitle="+inTitle.readString());

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

  getGdkWindowFromGtkWindow: function(gtkWin) {
    try {
      let gtkWid = ctypes.cast(gtkWin, gtk.GtkWidget.ptr);
      return gtk.gtk_widget_get_window(gtkWid);
    } catch (x) {
      ERROR(x);
    }
    return null;
  },

  getXIDFromGdkWindow: function(gdkWin) {
    return gdk.gdk_x11_drawable_get_xid(ctypes.cast(gdkWin, gdk.GdkDrawable.ptr));
  },

  getXIDFromGtkWidget: function(gtkWid) {
    try {
      let gdkWin = gtk.gtk_widget_get_window(gtkWid);
      return gdk.gdk_x11_drawable_get_xid(ctypes.cast(gdkWin, gdk.GdkDrawable.ptr));
    } catch (x) {
      ERROR(x);
    }
    return null;
  },

  /** consider using getXIDFromChromeWindow() if you only need the XID */
  getWindowsFromChromeWindow: function(win) {
    let gtkWin = firetray.Window.getGtkWindowHandle(win);
    LOG("gtkWin="+gtkWin);
    let gdkWin = firetray.Window.getGdkWindowFromGtkWindow(gtkWin);
    LOG("gdkWin="+gdkWin);
    let xid = firetray.Window.getXIDFromGdkWindow(gdkWin);
    LOG("XID="+xid);
    return [gtkWin, gdkWin, xid];
  },

  getXIDFromChromeWindow: function(win) {
    for (let xid in firetray.Handler.windows)
      if (firetray.Handler.windows[xid].win === win)
        return xid;
    ERROR("unknown window while lookup");
    return null;
  },

  hideWindow: function(win) {
    LOG("hideWindow");
    let xid = this.getXIDFromChromeWindow(win);
    LOG("found xid="+xid);
    try {
      firetray.Window._saveWindowPositionSizeState(xid);

      // hide window - NOTE: we don't use BaseWindow.visibility to have full
      // control
      gdk.gdk_window_hide(firetray.Handler.windows[xid].gdkWin);
    } catch (x) {
      ERROR(x);
    }
  },

  _saveWindowPositionSizeState: function(xid) {
    let gdkWin = firetray.Handler.windows[xid].gdkWin;

    try {
      let gx = new gobject.gint; let gy = new gobject.gint;
      // gtk.gtk_window_get_position(gtkWin, gx.address(), gy.address());
      gdk.gdk_window_get_position(gdkWin, gx.address(), gy.address());
      let gwidth = new gobject.gint; let gheight = new gobject.gint;
      // gtk.gtk_window_get_size(gtkWin, gwidth.address(), gheight.address());
      gdk.gdk_drawable_get_size(ctypes.cast(gdkWin, gdk.GdkDrawable.ptr), gwidth.address(), gheight.address());
      let windowState  = gdk.gdk_window_get_state(firetray.Handler.windows[xid].gdkWin);
      LOG("gx="+gx+", gy="+gy+", gwidth="+gwidth+", gheight="+gheight+", windowState="+windowState);
      firetray.Handler.windows[xid].savedX = gx;
      firetray.Handler.windows[xid].savedY = gy;
      firetray.Handler.windows[xid].savedWidth = gwidth;
      firetray.Handler.windows[xid].savedHeight = gheight;
      firetray.Handler.windows[xid].savedState = windowState;
    } catch (x) {
      ERROR(x);
    }

  },

  _restoreWindowPositionSizeState: function(xid) {
    let gdkWin = firetray.Handler.windows[xid].gdkWin;
    if (!firetray.Handler.windows[xid].savedX)
      return; // windows[xid].saved* may not be initialized

    LOG("restore gdkWin: "+gdkWin+", x="+firetray.Handler.windows[xid].savedX+", y="+firetray.Handler.windows[xid].savedY+", w="+firetray.Handler.windows[xid].savedWidth+", h="+firetray.Handler.windows[xid].savedHeight);
    try {
      gdk.gdk_window_move_resize(gdkWin,
                                 firetray.Handler.windows[xid].savedX,
                                 firetray.Handler.windows[xid].savedY,
                                 firetray.Handler.windows[xid].savedWidth,
                                 firetray.Handler.windows[xid].savedHeight);
      // firetray.Handler.windows[xid].savedState
    } catch (x) {
      ERROR(x);
    }
  },

  windowState: function(gtkWidget, gdkEventState, userData){
    // LOG("window-state-event");
    // if(event->new_window_state & GDK_WINDOW_STATE_ICONIFIED){
    let stopPropagation = true;
    return stopPropagation;
  }

}; // firetray.Window
