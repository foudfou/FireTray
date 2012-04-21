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

if ("undefined" == typeof(firetray.Handler))
  F.ERROR("This module MUST be imported from/after FiretrayHandler !");

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
    firetray.Utils.tryCloseLibs([gobject, gdk, gtk, libc, x11]);
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
  getGtkWindowHandle: function(window) {
    let baseWindow = window
          .QueryInterface(Ci.nsIInterfaceRequestor)
          .getInterface(Ci.nsIWebNavigation)
          .QueryInterface(Ci.nsIBaseWindow);

    // Tag the base window
    let oldTitle = baseWindow.title;
    F.LOG("oldTitle="+oldTitle);
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
      F.LOG("userData="+userData);
      gobject.g_list_foreach(widgets, findGtkWindowByTitleCb, userData);
      gobject.g_list_free(widgets);

      if (userData.contents.outWindow.isNull()) {
        throw new Error("Window not found!");
      }
      F.LOG("found window: "+userData.contents.outWindow);
    } catch (x) {
      F.ERROR(x);
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
      F.LOG(inTitle+" = "+winTitle);
      if (libc.strcmp(inTitle, winTitle) == 0)
        data.contents.outWindow = gtkWin;
    }
  },

  getGdkWindowFromGtkWindow: function(gtkWin) {
    try {
      let gtkWid = ctypes.cast(gtkWin, gtk.GtkWidget.ptr);
      return gtk.gtk_widget_get_window(gtkWid);
    } catch (x) {
      F.ERROR(x);
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
      F.ERROR(x);
    }
    return null;
  },

  /** consider using getXIDFromChromeWindow() if you only need the XID */
  getWindowsFromChromeWindow: function(win) {
    let gtkWin = firetray.Window.getGtkWindowHandle(win);
    let gdkWin = firetray.Window.getGdkWindowFromGtkWindow(gtkWin);
    let xid = firetray.Window.getXIDFromGdkWindow(gdkWin);
    F.LOG("XID="+xid);
    return [gtkWin, gdkWin, xid];
  },

  getXIDFromChromeWindow: function(win) {
    for (let xid in firetray.Handler.windows)
      if (firetray.Handler.windows[xid].chromeWin === win)
        return xid;
    F.ERROR("unknown window while lookup");
    return null;
  },

  unregisterWindowByXID: function(xid) {
    firetray.Handler.windowsCount -= 1;
    if (firetray.Handler.windows[xid].visible) firetray.Handler.visibleWindowsCount -= 1;
    if (firetray.Handler.windows.hasOwnProperty(xid)) {
      if (!delete firetray.Handler.windows[xid])
        throw new DeleteError();
      firetray.Handler.gtkWindows.remove(xid);
      firetray.Handler.gdkWindows.remove(xid);
      firetray.PopupMenu.removeWindowItem(xid);
    } else {
      F.ERROR("can't unregister unknown window "+xid);
      return false;
    }
    F.LOG("window "+xid+" unregistered");
    return true;
  },

  showSingleStateful: function(xid) {
    F.LOG("showSingleStateful xid="+xid);

    // try to restore previous state. TODO: z-order respected ?
    firetray.Window.restorePositionAndSize(xid);
    firetray.Window.restoreStates(xid);

    // better visual effect if visibility set here instead of before
    firetray.Window.setVisibility(xid, true);

    // after show
    firetray.Window.restoreDesktop(xid);
    firetray.Window.activate(xid);

    firetray.PopupMenu.hideSingleWindowItemAndSeparatorMaybe(xid);
    firetray.Handler.showHideIcon();
  },
  showSingleStatelessOnce: function(xid) {
    F.LOG("showSingleStateless");

    firetray.Window.setVisibility(xid, true);

    firetray.PopupMenu.hideSingleWindowItemAndSeparatorMaybe(xid);
    firetray.Handler.showHideIcon();

    firetray.Handler.windows[xid].show = firetray.Window.showSingleStateful; // reset
  },

  // NOTE: we keep using high-level cross-plat BaseWindow.visibility (instead of
  // gdk_window_show_unraised)
  /* FIXME: hiding windows should also hide child windows */
  hideSingleStateful: function(xid) {
    F.LOG("hideSingleStateful");

    firetray.Window.savePositionAndSize(xid);
    firetray.Window.saveStates(xid);
    firetray.Window.saveDesktop(xid);

    firetray.Window.setVisibility(xid, false);

    firetray.PopupMenu.showSingleWindowItem(xid);
    firetray.Handler.showHideIcon();
  },
  /**
   * hides without saving window states (position, size, ...) This is needed
   * when application starts hidden: as windows are not realized, their state
   * is not accurate.
   */
  hideSingleStatelessOnce: function(xid) {
    F.LOG("hideSingleStateless");

    firetray.Window.setVisibility(xid, false);

    firetray.PopupMenu.showSingleWindowItem(xid);
    firetray.Handler.showHideIcon();

    firetray.Handler.windows[xid].hide = firetray.Window.hideSingleStateful; // reset
  },

  savePositionAndSize: function(xid) {
    let gx = {}, gy = {}, gwidth = {}, gheight = {};
    firetray.Handler.windows[xid].baseWin.getPositionAndSize(gx, gy, gwidth, gheight);
    firetray.Handler.windows[xid].savedX = gx.value;
    firetray.Handler.windows[xid].savedY = gy.value;
    firetray.Handler.windows[xid].savedWidth = gwidth.value;
    firetray.Handler.windows[xid].savedHeight = gheight.value;
    F.LOG("save: gx="+gx.value+", gy="+gy.value+", gwidth="+gwidth.value+", gheight="+gheight.value);
  },

  restorePositionAndSize: function(xid) {
    if ("undefined" === typeof(firetray.Handler.windows[xid].savedX))
      return; // windows[xid].saved* may not be initialized

    F.LOG("restore: x="+firetray.Handler.windows[xid].savedX+", y="+firetray.Handler.windows[xid].savedY+", w="+firetray.Handler.windows[xid].savedWidth+", h="+firetray.Handler.windows[xid].savedHeight);
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
    F.LOG("save: windowStates="+winStates);
  },

  restoreStates: function(xid) {
    let winStates = firetray.Handler.windows[xid].savedStates;
    F.LOG("restored WindowStates: " + winStates);
    if (winStates & FIRETRAY_XWINDOW_MAXIMIZED) {
      firetray.Handler.windows[xid].chromeWin.maximize();
      F.LOG("restored maximized");
    }
    let hides_on_minimize = firetray.Utils.prefService.getBoolPref('hides_on_minimize');
    if (!hides_on_minimize && (winStates & FIRETRAY_XWINDOW_HIDDEN)) {
      firetray.Handler.windows[xid].chromeWin.minimize();
      F.LOG("restored minimized");
    }

    delete firetray.Handler.windows[xid].savedStates;
  },

  saveDesktop: function(xid) {
    if (!firetray.Utils.prefService.getBoolPref('remember_desktop'))
      return;

    let winDesktop = firetray.Window.getXWindowDesktop(x11.Window(xid));
    firetray.Handler.windows[xid].savedDesktop = winDesktop;
    F.LOG("save: windowDesktop="+winDesktop);
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

    F.LOG("restored to desktop: "+desktopDest);
    delete firetray.Handler.windows[xid].savedDesktop;
  },

  setVisibility: function(xid, visibility) {
    firetray.Handler.windows[xid].baseWin.visibility = visibility;
    firetray.Handler.windows[xid].visible = visibility;
    firetray.Handler.visibleWindowsCount = visibility ?
      firetray.Handler.visibleWindowsCount + 1 :
      firetray.Handler.visibleWindowsCount - 1 ;
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
    if (!firetray.Utils.prefService.getBoolPref('show_activates'))
      return;
    gtk.gtk_window_present(firetray.Handler.gtkWindows.get(xid));
    F.LOG("window raised");
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
    F.LOG("XGetWindowProperty res="+res+", actual_type="+actual_type.value+", actual_format="+actual_format.value+", bytes_after="+bytes_after.value+", nitems="+nitems.value);

    if (!firetray.js.strEquals(res, x11.Success)) {
      F.ERROR("XGetWindowProperty failed");
      return [null, null];
    }
    if (firetray.js.strEquals(actual_type.value, x11.None)) {
      F.LOG("property not found");
      return [null, null];
    }

    F.LOG("prop_value="+prop_value+", size="+prop_value.constructor.size);
    /* If the returned format is 32, the property data will be stored as an
     array of longs (which in a 64-bit application will be 64-bit values
     that are padded in the upper 4 bytes). [man XGetWindowProperty] */
    if (actual_format.value !== 32) {
      F.ERROR("unsupported format: "+actual_format.value);
    }
    F.LOG("format OK");
    var props = ctypes.cast(prop_value, ctypes.unsigned_long.array(nitems.value).ptr);
    F.LOG("props="+props+", size="+props.constructor.size);

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
    F.LOG("propsFound, nitems="+propsFound+", "+nitems);
    if (!propsFound) return 0;

    let maximizedHorz = maximizedVert = false;
    for (let i=0, len=nitems.value; i<len; ++i) {
      F.LOG("i: "+propsFound.contents[i]);
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
    F.LOG("DESKTOP propsFound, nitems="+propsFound+", "+nitems);
    if (!propsFound) return null;

    if (firetray.js.strEquals(nitems.value, 0))
      F.WARN("desktop number not found");
    else if (firetray.js.strEquals(nitems.value, 1))
      desktop = propsFound.contents[0];
    else
      throw new RangeError("more than one desktop found");

    x11.XFree(propsFound);

    return desktop;
  },

  getWindowTitle: function(xid) {
    let title = firetray.Handler.windows[xid].baseWin.title;
    F.LOG("baseWin.title="+title);
    let tailIndex = title.indexOf(" - Mozilla "+firetray.Handler.appName);
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
    F.LOG("xWindowAttributes: "+xWindowAttributes);
    let xEventMask = xWindowAttributes.your_event_mask;
    let xEventMaskNeeded = x11.VisibilityChangeMask|x11.StructureNotifyMask|x11.PropertyChangeMask;
    F.LOG("xEventMask="+xEventMask+" xEventMaskNeeded="+xEventMaskNeeded);
    if ((xEventMask & xEventMaskNeeded) !== xEventMaskNeeded) {
      F.WARN("missing mandatory event-masks");
      // could try to subscribe here with XChangeWindowAttributes()
    }
  },

  filterWindow: function(xev, gdkEv, data) {
    if (!xev)
      return gdk.GDK_FILTER_CONTINUE;

    try {
      let xany = ctypes.cast(xev, x11.XAnyEvent.ptr);
      let xwin = xany.contents.window;

      let winStates, isHidden;
      switch (xany.contents.type) {

      case x11.UnmapNotify:
        F.LOG("UnmapNotify");
        if (firetray.Handler.windows[xwin].visible) {
          winStates = firetray.Window.getXWindowStates(xwin);
          isHidden = winStates & FIRETRAY_XWINDOW_HIDDEN;
        }
        break;

      case x11.PropertyNotify:
        let xprop = ctypes.cast(xev, x11.XPropertyEvent.ptr);
        if (firetray.Handler.windows[xwin].visible &&
            firetray.js.strEquals(xprop.contents.atom, x11.current.Atoms.WM_STATE) &&
            firetray.js.strEquals(xprop.contents.state, x11.PropertyNewValue)) {
          F.LOG("PropertyNotify: WM_STATE, send_event: "+xprop.contents.send_event+", state: "+xprop.contents.state);
          winStates = firetray.Window.getXWindowStates(xwin);
          isHidden = winStates & FIRETRAY_XWINDOW_HIDDEN;
        }
        break;

      // default:
      //   F.LOG("xany.type="+xany.contents.type);
      //   break;
      }

      if (isHidden) { // minimized
        F.LOG("winStates="+winStates+", isHidden="+isHidden);
        let hides_on_minimize = firetray.Utils.prefService.getBoolPref('hides_on_minimize');
        let hides_single_window = firetray.Utils.prefService.getBoolPref('hides_single_window');
        if (hides_on_minimize) {
          if (hides_single_window) {
            firetray.Handler.hideSingleWindow(xwin);
          } else
          firetray.Handler.hideAllWindows();
        }
      }

    } catch(x) {
      F.ERROR(x);
    }

    return gdk.GDK_FILTER_CONTINUE;
  }

}; // firetray.Window


