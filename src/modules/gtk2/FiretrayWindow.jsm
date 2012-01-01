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
Cu.import("resource://firetray/ctypesMap.jsm");
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

    if (!winTitle.isNull()) {
      LOG(inTitle+" = "+winTitle);
      if (libc.strcmp(inTitle, winTitle) == 0)
        data.contents.outWindow = gtkWin;
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
    let gdkWin = firetray.Window.getGdkWindowFromGtkWindow(gtkWin);
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

  saveWindowPositionSizeState: function(xid) {
    let gtkWin = firetray.Handler.gtkWindows.get(xid);
    let gdkWin = firetray.Handler.gdkWindows.get(xid);

    try {
      let gx = new gobject.gint; let gy = new gobject.gint;
      gtk.gtk_window_get_position(gtkWin, gx.address(), gy.address());
      let gwidth = new gobject.gint; let gheight = new gobject.gint;
      gtk.gtk_window_get_size(gtkWin, gwidth.address(), gheight.address());
      let windowState  = gdk.gdk_window_get_state(gdkWin);
      LOG("save: gx="+gx+", gy="+gy+", gwidth="+gwidth+", gheight="+gheight+", windowState="+windowState);
      firetray.Handler.windows[xid].savedX = gx;
      firetray.Handler.windows[xid].savedY = gy;
      firetray.Handler.windows[xid].savedWidth = gwidth;
      firetray.Handler.windows[xid].savedHeight = gheight;
      firetray.Handler.windows[xid].savedState = windowState;
    } catch (x) {
      ERROR(x);
    }
  },

  restoreWindowPositionSizeState: function(xid) {
    if (!firetray.Handler.windows[xid].savedX)
      return; // windows[xid].saved* may not be initialized

    let gtkWin = firetray.Handler.gtkWindows.get(xid);
    let gdkWin = firetray.Handler.gdkWindows.get(xid);

    LOG("restore: x="+firetray.Handler.windows[xid].savedX+", y="+firetray.Handler.windows[xid].savedY+", w="+firetray.Handler.windows[xid].savedWidth+", h="+firetray.Handler.windows[xid].savedHeight);
    // NOTE: unfortunately, this is the best way I found *inside GTK* to
    // restore position and size: gdk.gdk_window_move_resize doesn't work
    // well. And unfortunately, we need to show the window before restoring
    // position and size :-( TODO: Might be worth trying with x11 or
    // BaseWindow.visibility ?
    gtk.gtk_window_move(gtkWin, firetray.Handler.windows[xid].savedX, firetray.Handler.windows[xid].savedY);
    gtk.gtk_window_resize(gtkWin, firetray.Handler.windows[xid].savedWidth, firetray.Handler.windows[xid].savedHeight);

    // TODO: restore state
    firetray.Handler.windows[xid].win.setCursor("help");
    // firetray.Handler.windows[xid].savedState
  },

  onWindowState: function(gtkWidget, gdkEventState, userData){
    // LOG("window-state-event");
    // if(event->new_window_state & GDK_WINDOW_STATE_ICONIFIED){
    let stopPropagation = true;
    return stopPropagation;
  }

}; // firetray.Window


///////////////////////// firetray.Handler overriding /////////////////////////

// NOTE: storing ctypes pointers into a JS object doesn't work: pointers are
// "evolving" after a while (maybe due to back and forth conversion). So we
// need to store them into a real ctypes array !
firetray.Handler.gtkWindows = new ctypesMap(gtk.GtkWindow.ptr),
firetray.Handler.gdkWindows = new ctypesMap(gdk.GdkWindow.ptr),

/** debug facility */
firetray.Handler.dumpWindows = function() {
  LOG(firetray.Handler.windowsCount);
  for (let winId in firetray.Handler.windows)
    LOG(winId+"="+firetray.Handler.gtkWindows.get(winId));
};

