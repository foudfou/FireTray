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
 * The Original Code is messagingmenu-extension
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

var EXPORTED_SYMBOLS = ["LibGdkWindow"];

const LIB_GDKWINDOW = "libgdk-x11-2.0.so.0";

const Cu = Components.utils;
const Cc = Components.classes;
const Ci = Components.interfaces;

Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://moztray/LibGObject.jsm");

XPCOMUtils.defineLazyGetter(this, "libgdkwindow", function() {
  var libgdkwindow = ctypes.open(LIB_GDKWINDOW);
  if (!libgdkwindow)
    throw "libgdkwindow is unavailable";

  return libgdkwindow;
});

XPCOMUtils.defineLazyGetter(this, "GdkWindow", function() {
  return ctypes.StructType("GdkWindow");
});

XPCOMUtils.defineLazyGetter(this, "GdkVisual", function() {
  return ctypes.StructType("GdkVisual");
});

XPCOMUtils.defineLazyGetter(this, "GdkColormap", function() {
  return ctypes.StructType("GdkColormap");
});

XPCOMUtils.defineLazyGetter(this, "GdkWindowType", function() {
  return ctypes.StructType("GdkWindowType");
});

XPCOMUtils.defineLazyGetter(this, "GdkCursor", function() {
  return ctypes.StructType("GdkCursor");
});

XPCOMUtils.defineLazyGetter(this, "GdkWindowTypeHint", function() {
  return ctypes.StructType("GdkWindowTypeHint");
});

XPCOMUtils.defineLazyGetter(this, "GdkWindowClass", function() {
  return ctypes.StructType("GdkWindowClass");
});

XPCOMUtils.defineLazyGetter(this, "GdkWindowAttributes", function() {
  return ctypes.StructType("GdkWindowAttributes",
                           [ { "title": LibGObject.gchar },
                             { "event_mask": LibGObject.gint },
                             { "x": LibGObject.gint },
                             { "y": LibGObject.gint },
                             { "width": LibGObject.gint },
                             { "height": LibGObject.gint },
                             { "wclass": LibGObject.gint },
                             { "visual": GdkVisual.ptr },
                             { "colormap": GdkColormap.ptr },
                             { "window_type": LibGObject.gint },
                             { "cursor": GdkCursor.ptr },
                             { "wmclass_name": LibGObject.gchar },
                             { "wmclass_class": LibGObject.gchar },
                             { "override_redirect": LibGObject.gboolean },
                             { "type_hint": LibGObject.gint }]);
});

XPCOMUtils.defineLazyGetter(this, "gdk_window_new", function() {
  var gdk_window_new =
    libgdkwindow.declare("gdk_window_new",
                         ctypes.default_abi,
                         GdkWindow.ptr,
                         GdkWindow.ptr,
                         GdkWindowAttributes.ptr,
                         LibGObject.gint);

  if (!gdk_window_new)
    throw "gdk_window_new is unavailable";

  return gdk_window_new;
});

XPCOMUtils.defineLazyGetter(this, "gdk_window_destroy", function() {
  var gdk_window_destroy =
    libgdkwindow.declare("gdk_window_destroy",
                         ctypes.default_abi,
                         ctypes.void_t,
                         GdkWindow.ptr);

  if (!gdk_window_destroy)
    throw "gdk_window_destroy is unavailable";

  return gdk_window_destroy;
});

XPCOMUtils.defineLazyGetter(this, "gdk_x11_window_set_user_time", function() {
  var gdk_x11_window_set_user_time =
    libgdkwindow.declare("gdk_x11_window_set_user_time",
                         ctypes.default_abi,
                         ctypes.void_t,
                         GdkWindow.ptr,
                         LibGObject.guint32);

  if (!gdk_x11_window_set_user_time)
    throw "gdk_x11_window_set_user_time is unavailable";

  return gdk_x11_window_set_user_time;
});

XPCOMUtils.defineLazyGetter(this, "gdk_window_hide", function() {
  var gdk_window_hide =
    libgdkwindow.declare("gdk_window_hide",
                         ctypes.default_abi,
                         ctypes.void_t,
                         GdkWindow.ptr);

  if (!gdk_window_hide)
    throw "gdk_window_hide is unavailable";

  return gdk_window_hide;
});

XPCOMUtils.defineLazyGetter(this, "GdkScreen", function() {
  return ctypes.StructType("GdkScreen");
});

XPCOMUtils.defineLazyGetter(this, "gdk_screen_get_default", function() {
  var gdk_screen_get_default =
    libgdkwindow.declare("gdk_screen_get_default", ctypes.default_abi, GdkScreen.ptr);

  if (!gdk_screen_get_default)
    throw "gdk_screen_get_default is unavailable";

  return gdk_screen_get_default;
});

XPCOMUtils.defineLazyGetter(this, "gdk_screen_get_toplevel_windows", function() {
  var gdk_screen_get_toplevel_windows = libgdkwindow.declare(
    "gdk_screen_get_toplevel_windows", ctypes.default_abi, LibGObject.GList.ptr,
    GdkScreen.ptr
  );

  if (!gdk_screen_get_toplevel_windows)
    throw "gdk_screen_get_toplevel_windows is unavailable";

  return gdk_screen_get_toplevel_windows;
});

var LibGdkWindow = {
  GdkWindow: GdkWindow,
  GdkWindowAttributes: GdkWindowAttributes,
  GdkScreen: GdkScreen,
  GdkX11WindowSetUserTime: gdk_x11_window_set_user_time,
  GdkWindowNew: gdk_window_new,
  GdkWindowDestroy: gdk_window_destroy,
  GdkWindowHide: gdk_window_hide,
  GdkScreenGetDefault: gdk_screen_get_default,
  GdkScreenGetToplevelWindows: gdk_screen_get_toplevel_windows
}
