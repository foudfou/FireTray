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
  /* NOTE: it should not be necessary to gtk_widget_add_events(gtkWin,
   gdk.GDK_ALL_EVENTS_MASK); */
  this.windows[xid] = {}; // windows.hasOwnProperty(xid) is true, remove with: delete windows[xid]
  this.windows[xid].gtkWin = gtkWin;
  this.windows[xid].gdkWin = gdkWin;

  try {

    /* delete_event_cb (in gtk2/nsWindow.cpp) prevents us from catching
     "delete-event" */
    let deleteEventId = gobject.g_signal_lookup("delete-event", gtk.gtk_window_get_type());
    LOG("deleteEventId="+deleteEventId);
    let mozDeleteEventCb = gobject.g_signal_handler_find(gtkWin, gobject.G_SIGNAL_MATCH_ID, deleteEventId, 0, null, null, null);
    LOG("mozDeleteEventCb="+mozDeleteEventCb);
    gobject.g_signal_handler_block(gtkWin, mozDeleteEventCb); // not _disconnect !
    this.windows[xid].mozDeleteEventCb = mozDeleteEventCb; // FIXME: cb should be unblocked

    this.windows[xid].windowDeleteCb = gtk.GCallbackGenericEvent_t(firetray.Window.windowDelete);
    res = gobject.g_signal_connect(gtkWin, "delete-event", that.windows[xid].windowDeleteCb, null);
    LOG("g_connect delete-event="+res);

    /* we'll catch minimize events with Gtk:
     http://stackoverflow.com/questions/8018328/what-is-the-gtk-event-called-when-a-window-minimizes */
    this.windows[xid].windowStateCb = gtk.GCallbackGenericEvent_t(firetray.Window.windowState);
    res = gobject.g_signal_connect(gtkWin, "window-state-event", this.windows[xid].windowStateCb, null);
    LOG("g_connect window-state-event="+res);

  } catch (x) {
    this._unregisterWindowByXID(xid);
    ERROR(x);
    return false;
  }

  return true;
};

firetray.Handler.unregisterWindow = function(win) {
  LOG("unregister window");

  let [gtkWin, gdkWin, xid] = firetray.Window.getWindowsFromChromeWindow(win);
  return this._unregisterWindowByXID(xid);
};

firetray.Handler._unregisterWindowByXID = function(xid) {
  if (this.windows.hasOwnProperty(xid))
    delete this.windows[xid];
  else {
    ERROR("can't unregister unknown window "+xid);
    return false;
  }
  return true;
};

firetray.Handler.showHideToTray = function(gtkStatusIcon, userData) {
  LOG("showHideToTray: "+userData);

  for (let xid in firetray.Handler.windows) {
    LOG(xid);
    try {
      gdk.gdk_window_show(firetray.Handler.windows[xid].gdkWin);
    } catch (x) {
      ERROR(x);
    }
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

  getWindowsFromChromeWindow: function(win) {
    let gtkWin = firetray.Window.getGtkWindowHandle(win);
    LOG("gtkWin="+gtkWin);
    let gdkWin = firetray.Window.getGdkWindowFromGtkWindow(gtkWin);
    LOG("gdkWin="+gdkWin);
    let xid = firetray.Window.getXIDFromGdkWindow(gdkWin);
    LOG("XID="+xid);
    return [gtkWin, gdkWin, xid];
  },

  windowDelete: function(gtkWidget, gdkEv, userData){
    LOG("gtk_widget_hide: "+gtkWidget+", "+gdkEv+", "+userData);
    try{
      let gdkWin = firetray.Window.getGdkWindowFromGtkWindow(gtkWidget);
      gdk.gdk_window_hide(gdkWin);
    } catch (x) {
      ERROR(x);
    }
    let stopPropagation = true;
    return stopPropagation;
  },

  windowState: function(gtkWidget, gdkEv, userData){
    LOG("window-state-event");
    let stopPropagation = true;
    return stopPropagation;
  }

}; // firetray.Window
