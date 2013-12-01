/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = [ "firetray" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://firetray/ctypes/ctypesMap.jsm");
Cu.import("resource://firetray/ctypes/winnt/win32.jsm");
Cu.import("resource://firetray/ctypes/winnt/user32.jsm");
Cu.import("resource://firetray/winnt/FiretrayWin32.jsm");
Cu.import("resource://firetray/FiretrayWindow.jsm");
Cu.import("resource://firetray/commons.js");
firetray.Handler.subscribeLibsForClosing([user32]);

let log = firetray.Logging.getLogger("firetray.Window");

if ("undefined" == typeof(firetray.Handler))
  log.error("This module MUST be imported from/after FiretrayHandler !");

const FIRETRAY_XWINDOW_HIDDEN    = 1 << 0; // when minimized also
const FIRETRAY_XWINDOW_MAXIMIZED = 1 << 1;

const kPropProcPrev = "_FIRETRAY_OLD_PROC";

// NOTE: storing ctypes pointers into a JS object doesn't work: pointers are
// "evolving" after a while (maybe due to back and forth conversion). So we
// need to store them into a real ctypes array !
firetray.Handler.wndProcs     = new ctypesMap(user32.WNDPROC);
firetray.Handler.wndProcsOrig = new ctypesMap(user32.WNDPROC);


firetray.Window = new FiretrayWindow();

firetray.Window.init = function() {
    this.initialized = true;
  };

firetray.Window.shutdown = function() {
  this.initialized = false;
};

firetray.Window.show = function(xid) {
  log.debug("show xid="+xid);
};

firetray.Window.hide = function(xid) {
  log.debug("hide");
};

firetray.Window.startupHide = function(xid) {
  log.debug('startupHide: '+xid);
};

firetray.Window.setVisibility = function(xid, visibility) {
};

// wid will be used as a string most of the time (through f.Handler.windows mainly)
firetray.Window.hwndToHexStr = function(hWnd) {
  return "0x" + ctypes.cast(hWnd, ctypes.uintptr_t).value.toString(16);
};

firetray.Window.wndProc = function(hWnd, uMsg, wParam, lParam) { // filterWindow
  log.debug("wndProc CALLED: hWnd="+hWnd+", uMsg="+uMsg+", wParam="+wParam+", lParam="+lParam);

  let proc = user32.GetWindowLongW(hWnd, user32.GWLP_WNDPROC);
  log.debug("  proc="+proc.toString(16)+" winLastError="+ctypes.winLastError);

try {

  let wid = firetray.Window.hwndToHexStr(hWnd);
  // let procPrev = firetray.Handler.wndProcsOrig.get(wid);
  // let procPrev = ctypes.cast(user32.GetPropW(hWnd, win32._T(kPropProcPrev)), user32.WNDPROC);
  // let procPrev = user32.GetPropW(hWnd, win32._T(kPropProcPrev));
  log.debug("  wid="+wid+" prev="+procPrev);

  /*
   * https://bugzilla.mozilla.org/show_bug.cgi?id=598679
   * https://bugzilla.mozilla.org/show_bug.cgi?id=671266
   */
  // let rv = user32.CallWindowProcW(procPrev, hWnd, uMsg, wParam, lParam);
  let rv = procPrev(hWnd, uMsg, wParam, lParam);
  log.debug("  CallWindowProc="+rv);
  return rv;

  } catch(error) {
log.error(error);
  }

  // user32.SetWindowLongW(hWnd, user32.GWLP_WNDPROC, ctypes.cast(procPrev, win32.LONG_PTR));

  // if (uMsg === win32.WM_USER) {
  //   log.debug("wndProc CALLED: hWnd="+hWnd+", uMsg="+uMsg+", wParam="+wParam+", lParam="+lParam);

  //   // return user32.DefWindowProcW(hWnd, uMsg, wParam, lParam);
  // }

  // return user32.DefWindowProcW(hWnd, uMsg, wParam, lParam);
};



///////////////////////// firetray.Handler overriding /////////////////////////

/** debug facility */
firetray.Handler.dumpWindows = function() {
  let dumpStr = ""+firetray.Handler.windowsCount;
  for (let wid in firetray.Handler.windows) {
    dumpStr += " "+wid;
  }
  log.info(dumpStr);
};

firetray.Handler.registerWindow = function(win) {
  log.debug("register window");

  let baseWin = firetray.Handler.getWindowInterface(win, "nsIBaseWindow");
  let nativeHandle = baseWin.nativeHandle;
  let hwnd = nativeHandle ?
        new ctypes.voidptr_t(ctypes.UInt64(nativeHandle)) :
        user32.FindWindowW("MozillaWindowClass", win.document.title);
  let wid = firetray.Window.hwndToHexStr(hwnd);
  log.debug("=== hwnd="+hwnd+" wid="+wid+" win.document.title: "+win.document.title);

  if (this.windows.hasOwnProperty(wid)) {
    let msg = "Window ("+wid+") already registered.";
    log.error(msg);
    Cu.reportError(msg);
    return false;
  }
  this.windows[wid] = {};
  this.windows[wid].chromeWin = win;
  this.windows[wid].baseWin = baseWin;

//   SetupWnd(hwnd);
//   ::SetPropW(hwnd, kIconData, reinterpret_cast<HANDLE>(iconData));
//   ::SetPropW(hwnd, kIconMouseEventProc, reinterpret_cast<HANDLE>(callback));
//   ::SetPropW(hwnd, kIcon, reinterpret_cast<HANDLE>(0x1));

  this.windowsCount += 1;
  // NOTE: no need to check for window state to set visibility because all
  // windows *are* shown at startup
  firetray.Window.updateVisibility(wid, true);
  log.debug("window "+wid+" registered");
  // NOTE: shouldn't be necessary to gtk_widget_add_events(gtkWin, gdk.GDK_ALL_EVENTS_MASK);

/*
  // try {
try {
    let wndProc = user32.WNDPROC(firetray.Window.wndProc);
    log.debug("proc="+wndProc);
    this.wndProcs.insert(wid, wndProc);
    let procPrev = user32.WNDPROC(
      user32.SetWindowLongW(hwnd, user32.GWLP_WNDPROC, ctypes.cast(wndProc, win32.LONG_PTR))
    );
    log.debug("procPrev="+procPrev+" winLastError="+ctypes.winLastError);
    this.wndProcsOrig.insert(wid, procPrev); // could be set as a window prop (SetPropW)

    procPrev = ctypes.cast(procPrev, win32.HANDLE);
    user32.SetPropW(hwnd, win32._T(kPropProcPrev), procPrev);
    log.debug("SetPropW: "+procPrev+" winLastError="+ctypes.winLastError);
  } catch(error) {
log.error(error);
  }
*/
    // firetray.Win32.acceptAllMessages(hwnd);

  // } catch (x) {
  //   if (x.name === "RangeError") // instanceof not working :-(
  //     win.alert(x+"\n\nYou seem to have more than "+FIRETRAY_WINDOW_COUNT_MAX
  //               +" windows open. This breaks FireTray and most probably "
  //               +firetray.Handler.appName+".");
  //   else win.alert(x);
  // }

  // TODO: check wndproc chaining http://stackoverflow.com/a/8835843/421846 if
  // needed for startupFilter

  log.debug("AFTER"); firetray.Handler.dumpWindows();
  return wid;
};

firetray.Handler.unregisterWindow = function(win) {
  log.debug("unregister window");

  let wid = firetray.Window.getWIDFromChromeWindow(win);

  if (!firetray.Handler.windows.hasOwnProperty(wid)) {
    log.error("can't unregister unknown window "+wid);
    return false;
  }

  if (!delete firetray.Handler.windows[wid])
    throw new DeleteError();
  // firetray.Handler.wndProcs.remove(wid);
  // firetray.Handler.wndProcsOrig.remove(wid);
  firetray.Handler.windowsCount -= 1;
  firetray.Handler.visibleWindowsCount -= 1;

  log.debug("window "+wid+" unregistered");
  return true;
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
