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
Cu.import("resource://firetray/ctypes/ctypesMap.jsm");
Cu.import("resource://firetray/ctypes/linux/gobject.jsm");
Cu.import("resource://firetray/ctypes/linux/gdk.jsm");
Cu.import("resource://firetray/ctypes/linux/gtk.jsm");
Cu.import("resource://firetray/ctypes/linux/libc.jsm");
Cu.import("resource://firetray/ctypes/linux/x11.jsm");
Cu.import("resource://firetray/commons.js");
firetray.Handler.subscribeLibsForClosing([gobject, gdk, gtk, libc, x11, glib]);

let log = firetray.Logging.getLogger("firetray.Window");

if ("undefined" == typeof(firetray.Handler))
  log.error("This module MUST be imported from/after FiretrayHandler !");

const Services2 = {};
XPCOMUtils.defineLazyServiceGetter(
  Services2,
  "uuid",
  "@mozilla.org/uuid-generator;1",
  "nsIUUIDGenerator"
);

const FIRETRAY_XWINDOW_HIDDEN    = 1 << 0; // when minimized also
const FIRETRAY_XWINDOW_MAXIMIZED = 1 << 1;

/**
 * custum type used to pass data in to and out of findGtkWindowByTitleCb
 */
var _find_data_t = ctypes.StructType("_find_data_t", [
  { inTitle: ctypes.char.ptr },
  { outWindow: gtk.GtkWindow.ptr }
]);

// NOTE: storing ctypes pointers into a JS object doesn't work: pointers are
// "evolving" after a while (maybe due to back and forth conversion). So we
// need to store them into a real ctypes array !
firetray.Handler.gtkWindows              = new ctypesMap(gtk.GtkWindow.ptr),
firetray.Handler.gdkWindows              = new ctypesMap(gdk.GdkWindow.ptr),
firetray.Handler.gtkPopupMenuWindowItems = new ctypesMap(gtk.GtkImageMenuItem.ptr),


