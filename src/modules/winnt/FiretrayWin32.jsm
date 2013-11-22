/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = [ "firetray" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://firetray/ctypes/winnt/win32.jsm");
Cu.import("resource://firetray/ctypes/winnt/kernel32.jsm");
Cu.import("resource://firetray/ctypes/winnt/user32.jsm");
Cu.import("resource://firetray/commons.js");
firetray.Handler.subscribeLibsForClosing([kernel32, user32]);

let log = firetray.Logging.getLogger("firetray.Win32");

if ("undefined" == typeof(firetray.Handler))
  log.error("This module MUST be imported from/after FiretrayHandler !");

const kMessageTray     = "_FIRETRAY_TrayMessage";
const kMessageCallback = "_FIRETRAY_TrayCallback";

function Win32Env() {
  this.WM_TASKBARCREATED = user32.RegisterWindowMessageW("TaskbarCreated");
  // We register this as well, as we cannot know which WM_USER values are
  // already taken
  this.WM_TRAYMESSAGE  = user32.RegisterWindowMessageW(kMessageTray);
  this.WM_TRAYCALLBACK = user32.RegisterWindowMessageW(kMessageCallback);
  log.debug("WM_*="+this.WM_TASKBARCREATED+" "+this.WM_TRAYMESSAGE+" "+this.WM_TRAYCALLBACK);

  this.hInstance = kernel32.GetModuleHandleW("xul"); // ordinary windows are created from xul.dll
  log.debug("hInstance="+this.hInstance);

/*
  let hUser = kernel32.LoadLibraryW("user32");
  let defWindowProcW = kernel32.GetProcAddress(hUser, "DefWindowProcW");
  log.debug("defWindowProcW="+defWindowProcW);
  log.debug("_______________DefWindowProcW="+user32.DefWindowProcW);
*/

  this.WNDCLASS_NAME = "FireTrayHiddenWindowClass";
  let wndClass = new user32.WNDCLASSEXW();
  wndClass.cbSize = user32.WNDCLASSEXW.size;
  wndClass.lpfnWndProc = ctypes.cast(user32.DefWindowProcW, user32.WNDPROC);
  wndClass.hInstance = this.hInstance;
  wndClass.lpszClassName = win32._T(this.WNDCLASS_NAME);
  this.WNDCLASS_ATOM = user32.RegisterClassExW(wndClass.address());
  log.debug("WNDCLASS_ATOM="+this.WNDCLASS_ATOM);
}

firetray.Win32 = new Win32Env();
