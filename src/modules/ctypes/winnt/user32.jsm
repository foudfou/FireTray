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

  lib.lazy_bind("SendMessageW", win32.LRESULT, win32.HWND, win32.UINT, win32.WPARAM, win32.LPARAM);
  this.WM_GETICON = 0x007F;
  this.WM_SETICON = 0x0080;
  this.ICON_SMALL  = 0;
  this.ICON_BIG    = 1;
  this.ICON_SMALL2 = 2;

  lib.lazy_bind("GetClassLongPtrW", win32.ULONG_PTR, win32.HWND, ctypes.int);
  lib.lazy_bind("GetClassLongW", win32.DWORD, win32.HWND, ctypes.int); // 32-bits
  this.GetClassLong = is64bit ? this.GetClassLongPtrW : this.GetClassLongW;
  this.GCLP_HICONSM = -34;

  lib.lazy_bind("LoadIconW", win32.HICON, win32.HINSTANCE, win32.LPCTSTR); // superseeded by LoadImage
  this.IDI_APPLICATION = win32.MAKEINTRESOURCE(32512);
  this.IDI_HAND        = win32.MAKEINTRESOURCE(32513);
  this.IDI_QUESTION    = win32.MAKEINTRESOURCE(32514);
  this.IDI_EXCLAMATION = win32.MAKEINTRESOURCE(32515);
  this.IDI_ASTERISK    = win32.MAKEINTRESOURCE(32516);
  lib.lazy_bind("LoadImageW", win32.HANDLE, win32.HINSTANCE, win32.LPCTSTR, win32.UINT, ctypes.int, ctypes.int, win32.UINT);
  this.LR_CREATEDIBSECTION = 0x00002000;
  this.LR_DEFAULTCOLOR     = 0x00000000;
  this.LR_DEFAULTSIZE      = 0x00000040;
  this.LR_LOADFROMFILE     = 0x00000010;
  this.LR_LOADMAP3DCOLORS  = 0x00001000;
  this.LR_LOADTRANSPARENT  = 0x00000020;
  this.LR_MONOCHROME       = 0x00000001;
  this.LR_SHARED           = 0x00008000;
  this.LR_VGACOLOR         = 0x00000080;
  lib.lazy_bind("DestroyIcon", win32.BOOL, win32.HICON);

  lib.lazy_bind("GetPropW", win32.HANDLE, win32.HWND, win32.LPCTSTR);
  lib.lazy_bind("SetPropW", win32.BOOL, win32.HWND, win32.LPCTSTR, win32.HANDLE);
  lib.lazy_bind("RemovePropW", win32.HANDLE, win32.HWND, win32.LPCTSTR);

  lib.lazy_bind("GetWindowLongW", win32.LONG_PTR, win32.HWND, ctypes.int);
  lib.lazy_bind("SetWindowLongW", win32.LONG_PTR , win32.HWND, ctypes.int, win32.LONG_PTR);
  // SetWindowLongPtrW aliases SetWindowLongW with the correct signature thank
  // win32.LONG_PTR
  this.GWLP_WNDPROC   = -4;
  this.GWLP_HINSTANCE = -6;
  this.GWLP_ID        = -12;
  this.GWL_STYLE      = -16;
  this.GWL_EXSTYLE    = -20;
  this.GWLP_USERDATA  = -21;
  lib.lazy_bind("SetClassLongW", win32.DWORD , win32.HWND, ctypes.int, win32.LONG); // superseeded by SetClassLongPtrW
  this.GCL_MENUNAME      = -8;
  this.GCL_HBRBACKGROUND = -10;
  this.GCL_HCURSOR       = -12;
  this.GCL_HICON         = -14;
  this.GCL_HMODULE       = -16;
  this.GCL_CBWNDEXTRA    = -18;
  this.GCL_CBCLSEXTRA    = -20;
  this.GCL_WNDPROC       = -24;
  this.GCL_HICONSM       = -34;

  this.WNDPROC = ctypes.FunctionType(
    WinCbABI, win32.LRESULT,
    [win32.HWND, win32.UINT, win32.WPARAM, win32.LPARAM]).ptr;

  // lib.lazy_bind("CallWindowProcW", win32.LRESULT, this.WNDPROC, win32.HWND, win32.UINT, win32.WPARAM, win32.LPARAM);
  lib.lazy_bind("CallWindowProcW", win32.LRESULT, ctypes.voidptr_t, win32.HWND, win32.UINT, win32.WPARAM, win32.LPARAM);
  lib.lazy_bind("DefWindowProcW", win32.LRESULT, win32.HWND, win32.UINT, win32.WPARAM, win32.LPARAM);

  this.WNDCLASSEXW = ctypes.StructType("WNDCLASSEXW", [
    { "cbSize": win32.UINT },
    { "style": win32.UINT },
    { "lpfnWndProc": this.WNDPROC },
    { "cbClsExtra": ctypes.int },
    { "cbWndExtra": ctypes.int },
    { "hInstance": win32.HINSTANCE },
    { "hIcon": win32.HICON },
    { "hCursor": win32.HCURSOR },
    { "hbrBackground": win32.HBRUSH },
    { "lpszMenuName": win32.LPCTSTR },
    { "lpszClassName": win32.LPCTSTR },
    { "hIconSm": win32.HICON }
  ]);

  lib.lazy_bind("RegisterClassExW", win32.ATOM, this.WNDCLASSEXW.ptr);
  lib.lazy_bind("UnregisterClassW", win32.BOOL, win32.LPCTSTR, win32.HINSTANCE);
  lib.lazy_bind("CreateWindowExW", win32.HWND, win32.DWORD, win32.LPCTSTR, win32.LPCTSTR, win32.DWORD, ctypes.int, ctypes.int, ctypes.int, ctypes.int, win32.HWND, win32.HMENU, win32.HINSTANCE, win32.LPVOID);
  lib.lazy_bind("DestroyWindow", win32.BOOL, win32.HWND);
  lib.lazy_bind("ShowWindow", win32.BOOL, win32.HWND, ctypes.int);
  lib.lazy_bind("IsWindowVisible", win32.BOOL, win32.HWND);

  this.SW_HIDE            = 0;
  this.SW_SHOWNORMAL      = 1;
  this.SW_NORMAL          = 1;
  this.SW_SHOWMINIMIZED   = 2;
  this.SW_SHOWMAXIMIZED   = 3;
  this.SW_MAXIMIZE        = 3;
  this.SW_SHOWNOACTIVATE  = 4;
  this.SW_SHOW            = 5;
  this.SW_MINIMIZE        = 6;
  this.SW_SHOWMINNOACTIVE = 7;
  this.SW_SHOWNA          = 8;
  this.SW_RESTORE         = 9;
  this.SW_SHOWDEFAULT     = 10;
  this.SW_FORCEMINIMIZE   = 11;
  this.SW_MAX             = 11;

  this.CW_USEDEFAULT = ctypes.int(0x80000000); // -2147483648

  this.HWND_BROADCAST = win32.HWND(0xffff);
  this.HWND_MESSAGE   = win32.HWND(-3); // WINVER >= 0x0500

  // need to be win32.DWORD()'d after binray operations are applied !
  this.WS_BORDER           = 0x00800000;
  this.WS_CAPTION          = 0x00C00000;
  this.WS_CHILD            = 0x40000000;
  this.WS_CHILDWINDOW      = 0x40000000;
  this.WS_CLIPCHILDREN     = 0x02000000;
  this.WS_CLIPSIBLINGS     = 0x04000000;
  this.WS_DISABLED         = 0x08000000;
  this.WS_DLGFRAME         = 0x00400000;
  this.WS_GROUP            = 0x00020000;
  this.WS_HSCROLL          = 0x00100000;
  this.WS_ICONIC           = 0x20000000;
  this.WS_MAXIMIZE         = 0x01000000;
  this.WS_MAXIMIZEBOX      = 0x00010000;
  this.WS_MINIMIZE         = 0x20000000;
  this.WS_MINIMIZEBOX      = 0x00020000;
  this.WS_OVERLAPPED       = 0x00000000;
  this.WS_POPUP            = 0x80000000;
  this.WS_SIZEBOX          = 0x00040000;
  this.WS_SYSMENU          = 0x00080000;
  this.WS_TABSTOP          = 0x00010000;
  this.WS_THICKFRAME       = 0x00040000;
  this.WS_TILED            = 0x00000000;
  this.WS_VISIBLE          = 0x10000000;
  this.WS_VSCROLL          = 0x00200000;
  this.WS_POPUPWINDOW      = (this.WS_POPUP | this.WS_BORDER | this.WS_SYSMENU);
  this.WS_OVERLAPPEDWINDOW = (this.WS_OVERLAPPED | this.WS_CAPTION | this.WS_SYSMENU | this.WS_THICKFRAME | this.WS_MINIMIZEBOX | this.WS_MAXIMIZEBOX);
  this.WS_TILEDWINDOW      = (this.WS_OVERLAPPED | this.WS_CAPTION | this.WS_SYSMENU | this.WS_THICKFRAME | this.WS_MINIMIZEBOX | this.WS_MAXIMIZEBOX);

  this.CWPSTRUCT = ctypes.StructType("CWPSTRUCT", [
    { "lParam": win32.LPARAM },
    { "wParam": win32.WPARAM },
    { "message": win32.UINT },
    { "hwnd": win32.HWND }
  ]);

  this.CWPRETSTRUCT = ctypes.StructType("CWPRETSTRUCT", [
    { "lResult": win32.LRESULT },
    { "lParam": win32.LPARAM },
    { "wParam": win32.WPARAM },
    { "message": win32.UINT },
    { "hwnd": win32.HWND }
  ]);

  this.HOOKPROC = ctypes.FunctionType(
    WinCbABI, win32.LRESULT,
    [ctypes.int, win32.WPARAM, win32.LPARAM]).ptr;

  lib.lazy_bind("SetWindowsHookExW", win32.HHOOK, ctypes.int, this.HOOKPROC, win32.HINSTANCE, win32.DWORD);
  lib.lazy_bind("CallNextHookEx", win32.LRESULT, win32.HHOOK, ctypes.int, win32.WPARAM, win32.LPARAM);
  lib.lazy_bind("UnhookWindowsHookEx", win32.BOOL, win32.HHOOK);

  this.WH_MIN             = (-1);
  this.WH_MSGFILTER       = (-1);
  this.WH_JOURNALRECORD   = 0;
  this.WH_JOURNALPLAYBACK = 1;
  this.WH_KEYBOARD        = 2;
  this.WH_GETMESSAGE      = 3;
  this.WH_CALLWNDPROC     = 4;
  this.WH_CBT             = 5;
  this.WH_SYSMSGFILTER    = 6;
  this.WH_MOUSE           = 7;
  this.WH_HARDWARE        = 8;
  this.WH_DEBUG           = 9;
  this.WH_SHELL           = 10;
  this.WH_FOREGROUNDIDLE  = 11;
  this.WH_CALLWNDPROCRET  = 12;
  this.WH_KEYBOARD_LL     = 13;
  this.WH_MOUSE_LL        = 14;

  this.HC_ACTION      = 0;
  this.HC_GETNEXT     = 1;
  this.HC_SKIP        = 2;
  this.HC_NOREMOVE    = 3;
  this.HC_NOREM       = this.HC_NOREMOVE;
  this.HC_SYSMODALON  = 4;
  this.HC_SYSMODALOFF = 5;

  lib.lazy_bind("GetWindowThreadProcessId", win32.DWORD, win32.HWND, win32.LPDWORD);

}

new ctypes_library(USER32_LIBNAME, USER32_ABIS, user32_defines, this);