firetray.Window = {

  init: function() {
    this.initialized = true;
  },

  shutdown: function() {
    this.initialized = false;
  },

  /**
   * Iterate over all Gtk toplevel windows to find a window. We rely on
   * Service.wm to watch windows correctly: we should find only one window.
   *
   * @author Nils Maier (stolen from MiniTrayR)
   * @param window nsIDOMWindow from Services.wm
   * @return a gtk.GtkWindow.ptr
   */
  getGtkWindowFromChromeWindow: function(window) {
    let baseWindow = window
          .QueryInterface(Ci.nsIInterfaceRequestor)
          .getInterface(Ci.nsIWebNavigation)
          .QueryInterface(Ci.nsIBaseWindow);

    // Tag the base window
    let oldTitle = baseWindow.title;
    log.debug("oldTitle="+oldTitle);
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
      log.debug("userData="+userData);
      gobject.g_list_foreach(widgets, findGtkWindowByTitleCb, userData);
      gobject.g_list_free(widgets);

      if (userData.contents.outWindow.isNull())
        throw new Error("Window not found!");

      log.debug("found window: "+userData.contents.outWindow);
    } catch (x) {
      log.error(x);
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
    let data = ctypes.cast(userData, _find_data_t.ptr);
    let inTitle = data.contents.inTitle;

    let gtkWin = ctypes.cast(gtkWidget, gtk.GtkWindow.ptr);
    let winTitle = gtk.gtk_window_get_title(gtkWin);

    if (!winTitle.isNull()) {
      log.debug(inTitle+" = "+winTitle);
      if (libc.strcmp(inTitle, winTitle) == 0)
        data.contents.outWindow = gtkWin;
    }
  },

  getGdkWindowFromGtkWindow: function(gtkWin) {
    try {
      let gtkWid = ctypes.cast(gtkWin, gtk.GtkWidget.ptr);
      return gtk.gtk_widget_get_window(gtkWid);
    } catch (x) {
      log.error(x);
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
      log.error(x);
    }
    return null;
  },

  addrPointedByInHex: function(ptr) {
    return "0x"+ctypes.cast(ptr, ctypes.uintptr_t.ptr).contents.toString(16);
  },

  getGdkWindowFromNativeHandle: function(nativeHandle) {
    let gdkw = new gdk.GdkWindow.ptr(ctypes.UInt64(nativeHandle)); // a new pointer to the GdkWindow
    gdkw = gdk.gdk_window_get_effective_toplevel(gdkw);
    log.debug("gdkw="+gdkw+" *gdkw="+this.addrPointedByInHex(gdkw));
    return gdkw;
  },

  getGtkWindowFromGdkWindow: function(gdkWin) {
    let gptr = new gobject.gpointer;
    gdk.gdk_window_get_user_data(gdkWin, gptr.address());
    log.debug("gptr="+gptr+" *gptr="+this.addrPointedByInHex(gptr));
    let gtkw = ctypes.cast(gptr, gtk.GtkWindow.ptr);
    log.debug("gtkw="+gtkw+" *gtkw="+this.addrPointedByInHex(gtkw));
    return gtkw;
  },

  /* consider using getXIDFromChromeWindow() if you only need the XID */
  getWindowsFromChromeWindow: function(win) {
    let baseWin = firetray.Handler.getWindowInterface(win, "nsIBaseWindow");
    let nativeHandle = baseWin.nativeHandle; // Moz' private pointer to the GdkWindow
    log.debug("nativeHandle="+nativeHandle);
    let gtkWin, gdkWin;
    if (nativeHandle) { // Gecko 17+
      gdkWin = firetray.Window.getGdkWindowFromNativeHandle(nativeHandle);
      gtkWin = firetray.Window.getGtkWindowFromGdkWindow(gdkWin);
    } else {
      gtkWin = firetray.Window.getGtkWindowFromChromeWindow(win);
      gdkWin = firetray.Window.getGdkWindowFromGtkWindow(gtkWin);
    }
    let xid = firetray.Window.getXIDFromGdkWindow(gdkWin);
    log.debug("XID="+xid);
    return [baseWin, gtkWin, gdkWin, xid];
  },

  getXIDFromChromeWindow: function(win) {
    for (let xid in firetray.Handler.windows)
      if (firetray.Handler.windows[xid].chromeWin === win) return xid;
    log.error("unknown window while lookup");
    return null;
  },

  unregisterWindowByXID: function(xid) {
    if (!firetray.Handler.windows.hasOwnProperty(xid)) {
      log.error("can't unregister unknown window "+xid);
      return false;
    }

    if (!delete firetray.Handler.windows[xid])
      throw new DeleteError();
    firetray.Handler.gtkWindows.remove(xid);
    firetray.Handler.gdkWindows.remove(xid);
    firetray.PopupMenu.removeWindowItem(xid);
    firetray.Handler.visibleWindowsCount -= 1;

    log.debug("window "+xid+" unregistered");
    return true;
  },

  show: function(xid) {
    log.debug("show xid="+xid);

    // try to restore previous state. TODO: z-order respected ?
    firetray.Window.restorePositionAndSize(xid);
    firetray.Window.restoreStates(xid);

    // better visual effect if visibility set after restorePosition, but some
    // WMs like compiz seem not to honor position setting if window not visible
    firetray.Window.setVisibility(xid, true);

    // after show
    firetray.Window.restoreDesktop(xid);
    if (firetray.Utils.prefService.getBoolPref('show_activates'))
      firetray.Window.activate(xid);

    firetray.PopupMenu.hideWindowItemAndSeparatorMaybe(xid);
    firetray.Handler.showHideIcon();
  },

  /* FIXME: hiding windows should also hide child windows */
  hide: function(xid) {
    log.debug("hide");

    firetray.Window.savePositionAndSize(xid);
    firetray.Window.saveStates(xid);
    firetray.Window.saveDesktop(xid);

    firetray.Window.setVisibility(xid, false);

    firetray.PopupMenu.showWindowItem(xid);
    firetray.Handler.showHideIcon();
  },

  startupHide: function(xid) {
    log.debug('startupHide: '+xid);

    firetray.Handler.windows[xid].baseWin.visibility = false;
    this.updateVisibility(xid, false);

    firetray.PopupMenu.showWindowItem(xid);
    firetray.Handler.showHideIcon();
  },

  savePositionAndSize: function(xid) {
    let gx = {}, gy = {}, gwidth = {}, gheight = {};
    firetray.Handler.windows[xid].baseWin.getPositionAndSize(gx, gy, gwidth, gheight);
    firetray.Handler.windows[xid].savedX = gx.value;
    firetray.Handler.windows[xid].savedY = gy.value;
    firetray.Handler.windows[xid].savedWidth = gwidth.value;
    firetray.Handler.windows[xid].savedHeight = gheight.value;
    log.debug("save: gx="+gx.value+", gy="+gy.value+", gwidth="+gwidth.value+", gheight="+gheight.value);
  },

  restorePositionAndSize: function(xid) {
    if ("undefined" === typeof(firetray.Handler.windows[xid].savedX))
      return; // windows[xid].saved* may not be initialized

    log.debug("restore: x="+firetray.Handler.windows[xid].savedX+", y="+firetray.Handler.windows[xid].savedY+", w="+firetray.Handler.windows[xid].savedWidth+", h="+firetray.Handler.windows[xid].savedHeight);
    firetray.Handler.windows[xid].baseWin.setPositionAndSize(
      firetray.Handler.windows[xid].savedX,
      firetray.Handler.windows[xid].savedY,
      firetray.Handler.windows[xid].savedWidth,
      firetray.Handler.windows[xid].savedHeight,
      false); // repaint

    ['savedX', 'savedX', 'savedWidth', 'savedHeight'].forEach(function(element, index, array) {
      delete firetray.Handler.windows[xid][element];
    });
  },

  saveStates: function(xid) {
    let winStates = firetray.Window.getXWindowStates(x11.Window(xid));
    firetray.Handler.windows[xid].savedStates = winStates;
    log.debug("save: windowStates="+winStates);
  },

  restoreStates: function(xid) {
    let winStates = firetray.Handler.windows[xid].savedStates;
    log.debug("restored WindowStates: " + winStates);

    if (winStates & FIRETRAY_XWINDOW_MAXIMIZED) {
      firetray.Handler.windows[xid].chromeWin.maximize();
      log.debug("restored maximized");
    }

    if (winStates & FIRETRAY_XWINDOW_HIDDEN) {
      firetray.Handler.windows[xid].chromeWin.minimize();
      log.debug("restored minimized");
    }

    /* helps prevent getting iconify event following show() */
    if (firetray.Utils.prefService.getBoolPref('hides_on_minimize'))
      firetray.Handler.windows[xid].chromeWin.restore();

    delete firetray.Handler.windows[xid].savedStates;
  },

  saveDesktop: function(xid) {
    if (!firetray.Utils.prefService.getBoolPref('remember_desktop'))
      return;

    let winDesktop = firetray.Window.getXWindowDesktop(x11.Window(xid));
    firetray.Handler.windows[xid].savedDesktop = winDesktop;
    log.debug("save: windowDesktop="+winDesktop);
  },

  restoreDesktop: function(xid) {
    if (!firetray.Utils.prefService.getBoolPref('remember_desktop'))
      return;

    let desktopDest = firetray.Handler.windows[xid].savedDesktop;
    if (desktopDest === null || "undefined" === typeof(desktopDest)) return;

    let dataSize = 1;
    let data = ctypes.long(dataSize);
    data[0] = desktopDest;
    this.xSendClientMessgeEvent(xid, x11.current.Atoms._NET_WM_DESKTOP, data, dataSize);

    log.debug("restored to desktop: "+desktopDest);
    delete firetray.Handler.windows[xid].savedDesktop;
  },

  setVisibility: function(xid, visibility) {
    log.debug("setVisibility="+visibility);
    let gtkWidget = ctypes.cast(firetray.Handler.gtkWindows.get(xid), gtk.GtkWidget.ptr);
    if (visibility)
      gtk.gtk_widget_show_all(gtkWidget);
    else
      gtk.gtk_widget_hide(gtkWidget);

    this.updateVisibility(xid, visibility);
  },

  updateVisibility: function(xid, visibility) {
    let win = firetray.Handler.windows[xid];
    if (win.visible === visibility)
      log.warn("window (xid="+xid+") was already visible="+win.visible);

    firetray.Handler.visibleWindowsCount = visibility ?
      firetray.Handler.visibleWindowsCount + 1 :
      firetray.Handler.visibleWindowsCount - 1 ;

    win.visible = visibility; // nsIBaseWin.visibility always true :-(
  },

  xSendClientMessgeEvent: function(xid, atom, data, dataSize) {
    let xev = new x11.XClientMessageEvent;
    xev.type = x11.ClientMessage;
    xev.window = x11.Window(xid);
    xev.message_type = atom;
    xev.format = 32;
    for (let i=0; i<dataSize; ++i)
      xev.data[i] = data[i];

    let rootWin = x11.XDefaultRootWindow(x11.current.Display);
    let propagate = false;
    let mask = ctypes.long(x11.SubstructureNotifyMask|x11.SubstructureRedirectMask);
    // fortunately, it's OK not to cast xev. ctypes.cast to a void_t doesn't work (length pb)
    let status = x11.XSendEvent(x11.current.Display, rootWin, propagate, mask, xev.address());
    // always returns 1 (BadRequest as a coincidence)
  },

  /**
   * raises window on top and give focus.
   */
  activate: function(xid) {
    gtk.gtk_window_present(firetray.Handler.gtkWindows.get(xid));
    log.debug("window raised");
  },

  /**
   * YOU MUST x11.XFree() THE VARIABLE RETURNED BY THIS FUNCTION
   * @param xwin: a x11.Window
   * @param prop: a x11.Atom
   */
  getXWindowProperties: function(xwin, prop) {
    // infos returned by XGetWindowProperty() - FIXME: should be freed ?
    let actual_type = new x11.Atom;
    let actual_format = new ctypes.int;
    let nitems = new ctypes.unsigned_long;
    let bytes_after = new ctypes.unsigned_long;
    let prop_value = new ctypes.unsigned_char.ptr;

    let bufSize = XATOMS_EWMH_WM_STATES.length*ctypes.unsigned_long.size;
    let offset = 0;
    let res = x11.XGetWindowProperty(
      x11.current.Display, xwin, prop, offset, bufSize, 0, x11.AnyPropertyType,
      actual_type.address(), actual_format.address(), nitems.address(),
      bytes_after.address(), prop_value.address());
    log.debug("XGetWindowProperty res="+res+", actual_type="+actual_type.value+", actual_format="+actual_format.value+", bytes_after="+bytes_after.value+", nitems="+nitems.value);

    if (!firetray.js.strEquals(res, x11.Success)) {
      log.error("XGetWindowProperty failed");
      return [null, null];
    }
    if (firetray.js.strEquals(actual_type.value, x11.None)) {
      log.debug("property not found");
      return [null, null];
    }

    log.debug("prop_value="+prop_value+", size="+prop_value.constructor.size);
    /* If the returned format is 32, the property data will be stored as an
     array of longs (which in a 64-bit application will be 64-bit values
     that are padded in the upper 4 bytes). [man XGetWindowProperty] */
    if (actual_format.value !== 32) {
      log.error("unsupported format: "+actual_format.value);
    }
    log.debug("format OK");
    var props = ctypes.cast(prop_value, ctypes.unsigned_long.array(nitems.value).ptr);
    log.debug("props="+props+", size="+props.constructor.size);

    return [props, nitems];
  },

  /**
   * check the state of a window by its EWMH window state. This is more
   * accurate than the chromeWin.windowState or the GdkWindowState which are
   * based on WM_STATE. For instance, WM_STATE becomes 'Iconic' on virtual
   * desktop change...
   */
  getXWindowStates: function(xwin) {
    let winStates = 0;

    let [propsFound, nitems] =
      firetray.Window.getXWindowProperties(xwin, x11.current.Atoms._NET_WM_STATE);
    log.debug("propsFound, nitems="+propsFound+", "+nitems);
    if (!propsFound) return 0;

    let maximizedHorz = maximizedVert = false;
    for (let i=0, len=nitems.value; i<len; ++i) {
      log.debug("i: "+propsFound.contents[i]);
      let currentProp = propsFound.contents[i];
      if (firetray.js.strEquals(currentProp, x11.current.Atoms['_NET_WM_STATE_HIDDEN']))
        winStates |= FIRETRAY_XWINDOW_HIDDEN;
      else if (firetray.js.strEquals(currentProp, x11.current.Atoms['_NET_WM_STATE_MAXIMIZED_HORZ']))
        maximizedHorz = true;
      else if (firetray.js.strEquals(currentProp, x11.current.Atoms['_NET_WM_STATE_MAXIMIZED_VERT']))
        maximizedVert = true;
    }

    if (maximizedHorz && maximizedVert)
      winStates |= FIRETRAY_XWINDOW_MAXIMIZED;

    x11.XFree(propsFound);

    return winStates;
  },

  getXWindowDesktop: function(xwin) {
    let desktop = null;

    let [propsFound, nitems] =
      firetray.Window.getXWindowProperties(xwin, x11.current.Atoms._NET_WM_DESKTOP);
    log.debug("DESKTOP propsFound, nitems="+propsFound+", "+nitems);
    if (!propsFound) return null;

    if (firetray.js.strEquals(nitems.value, 0))
      log.warn("desktop number not found");
    else if (firetray.js.strEquals(nitems.value, 1))
      desktop = propsFound.contents[0];
    else
      throw new RangeError("more than one desktop found");

    x11.XFree(propsFound);

    return desktop;
  },

  getWindowTitle: function(xid) {
    let title = firetray.Handler.windows[xid].baseWin.title;
    log.debug("|baseWin.title="+title+"|");
    let tailIndex;
    if (firetray.Handler.appId === FIRETRAY_SEAMONKEY_ID)
      tailIndex = title.indexOf(" - "+firetray.Handler.appName);
    else
      tailIndex = title.indexOf(" - Mozilla "+firetray.Handler.appName);
    if (tailIndex !== -1)
      return title.substring(0, tailIndex);
    else if (title === "Mozilla "+firetray.Handler.appName)
      return title;
    else
      return null;
  },

  checkSubscribedEventMasks: function(xid) {
    let xWindowAttributes = new x11.XWindowAttributes;
    let status = x11.XGetWindowAttributes(x11.current.Display, xid, xWindowAttributes.address());
    log.debug("xWindowAttributes: "+xWindowAttributes);
    let xEventMask = xWindowAttributes.your_event_mask;
    let xEventMaskNeeded = x11.VisibilityChangeMask|x11.StructureNotifyMask|
      x11.FocusChangeMask|x11.PropertyChangeMask;
    log.debug("xEventMask="+xEventMask+" xEventMaskNeeded="+xEventMaskNeeded);
    if ((xEventMask & xEventMaskNeeded) !== xEventMaskNeeded) {
      log.error("missing mandatory event-masks"); // change with gdk_window_set_events()
    }
  },

  filterWindow: function(xev, gdkEv, data) {
    if (!xev)
      return gdk.GDK_FILTER_CONTINUE;

    let xany = ctypes.cast(xev, x11.XAnyEvent.ptr);
    let xid = xany.contents.window;

    switch (xany.contents.type) {

    case x11.MapNotify:
      log.debug("MapNotify");
      let win = firetray.Handler.windows[xid];
      if (!win.visible) { // happens when hidden app called from command line
        log.warn("window not visible, correcting visibility");
        firetray.Window.updateVisibility(xid, true);
        log.debug("visibleWindowsCount="+firetray.Handler.visibleWindowsCount);
      }
      break;

    case x11.UnmapNotify:       // for catching 'iconify'
      let gdkWinState = gdk.gdk_window_get_state(firetray.Handler.gdkWindows.get(xid));
      log.debug("gdkWinState="+gdkWinState+" for xid="+xid);
      // NOTE: Gecko 8.0 provides the 'sizemodechange' event
      if (gdkWinState === gdk.GDK_WINDOW_STATE_ICONIFIED) {
        log.debug("GOT ICONIFIED");
        let hides_on_minimize = firetray.Utils.prefService.getBoolPref('hides_on_minimize');
        let hides_single_window = firetray.Utils.prefService.getBoolPref('hides_single_window');
        if (hides_on_minimize) {
          if (hides_single_window)
            firetray.Handler.hideWindow(xid);
          else
            firetray.Handler.hideAllWindows();
        }
      }
      break;

      // default:
      //   log.debug("xany.type="+xany.contents.type);
      //   break;
    }

    return gdk.GDK_FILTER_CONTINUE;
  }

}; // firetray.Window


