var EXPORTED_SYMBOLS = [ "user32" ];

const USER32_LIBNAME = "user32";
const USER32_ABIS    = [ "dll" ];

const Cu = Components.utils;

Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://firetray/ctypes/ctypes-utils.jsm");
Cu.import("resource://firetray/ctypes/winnt/win32.jsm");

function user32_defines(lib) {

  this.CHANGEFILTERSTRUCT = ctypes.StructType("CHANGEFILTERSTRUCT", [
    { "cbSize": win32.DWORD },
    { "ExtStatus": win32.DWORD }
  ]);
  this.MSGFLTINFO_NONE                     = 0;
  this.MSGFLTINFO_ALLOWED_HIGHER           = 3;
  this.MSGFLTINFO_ALREADYALLOWED_FORWND    = 1;
  this.MSGFLTINFO_ALREADYDISALLOWED_FORWND = 2;

  lib.lazy_bind("ChangeWindowMessageFilter", win32.BOOL, win32.UINT, win32.DWORD);
  this.MSGFLT_ADD    = 1;
  this.MSGFLT_REMOVE = 2;
  lib.lazy_bind("ChangeWindowMessageFilterEx", win32.BOOL, win32.HWND, win32.UINT, win32.DWORD, this.CHANGEFILTERSTRUCT.ptr);
  this.MSGFLT_ALLOW    = 1;
  this.MSGFLT_DISALLOW = 2;
  this.MSGFLT_RESET    = 0;

  lib.lazy_bind("RegisterWindowMessageW", win32.UINT, win32.LPCTSTR);
  lib.lazy_bind("GetWindowTextW", ctypes.int, win32.HWND, win32.LPTSTR, ctypes.int);
  lib.lazy_bind("FindWindowW", win32.HWND, win32.LPCTSTR, win32.LPCTSTR);

  lib.lazy_bind("SendMessageW", win32.LRESULT, win32.HWND, win32.UINT, win32.WPARAM, win32.WPARAM);
  this.WM_GETICON = 0x007F;
  this.ICON_SMALL  = 0;
  this.ICON_BIG    = 1;
  this.ICON_SMALL2 = 2;

  lib.lazy_bind("GetClassLongPtrW", win32.ULONG_PTR, win32.HWND, ctypes.int);
  lib.lazy_bind("GetClassLongW", win32.DWORD, win32.HWND, ctypes.int); // 32-bits
  this.GetClassLong = is64bit ? this.GetClassLongPtrW : this.GetClassLongW;
  this.GCLP_HICONSM = -34;

  lib.lazy_bind("LoadIconW", win32.HICON, win32.HINSTANCE, win32.LPCTSTR); // superseeded by LoadImage
  this.IDI_APPLICATION = 32512;

  lib.lazy_bind("LoadImageW", win32.HANDLE, win32.HINSTANCE, win32.LPCTSTR,
                win32.UINT, ctypes.int, ctypes.int, win32.UINT);
  this.LR_CREATEDIBSECTION = 0x00002000;
  this.LR_DEFAULTCOLOR     = 0x00000000;
  this.LR_DEFAULTSIZE      = 0x00000040;
  this.LR_LOADFROMFILE     = 0x00000010;
  this.LR_LOADMAP3DCOLORS  = 0x00001000;
  this.LR_LOADTRANSPARENT  = 0x00000020;
  this.LR_MONOCHROME       = 0x00000001;
  this.LR_SHARED           = 0x00008000;
  this.LR_VGACOLOR         = 0x00000080;

  lib.lazy_bind("SetWindowLongPtrW", win32.LONG_PTR , win32.HWND, ctypes.int, win32.LONG_PTR);
  lib.lazy_bind("SetWindowLongW", win32.LONG , win32.HWND, ctypes.int, win32.LONG);
  this.SetWindowLong = is64bit ? this.SetWindowLongPtrW : this.SetWindowLongW;
  this.GWL_EXSTYLE = -20;
  this.GWLP_HINSTANCE = -6;
  this.GWLP_ID = -12;
  this.GWL_STYLE = -16;
  this.GWLP_USERDATA = -21;
  this.GWLP_WNDPROC = -4;

  this.WNDPROC = ctypes.FunctionType(
    WinCbABI, win32.LRESULT,
    [win32.HWND, win32.UINT, win32.WPARAM, win32.LPARAM]).ptr;

  lib.lazy_bind("CallWindowProcW", win32.LRESULT, this.WNDPROC, win32.HWND, win32.UINT, win32.WPARAM, win32.LPARAM);
  lib.lazy_bind("DefWindowProcW", win32.LRESULT, win32.HWND, win32.UINT, win32.WPARAM, win32.LPARAM);

}

new ctypes_library(USER32_LIBNAME, USER32_ABIS, user32_defines, this);
