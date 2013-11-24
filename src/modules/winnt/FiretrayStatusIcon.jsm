/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

/* The tray icon for the main app. We need a hidden proxy window as (1) we want
 a unique icon, (2) the icon sends notifications to a single window. */

var EXPORTED_SYMBOLS = [ "firetray" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://firetray/ctypes/winnt/win32.jsm");
Cu.import("resource://firetray/ctypes/winnt/kernel32.jsm");
Cu.import("resource://firetray/ctypes/winnt/shell32.jsm");
Cu.import("resource://firetray/ctypes/winnt/user32.jsm");
Cu.import("resource://firetray/winnt/FiretrayWin32.jsm");
Cu.import("resource://firetray/commons.js");
firetray.Handler.subscribeLibsForClosing([kernel32, shell32, user32]);

const kMessageTray     = "_FIRETRAY_TrayMessage";
const kMessageCallback = "_FIRETRAY_TrayCallback";

let log = firetray.Logging.getLogger("firetray.StatusIcon");

if ("undefined" == typeof(firetray.Handler))
  log.error("This module MUST be imported from/after FiretrayHandler !");


firetray.StatusIcon = {
  initialized: false,
  callbacks: {}, // pointers to JS functions. MUST LIVE DURING ALL THE EXECUTION
  notifyIconData: null,
  msg: {WM_TASKBARCREATED:null, WM_TRAYMESSAGE:null, WM_TRAYCALLBACK:null},
  hwndProxy: null,
  WNDCLASS_NAME: "FireTrayHiddenWindowClass",
  WNDCLASS_ATOM: null,

  init: function() {
    this.FILENAME_BLANK = firetray.Utils.chromeToPath(
      "chrome://firetray/skin/blank-icon.png");

    this.registerMessages();
    this.create();

    this.initialized = true;
    return true;
  },

  shutdown: function() {
    log.debug("Disabling StatusIcon");

    this.destroy();

    this.initialized = false;
  },

  registerMessages: function() {
    this.msg.WM_TASKBARCREATED = user32.RegisterWindowMessageW("TaskbarCreated");
    this.msg.WM_TRAYMESSAGE  = user32.RegisterWindowMessageW(kMessageTray);
    this.msg.WM_TRAYCALLBACK = user32.RegisterWindowMessageW(kMessageCallback);
    log.debug("WM_*="+this.msg.WM_TASKBARCREATED+" "+this.msg.WM_TRAYMESSAGE+" "+this.msg.WM_TRAYCALLBACK);
  },

  unregisterMessages: function() {
    // FIXME: TODO:
  },

  create: function() {
    let hwnd_hidden = this.createProxyWindow();

    // the Mozilla hidden window has the default Mozilla icon
    let hwnd_hidden_moz = user32.FindWindowW("MozillaHiddenWindowClass", null);
    log.debug("=== hwnd_hidden_moz="+hwnd_hidden_moz);

    nid = new shell32.NOTIFYICONDATAW();
    nid.cbSize = shell32.NOTIFYICONDATAW_SIZE();
    log.debug("SIZE="+nid.cbSize);
    nid.szTip = firetray.Handler.appName;
    nid.hIcon = this.getIconFromWindow(hwnd_hidden_moz);
    nid.hWnd = hwnd_hidden;
    nid.uCallbackMessage = this.msg.WM_TRAYMESSAGE;
    nid.uFlags = shell32.NIF_ICON | shell32.NIF_MESSAGE | shell32.NIF_TIP;
    nid.uVersion = shell32.NOTIFYICON_VERSION_4;

    // Install the icon
    rv = shell32.Shell_NotifyIconW(shell32.NIM_ADD, nid.address());
    log.debug("Shell_NotifyIcon ADD="+rv+" winLastError="+ctypes.winLastError); // ERROR_INVALID_WINDOW_HANDLE(1400)
    rv = shell32.Shell_NotifyIconW(shell32.NIM_SETVERSION, nid.address());
    log.debug("Shell_NotifyIcon SETVERSION="+rv+" winLastError="+ctypes.winLastError);

    this.notifyIconData = nid;
    this.hwndProxy = hwnd_hidden;
  },

  createProxyWindow: function() {
    this.registerWindowClass();

    this.callbacks.hiddenWinProc = user32.WNDPROC(firetray.StatusIcon.proxyWindowProc);

    let hwnd_hidden = user32.CreateWindowExW(
      0, win32.LPCTSTR(this.WNDCLASS_ATOM), // lpClassName can also be _T(WNDCLASS_NAME)
      "Firetray Message Window", 0,
      user32.CW_USEDEFAULT, user32.CW_USEDEFAULT, user32.CW_USEDEFAULT, user32.CW_USEDEFAULT,
      null, null, firetray.Win32.hInstance, null);
    log.debug("CreateWindow="+!hwnd_hidden.isNull()+" winLastError="+ctypes.winLastError);

    let procPrev = user32.SetWindowLongW(hwnd_hidden, user32.GWLP_WNDPROC,
      ctypes.cast(this.callbacks.hiddenWinProc, win32.LONG_PTR));
    log.debug("procPrev="+procPrev+" winLastError="+ctypes.winLastError);

    firetray.Win32.acceptAllMessages(hwnd_hidden);

    return hwnd_hidden;
  },

  registerWindowClass: function() {
    let wndClass = new user32.WNDCLASSEXW();
    wndClass.cbSize = user32.WNDCLASSEXW.size;
    wndClass.lpfnWndProc = ctypes.cast(user32.DefWindowProcW, user32.WNDPROC);
    wndClass.hInstance = firetray.Win32.hInstance;
    wndClass.lpszClassName = win32._T(this.WNDCLASS_NAME);
    this.WNDCLASS_ATOM = user32.RegisterClassExW(wndClass.address());
    log.debug("WNDCLASS_ATOM="+this.WNDCLASS_ATOM);
  },

  proxyWindowProc: function(hWnd, uMsg, wParam, lParam) {
    // log.debug("ProxyWindowProc CALLED: hWnd="+hWnd+", uMsg="+uMsg+", wParam="+wParam+", lParam="+lParam);

    if (uMsg === firetray.StatusIcon.msg.WM_TASKBARCREATED) {
      log.info("____________TASKBARCREATED");

    } else if (uMsg === firetray.StatusIcon.msg.WM_TRAYMESSAGE) {

      switch (+lParam) {
      case win32.WM_LBUTTONUP:
        log.debug("WM_LBUTTONUP");
        break;
      case win32.WM_RBUTTONUP:
        log.debug("WM_RBUTTONUP");
        break;
      case win32.WM_CONTEXTMENU:
        log.debug("WM_CONTEXTMENU");
        break;
      case win32.NIN_KEYSELECT:
        log.debug("NIN_KEYSELECT");
        break;
      default:
      }

    }

    return user32.DefWindowProcW(hWnd, uMsg, wParam, lParam);
  },

  getIconFromWindow: function(hwnd) {
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
      icon = user32.LoadIconW(firetray.Win32.hInstance, win32.MAKEINTRESOURCE(0));
      log.debug("LoadIconW module winLastError="+ctypes.winLastError);
    }
    if (firetray.js.strEquals(icon, NULL)) { // OS default icon
      icon = user32.LoadIconW(null, win32.MAKEINTRESOURCE(user32.IDI_APPLICATION));
      log.debug("LoadIconW default winLastError="+ctypes.winLastError);
    }
    log.debug("=== icon="+icon);
    return icon;
  },

  destroyProxyWindow: function() {
    let rv = user32.DestroyWindow(this.hwndProxy);

    rv = this.unregisterWindowClass();
    log.debug("Hidden window removed");
  },

  unregisterWindowClass: function() {
    return user32.UnregisterClassW(win32.LPCTSTR(this.WNDCLASS_ATOM), firetray.Win32.hInstance);
  },

  destroy: function() {
    let rv = shell32.Shell_NotifyIconW(shell32.NIM_DELETE, this.notifyIconData.address());
    log.debug("Shell_NotifyIcon DELETE="+rv+" winLastError="+ctypes.winLastError);
    this.destroyProxyWindow();
  }

}; // firetray.StatusIcon

firetray.Handler.setIconImageDefault = function() {
  log.debug("setIconImageDefault");
};

firetray.Handler.setIconImageNewMail = function() {
};

// firetray.Handler.setIconImageFromFile = firetray.StatusIcon.setIconImageFromFile;

firetray.Handler.setIconTooltip = function(toolTipStr) {
};

firetray.Handler.setIconTooltipDefault = function() {
};

firetray.Handler.setIconText = function(text, color) { // FIXME: function too long
};

firetray.Handler.setIconVisibility = function(visible) {
};