///////////////////////// firetray.Handler overriding /////////////////////////

/** debug facility */
firetray.Handler.dumpWindows = function() {
  log.debug(firetray.Handler.windowsCount);
  for (let winId in firetray.Handler.windows) log.info(winId+"="+firetray.Handler.gtkWindows.get(winId));
};

firetray.Handler.getWindowIdFromChromeWindow = firetray.Window.getXIDFromChromeWindow;

firetray.Handler.registerWindow = function(win) {
  log.debug("register window");

  // register
  let [baseWin, gtkWin, gdkWin, xid] = firetray.Window.getWindowsFromChromeWindow(win);
  this.windows[xid] = {};
  this.windows[xid].chromeWin = win;
  this.windows[xid].baseWin = baseWin;
  firetray.Window.checkSubscribedEventMasks(xid);
  try {
    this.gtkWindows.insert(xid, gtkWin);
    this.gdkWindows.insert(xid, gdkWin);
    firetray.PopupMenu.addWindowItem(xid);
  } catch (x) {
    if (x.name === "RangeError") // instanceof not working :-(
      win.alert(x+"\n\nYou seem to have more than "+FIRETRAY_WINDOW_COUNT_MAX
                +" windows open. This breaks FireTray and most probably "
                +firetray.Handler.appName+".");
  }
  this.windowsCount += 1;
  // NOTE: no need to check for window state to set visibility because all
  // windows *are* shown at startup
  firetray.Window.updateVisibility(xid, true);
  log.debug("window "+xid+" registered");
  // NOTE: shouldn't be necessary to gtk_widget_add_events(gtkWin, gdk.GDK_ALL_EVENTS_MASK);

  try {
     // NOTE: we could try to catch the "delete-event" here and block
     // delete_event_cb (in gtk2/nsWindow.cpp), but we prefer to use the
     // provided 'close' JS event

    this.windows[xid].filterWindowCb = gdk.GdkFilterFunc_t(firetray.Window.filterWindow);
    gdk.gdk_window_add_filter(gdkWin, this.windows[xid].filterWindowCb, null);

    if (firetray.Handler.isChatEnabled() && firetray.Chat.initialized) { // missing import ok
      Cu.import("resource://firetray/linux/FiretrayChatStatusIcon.jsm");
      firetray.ChatStatusIcon.attachOnFocusInCallback(xid);
    }

  } catch (x) {
    firetray.Window.unregisterWindowByXID(xid);
    log.error(x);
    return null;
  }

  log.debug("AFTER"); firetray.Handler.dumpWindows();
  return xid;
};

