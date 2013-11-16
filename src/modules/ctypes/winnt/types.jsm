var EXPORTED_SYMBOLS = [ "win_t" ];

const Cu = Components.utils;

Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://firetray/ctypes/ctypes-utils.jsm");

const UINT_PTR_T  = is64bit ? ctypes.uint64_t : ctypes.unsigned_int;
const LONG_PTR_T  = is64bit ? ctypes.int64_t  : ctypes.long;
const ULONG_PTR_T = is64bit ? ctypes.uint64_t : ctypes.unsigned_long;
const HANDLE_T    = ctypes.voidptr_t; // oder ctypes.intptr_t, ctypes.size_t,

var win_t = {

  BOOL: ctypes.bool,
  BYTE: ctypes.unsigned_char,
  UINT: ctypes.unsigned_int,
  WORD: ctypes.unsigned_short,
  DWORD: ctypes.unsigned_long,
  PVOID: ctypes.voidptr_t,
  ULONG_PTR: ULONG_PTR_T,
  SIZE_T: ULONG_PTR_T,
  HWND: HANDLE_T,
  HICON: HANDLE_T,
  HINSTANCE: HANDLE_T,
  HMODULE: HANDLE_T,
  TCHAR: ctypes.jschar, // Mozilla compiled with UNICODE/_UNICODE macros and wchar_t: jschar
  LPSTR: ctypes.char.ptr,
  LPCSTR: ctypes.char.ptr,
  LPTSTR: ctypes.jschar.ptr,    // UNICODE
  LPCTSTR: ctypes.jschar.ptr,
  LPCWSTR: ctypes.jschar.ptr,
  LPWSTR: ctypes.jschar.ptr,      // WCHAR
  LRESULT: LONG_PTR_T,
  WPARAM: UINT_PTR_T,
  LPARAM: LONG_PTR_T,

  GUID: ctypes.StructType("GUID", [
    { "Data1": ctypes.unsigned_long },
    { "Data2": ctypes.unsigned_short },
    { "Data3": ctypes.unsigned_short },
    { "Data4": ctypes.char.array(8) }
  ]),

  /*
   * #define MAKEINTRESOURCEA(i) ((LPSTR)((ULONG_PTR)((WORD)(i))))
   * #define MAKEINTRESOURCEW(i) ((LPWSTR)((ULONG_PTR)((WORD)(i))))
   */
  MAKEINTRESOURCE: function(i) {return this.LPWSTR(i); }

};
