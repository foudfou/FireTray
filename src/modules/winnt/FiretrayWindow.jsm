/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = [ "firetray" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://firetray/ctypes/ctypesMap.jsm");
Cu.import("resource://firetray/ctypes/winnt/kernel32.jsm");
Cu.import("resource://firetray/ctypes/winnt/user32.jsm");
Cu.import("resource://firetray/ctypes/winnt/win32.jsm");
Cu.import("resource://firetray/winnt/FiretrayWin32.jsm");
Cu.import("resource://firetray/FiretrayWindow.jsm");
Cu.import("resource://firetray/commons.js");
firetray.Handler.subscribeLibsForClosing([user32, kernel32]);

let log = firetray.Logging.getLogger("firetray.Window");

if ("undefined" == typeof(firetray.Handler))
  log.error("This module MUST be imported from/after FiretrayHandler !");

const FIRETRAY_XWINDOW_HIDDEN    = 1 << 0; // when minimized also
const FIRETRAY_XWINDOW_MAXIMIZED = 1 << 1;

// We need to keep long-living references to wndProcs callbacks. As they also
// happen to be ctypes pointers, we store them into real ctypes arrays.
firetray.Handler.wndProcs      = new ctypesMap(user32.WNDPROC);
firetray.Handler.wndProcsOrig  = new ctypesMap(user32.WNDPROC);
firetray.Handler.procHooks          = new ctypesMap(win32.HHOOK);
firetray.Handler.procHooksRegistred = new ctypesMap(win32.HHOOK);


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
  // log.debug("wndProc CALLED: hWnd="+hWnd+", uMsg=0x"+uMsg.toString(16)+", wParam="+wParam+", lParam="+lParam);
  let wid = firetray.Win32.hwndToHexStr(hWnd);

  if (uMsg === win32.WM_SYSCOMMAND) {
    log.debug("wndProc CALLED with WM_SYSCOMMAND wParam="+wParam);
    if (wParam === win32.SC_MINIMIZE) {
      log.debug("GOT ICONIFIED");
      if (firetray.Handler.hideOnMinimizeMaybe(wid)) {
        return 0;               // processed => preventDefault
      }
    }
  }

  let procPrev = firetray.Handler.wndProcsOrig.get(wid);
  return user32.CallWindowProcW(procPrev, hWnd, uMsg, wParam, lParam); // or DefWindowProcW
};

// We could chain wndProcs, but adding a hook looks simpler.
firetray.Window.showCount = 0;
firetray.Window.startupHook = function(nCode, wParam, lParam) { // WH_CALLWNDPROC, WH_GETMESSAGE
  // log.debug("startupHook CALLED: nCode="+nCode+", wParam="+wParam+", lParam="+lParam);
  if (nCode < 0) return user32.CallNextHookEx(null, nCode, wParam, lParam); // user32.HC_ACTION

  let cwpstruct = ctypes.cast(win32.LPARAM(lParam), user32.CWPSTRUCT.ptr).contents;
  let uMsg = cwpstruct.message;
  let hwnd = cwpstruct.hwnd;
  let wid = firetray.Win32.hwndToHexStr(hwnd);
  let wparam = cwpstruct.wParam;
  let lparam = cwpstruct.lParam;

  if (uMsg === win32.WM_SHOWWINDOW && wparam == 1 && lparam == 0) { // shown and ShowWindow called
    log.debug("startupHook CALLED with WM_SHOWWINDOW wparam="+wparam+" lparam="+lparam);
    firetray.Window.showCount += 1;

    if (firetray.Utils.prefService.getBoolPref('start_hidden')) {
      log.debug("start_hidden");

      /* Compared to ShowWindow, SetWindowPlacement seems to bypass window
       animations. http://stackoverflow.com/a/6087214 */
      let placement = new user32.WINDOWPLACEMENT;
      let ret = user32.GetWindowPlacement(hwnd, placement.address());
      log.debug("  GetWindowPlacement="+ret+" winLastError="+ctypes.winLastError);
      log.debug("  PLACEMENT="+placement);

      if (firetray.Window.showCount < 2) {
        // we can't prevent ShowWindow, so we mitigate the effect by minimizing
        // it before. This is why we'll have to restore it when unhidden.
        placement.showCmd = user32.SW_SHOWMINNOACTIVE;
        ret = user32.SetWindowPlacement(hwnd, placement.address());
        log.debug("  SetWindowPlacement="+ret+" winLastError="+ctypes.winLastError);

        firetray.Utils.timer(
          FIRETRAY_DELAY_NOWAIT_MILLISECONDS,
          Ci.nsITimer.TYPE_ONE_SHOT, function(){firetray.Handler.hideWindow(wid);}
        ); // looks like CData (hwnd) cannot be closured

      } else {                  // restore
        firetray.Window.detachHook(wid);

        placement.showCmd = user32.SW_RESTORE;
        user32.SetWindowPlacement(hwnd, placement.address());
      }

    } else {
      firetray.Window.detachHook(wid);
    }

  }

  return user32.CallNextHookEx(null, nCode, wParam, lParam);
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
    /* we can't store WNDPROC callbacks (JS ctypes objects) with SetPropW(), as
     we need long-living refs. */
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

firetray.Window.attachHook = function(wid) { // detaches itself alone
    let startupHook = user32.HOOKPROC(firetray.Window.startupHook);
    log.debug("callhk="+startupHook);
    firetray.Handler.procHooks.insert(wid, startupHook);
    // Global hooks must reside in a dll (hence hInst). This is important for
    // the scope of variables.
    let hhook = user32.SetWindowsHookExW(
      user32.WH_CALLWNDPROC, startupHook, null, kernel32.GetCurrentThreadId());
    log.debug("  hhook="+hhook+" winLastError="+ctypes.winLastError);
    firetray.Handler.procHooksRegistred.insert(wid, hhook);
};

firetray.Window.detachHook = function(wid) { // detaches itself alone
  let hook = firetray.Handler.procHooksRegistred.get(wid);
  if (!user32.UnhookWindowsHookEx(hook)) {
    log.error("UnhookWindowsHookEx for window "+wid+" failed: winLastError="+ctypes.winLastError);
    return;
  }
  firetray.Handler.procHooks.remove(wid);
  firetray.Handler.procHooksRegistred.remove(wid);
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
  if (!firetray.Handler.appStarted) {
    firetray.Window.attachHook(wid);
  }

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
  firetray.Handler.removePopupMenuWindowItemAndSeparatorMaybe(wid);
  return firetray.Window.setVisibility(wid, true);
};
firetray.Handler.hideWindow = function(wid) {
  firetray.Handler.addPopupMenuWindowItemAndSeparatorMaybe(wid);
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