///////////////////////// firetray.Handler overriding /////////////////////////

/** debug facility */
firetray.Handler.dumpWindows = function() {
  F.LOG(firetray.Handler.windowsCount);
  for (let winId in firetray.Handler.windows) F.LOG(winId+"="+firetray.Handler.gtkWindows.get(winId));
};

firetray.Handler.getWindowIdFromChromeWindow = firetray.Window.getXIDFromChromeWindow;

firetray.Handler.registerWindow = function(win) {
  F.LOG("register window");

  // register
  let [gtkWin, gdkWin, xid] = firetray.Window.getWindowsFromChromeWindow(win);
  firetray.Window.checkSubscribedEventMasks(xid);
  this.windows[xid] = {};
  this.windows[xid].chromeWin = win;
  this.windows[xid].baseWin = firetray.Handler.getWindowInterface(win, "nsIBaseWindow");
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
  this.windows[xid].visible = true; // this.windows[xid].baseWin.visibility always true :-(
  this.visibleWindowsCount += 1;
  F.LOG("window "+xid+" registered");
  // NOTE: shouldn't be necessary to gtk_widget_add_events(gtkWin, gdk.GDK_ALL_EVENTS_MASK);

  try {
     // NOTE: we could try to catch the "delete-event" here and block
     // delete_event_cb (in gtk2/nsWindow.cpp), but we prefer to use the
     // provided 'close' JS event

    this.windows[xid].filterWindowCb = gdk.GdkFilterFunc_t(firetray.Window.filterWindow);
    gdk.gdk_window_add_filter(gdkWin, this.windows[xid].filterWindowCb, null);

  } catch (x) {
    firetray.Window.unregisterWindowByXID(xid);
    F.ERROR(x);
    return null;
  }

  if (!firetray.Handler.appStarted &&
      firetray.Utils.prefService.getBoolPref('start_hidden')) {
    this.windows[xid].startHidden = true;
    this.windows[xid].hide = firetray.Window.hideSingleStatelessOnce;
    this.windows[xid].show = firetray.Window.showSingleStatelessOnce;
  } else {
    this.windows[xid].startHidden = false;
    this.windows[xid].hide = firetray.Window.hideSingleStateful;
    this.windows[xid].show = firetray.Window.showSingleStateful;
  }

  F.LOG("AFTER"); firetray.Handler.dumpWindows();
  return xid;
};

