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

// We need to keep long-living references to wndProcs callbacks. As they also
// happen to be ctypes pointers, we store them into real ctypes arrays.
firetray.Handler.wndProcs     = new ctypesMap(user32.WNDPROC);
firetray.Handler.wndProcsOrig = new ctypesMap(user32.WNDPROC);


firetray.Window = new FiretrayWindow();

firetray.Window.init = function() {
    this.initialized = true;
  };

firetray.Window.shutdown = function() {
  this.initialized = false;
};

firetray.Window.getVisibility = function(wid) {
  let hwnd = firetray.Win32.hexStrToHwnd(wid);
  let style = user32.GetWindowLongW(hwnd, user32.GWL_STYLE);
  return ((style & user32.WS_VISIBLE) != 0); // user32.IsWindowVisible(hwnd);
};

// firetray.Window.{show,hide} useless as we don't need to restore position and size
firetray.Window.setVisibility = function(wid, visible) {
  log.debug("setVisibility="+visible);
  let hwnd = firetray.Win32.hexStrToHwnd(wid);
  let ret = user32.ShowWindow(hwnd, visible ? user32.SW_SHOW : user32.SW_HIDE);
  log.debug("  ShowWindow="+ret+" winLastError="+ctypes.winLastError);
};

firetray.Window.wndProc = function(hWnd, uMsg, wParam, lParam) { // filterWindow
  // log.debug("wndProc CALLED: hWnd="+hWnd+", uMsg="+uMsg+", wParam="+wParam+", lParam="+lParam);
  let wid = firetray.Win32.hwndToHexStr(hWnd);

  if (uMsg === firetray.Win32.WM_TRAYMESSAGE) {
    log.debug("wndProc CALLED with WM_TRAYMESSAGE");

  } else if (uMsg === firetray.Win32.WM_TRAYMESSAGEFWD) {
    log.debug("wndProc CALLED with WM_TRAYMESSAGEFWD");

  } else if (uMsg === win32.WM_USER) {
    log.debug("wndProc CALLED with WM_USER");

  } else if (uMsg === win32.WM_CLOSE) {
    log.debug("wndProc CALLED with WM_CLOSE");

  } else if (uMsg === win32.WM_SYSCOMMAND) {
    // FIXME: not work with window.minimize() (menubar hidden)
    log.debug("wndProc CALLED with WM_SYSCOMMAND wParam="+wParam);
    if (wParam === win32.SC_MINIMIZE) {
      log.debug("GOT ICONIFIED");
      if (firetray.Handler.hideOnMinimizeMaybe(wid)) {
        return 0;               // processed => preventDefault
      }
    }

  } else if (uMsg === win32.WM_DESTROY) {
    log.debug("wndProc CALLED with WM_DESTROY "+wid);

  } else if (uMsg === win32.WM_MOVE) {
    log.debug("wndProc CALLED with WM_MOVE "+wid);

  } else if (uMsg === win32.WM_ACTIVATE) {
    log.debug("wndProc CALLED with WM_ACTIVATE "+wid);
  }

  let procPrev = firetray.Handler.wndProcsOrig.get(wid);
  return user32.CallWindowProcW(procPrev, hWnd, uMsg, wParam, lParam); // or DefWindowProcW
};

firetray.Window.attachWndProc = function(wid, hwnd) {
  try {
    let wndProc = user32.WNDPROC(firetray.Window.wndProc);
    log.debug("proc="+wndProc);
    firetray.Handler.wndProcs.insert(wid, wndProc);
    let procPrev = user32.WNDPROC(
      user32.SetWindowLongW(hwnd, user32.GWLP_WNDPROC,
                            ctypes.cast(wndProc, win32.LONG_PTR))
    );
    log.debug("procPrev="+procPrev+" winLastError="+ctypes.winLastError);
    // we can't store WNDPROC callbacks (JS ctypes objects) with SetPropW(), as
    // we need long-living refs.
    firetray.Handler.wndProcsOrig.insert(wid, procPrev);

  } catch (x) {
    if (x.name === "RangeError") { // instanceof not working :-(
      let msg = x+"\n\nYou seem to have more than "+FIRETRAY_WINDOW_COUNT_MAX
                +" windows open. This breaks FireTray and most probably "
                +firetray.Handler.appName+".";
      log.error(msg);
      Cu.reportError(msg);
    }else {
      log.error(x);
      Cu.reportError(x);
    }
  }
};

firetray.Window.detachWndProc = function(wid) {
  let procPrev = firetray.Handler.wndProcsOrig.get(wid);
  let hwnd = firetray.Win32.hexStrToHwnd(wid);
  log.debug("hwnd="+hwnd);
  let proc = user32.WNDPROC(
    user32.SetWindowLongW(hwnd, user32.GWLP_WNDPROC,
                          ctypes.cast(procPrev, win32.LONG_PTR))
  );
  firetray.js.assert(firetray.js.strEquals(proc, firetray.Handler.wndProcs.get(wid)),
                     "Wrong WndProc replaced.");
  firetray.Handler.wndProcs.remove(wid);
  firetray.Handler.wndProcsOrig.remove(wid);
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
        firetray.Win32.hexStrToHwnd(nativeHandle) :
        user32.FindWindowW("MozillaWindowClass", win.document.title);
  let wid = firetray.Win32.hwndToHexStr(hwnd);
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
  Object.defineProperties(this.windows[wid], {
    "visible": { get: function(){return firetray.Window.getVisibility(wid);} }
  });

  log.debug("window "+wid+" registered");

  firetray.Window.attachWndProc(wid, hwnd);

  firetray.Win32.acceptAllMessages(hwnd);

  log.debug("AFTER"); firetray.Handler.dumpWindows();
  return wid;
};

firetray.Handler.unregisterWindow = function(win) {
  log.debug("unregister window");

  let wid = firetray.Window.getRegisteredWinIdFromChromeWindow(win);
  if (!firetray.Handler.windows.hasOwnProperty(wid)) {
    log.error("can't unregister unknown window "+wid);
    return false;
  }

  firetray.Window.detachWndProc(wid);

  if (!delete firetray.Handler.windows[wid])
    throw new DeleteError();

  firetray.Handler.dumpWindows();
  log.debug("window "+wid+" unregistered");
  return true;
};

firetray.Handler.showWindow = function(wid) {
  return firetray.Window.setVisibility(wid, true);
};
firetray.Handler.hideWindow = function(wid) {
  return firetray.Window.setVisibility(wid, false);
};

firetray.Handler.windowGetAttention = function(wid) { // see nsWindow.cpp
  for (var first in this.windows) break;
  wid = wid || first;
  let hwnd = firetray.Win32.hexStrToHwnd(wid);
  let fgWnd = user32.GetForegroundWindow();
  log.debug(hwnd+" === "+fgWnd);
  if (firetray.js.strEquals(hwnd, fgWnd) ||
      !this.windows[wid].visible)
    return;

  let defaultCycleCount = new win32.DWORD;
  user32.SystemParametersInfoW(user32.SPI_GETFOREGROUNDFLASHCOUNT, 0,
                               defaultCycleCount.address(), 0);
  log.debug("defaultCycleCount="+defaultCycleCount);

  let flashInfo = new user32.FLASHWINFO;
  flashInfo.cbSize = user32.FLASHWINFO.size;
  flashInfo.hwnd = hwnd;
  flashInfo.dwFlags = user32.FLASHW_ALL;
  flashInfo.uCount = defaultCycleCount;
  flashInfo.dwTimeout = 0;
  user32.FlashWindowEx(flashInfo.address());
};
