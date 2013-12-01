var EXPORTED_SYMBOLS = [ "win32" ];

const Cu = Components.utils;

Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://firetray/ctypes/ctypes-utils.jsm");


var win32 = new function() {

  this.WIN_VERSIONS = { // maj*10 + min
    '8':     62,    // 2012
    '7':     61,    // 2009
    'Vista': 60,    // 2007
    'XP':    51,    // 2001
    '2K':    50,    // 2000
  };
  this.WINVER = null;                 // initialized in kernel32.jsm

  this.BOOL      = ctypes.bool;
  this.BYTE      = ctypes.unsigned_char;
  this.INT_PTR   = is64bit ? ctypes.int64_t  : ctypes.int;
  this.UINT      = ctypes.unsigned_int;
  this.UINT_PTR  = is64bit ? ctypes.uint64_t : ctypes.unsigned_int;
  this.WORD      = ctypes.unsigned_short;
  this.DWORD     = ctypes.unsigned_long;
  this.PVOID     = ctypes.voidptr_t;
  this.LPVOID    = ctypes.voidptr_t;
  this.LONG      = ctypes.long;
  this.LONG_PTR  = is64bit ? ctypes.int64_t  : ctypes.long;
  this.ULONG_PTR = is64bit ? ctypes.uint64_t : ctypes.unsigned_long;
  this.SIZE_T    = this.ULONG_PTR;
  this.ATOM      = this.WORD;
  this.HANDLE    = ctypes.voidptr_t;
  this.HWND      = this.HANDLE;
  this.HICON     = this.HANDLE;
  this.HINSTANCE = this.HANDLE;
  this.HMODULE   = this.HANDLE;
  this.HMENU     = this.HANDLE;
  this.HBRUSH    = this.HICON;
  this.HCURSOR   = this.HANDLE;
  this.HHOOK     = this.HANDLE;
  this.TCHAR     = ctypes.jschar, // Mozilla compiled with UNICODE/_UNICODE macros and wchar_t = jschar
  this.LPSTR     = ctypes.char.ptr;
  this.LPCSTR    = ctypes.char.ptr;
  this.LPTSTR    = ctypes.jschar.ptr; // UNICODE
  this.LPCTSTR   = ctypes.jschar.ptr;
  this.LPCWSTR   = ctypes.jschar.ptr;
  this.LPWSTR    = ctypes.jschar.ptr; // WCHAR
  this.LRESULT   = this.LONG_PTR;
  this.WPARAM    = this.UINT_PTR;
  this.LPARAM    = this.LONG_PTR;
  this.FARPROC   = ctypes.voidptr_t; // typedef INT_PTR (FAR WINAPI *FARPROC)();

  this.GUID = ctypes.StructType("GUID", [
    { "Data1": ctypes.unsigned_long },
    { "Data2": ctypes.unsigned_short },
    { "Data3": ctypes.unsigned_short },
    { "Data4": ctypes.char.array(8) }
  ]);

  /*
   * #define MAKEINTRESOURCEA(i) ((LPSTR)((ULONG_PTR)((WORD)(i))))
   * #define MAKEINTRESOURCEW(i) ((LPWSTR)((ULONG_PTR)((WORD)(i))))
   */
  this.MAKEINTRESOURCE = function(i) {return this.LPWSTR(i);};

  this._T = function(str) {
    return ctypes.jschar.array()(str);
  };

  this.ERROR_INVALID_WINDOW_HANDLE   = 1400;
  this.ERROR_RESOURCE_TYPE_NOT_FOUND = 1813;

  // WinUser.h
  this.WM_USER          = 0x0400;
  this.WM_APP           = 0x8000;

  this.WM_CONTEXTMENU   = 0x007B;

  this.WM_MOUSEFIRST    = 0x0200;
  this.WM_MOUSEMOVE     = 0x0200;
  this.WM_LBUTTONDOWN   = 0x0201;
  this.WM_LBUTTONUP     = 0x0202;
  this.WM_LBUTTONDBLCLK = 0x0203;
  this.WM_RBUTTONDOWN   = 0x0204;
  this.WM_RBUTTONUP     = 0x0205;
  this.WM_RBUTTONDBLCLK = 0x0206;
  this.WM_MBUTTONDOWN   = 0x0207;
  this.WM_MBUTTONUP     = 0x0208;
  this.WM_MBUTTONDBLCLK = 0x0209;
  this.WM_MOUSEWHEEL    = 0x020A;
  this.WM_XBUTTONDOWN   = 0x020B;
  this.WM_XBUTTONUP     = 0x020C;
  this.WM_XBUTTONDBLCLK = 0x020D;
  this.WM_MOUSELAST     = 0x020D;
  this.WM_MOUSELAST     = 0x020A;

};

// ShellAPI.h
let nin_select = win32.WM_USER + 0;
win32.NIN_SELECT = nin_select;
win32.NINF_KEY = 0x1;
win32.NIN_KEYSELECT = (win32.NIN_SELECT | win32.NINF_KEY);
