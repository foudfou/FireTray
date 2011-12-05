/* -*- Mode: javascript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = [ "x11" ];

const X11_LIBNAME = "X11";
const X11_ABIS    = [ 6 ];

const Cu = Components.utils;
const Cc = Components.classes;
const Ci = Components.interfaces;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://firetray/ctypes-utils.jsm");

function x11_defines(lib) {
  // X.h
  this.UnmapNotify = 18;
  this.MapNotify = 19;
  this.ClientMessage = 33;

  this.Bool = ctypes.int;
  this.Display = ctypes.StructType("Display");
  // union not supported by js-ctypes
  // https://bugzilla.mozilla.org/show_bug.cgi?id=535378 "You can always
  // typecast pointers, at least as long as you know which type is the biggest"
  this.XEvent = ctypes.void_t;
  this.XAnyEvent = ctypes.StructType("XAnyEvent", [
    { "type": ctypes.int },
    { "serial": ctypes.unsigned_long },
    { "send_event": this.Bool },
    { "display": this.Display.ptr },
    { "window": x11.Window }
  ]);
  this.XClientMessageEvent = ctypes.StructType("XClientMessageEvent", [
    { "type": ctypes.int },
    { "serial": ctypes.unsigned_long },
    { "send_event": this.Bool },
    { "display": this.Display.ptr },
    { "window": x11.Window },
    { "message_type": x11.Atom },
    { "format": ctypes.int },
    { "data": ctypes.long.array(5) } // actually a union char b[20]; short s[10]; long l[5];
  ]);

  lib.lazy_bind("XInternAtom", x11.Atom, this.Display.ptr, ctypes.char.ptr, this.Bool);

}

if (!x11) {
  var x11 = {};

  // We *try to guess* the size of Atom and Window...
  try {
    // http://mxr.mozilla.org/mozilla-central/source/configure.in
    if (/^(Alpha|hppa|ia64|ppc64|s390|x86_64)-/.test(Services.appinfo.XPCOMABI)) {
      x11.CARD32 = ctypes.unsigned_int;
      x11.Atom = ctypes.unsigned_long;
      x11.Window = ctypes.unsigned_long;
    } else {
      x11.CARD32 = ctypes.unsigned_long;
      x11.Atom = x11.CARD32;
      x11.Window = x11.CARD32;
    }
  } catch(x) {
    ERROR(x);
  }

  x11 = new ctypes_library(X11_LIBNAME, X11_ABIS, x11_defines);
}

/* Xorg 1.10.4
#if defined (_LP64) || \
    defined(__alpha) || defined(__alpha__) || \
    defined(__ia64__) || defined(ia64) || \
    defined(__sparc64__) || \
    defined(__s390x__) || \
    (defined(__hppa__) && defined(__LP64__)) || \
    defined(__amd64__) || defined(amd64) || \
    defined(__powerpc64__) || \
    (defined(sgi) && (_MIPS_SZLONG == 64))
#define LONG64
#endif

# ifdef LONG64
typedef unsigned long CARD64;
typedef unsigned int CARD32;
# else
typedef unsigned long CARD32;
# endif

#  ifndef _XSERVER64
typedef unsigned long Atom;
#  else
typedef CARD32 Atom;
#  endif
*/

/*
XEvent {
        int type;
        XAnyEvent xany;
        XKeyEvent xkey;
        XButtonEvent xbutton;
        XMotionEvent xmotion;
        XCrossingEvent xcrossing;
        XFocusChangeEvent xfocus;
        XExposeEvent xexpose;
        XGraphicsExposeEvent xgraphicsexpose;
        XNoExposeEvent xnoexpose;
        XVisibilityEvent xvisibility;
        XCreateWindowEvent xcreatewindow;
        XDestroyWindowEvent xdestroywindow;
        XUnmapEvent xunmap;
        XMapEvent xmap;
        XMapRequestEvent xmaprequest;
        XReparentEvent xreparent;
        XConfigureEvent xconfigure;
        XGravityEvent xgravity;
        XResizeRequestEvent xresizerequest;
        XConfigureRequestEvent xconfigurerequest;
        XCirculateEvent xcirculate;
        XCirculateRequestEvent xcirculaterequest;
        XPropertyEvent xproperty;
        XSelectionClearEvent xselectionclear;
        XSelectionRequestEvent xselectionrequest;
        XSelectionEvent xselection;
        XColormapEvent xcolormap;
        XClientMessageEvent xclient;
        XMappingEvent xmapping;
        XErrorEvent xerror;
        XKeymapEvent xkeymap;
        XGenericEvent xgeneric;
        XGenericEventCookie xcookie;
        long pad[24];
}

GdkEvent {
  GdkEventType              type;
  GdkEventAny               any;
  GdkEventExpose            expose;
  GdkEventNoExpose          no_expose;
  GdkEventVisibility        visibility;
  GdkEventMotion            motion;
  GdkEventButton            button;
  GdkEventScroll            scroll;
  GdkEventKey               key;
  GdkEventCrossing          crossing;
  GdkEventFocus             focus_change;
  GdkEventConfigure         configure;
  GdkEventProperty          property;
  GdkEventSelection         selection;
  GdkEventOwnerChange       owner_change;
  GdkEventProximity         proximity;
  GdkEventClient            client;
  GdkEventDND               dnd;
  GdkEventWindowState       window_state;
  GdkEventSetting           setting;
  GdkEventGrabBroken        grab_broken;
};
*/
