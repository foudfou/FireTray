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
Cu.import("resource://firetray/ctypes-utils.jsm");
Cu.import("resource://firetray/cairo.jsm");
Cu.import("resource://firetray/glib.jsm");
Cu.import("resource://firetray/gobject.jsm");
Cu.import("resource://firetray/x11.jsm");

function gdk_defines(lib) {
  this.GdkInterpType = ctypes.int; // enum
  this.GDK_INTERP_NEAREST = 0;
  this.GdkFilterReturn = ctypes.int; // enum
  this.GDK_FILTER_CONTINUE  = 0;
  this.GDK_FILTER_TRANSLATE = 1;
  this.GDK_FILTER_REMOVE    = 2;
  this.GdkWindowState = ctypes.int; // enum
  this.GDK_WINDOW_STATE_ICONIFIED = 2;
  this.GDK_WINDOW_STATE_MAXIMIZED = 4;

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

  this.GdkFilterFunc_t = ctypes.FunctionType(
    ctypes.default_abi, this.GdkFilterReturn,
    [this.GdkXEvent.ptr, this.GdkEvent.ptr, gobject.gpointer]).ptr;

  lib.lazy_bind("gdk_window_new", this.GdkWindow.ptr, this.GdkWindow.ptr, this.GdkWindowAttributes.ptr, gobject.gint);
  lib.lazy_bind("gdk_window_destroy", ctypes.void_t, this.GdkWindow.ptr);
  lib.lazy_bind("gdk_x11_window_set_user_time", ctypes.void_t, this.GdkWindow.ptr, gobject.guint32);
  lib.lazy_bind("gdk_window_hide", ctypes.void_t, this.GdkWindow.ptr);
  lib.lazy_bind("gdk_window_show", ctypes.void_t, this.GdkWindow.ptr);
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
}

if (!gdk) {
  var gdk = new ctypes_library(GDK_LIBNAME, GDK_ABIS, gdk_defines);
}
