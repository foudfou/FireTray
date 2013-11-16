var EXPORTED_SYMBOLS = [ "shell32" ];

const SHELL32_LIBNAME = "shell32";
const SHELL32_ABIS    = [ "dll" ];

const Cu = Components.utils;

Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://firetray/ctypes/ctypes-utils.jsm");
Cu.import("resource://firetray/ctypes/winnt/types.jsm");

function shell32_defines(lib) {

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

  this.NOTIFYICONDATAW = ctypes.StructType("NOTIFYICONDATAW", [
    { "cbSize": win_t.DWORD },
    { "hWnd": win_t.HWND },
    { "uID": win_t.UINT },
    { "uFlags": win_t.UINT },
    { "uCallbackMessage": win_t.UINT },
    { "hIcon": win_t.HICON },
    { "szTip": ctypes.ArrayType(win_t.TCHAR, 64) }, // 128 on win2k+
    { "dwState": win_t.DWORD },
    { "dwStateMask": win_t.DWORD },
    { "szInfo": ctypes.ArrayType(win_t.TCHAR, 256) },
    { "uTimeoutOrVersion": win_t.UINT }, // union
    { "szInfoTitle[64]": win_t.TCHAR },
    { "dwInfoFlags": win_t.DWORD },
    { "guidItem": win_t.GUID },
    { "hBalloonIcon": win_t.HICON }
  ]);

  lib.lazy_bind("Shell_NotifyIconW", win_t.BOOL, win_t.DWORD, this.NOTIFYICONDATAW.ptr);

}

new ctypes_library(SHELL32_LIBNAME, SHELL32_ABIS, shell32_defines, this);