firetray.Handler.unregisterWindow = function(win) {
  log.debug("unregister window");
  let xid = firetray.Window.getXIDFromChromeWindow(win);
  return firetray.Window.unregisterWindowByXID(xid);
};

firetray.Handler.showWindow = firetray.Window.show;
firetray.Handler.hideWindow = firetray.Window.hide;
firetray.Handler.startupHideWindow = firetray.Window.startupHide;

firetray.Handler.showHideAllWindows = function(gtkStatusIcon, userData) {
  log.debug("showHideAllWindows: "+userData);
  // NOTE: showHideAllWindows being a callback, we need to use
  // 'firetray.Handler' explicitely instead of 'this'

  log.debug("visibleWindowsCount="+firetray.Handler.visibleWindowsCount);
  log.debug("windowsCount="+firetray.Handler.windowsCount);
  let visibilityRate = firetray.Handler.visibleWindowsCount/firetray.Handler.windowsCount;
  log.debug("visibilityRate="+visibilityRate);
  if ((0.5 < visibilityRate) && (visibilityRate < 1)
      || visibilityRate === 0) { // TODO: should be configurable
    firetray.Handler.showAllWindows();
  } else {
    firetray.Handler.hideAllWindows();
  }

  let stopPropagation = true;
  return stopPropagation;
};

