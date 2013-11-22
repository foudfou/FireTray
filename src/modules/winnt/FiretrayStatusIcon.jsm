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
  trayIcon: null,
  themedIconApp: null,
  themedIconNewMail: null,
  prefAppIconNames: null,
  prefNewMailIconNames: null,
  defaultAppIconName: null,
  defaultNewMailIconName: null,

  init: function() {
    this.FILENAME_BLANK = firetray.Utils.chromeToPath(
      "chrome://firetray/skin/blank-icon.png");

    this.create();

    this.initialized = true;
    return true;
  },

  shutdown: function() {
    log.debug("Disabling StatusIcon");
    this.initialized = false;
  },

  create: function() {
    let hwnd_hidden = this.createHiddenWindow();

    // the Mozilla hidden window has the default Mozilla icon
    let hwnd_hidden_moz = user32.FindWindowW("MozillaHiddenWindowClass", null);
    log.debug("=== hwnd_hidden_moz="+hwnd_hidden_moz);

    let nid = new shell32.NOTIFYICONDATAW();

    nid.cbSize = shell32.NOTIFYICONDATAW_SIZE();
    log.debug("SIZE="+nid.cbSize);
    nid.szTip = firetray.Handler.appName;
    nid.hIcon = this.getIconFromWindow(hwnd_hidden_moz);
    nid.hwnd = hwnd_hidden;
    nid.uCallbackMessage = firetray.Win32.WM_TRAYMESSAGE;
    nid.uFlags = shell32.NIF_ICON | shell32.NIF_MESSAGE | shell32.NIF_TIP;
    nid.uVersion = shell32.NOTIFYICON_VERSION_4;

/*
    // string is truncate to size of buffer and null-terminated. nid.szTip is
    // initialized automatically by ctypes
    let nMaxCount = 127;
    let len = user32.GetWindowTextW(hwnd, nid.szTip, nMaxCount);
    log.debug("errno="+ctypes.errno+" winLastError="+ctypes.winLastError);
    if (len != 0) {
      log.info("nid.szTip="+nid.szTip.readString());
    }
*/

    // Install the icon
    rv = shell32.Shell_NotifyIconW(shell32.NIM_ADD, nid.address());
    log.debug("Shell_NotifyIcon ADD="+rv+" winLastError="+ctypes.winLastError); // ERROR_INVALID_WINDOW_HANDLE(1400)
    shell32.Shell_NotifyIconW(shell32.NIM_SETVERSION, nid.address());
    log.debug("Shell_NotifyIcon SETVERSION="+rv+" winLastError="+ctypes.winLastError);
  },

  createHiddenWindow: function() {
    this.callbacks.hiddenWinProc = user32.WNDPROC(firetray.StatusIcon.hiddenWindowProc);

    let hwnd_hidden = user32.CreateWindowExW(
      0, win32.LPCTSTR(firetray.Win32.WNDCLASS_ATOM), // lpClassName can also be _T(WNDCLASS_NAME)
      "Firetray Message Window", 0,
      user32.CW_USEDEFAULT, user32.CW_USEDEFAULT, user32.CW_USEDEFAULT, user32.CW_USEDEFAULT,
      null, null, firetray.Win32.hInstance, null);
    log.debug("CreateWindow="+!hwnd_hidden.isNull()+" winLastError="+ctypes.winLastError);

    let procPrev = user32.SetWindowLongW(hwnd_hidden, user32.GWLP_WNDPROC,
                                         ctypes.cast(this.callbacks.hiddenWinProc, win32.LONG_PTR));
    log.debug("procPrev="+procPrev+" winLastError="+ctypes.winLastError);

    return hwnd_hidden;
  },

  hiddenWindowProc: function(hWnd, uMsg, wParam, lParam) {

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
