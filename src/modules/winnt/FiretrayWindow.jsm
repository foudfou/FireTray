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
Cu.import("resource://firetray/ctypes/winnt/types.jsm");
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

  // TESTING
  let baseWin = firetray.Handler.getWindowInterface(win, "nsIBaseWindow");
  let nativeHandle = baseWin.nativeHandle; // Moz' private pointer to the GdkWindow
  log.info("nativeHandle="+nativeHandle);

  log.info("size="+ctypes.size_t.size);
  log.info("psize="+ctypes.voidptr_t.size);
  log.info("osvi size="+kernel32.OSVERSIONINFOEXW.size);

  let osvi = new kernel32.OSVERSIONINFOEXW();
  osvi.dwOSVersionInfoSize = kernel32.OSVERSIONINFOEXW.size;
  if (kernel32.GetVersionExW(osvi.address())) {
    log.debug("osvi.dwMajorVersion="+osvi.dwMajorVersion);
    log.debug("osvi.dwMinorVersion="+osvi.dwMinorVersion);
  }

  /*
   * Windows 8	6.2
   * Windows 7	6.1
   * Windows Vista	6.0
   * Windows XP	5.1
   */
  let version = osvi.dwMajorVersion*10 + osvi.dwMinorVersion; // if (version >= 51)

  let nid = new shell32.NOTIFYICONDATAW();
  nid.cbSize = shell32.NOTIFYICONDATAW.size;

  let hwnd = user32.FindWindowW("MozillaWindowClass", win.document.title);
  log.debug("hwnd FindWindow="+hwnd);

/*
  let hwnd = new ctypes.voidptr_t(ctypes.UInt64(nativeHandle));
  log.debug("hwnd nativeHandle="+hwnd);
*/

  const BUF_SIZE = 255;
  let buffer_t = ctypes.jschar.array(BUF_SIZE); // LPTSTR

  let title = new buffer_t();
  let len = user32.GetWindowTextW(hwnd, title, BUF_SIZE);
  log.error("errno="+ctypes.errno+" winLastError="+ctypes.winLastError);
  if (len) {
    log.info("title="+title.readString());
  }

/*
  let consoleWin = kernel32.GetConsoleWindow();
  log.error("errno="+ctypes.errno+" winLastError="+ctypes.winLastError);
  log.info("consoleWin="+consoleWin);
  len = user32.GetWindowTextW(consoleWin, title, 127);
  log.error("errno="+ctypes.errno+" winLastError="+ctypes.winLastError);
  log.debug("len="+len);
  log.info("title="+title.readString());

  len = kernel32.GetConsoleTitleW(title, win_t.DWORD(127));
  log.error("errno="+ctypes.errno+" winLastError="+ctypes.winLastError);
  log.debug("len="+len);
  log.debug("len type="+typeof(len)); // "object" ???
  if (len) {
    log.info("consoleTitle="+title.readString());
  }
*/

  let result = user32.SendMessageW(hwnd, user32.WM_GETICON, user32.ICON_SMALL, 0);
  // result is a ctypes.Int64. So we need to create a CData from it before
  // casting it.
  let icon = ctypes.cast(win_t.LRESULT(result), win_t.HICON);
  let NULL = win_t.HICON(null);
  log.debug("SendMessageW winLastError="+ctypes.winLastError);
  if (firetray.js.strEquals(icon, NULL)) { // OS default icon
    result = user32.GetClassLong(hwnd, user32.GCLP_HICONSM);
    icon = ctypes.cast(win_t.ULONG_PTR(result), win_t.HICON);
    log.debug("GetClassLong winLastError="+ctypes.winLastError);
  }
  if (firetray.js.strEquals(icon, NULL)) { // from the first resource -> ERROR_RESOURCE_TYPE_NOT_FOUND(1813)
    icon = user32.LoadIconW(kernel32.GetModuleHandleW(null),
                              win_t.MAKEINTRESOURCE(0));
    log.debug("LoadIconW module winLastError="+ctypes.winLastError);
  }
  if (firetray.js.strEquals(icon, NULL)) { // OS default icon
    icon = user32.LoadIconW(null, win_t.MAKEINTRESOURCE(user32.IDI_APPLICATION));
    log.debug("LoadIconW default winLastError="+ctypes.winLastError);
  }
  log.debug("icon="+icon);

// BOOL mintrayr_CreateIcon(void *handle, mouseevent_callback_t callback)
// {
//   HWND hwnd = (HWND)handle;
//   if (!hwnd) {
//     return FALSE;
//   }

//   SetupWnd(hwnd);

//   NOTIFYICONDATAW *iconData = new(std::nothrow) NOTIFYICONDATAW;
//   if (!iconData) {
//     return FALSE;
//   }
//   // Init the icon data according to MSDN
//   iconData->cbSize = sizeof(NOTIFYICONDATAW);

//   // Copy the title
//   if (GetWindowText(hwnd, iconData->szTip, 127)) {
//     iconData->szTip[127] = '\0'; // Better be safe than sorry :p
//   }
//   else{
//     iconData->szTip[0] = '\0';
//   }

//   // Get the window icon
//   HICON icon = reinterpret_cast<HICON>(::SendMessageW(hwnd, WM_GETICON, ICON_SMALL, 0));
//   if (icon == 0) {
//     // Alternative method. Get from the window class
//     icon = reinterpret_cast<HICON>(::GetClassLongPtrW(hwnd, GCLP_HICONSM));
//   }
//   // Alternative method: get the first icon from the main module (executable image of the process)
//   if (icon == 0) {
//     icon = ::LoadIcon(GetModuleHandleW(0), MAKEINTRESOURCE(0));
//   }
//   // Alternative method. Use OS default icon
//   if (icon == 0) {
//     icon = ::LoadIcon(0, IDI_APPLICATION);
//   }
//   iconData->hIcon = icon;

//   // Set the rest of the members
//   iconData->hWnd = hwnd;
//   iconData->uCallbackMessage = WM_TRAYMESSAGE;
//   iconData->uFlags = NIF_ICON | NIF_MESSAGE | NIF_TIP;
//   iconData->uVersion = 5;

//   // Install the icon
//   ::Shell_NotifyIconW(NIM_ADD, iconData);
//   ::Shell_NotifyIconW(NIM_SETVERSION, iconData);

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