firetray.Handler.activateLastWindow = function(gtkStatusIcon, gdkEvent, userData) {
  log.debug("activateLastWindow");

  let gdkEventButton = ctypes.cast(gdkEvent, gdk.GdkEventButton.ptr);
  if (gdkEventButton.contents.button === 2 && gdkEventButton.contents.type === gdk.GDK_BUTTON_PRESS) {
    log.debug("MIDDLE CLICK");

    let visibilityRate = firetray.Handler.visibleWindowsCount/firetray.Handler.windowsCount;
    log.debug("visibilityRate="+visibilityRate);
    if (visibilityRate < 1)
      firetray.Handler.showAllWindows();

    for(var key in firetray.Handler.windows);
    firetray.Window.activate(key);
  }

  let stopPropagation = false;
  return stopPropagation;
};

/* gtk_window_is_active() not reliable */
firetray.Handler.findActiveWindow = function() {
  let rootWin = x11.XDefaultRootWindow(x11.current.Display);
  let [propsFound, nitems] =
    firetray.Window.getXWindowProperties(rootWin, x11.current.Atoms._NET_ACTIVE_WINDOW);

  log.debug("ACTIVE_WINDOW propsFound, nitems="+propsFound+", "+nitems);
  if (!propsFound) return null;

  let activeWin = null;
  if (firetray.js.strEquals(nitems.value, 0))
    log.warn("active window not found");
  else if (firetray.js.strEquals(nitems.value, 1))
    activeWin = propsFound.contents[0];
  else
    throw new RangeError("more than one active window found");

  x11.XFree(propsFound);

  log.debug("ACTIVE_WINDOW="+activeWin);
  return activeWin;
};


/**
 * init X11 Display and handled XAtoms.
 * Needs to be defined and called outside x11.jsm because: 1. gdk already
 * imports x11, 2. there is no means to get the default Display solely with
 * Xlib without opening one... :-(
 */
x11.init = function() {
  if (!firetray.js.isEmpty(this.current))
    return true; // init only once

  this.current = {};
  try {
    let gdkDisplay = gdk.gdk_display_get_default();
    this.current.Display = gdk.gdk_x11_display_get_xdisplay(gdkDisplay);
    this.current.Atoms = {};
    XATOMS.forEach(function(atomName, index, array) {
      this.current.Atoms[atomName] = x11.XInternAtom(this.current.Display, atomName, 0);
      log.debug("x11.current.Atoms."+atomName+"="+this.current.Atoms[atomName]);
    }, this);
    return true;
  } catch (x) {
    log.error(x);
    return false;
  }
};
x11.init();
