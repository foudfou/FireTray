var EXPORTED_SYMBOLS = [ "gdi32" ];

const GDI32_LIBNAME = "gdi32";
const GDI32_ABIS    = [ "dll" ];

const Cu = Components.utils;

Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://firetray/ctypes/ctypes-utils.jsm");
Cu.import("resource://firetray/ctypes/winnt/win32.jsm");

function gdi32_defines(lib) {

  this.BITMAP = ctypes.StructType("BITMAP", [
    { "bmType": win32.LONG },
    { "bmWidth": win32.LONG },
    { "bmHeight": win32.LONG },
    { "bmWidthBytes": win32.LONG },
    { "bmPlanes": win32.WORD },
    { "bmBitsPixel": win32.WORD },
    { "bmBits": win32.LPVOID }
  ]);
  this.PBITMAP = this.BITMAP.ptr;

  lib.lazy_bind("CreateCompatibleDC", win32.HDC, win32.HDC);
  lib.lazy_bind("DeleteDC", win32.BOOL, win32.HDC);
  lib.lazy_bind("CreateCompatibleBitmap", win32.HBITMAP, win32.HDC, ctypes.int, ctypes.int);
  lib.lazy_bind("SelectObject", win32.HGDIOBJ, win32.HDC, win32.HGDIOBJ);
  lib.lazy_bind("DeleteObject", win32.BOOL, win32.HGDIOBJ);
  lib.lazy_bind("PatBlt", win32.BOOL, win32.HDC, ctypes.int, ctypes.int, ctypes.int, ctypes.int, win32.DWORD);
  this.BLACKNESS = win32.DWORD(0x00000042); /* dest = BLACK */
  this.WHITENESS = win32.DWORD(0x00FF0062); /* dest = WHITE */
  lib.lazy_bind("CreateFontW", win32.HFONT, ctypes.int, ctypes.int, ctypes.int, ctypes.int, ctypes.int, win32.DWORD, win32.DWORD, win32.DWORD, win32.DWORD, win32.DWORD, win32.DWORD, win32.DWORD, win32.DWORD, win32.LPCWSTR);
  this.FW_DONTCARE   = 0;
  this.FW_THIN       = 100;
  this.FW_EXTRALIGHT = 200;
  this.FW_LIGHT      = 300;
  this.FW_NORMAL     = 400;
  this.FW_MEDIUM     = 500;
  this.FW_SEMIBOLD   = 600;
  this.FW_BOLD       = 700;
  this.FW_EXTRABOLD  = 800;
  this.FW_HEAVY      = 900;
  this.FF_DONTCARE   = (0<<4);  /* Don't care or don't know. */
  this.FF_ROMAN      = (1<<4);  /* Variable stroke width, serifed. Times Roman, Century Schoolbook, etc. */
  this.FF_SWISS      = (2<<4);  /* Variable stroke width, sans-serifed. Helvetica, Swiss, etc. */
  this.FF_MODERN     = (3<<4);  /* Constant stroke width, serifed or sans-serifed. Pica, Elite, Courier, etc. */
  this.FF_SCRIPT     = (4<<4);  /* Cursive, etc. */
  this.FF_DECORATIVE = (5<<4);  /* Old English, etc. */
  this.DEFAULT_PITCH  = 0;
  this.FIXED_PITCH    = 1;
  this.VARIABLE_PITCH = 2;
  this.MONO_FONT      = 8;
  this.ANSI_CHARSET        = 0;
  this.DEFAULT_CHARSET     = 1;
  this.SYMBOL_CHARSET      = 2;
  this.SHIFTJIS_CHARSET    = 128;
  this.HANGEUL_CHARSET     = 129;
  this.HANGUL_CHARSET      = 129;
  this.GB2312_CHARSET      = 134;
  this.CHINESEBIG5_CHARSET = 136;
  this.OEM_CHARSET         = 255;
  this.JOHAB_CHARSET       = 130;
  this.HEBREW_CHARSET      = 177;
  this.ARABIC_CHARSET      = 178;
  this.GREEK_CHARSET       = 161;
  this.TURKISH_CHARSET     = 162;
  this.VIETNAMESE_CHARSET  = 163;
  this.THAI_CHARSET        = 222;
  this.EASTEUROPE_CHARSET  = 238;
  this.RUSSIAN_CHARSET     = 204;
  lib.lazy_bind("SetTextColor", win32.COLORREF, win32.HDC, win32.COLORREF);
  lib.lazy_bind("SetBkMode", ctypes.int, win32.HDC, ctypes.int);
  this.TRANSPARENT = 1;
  this.OPAQUE      = 2;
  this.BKMODE_LAST = 2;

  lib.lazy_bind("TextOutW", win32.BOOL, win32.HDC, ctypes.int, ctypes.int, win32.LPCTSTR, ctypes.int);

  lib.lazy_bind("GetTextAlign", win32.UINT, win32.HDC);
  lib.lazy_bind("SetTextAlign", win32.UINT, win32.HDC, win32.UINT);
  this.TA_LEFT       = 0;
  this.TA_RIGHT      = 2;
  this.TA_CENTER     = 6;
  this.TA_TOP        = 0;
  this.TA_BOTTOM     = 8;
  this.TA_BASELINE   = 24;
  this.TA_RTLREADING = 256;
  this.TA_MASK       =(this.TA_BASELINE+this.TA_CENTER+this.TA_UPDATECP+this.TA_RTLREADING);

}

new ctypes_library(GDI32_LIBNAME, GDI32_ABIS, gdi32_defines, this);
