/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

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

let log = firetray.Logging.getLogger("firetray.StatusIcon");

if ("undefined" == typeof(firetray.Handler))
  log.error("This module MUST be imported from/after FiretrayHandler !");


firetray.StatusIcon = {
  initialized: false,
  callbacks: {}, // pointers to JS functions. MUST LIVE DURING ALL THE EXECUTION
  notifyIconData: null,
  hwndHidden: null,
  WNDCLASS_NAME: "FireTrayHiddenWindowClass",
  WNDCLASS_ATOM: null,

  init: function() {
    this.FILENAME_BLANK = firetray.Utils.chromeToPath(
      "chrome://firetray/skin/blank-icon.png");

    this.create();

    this.initialized = true;
    return true;
  },

  shutdown: function() {
    log.debug("Disabling StatusIcon");

    this.destroy();

    this.initialized = false;
  },

  create: function() {
    let hwnd_hidden = this.createHiddenWindow();

    // the Mozilla hidden window has the default Mozilla icon
    let hwnd_hidden_moz = user32.FindWindowW("MozillaHiddenWindowClass", null);
    log.debug("=== hwnd_hidden_moz="+hwnd_hidden_moz);

    nid = new shell32.NOTIFYICONDATAW();
    nid.cbSize = shell32.NOTIFYICONDATAW_SIZE();
    log.debug("SIZE="+nid.cbSize);
    nid.szTip = firetray.Handler.appName;
    nid.hIcon = this.getIconFromWindow(hwnd_hidden_moz);
    nid.hwnd = hwnd_hidden;
    nid.uCallbackMessage = firetray.Win32.WM_TRAYMESSAGE;
    nid.uFlags = shell32.NIF_ICON | shell32.NIF_MESSAGE | shell32.NIF_TIP;
    nid.uVersion = shell32.NOTIFYICON_VERSION_4;

    // Install the icon
    rv = shell32.Shell_NotifyIconW(shell32.NIM_ADD, nid.address());
    log.debug("Shell_NotifyIcon ADD="+rv+" winLastError="+ctypes.winLastError); // ERROR_INVALID_WINDOW_HANDLE(1400)
    rv = shell32.Shell_NotifyIconW(shell32.NIM_SETVERSION, nid.address());
    log.debug("Shell_NotifyIcon SETVERSION="+rv+" winLastError="+ctypes.winLastError);

    this.notifyIconData = nid;
    this.hwndHidden = hwnd_hidden;
  },

  createHiddenWindow: function() {
    this.registerWindowClass();

    this.callbacks.hiddenWinProc = user32.WNDPROC(firetray.StatusIcon.hiddenWindowProc);

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

  hiddenWindowProc: function(hWnd, uMsg, wParam, lParam) {
    log.debug("HiddenWindowProc CALLED: hWnd="+hWnd+", uMsg="+uMsg+", wParam="+wParam+", lParam="+lParam);
    // ... do something smart with this event!

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

  destroyHiddenWindow: function() {
    let rv = user32.DestroyWindow(this.hwndHidden);

    rv = this.unregisterWindowClass();
    log.debug("Hidden window removed");
  },

  unregisterWindowClass: function() {
    return user32.UnregisterClassW(win32.LPCTSTR(this.WNDCLASS_ATOM), firetray.Win32.hInstance);
  },

  destroy: function() {
    let rv = shell32.Shell_NotifyIconW(shell32.NIM_DELETE, this.notifyIconData.address());
    log.debug("Shell_NotifyIcon DELETE="+rv+" winLastError="+ctypes.winLastError);
    this.destroyHiddenWindow();
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
