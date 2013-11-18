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
Cu.import("resource://firetray/ctypes/winnt/win32.jsm");
Cu.import("resource://firetray/ctypes/winnt/kernel32.jsm");
Cu.import("resource://firetray/ctypes/winnt/shell32.jsm");
Cu.import("resource://firetray/ctypes/winnt/user32.jsm");
Cu.import("resource://firetray/commons.js");
firetray.Handler.subscribeLibsForClosing([kernel32, shell32, user32]);

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

// // NOTE: storing ctypes pointers into a JS object doesn't work: pointers are
// // "evolving" after a while (maybe due to back and forth conversion). So we
// // need to store them into a real ctypes array !
// firetray.Handler.gtkWindows              = new ctypesMap(gtk.GtkWindow.ptr),


firetray.Window = {
  signals: {'focus-in': {callback: {}, handler: {}}},

  init: function() {
    this.initialized = true;
  },

  shutdown: function() {
    this.initialized = false;
  },

  show: function(xid) {
    log.debug("show xid="+xid);
  },

  hide: function(xid) {
    log.debug("hide");
  },

  startupHide: function(xid) {
    log.debug('startupHide: '+xid);
  },

  setVisibility: function(xid, visibility) {
  },

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

  let baseWin = firetray.Handler.getWindowInterface(win, "nsIBaseWindow");
  let nativeHandle = baseWin.nativeHandle;
  let hwnd = nativeHandle ?
        new ctypes.voidptr_t(ctypes.UInt64(nativeHandle)) :
        user32.FindWindowW("MozillaWindowClass", win.document.title);
  log.debug("=== hwnd="+hwnd);

  // Get TaskbarCreated
  const WM_TASKBARCREATED = user32.RegisterWindowMessageW("TaskbarCreated");
  // We register this as well, as we cannot know which WM_USER values are already taken
  const kTrayMessage  = "_MINTRAYR_TrayMessageW";
  const kTrayCallback = "_MINTRAYR_TrayCallbackW";
  const WM_TRAYMESSAGE  = user32.RegisterWindowMessageW(kTrayMessage);
  const WM_TRAYCALLBACK = user32.RegisterWindowMessageW(kTrayCallback);
  log.debug("WM_*="+WM_TASKBARCREATED+" "+WM_TRAYMESSAGE+" "+WM_TRAYCALLBACK);

  /* if Administrator, accept messages from applications running in a lower
   privilege level */
  let rv;
  if (win32.WINVER >= win32.WIN_VERSIONS["7"]) {
    rv = user32.ChangeWindowMessageFilterEx(hwnd, WM_TASKBARCREATED, user32.MSGFLT_ALLOW, null);
    log.debug("ChangeWindowMessageFilterEx res="+rv+" winLastError="+ctypes.winLastError);
  } else if (win32.WINVER >= win32.WINVER["Vista"]) {
    rv = user32.ChangeWindowMessageFilter(WM_TASKBARCREATED, user32.MSGFLT_ADD);
    log.debug("ChangeWindowMessageFilter res="+rv+" winLastError="+ctypes.winLastError);
  } else {
    log.error("Unsupported windoz version "+win32.WINVER);
  }

  let nid = new shell32.NOTIFYICONDATAW();

  if (win32.WINVER >= win32.WIN_VERSIONS["Vista"]) {
    nid.cbSize = shell32.NOTIFYICONDATAW.size;
  } else if (win32.WINVER >= win32.WIN_VERSIONS["XP"]) {
    nid.cbSize = shell32.NOTIFYICONDATAW_V3_SIZE;
  } else if (win32.WINVER >= win32.WIN_VERSIONS["2K"]) {
    nid.cbSize = shell32.NOTIFYICONDATAW_V2_SIZE;
  } else {
    nid.cbSize = shell32.NOTIFYICONDATAW_V1_SIZE;
  }
  log.debug("SIZE="+nid.cbSize);

  // string is truncate to size of buffer and null-terminated. nid.szTip is
  // initialized automatically by ctypes
  let nMaxCount = 127;
  let len = user32.GetWindowTextW(hwnd, nid.szTip, nMaxCount);
  log.error("errno="+ctypes.errno+" winLastError="+ctypes.winLastError);
  if (len != 0) {
    log.info("nid.szTip="+nid.szTip.readString());
  }

  rv = user32.SendMessageW(hwnd, user32.WM_GETICON, user32.ICON_SMALL, 0);
  // result is a ctypes.Int64. So we need to create a CData from it before
  // casting it to a HICON.
  let icon = ctypes.cast(win32.LRESULT(rv), win32.HICON);
  let NULL = win32.HICON(null); // for comparison only
  log.debug("SendMessageW winLastError="+ctypes.winLastError);
  if (firetray.js.strEquals(icon, NULL)) { // from the window class
    rv = user32.GetClassLong(hwnd, user32.GCLP_HICONSM);
    icon = ctypes.cast(win32.ULONG_PTR(rv), win32.HICON);
    log.debug("GetClassLong winLastError="+ctypes.winLastError);
  }
  if (firetray.js.strEquals(icon, NULL)) { // from the first resource -> ERROR_RESOURCE_TYPE_NOT_FOUND(1813)
    icon = user32.LoadIconW(kernel32.GetModuleHandleW(null),
                              win32.MAKEINTRESOURCE(0));
    log.debug("LoadIconW module winLastError="+ctypes.winLastError);
  }
  if (firetray.js.strEquals(icon, NULL)) { // OS default icon
    icon = user32.LoadIconW(null, win32.MAKEINTRESOURCE(user32.IDI_APPLICATION));
    log.debug("LoadIconW default winLastError="+ctypes.winLastError);
  }
  log.debug("=== icon="+icon);
  nid.hIcon = icon;

  nid.hwnd = hwnd;
  nid.uCallbackMessage = WM_TRAYMESSAGE;
  nid.uFlags = shell32.NIF_ICON | shell32.NIF_MESSAGE | shell32.NIF_TIP;
  nid.uVersion = shell32.NOTIFYICON_VERSION_4; // 5 ?! niels

  // Install the icon
  rv = shell32.Shell_NotifyIconW(shell32.NIM_ADD, nid.address());
  log.debug("Shell_NotifyIcon ADD="+rv+" winLastError="+ctypes.winLastError); // ERROR_INVALID_WINDOW_HANDLE(1400)
  shell32.Shell_NotifyIconW(shell32.NIM_SETVERSION, nid.address());
  log.debug("Shell_NotifyIcon SETVERSION="+rv+" winLastError="+ctypes.winLastError);

//   SetupWnd(hwnd);
//   ::SetPropW(hwnd, kIconData, reinterpret_cast<HANDLE>(iconData));
//   ::SetPropW(hwnd, kIconMouseEventProc, reinterpret_cast<HANDLE>(callback));
//   ::SetPropW(hwnd, kIcon, reinterpret_cast<HANDLE>(0x1));

  return;

  // register
  let [whndbaseWin, gtkWin, gdkWin, xid] = firetray.Window.getWindowsFromChromeWindow(win);
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
    if (!firetray.Handler.appStarted) {
      this.windows[xid].startupFilterCb = gdk.GdkFilterFunc_t(firetray.Window.startupFilter);
      gdk.gdk_window_add_filter(gdkWin, this.windows[xid].startupFilterCb, null);
    }

    firetray.Window.attachOnFocusInCallback(xid);
    if (firetray.Handler.isChatEnabled() && firetray.Chat.initialized) {
      firetray.Chat.attachSelectListeners(win);
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
