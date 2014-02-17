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
Cu.import("resource://firetray/ctypes/ctypesMap.jsm");
Cu.import("resource://firetray/ctypes/winnt/win32.jsm");
Cu.import("resource://firetray/ctypes/winnt/gdi32.jsm");
Cu.import("resource://firetray/ctypes/winnt/kernel32.jsm");
Cu.import("resource://firetray/ctypes/winnt/shell32.jsm");
Cu.import("resource://firetray/ctypes/winnt/user32.jsm");
Cu.import("resource://firetray/winnt/FiretrayWin32.jsm");
Cu.import("resource://firetray/commons.js");
firetray.Handler.subscribeLibsForClosing([gdi32, kernel32, shell32, user32]);

let log = firetray.Logging.getLogger("firetray.StatusIcon");

if ("undefined" == typeof(firetray.Handler))
  log.error("This module MUST be imported from/after FiretrayHandler !");

FIRETRAY_ICON_CHROME_PATHS = {
  'blank-icon': "chrome://firetray/skin/winnt/blank-icon.bmp",
  'mail-unread': "chrome://firetray/skin/winnt/mail-unread.ico",
};

firetray.StatusIcon = {
  initialized: false,
  callbacks: {}, // pointers to JS functions. MUST LIVE DURING ALL THE EXECUTION
  notifyIconData: null,
  hwndProxy: null,
  icons: null,
  bitmaps: null,
  WNDCLASS_NAME: "FireTrayHiddenWindowClass",
  WNDCLASS_ATOM: null,

  init: function() {
    this.loadImages();
    // this.defineIconNames();     // FIXME: linux-only
    this.create();

    this.initialized = true;
    return true;
  },

  shutdown: function() {
    log.debug("Disabling StatusIcon");

    this.destroy();
    this.destroyImages();

    this.initialized = false;
    return true;
  },

  defineIconNames: function() { // FIXME: linux-only
    this.prefAppIconNames = (function() {
      if (firetray.Handler.inMailApp) {
        return "app_mail_icon_names";
      } else if (firetray.Handler.inBrowserApp) {
        return "app_browser_icon_names";
      } else {
        return "app_default_icon_names";
      }
    })();
    this.defaultAppIconName = firetray.Handler.appName.toLowerCase();

    this.prefNewMailIconNames = "new_mail_icon_names";
    this.defaultNewMailIconName = "mail-unread";
  },

  loadImages: function() {
    this.icons = new ctypesMap(win32.HICON);
    this.bitmaps = new ctypesMap(win32.HBITMAP);

    // the Mozilla hidden window has the default Mozilla icon
    let hwnd_hidden_moz = user32.FindWindowW("MozillaHiddenWindowClass", null);
    log.debug("=== hwnd_hidden_moz="+hwnd_hidden_moz);
    this.icons.insert('app', this.getIconFromWindow(hwnd_hidden_moz));

    /* we'll take the first icon in the .ico file. To get the icon count in the
     file, pass ctypes.cast(ctypes.int(-1), win32.UINT); */
    for (let imgName in FIRETRAY_ICON_CHROME_PATHS) {
      let path = firetray.Utils.chromeToPath(FIRETRAY_ICON_CHROME_PATHS[imgName]);
      let imgType = path.substr(-3, 3);
      let imgTypeDict = {
        ico: { win_t: win32.HICON,   load_const: user32.IMAGE_ICON,   map: this.icons },
        bmp: { win_t: win32.HBITMAP, load_const: user32.IMAGE_BITMAP, map: this.bitmaps }
      };
      if (!(imgType in imgTypeDict)) {
        throw Error("Unrecognized type '"+imgType+"'");
      }
      let imgTypeRec = imgTypeDict[imgType];
      let himg = ctypes.cast(
        user32.LoadImageW(null, path, imgTypeRec['load_const'], 0, 0,
                          user32.LR_LOADFROMFILE|user32.LR_SHARED),
        imgTypeRec['win_t']);
      if (himg.isNull()) {
        log.error("Could not load '"+imgName+"'="+himg+" winLastError="+ctypes.winLastError);
        continue;
      }
      imgTypeRec['map'].insert(imgName, himg);
    }
  },

  // images loaded with LR_SHARED need't be destroyed
  destroyImages: function() {
    [this.icons, this.bitmaps].forEach(function(map, idx, ary) {
      let keys = map.keys;
      for (let i=0, len=keys.length; i<len; ++i) {
        let imgName = keys[i];
        map.remove(imgName);
      }
    });
    log.debug("Icons destroyed");
  },

  create: function() {
    let hwnd_hidden = this.createProxyWindow();

    nid = new shell32.NOTIFYICONDATAW();
    nid.cbSize = shell32.NOTIFYICONDATAW_SIZE();
    log.debug("SIZE="+nid.cbSize);
    nid.szTip = firetray.Handler.appName;
    nid.hIcon = this.icons.get('app');
    nid.hWnd = hwnd_hidden;
    nid.uCallbackMessage = firetray.Win32.WM_TRAYMESSAGE;
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

    let hwnd_hidden = user32.CreateWindowExW(
      0, win32.LPCTSTR(this.WNDCLASS_ATOM), // lpClassName can also be _T(WNDCLASS_NAME)
      "Firetray Message Window", 0,
      user32.CW_USEDEFAULT, user32.CW_USEDEFAULT, user32.CW_USEDEFAULT, user32.CW_USEDEFAULT,
      null, null, firetray.Win32.hInstance, null);
    log.debug("CreateWindow="+!hwnd_hidden.isNull()+" winLastError="+ctypes.winLastError);

    this.callbacks.proxyWndProc = user32.WNDPROC(firetray.StatusIcon.proxyWndProc);
    let procPrev = user32.SetWindowLongW(hwnd_hidden, user32.GWLP_WNDPROC,
      ctypes.cast(this.callbacks.proxyWndProc, win32.LONG_PTR));
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

  proxyWndProc: function(hWnd, uMsg, wParam, lParam) {
    // log.debug("ProxyWindowProc CALLED: hWnd="+hWnd+", uMsg="+uMsg+", wParam="+wParam+", lParam="+lParam);

    if (uMsg === firetray.Win32.WM_TASKBARCREATED) {
      log.info("____________TASKBARCREATED");

    } else if (uMsg === firetray.Win32.WM_TRAYMESSAGEFWD) {
      log.debug("ProxyWindowProc WM_TRAYMESSAGEFWD reached!");

    } else if (uMsg === firetray.Win32.WM_TRAYMESSAGE) {

      switch (+lParam) {
      case win32.WM_LBUTTONUP:
        log.debug("WM_LBUTTONUP");
        firetray.Handler.showHideAllWindows();
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
    let rv = user32.SendMessageW(hwnd, user32.WM_GETICON, user32.ICON_SMALL, 0);
    log.debug("SendMessageW winLastError="+ctypes.winLastError);
    // result is a ctypes.Int64. So we need to create a CData from it before
    // casting it to a HICON.
    let icon = ctypes.cast(win32.LRESULT(rv), win32.HICON);
    if (icon.isNull()) { // from the window class
      rv = user32.GetClassLong(hwnd, user32.GCLP_HICONSM);
      icon = ctypes.cast(win32.ULONG_PTR(rv), win32.HICON);
      log.debug("GetClassLong winLastError="+ctypes.winLastError);
    }
    if (icon.isNull()) { // from the first resource -> ERROR_RESOURCE_TYPE_NOT_FOUND(1813)
      icon = user32.LoadIconW(firetray.Win32.hInstance, win32.MAKEINTRESOURCE(0));
      log.debug("LoadIconW module winLastError="+ctypes.winLastError);
    }
    if (icon.isNull()) { // OS default icon
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
  },

  setIcon: function(iconinfo) {
    let nid = firetray.StatusIcon.notifyIconData;
    if (iconinfo.hicon)
      nid.hIcon = iconinfo.hicon;
    if (iconinfo.tip)
      nid.szTip = iconinfo.tip;
    rv = shell32.Shell_NotifyIconW(shell32.NIM_MODIFY, nid.address());
    log.debug("Shell_NotifyIcon MODIFY="+rv+" winLastError="+ctypes.winLastError);
  },

  // rgb colors encoded in *bbggrr*
  cssColorToCOLORREF: function(csscolor) {
    let rgb = csscolor.substr(1);
    let rr = rgb.substr(0, 2);
    let gg = rgb.substr(2, 2);
    let bb = rgb.substr(4, 2);
    return parseInt("0x"+bb+gg+rr);
  },

  // http://stackoverflow.com/questions/457050/how-to-display-text-in-system-tray-icon-with-win32-api
  createTextIcon: function(hWnd, text, color) {
    log.debug("createTextIcon hWnd="+hWnd+" text="+text+" color="+color);

    let blank = this.bitmaps.get('blank-icon');
    let bitmap = new win32.BITMAP();
    let err = gdi32.GetObjectW(blank, win32.BITMAP.size, bitmap.address()); // get bitmap info
    let width = bitmap.bmWidth, height = bitmap.bmHeight;

    let hdc = user32.GetDC(hWnd); // get device context (DC) for hWnd
    let hdcMem = gdi32.CreateCompatibleDC(hdc); // creates a memory device context (DC) compatible with hdc (need a bitmap)
    let hBitmap = user32.CopyImage(blank, user32.IMAGE_BITMAP, width, height, 0);
    let hBitmapMask = gdi32.CreateCompatibleBitmap(hdc, width, height);
    user32.ReleaseDC(hWnd, hdc);

    let hBitmapOrig = gdi32.SelectObject(hdcMem, hBitmap);
    // gdi32.PatBlt(hdcMem, 0, 0, 16, 16, gdi32.BLACKNESS); // paint black rectangle

// http://forums.codeguru.com/showthread.php?379565-Windows-SDK-GDI-How-do-I-choose-a-font-size-to-exactly-fit-a-string-in-a

    let fnHeight = firetray.js.floatToInt(height);
    let hFont = gdi32.CreateFontW(fnHeight, 0, 0, 0, gdi32.FW_MEDIUM, 0, 0, 0,
      gdi32.ANSI_CHARSET, 0, 0, 0, gdi32.FF_SWISS, "Sans"); // get font
    ctypes.cast(gdi32.SelectObject(hdcMem, hFont), win32.HFONT); // replace font in bitmap by hFont
    let faceName = ctypes.jschar.array()(32);
    gdi32.GetTextFaceW(hdcMem, 32, faceName);
    log.debug("    font="+faceName);

    let size = new gdi32.SIZE();
    gdi32.GetTextExtentPoint32W(hdcMem, text, text.length, size.address()); // more reliable than DrawText(DT_CALCRECT)

    while (size.cx > width - 6 || size.cy > height - 4) {
      fnHeight -= 1;
      hFont = gdi32.CreateFontW(fnHeight, 0, 0, 0, gdi32.FW_SEMIBOLD, 0, 0, 0,
                                gdi32.ANSI_CHARSET, 0, 0, gdi32.PROOF_QUALITY,
                                gdi32.FF_SWISS, "Arial");
      ctypes.cast(gdi32.SelectObject(hdcMem, hFont), win32.HFONT);

      gdi32.GetTextExtentPoint32W(hdcMem, text, text.length, size.address()); // more reliable than DrawText(DT_CALCRECT)
      log.debug("    fnHeight="+fnHeight+" width="+size.cx);
    }
    gdi32.GetTextExtentPoint32W(hdcMem, text, text.length, size.address());

    gdi32.SetTextColor(hdcMem, win32.COLORREF(this.cssColorToCOLORREF(color)));
    gdi32.SetBkMode(hdcMem, gdi32.TRANSPARENT); // VERY IMPORTANT
    gdi32.SetTextAlign(hdcMem, gdi32.TA_TOP|gdi32.TA_CENTER);
    log.debug("   ___ALIGN=(winLastError="+ctypes.winLastError+") "+gdi32.GetTextAlign(hdcMem));

    let nXStart = firetray.js.floatToInt((width - size.cx)/2),
        nYStart = firetray.js.floatToInt((height - size.cy)/2);
    gdi32.TextOutW(hdcMem, width/2, nYStart+2, text, text.length); // ref point for alignment

    gdi32.SelectObject(hdcMem, hBitmapOrig);

    let iconInfo = win32.ICONINFO();
    iconInfo.fIcon = true;
    iconInfo.xHotspot = 0;
    iconInfo.yHotspot = 0;
    iconInfo.hbmMask = hBitmapMask;
    iconInfo.hbmColor = hBitmap;

    let hIcon = user32.CreateIconIndirect(iconInfo.address());
    log.debug("   CreateIconIndirect hIcon="+hIcon+" lastError="+ctypes.winLastError);

    gdi32.DeleteObject(gdi32.SelectObject(hdcMem, hFont));
    gdi32.DeleteDC(hdcMem);
    // gdi32.DeleteDC(hdc); // already ReleaseDC's
    gdi32.DeleteObject(hBitmap);
    gdi32.DeleteObject(hBitmapMask);

    return hIcon;               // to be destroyed (DestroyIcon)
  }

}; // firetray.StatusIcon

firetray.Handler.setIconImageDefault = function() {
  log.debug("setIconImageDefault");
  firetray.StatusIcon.setIcon({hicon:firetray.StatusIcon.icons.get('app')});
};

firetray.Handler.setIconImageNewMail = function() {
  log.debug("setIconImageDefault");
  firetray.StatusIcon.setIcon({hicon:firetray.StatusIcon.icons.get('mail-unread')});
};

// firetray.Handler.setIconImageFromFile = firetray.StatusIcon.setIconImageFromFile;

firetray.Handler.setIconTooltip = function(toolTipStr) {
  log.debug("setIconTooltip");
  firetray.StatusIcon.setIcon({tip:toolTipStr});
};

firetray.Handler.setIconTooltipDefault = function() {
  log.debug("setIconTooltipDefault");
  firetray.StatusIcon.setIcon({tip:this.appName});
};

firetray.Handler.setIconText = function(text, color) {
  let hicon = firetray.StatusIcon.createTextIcon(
    firetray.StatusIcon.hwndProxy, text, color);
  log.debug("setIconText icon="+hicon);
  if (hicon.isNull())
    log.error("Could not create hicon");
  firetray.StatusIcon.setIcon({hicon:hicon});
};

firetray.Handler.setIconVisibility = function(visible) {
};
