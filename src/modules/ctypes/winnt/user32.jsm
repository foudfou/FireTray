var EXPORTED_SYMBOLS = [ "user32" ];

const USER32_LIBNAME = "user32";
const USER32_ABIS    = [ "dll" ];

const Cu = Components.utils;

Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://firetray/ctypes/ctypes-utils.jsm");
Cu.import("resource://firetray/ctypes/winnt/types.jsm");

function user32_defines(lib) {

  lib.lazy_bind("GetWindowTextW", ctypes.int, win_t.HWND, win_t.LPTSTR, ctypes.int);
  lib.lazy_bind("FindWindowW", win_t.HWND, win_t.LPCTSTR, win_t.LPCTSTR);

  lib.lazy_bind("SendMessageW", win_t.LRESULT, win_t.HWND, win_t.UINT, win_t.WPARAM, win_t.WPARAM);
  this.WM_GETICON = 0x007F;
  this.ICON_SMALL  = 0;
  this.ICON_BIG    = 1;
  this.ICON_SMALL2 = 2;

  lib.lazy_bind("GetClassLongPtrW", win_t.ULONG_PTR, win_t.HWND, ctypes.int);
  lib.lazy_bind("GetClassLongW", win_t.DWORD, win_t.HWND, ctypes.int); // 32-bits
  this.GetClassLong = is64bit ? this.GetClassLongPtrW : this.GetClassLongW;
  this.GCLP_HICONSM = -34;

  lib.lazy_bind("LoadIconW", win_t.HICON, win_t.HINSTANCE, win_t.LPCTSTR); // superseeded by LoadImage
  this.IDI_APPLICATION = 32512;

  lib.lazy_bind("LoadImageW", win_t.HANDLE, win_t.HINSTANCE, win_t.LPCTSTR,
                win_t.UINT, ctypes.int, ctypes.int, win_t.UINT);
  this.LR_CREATEDIBSECTION = 0x00002000;
  this.LR_DEFAULTCOLOR     = 0x00000000;
  this.LR_DEFAULTSIZE      = 0x00000040;
  this.LR_LOADFROMFILE     = 0x00000010;
  this.LR_LOADMAP3DCOLORS  = 0x00001000;
  this.LR_LOADTRANSPARENT  = 0x00000020;
  this.LR_MONOCHROME       = 0x00000001;
  this.LR_SHARED           = 0x00008000;
  this.LR_VGACOLOR         = 0x00000080;

}

new ctypes_library(USER32_LIBNAME, USER32_ABIS, user32_defines, this);
