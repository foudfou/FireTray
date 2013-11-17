var EXPORTED_SYMBOLS = [ "shell32" ];

const SHELL32_LIBNAME = "shell32";
const SHELL32_ABIS    = [ "dll" ];

const Cu = Components.utils;

Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://firetray/ctypes/ctypes-utils.jsm");
Cu.import("resource://firetray/ctypes/winnt/win32.jsm");

function shell32_defines(lib) {

  this.NOTIFYICONDATAW = ctypes.StructType("NOTIFYICONDATAW", [
    { "cbSize": win32.DWORD },
    { "hWnd": win32.HWND },
    { "uID": win32.UINT },
    { "uFlags": win32.UINT },
    { "uCallbackMessage": win32.UINT },
    { "hIcon": win32.HICON },
    { "szTip": ctypes.ArrayType(win32.TCHAR, 64) }, // 128 on win2k+
    { "dwState": win32.DWORD },
    { "dwStateMask": win32.DWORD },
    { "szInfo": ctypes.ArrayType(win32.TCHAR, 256) },
    { "uTimeoutOrVersion": win32.UINT }, // union
    { "szInfoTitle": ctypes.ArrayType(win32.TCHAR, 64) },
    { "dwInfoFlags": win32.DWORD },
    { "guidItem": win32.GUID },
    { "hBalloonIcon": win32.HICON }
  ]);
  this.NOTIFY_VERSION       = 3; // 2K+
  this.NOTIFYICON_VERSION_4 = 4; // Vista+
  this.NOTIFYICONDATA_V1_SIZE = 88;
  this.NOTIFYICONDATA_V2_SIZE = 488; // 2K
  this.NOTIFYICONDATA_V3_SIZE = 504; // XP

  lib.lazy_bind("Shell_NotifyIconW", win32.BOOL, win32.DWORD, this.NOTIFYICONDATAW.ptr);

  // notify icon message
  this.NIM_ADD        = 0x00000000;
  this.NIM_MODIFY     = 0x00000001;
  this.NIM_DELETE     = 0x00000002;
  this.NIM_SETFOCUS   = 0x00000003;
  this.NIM_SETVERSION = 0x00000004;

  // for NOTIFYICONDATAW.uFlags
  this.NIF_MESSAGE  = 0x00000001;
  this.NIF_ICON     = 0x00000002;
  this.NIF_TIP      = 0x00000004;
  this.NIF_STATE    = 0x00000008;
  this.NIF_INFO     = 0x00000010;
  this.NIF_GUID     = 0x00000020;
  this.NIF_REALTIME = 0x00000040;
  this.NIF_SHOWTIP  = 0x00000080;

}

new ctypes_library(SHELL32_LIBNAME, SHELL32_ABIS, shell32_defines, this);