firetray.Handler.registerWindow = function(win) {
  LOG("register window");

  // register
  let [gtkWin, gdkWin, xid] = firetray.Window.getWindowsFromChromeWindow(win);
  this.windows[xid] = {};
  this.windows[xid].win = win;
  try {
    this.gtkWindows.insert(xid, gtkWin);
    this.gdkWindows.insert(xid, gdkWin);
  } catch (x) {
    if (x.name === "RangeError") // instanceof not working :-(
      win.alert(x+"\n\nYou seem to have more than "+FIRETRAY_WINDOW_COUNT_MAX
                +" windows open. This breaks FireTray and most probably "
                +firetray.Handler.appNameOriginal+".");
  }
  this.windowsCount += 1;
  this.visibleWindowsCount += 1;
  this.windows[xid].visibility = true;
  LOG("window "+xid+" registered");
  /* NOTE: it should not be necessary to gtk_widget_add_events(gtkWin,
   gdk.GDK_ALL_EVENTS_MASK); */

  try {
    /* NOTE: we could try to catch the "delete-event" here and block
       delete_event_cb (in gtk2/nsWindow.cpp), but we prefer to use the
       provided 'close' JS event */

    /* we'll catch minimize events with Gtk:
     http://stackoverflow.com/questions/8018328/what-is-the-gtk-event-called-when-a-window-minimizes */
    this.windows[xid].onWindowStateCb = gtk.GCallbackWindowStateEvent_t(firetray.Window.onWindowState);
    this.windows[xid].onWindowStateCbId = gobject.g_signal_connect(gtkWin, "window-state-event", this.windows[xid].onWindowStateCb, null);
    LOG("g_connect window-state-event="+this.windows[xid].onWindowStateCbId);

  } catch (x) {
    this._unregisterWindowByXID(xid);
    ERROR(x);
    return false;
  }

  LOG("AFTER"); firetray.Handler.dumpWindows();

  return true;
};

