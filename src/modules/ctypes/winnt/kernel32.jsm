var EXPORTED_SYMBOLS = [ "kernel32" ];

const KERNEL32_LIBNAME = "kernel32";
const KERNEL32_ABIS    = [ "dll" ];

const Cu = Components.utils;

Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://firetray/ctypes/ctypes-utils.jsm");
Cu.import("resource://firetray/ctypes/winnt/types.jsm");

function kernel32_defines(lib) {

  this.OSVERSIONINFOEXW = ctypes.StructType("OSVERSIONINFOEXW", [
    { "dwOSVersionInfoSize": win_t.DWORD },
    { "dwMajorVersion": win_t.DWORD },
    { "dwMinorVersion": win_t.DWORD },
    { "dwBuildNumber": win_t.DWORD },
    { "dwPlatformId": win_t.DWORD },
    { "szCSDVersion": ctypes.ArrayType(win_t.TCHAR, 128) },
    { "wServicePackMajor": win_t.WORD },
    { "wServicePackMinor": win_t.WORD },
    { "wSuiteMask": win_t.WORD },
    { "wProductType": win_t.BYTE },
    { "wReserved": win_t.BYTE }
  ]);

  // lib.lazy_bind("GetLastError", win_t.DWORD); // use ctypes.winLastError instead
  lib.lazy_bind("GetVersionExW", win_t.BOOL, this.OSVERSIONINFOEXW.ptr);
  lib.lazy_bind("GetConsoleWindow", win_t.HWND);
  lib.lazy_bind("GetConsoleTitleW", win_t.DWORD, win_t.LPTSTR, win_t.DWORD);
  lib.lazy_bind("GetModuleHandleW", win_t.HMODULE, win_t.LPCTSTR);

}

new ctypes_library(KERNEL32_LIBNAME, KERNEL32_ABIS, kernel32_defines, this);