firetray.Handler.unregisterWindow = function(win) {
  F.LOG("unregister window");
  let xid = firetray.Window.getXIDFromChromeWindow(win);
  return firetray.Window.unregisterWindowByXID(xid);
};

firetray.Handler.showSingleWindow = function(xid) {
  F.LOG("showSingleWindow xid="+xid);
  this.windows[xid].show(xid);
};

firetray.Handler.hideSingleWindow = function(xid) {
  F.LOG("hideSingleWindow xid="+xid);
  this.windows[xid].hide(xid);
};

firetray.Handler.showHideAllWindows = function(gtkStatusIcon, userData) {
  F.LOG("showHideAllWindows: "+userData);
  // NOTE: showHideAllWindows being a callback, we need to use
  // 'firetray.Handler' explicitely instead of 'this'

  F.LOG("visibleWindowsCount="+firetray.Handler.visibleWindowsCount);
  F.LOG("windowsCount="+firetray.Handler.windowsCount);
  let visibilityRate = firetray.Handler.visibleWindowsCount/firetray.Handler.windowsCount;
  F.LOG("visibilityRate="+visibilityRate);
  if ((0.5 < visibilityRate) && (visibilityRate < 1)
      || visibilityRate === 0) // TODO: should be configurable
    firetray.Handler.showAllWindows();
  else
    firetray.Handler.hideAllWindows();

  let stopPropagation = true;
  return stopPropagation;
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
      F.LOG("x11.current.Atoms."+atomName+"="+this.current.Atoms[atomName]);
    }, this);
    return true;
  } catch (x) {
    F.ERROR(x);
    return false;
  }
};
x11.init();