firetray.Handler._unregisterWindowByXID = function(xid) {
  this.windowsCount -= 1;
  if (this.windows[xid].visibility) this.visibleWindowsCount -= 1;
  if (this.windows.hasOwnProperty(xid)) {
    if (!delete this.windows[xid])
      throw new DeleteError();
    this.gtkWindows.remove(xid);
    this.gdkWindows.remove(xid);
  } else {
    ERROR("can't unregister unknown window "+xid);
    return false;
  }
  LOG("window "+xid+" unregistered");
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

firetray.Handler.getWindowIdFromChromeWindow = firetray.Window.getXIDFromChromeWindow;

firetray.Handler.showSingleWindow = function(xid) {
  LOG("show xid="+xid);
  try {
    // try to restore previous state. TODO: z-order respected ?
    gdk.gdk_window_show_unraised(firetray.Handler.gdkWindows.get(xid));
    // need to restore *after* showing for correctness
    firetray.Window.restoreWindowPositionSizeState(xid);
  } catch (x) {
    ERROR(x);
  }
  firetray.Handler.windows[xid].visibility = true;
  firetray.Handler.visibleWindowsCount += 1;
};

firetray.Handler.hideSingleWindow = function(xid) {
  LOG("hideSingleWindow");
  try {
    firetray.Window.saveWindowPositionSizeState(xid);
    // NOTE: we don't use BaseWindow.visibility to have full control
    gdk.gdk_window_hide(firetray.Handler.gdkWindows.get(xid));
  } catch (x) {
    ERROR(x);
  }
  firetray.Handler.windows[xid].visibility = false;
  firetray.Handler.visibleWindowsCount -= 1;
};

firetray.Handler.showHideAllWindows = function(gtkStatusIcon, userData) {
  LOG("showHideAllWindows: "+userData);
  // NOTE: showHideAllWindows being a callback, we need to use
  // 'firetray.Handler' explicitely instead of 'this'

  LOG("visibleWindowsCount="+firetray.Handler.visibleWindowsCount);
  LOG("windowsCount="+firetray.Handler.windowsCount);
  let visibilityRate = firetray.Handler.visibleWindowsCount/firetray.Handler.windowsCount;
  LOG("visibilityRate="+visibilityRate);
  if (visibilityRate > 0.5)     // TODO: should be configurable
    firetray.Handler.hideAllWindows();
  else
    firetray.Handler.showAllWindows();

  let stopPropagation = true;
  return stopPropagation;
};

/* GTK TEST */

// /*
//  * DAMN IT ! getZOrderDOMWindowEnumerator doesn't work on Linux :-(
//  * https://bugzilla.mozilla.org/show_bug.cgi?id=156333, and all windows
//  * seem to have the same zlevel ("normalZ") which is different from the
//  * z-order. There seems to be no means to get/set the z-order at this
//  * time...
//  */
// _updateHandledDOMWindows: function() {
//   LOG("_updateHandledDOMWindows");
//   this._handledDOMWindows = [];
//   var windowsEnumerator = Services.wm.getEnumerator(null); // returns a nsIDOMWindow
//   while (windowsEnumerator.hasMoreElements()) {
//     this._handledDOMWindows[this._handledDOMWindows.length] =
//       windowsEnumerator.getNext();
//   }
// },

// showHideToTray: function(a1) { // unused param
//   LOG("showHideToTray");

//   /*
//    * we update _handledDOMWindows only when hiding, because remembered{X,Y}
//    * properties are attached to them, and we suppose there won't be
//    * created/delete windows when all are hidden.
//    *
//    * NOTE: this may not be a good design if we want to show/hide one window
//    * at a time... might need win.QueryInterface(Ci.nsIInterfaceRequestor)
//    * .getInterface(Ci.nsIDOMWindowUtils).outerWindowID;
//    */
//   if (!this._windowsHidden)   // hide
//     this._updateHandledDOMWindows();
//   LOG("nb Windows: " + this._handledDOMWindows.length);

//   for(let i=0; i<this._handledDOMWindows.length; i++) {
//     let bw = this._getBaseOrXULWindowFromDOMWindow(
//       this._handledDOMWindows[i], "BaseWindow");

//     LOG('isHidden: ' + this._windowsHidden);
//     LOG("bw.visibility: " + bw.visibility);
//     try {
//       if (this._windowsHidden) { // show

//         // correct position, size and state
//         let x = this._handledDOMWindows[i].rememberedX;
//         let y = this._handledDOMWindows[i].rememberedY;
//         let cx = this._handledDOMWindows[i].rememberedWidth;
//         let cy = this._handledDOMWindows[i].rememberedHeight;
//         LOG("set bw.position: " + x + ", " + y + ", " + cx + ", " + cy);
//         let windowState = this._handledDOMWindows[i].rememberedState;
//         LOG("set windowState: " + windowState);

//         switch (windowState) {
//         case Ci.nsIDOMChromeWindow.STATE_MAXIMIZED: // 1
//           this._handledDOMWindows[i].QueryInterface(Ci.nsIDOMChromeWindow).maximize();
//           break;
//         case Ci.nsIDOMChromeWindow.STATE_MINIMIZED: // 2
//           let prefHidesOnMinimize = firetray.Utils.prefService.getBoolPref("hides_on_minimize");
//           if (!prefHidesOnMinimize)
//             this._handledDOMWindows[i].QueryInterface(Ci.nsIDOMChromeWindow).minimize();
//           break;
//         case Ci.nsIDOMChromeWindow.STATE_NORMAL: // 3
//           bw.setPositionAndSize(x, y, cx, cy, false); // repaint
//           break;
//         case Ci.nsIDOMChromeWindow.STATE_FULLSCREEN: // 4
//           // FIXME: NOT IMPLEMENTED YET
//         default:
//         }
//         LOG("maximize after: " + this._handledDOMWindows[i].QueryInterface(Ci.nsIDOMChromeWindow).windowState);

//         bw.visibility = true;

//       } else {                // hide

//         // remember position and size
//         let x = {}, y = {}, cx = {}, cy = {};
//         bw.getPositionAndSize(x, y, cx, cy);
//         LOG("remember bw.position: " + x.value + ", " + y.value + ", " + cx.value + ", " + cy.value);
//         this._handledDOMWindows[i].rememberedX = x.value;
//         this._handledDOMWindows[i].rememberedY = y.value;
//         this._handledDOMWindows[i].rememberedWidth = cx.value;
//         this._handledDOMWindows[i].rememberedHeight = cy.value;
//         this._handledDOMWindows[i].rememberedState = this._handledDOMWindows[i]
//           .QueryInterface(Ci.nsIDOMChromeWindow).windowState;
//         LOG("maximized: " + this._handledDOMWindows[i].rememberedState);

//         bw.visibility = false;
//       }

//     } catch (x) {
//       LOG(x);
//     }
//     LOG("bw.visibility: " + bw.visibility);
//     LOG("bw.title: " + bw.title);
//   }

//   if (this._windowsHidden) {
//     this._windowsHidden = false;
//   } else {
//     this._windowsHidden = true;
//   }

// }, // showHideToTray
