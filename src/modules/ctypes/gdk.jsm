/* -*- Mode: javascript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 *	 Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Firetray
 *
 * The Initial Developer of the Original Code is
 * Mozilla Messaging, Ltd.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *    Mike Conley <mconley@mozillamessaging.com>
 *    Foudil Brétel <foudil.newbie+amo@gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

var EXPORTED_SYMBOLS = [ "gdk" ];

const GDK_LIBNAME = "gdk-x11-2.0";
const GDK_ABIS    = [ 0 ];

const Cu = Components.utils;
const Cc = Components.classes;
const Ci = Components.interfaces;

Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://firetray/ctypes/ctypes-utils.jsm");
Cu.import("resource://firetray/ctypes/cairo.jsm");
Cu.import("resource://firetray/ctypes/glib.jsm");
Cu.import("resource://firetray/ctypes/gobject.jsm");
Cu.import("resource://firetray/ctypes/x11.jsm");

function gdk_defines(lib) {
  this.GdkInterpType = ctypes.int; // enum
  this.GDK_INTERP_NEAREST = 0;
  this.GdkFilterReturn = ctypes.int; // enum
  this.GDK_FILTER_CONTINUE  = 0;
  this.GDK_FILTER_TRANSLATE = 1;
  this.GDK_FILTER_REMOVE    = 2;
  this.GdkWindowState = ctypes.int; // enum
  this.GDK_WINDOW_STATE_WITHDRAWN  = 1 << 0,
  this.GDK_WINDOW_STATE_ICONIFIED  = 1 << 1,
  this.GDK_WINDOW_STATE_MAXIMIZED  = 1 << 2,
  this.GDK_WINDOW_STATE_STICKY     = 1 << 3,
  this.GDK_WINDOW_STATE_FULLSCREEN = 1 << 4,
  this.GDK_WINDOW_STATE_ABOVE      = 1 << 5,
  this.GDK_WINDOW_STATE_BELOW      = 1 << 6;
  this.GdkEventType = ctypes.int; // enum
  this.GDK_NOTHING           = -1;
  this.GDK_DELETE            = 0;
  this.GDK_DESTROY           = 1;
  this.GDK_EXPOSE            = 2;
  this.GDK_MOTION_NOTIFY     = 3;
  this.GDK_BUTTON_PRESS      = 4;
  this.GDK_2BUTTON_PRESS     = 5;
  this.GDK_3BUTTON_PRESS     = 6;
  this.GDK_BUTTON_RELEASE    = 7;
  this.GDK_KEY_PRESS         = 8;
  this.GDK_KEY_RELEASE       = 9;
  this.GDK_ENTER_NOTIFY      = 10;
  this.GDK_LEAVE_NOTIFY      = 11;
  this.GDK_FOCUS_CHANGE      = 12;
  this.GDK_CONFIGURE         = 13;
  this.GDK_MAP               = 14;
  this.GDK_UNMAP             = 15;
  this.GDK_PROPERTY_NOTIFY   = 16;
  this.GDK_SELECTION_CLEAR   = 17;
  this.GDK_SELECTION_REQUEST = 18;
  this.GDK_SELECTION_NOTIFY  = 19;
  this.GDK_PROXIMITY_IN      = 20;
  this.GDK_PROXIMITY_OUT     = 21;
  this.GDK_DRAG_ENTER        = 22;
  this.GDK_DRAG_LEAVE        = 23;
  this.GDK_DRAG_MOTION       = 24;
  this.GDK_DRAG_STATUS       = 25;
  this.GDK_DROP_START        = 26;
  this.GDK_DROP_FINISHED     = 27;
  this.GDK_CLIENT_EVENT      = 28;
  this.GDK_VISIBILITY_NOTIFY = 29;
  this.GDK_NO_EXPOSE         = 30;
  this.GDK_SCROLL            = 31;
  this.GDK_WINDOW_STATE      = 32;
  this.GDK_SETTING           = 33;
  this.GDK_OWNER_CHANGE      = 34;
  this.GDK_GRAB_BROKEN       = 35;
  this.GDK_DAMAGE            = 36;
  this.GDK_EVENT_LAST = 37;      /* helper variable for decls */

  this.GdkWindow = ctypes.StructType("GdkWindow");
  this.GdkByteOrder = ctypes.int; // enum
  this.GdkVisualType = ctypes.int; // enum
  this.GdkVisual = ctypes.StructType("GdkVisual", [
    { "parent_instance": gobject.GObject },
    { "type": this.GdkVisualType },
    { "depth": gobject.gint },
    { "byte": this.GdkByteOrder },
    { "colormap": gobject.gint },
    { "bits": gobject.gint },
    { "red_mask": gobject.guint32 },
    { "red_shift": gobject.gint },
    { "red_prec": gobject.gint },
    { "green_mask": gobject.guint32 },
    { "green_shift": gobject.gint },
    { "green_prec": gobject.gint },
    { "blue_mask": gobject.guint32 },
    { "blue_shift": gobject.gint },
    { "blue_prec": gobject.gint }
  ]);
  this.GdkColor = ctypes.StructType("GdkColor", [
    { "pixel": gobject.guint32 },
    { "red": gobject.guint16 },
    { "green": gobject.guint16 },
    { "blue": gobject.guint16 }
  ]);
  this.GdkColormap = ctypes.StructType("GdkColormap", [
    { "size": gobject.gint },
    { "colors": this.GdkColor.ptr }
  ]);
  this.GdkWindowType = ctypes.StructType("GdkWindowType");
  this.GdkCursor = ctypes.StructType("GdkCursor");
  this.GdkWindowTypeHint = ctypes.StructType("GdkWindowTypeHint");
  this.GdkWindowClass = ctypes.StructType("GdkWindowClass");
  this.GdkWindowAttributes = ctypes.StructType("GdkWindowAttributes", [
    { "title": gobject.gchar },
    { "event_mask": gobject.gint },
    { "x": gobject.gint },
    { "y": gobject.gint },
    { "width": gobject.gint },
    { "height": gobject.gint },
    { "wclass": gobject.gint },
    { "visual": this.GdkVisual.ptr },
    { "colormap": this.GdkColormap.ptr },
    { "window_type": gobject.gint },
    { "cursor": this.GdkCursor.ptr },
    { "wmclass_name": gobject.gchar },
    { "wmclass_class": gobject.gchar },
    { "override_redirect": gobject.gboolean },
    { "type_hint": gobject.gint }
  ]);
  this.GdkPixbuf = ctypes.StructType("GdkPixbuf");
  this.GdkScreen = ctypes.StructType("GdkScreen");
  this.GdkPixmap = ctypes.StructType("GdkPixmap");
  this.GdkDrawable = ctypes.StructType("GdkDrawable");
  this.GdkGC = ctypes.StructType("GdkGC");
  this.GdkXEvent = ctypes.void_t; // will probably be cast to XEvent
  this.GdkEvent = ctypes.void_t;
  this.GdkDisplay = ctypes.StructType("GdkDisplay");
  this.GdkFilterFunc = ctypes.voidptr_t;
  this.GdkEventWindowState = ctypes.StructType("GdkEventWindowState", [
    { "type": this.GdkEventType },
    { "window": this.GdkWindow.ptr },
    { "send_event": gobject.gint8 },
    { "changed_mask": this.GdkWindowState },
    { "new_window_state": this.GdkWindowState },
  ]);

  this.GdkFilterFunc_t = ctypes.FunctionType(
    ctypes.default_abi, this.GdkFilterReturn,
    [this.GdkXEvent.ptr, this.GdkEvent.ptr, gobject.gpointer]).ptr;

  lib.lazy_bind("gdk_x11_drawable_get_xid", x11.XID, this.GdkDrawable.ptr);
  lib.lazy_bind("gdk_window_new", this.GdkWindow.ptr, this.GdkWindow.ptr, this.GdkWindowAttributes.ptr, gobject.gint);
  lib.lazy_bind("gdk_window_destroy", ctypes.void_t, this.GdkWindow.ptr);
  lib.lazy_bind("gdk_x11_window_set_user_time", ctypes.void_t, this.GdkWindow.ptr, gobject.guint32);
  lib.lazy_bind("gdk_window_hide", ctypes.void_t, this.GdkWindow.ptr);
  lib.lazy_bind("gdk_window_show_unraised", ctypes.void_t, this.GdkWindow.ptr);
  lib.lazy_bind("gdk_screen_get_default", this.GdkScreen.ptr);
  lib.lazy_bind("gdk_screen_get_toplevel_windows", gobject.GList.ptr, this.GdkScreen.ptr);
  lib.lazy_bind("gdk_pixbuf_new_from_file", this.GdkPixbuf.ptr, gobject.gchar.ptr, glib.GError.ptr.ptr);
  lib.lazy_bind("gdk_pixbuf_copy", this.GdkPixbuf.ptr, this.GdkPixbuf.ptr);
  lib.lazy_bind("gdk_pixbuf_get_width", ctypes.int, this.GdkPixbuf.ptr);
  lib.lazy_bind("gdk_pixbuf_get_height", ctypes.int, this.GdkPixbuf.ptr);
  lib.lazy_bind("gdk_pixbuf_composite", ctypes.void_t, this.GdkPixbuf.ptr, this.GdkPixbuf.ptr, ctypes.int, ctypes.int, ctypes.int, ctypes.int, ctypes.double, ctypes.double, ctypes.double, ctypes.double, ctypes.int, ctypes.int);
  lib.lazy_bind("gdk_screen_get_system_colormap", this.GdkColormap.ptr, this.GdkScreen.ptr);
  lib.lazy_bind("gdk_colormap_get_visual", this.GdkVisual.ptr, this.GdkColormap.ptr);
  lib.lazy_bind("gdk_color_parse", gobject.gboolean, gobject.gchar.ptr, this.GdkColor.ptr);
  lib.lazy_bind("gdk_colormap_alloc_color", gobject.gboolean, this.GdkColormap.ptr, this.GdkColor.ptr, gobject.gboolean, gobject.gboolean);
  lib.lazy_bind("gdk_pixmap_new", this.GdkPixmap.ptr, this.GdkDrawable.ptr, gobject.gint, gobject.gint, gobject.gint);

  // DEPRECATED
  // lib.lazy_bind("gdk_gc_new", this.GdkGC.ptr, this.GdkDrawable.ptr);
  // lib.lazy_bind("gdk_gc_set_foreground", ctypes.void_t, this.GdkGC.ptr, this.GdkColor.ptr);
  // lib.lazy_bind("gdk_draw_rectangle", ctypes.void_t, this.GdkDrawable.ptr, this.GdkGC.ptr, gobject.gboolean, gobject.gint, gobject.gint, gobject.gint, gobject.gint);

  lib.lazy_bind("gdk_cairo_create", cairo.cairo_t.ptr, this.GdkDrawable.ptr);
  lib.lazy_bind("gdk_cairo_set_source_color", ctypes.void_t, cairo.cairo_t.ptr, this.GdkColor.ptr);
  lib.lazy_bind("gdk_pixbuf_get_from_drawable", this.GdkPixbuf.ptr, this.GdkPixbuf.ptr, this.GdkDrawable.ptr, this.GdkColormap.ptr, ctypes.int, ctypes.int, ctypes.int, ctypes.int, ctypes.int, ctypes.int);
  lib.lazy_bind("gdk_pixbuf_add_alpha", this.GdkPixbuf.ptr, this.GdkPixbuf.ptr, gobject.gboolean, gobject.guchar, gobject.guchar, gobject.guchar);
  lib.lazy_bind("gdk_pixbuf_composite", ctypes.void_t, this.GdkPixbuf.ptr, this.GdkPixbuf.ptr, ctypes.int, ctypes.int, ctypes.int, ctypes.int, ctypes.double, ctypes.double, ctypes.double, ctypes.double, this.GdkInterpType, ctypes.int);

  lib.lazy_bind("gdk_window_stick", ctypes.void_t, this.GdkWindow.ptr);
  lib.lazy_bind("gdk_window_iconify", ctypes.void_t, this.GdkWindow.ptr);
  lib.lazy_bind("gdk_window_set_title", ctypes.void_t, this.GdkWindow.ptr, gobject.gchar.ptr);
  lib.lazy_bind("gdk_window_beep", ctypes.void_t, this.GdkWindow.ptr);
  lib.lazy_bind("gdk_window_get_width", ctypes.int, this.GdkWindow.ptr);

  lib.lazy_bind("gdk_window_add_filter", ctypes.void_t, this.GdkWindow.ptr, this.GdkFilterFunc, gobject.gpointer);
  lib.lazy_bind("gdk_display_get_default", this.GdkDisplay.ptr);
  lib.lazy_bind("gdk_x11_display_get_xdisplay", x11.Display.ptr, this.GdkDisplay.ptr);
  lib.lazy_bind("gdk_window_get_state", this.GdkWindowState, this.GdkWindow.ptr);
  lib.lazy_bind("gdk_window_get_position", ctypes.void_t, this.GdkWindow.ptr, gobject.gint.ptr, gobject.gint.ptr);
  lib.lazy_bind("gdk_drawable_get_size", ctypes.void_t, this.GdkDrawable.ptr, gobject.gint.ptr, gobject.gint.ptr);
  // lib.lazy_bind("gdk_window_get_geometry", ctypes.void_t, this.GdkWindow.ptr, gobject.gint.ptr, gobject.gint.ptr, gobject.gint.ptr, gobject.gint.ptr, gobject.gint.ptr);
  lib.lazy_bind("gdk_window_move_resize", ctypes.void_t, this.GdkWindow.ptr, gobject.gint, gobject.gint, gobject.gint, gobject.gint);

}

if (!gdk) {
  var gdk = new ctypes_library(GDK_LIBNAME, GDK_ABIS, gdk_defines);
}
