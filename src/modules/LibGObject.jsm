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

var EXPORTED_SYMBOLS = ["LibGObject"];

const LIB_GOBJECT = "libgobject-2.0.so.0";

const Cu = Components.utils;
const Cc = Components.classes;
const Ci = Components.interfaces;

Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyGetter(this, "libgobject", function() {
  var libgobject = ctypes.open(LIB_GOBJECT);
  if (!libgobject)
    throw "libgobject is unavailable";

  return libgobject;
});

XPCOMUtils.defineLazyGetter(this, "GCallback", function() {
  return ctypes.void_t.ptr;
});

XPCOMUtils.defineLazyGetter(this, "gpointer", function() {
  return ctypes.void_t.ptr;
});

XPCOMUtils.defineLazyGetter(this, "gulong", function() {
  return ctypes.unsigned_long;
});

XPCOMUtils.defineLazyGetter(this, "guint", function() {
  return ctypes.unsigned_int;
});

XPCOMUtils.defineLazyGetter(this, "guint32", function() {
  return ctypes.unsigned_int;
});

XPCOMUtils.defineLazyGetter(this, "gint", function() {
  return ctypes.int;
});

XPCOMUtils.defineLazyGetter(this, "gchar", function() {
  return ctypes.unsigned_char;
});

XPCOMUtils.defineLazyGetter(this, "gboolean", function() {
  return gint;
});

XPCOMUtils.defineLazyGetter(this, "gfloat", function() {
  return ctypes.float;
});

XPCOMUtils.defineLazyGetter(this, "GConnectFlags", function() {
  return guint;
});

XPCOMUtils.defineLazyGetter(this, "GClosureNotify", function() {
  return gpointer;
});

XPCOMUtils.defineLazyGetter(this, "GCallback_t", function() {
  var GCallback_t =
    ctypes.FunctionType(ctypes.default_abi,
                        ctypes.void_t,
                        [gpointer,
                         guint,
                         gpointer]).ptr;
  if (!GCallback_t)
    throw "GCallback_t is unavailable";

  return GCallback_t;
});

XPCOMUtils.defineLazyGetter(this, "g_signal_connect_data", function() {
  var g_signal_connect_data =
    libgobject.declare("g_signal_connect_data",
                   ctypes.default_abi,
                   gulong,
                   gpointer,    // instance
                   gchar.ptr,   // detailed_signal
                   GCallback,   // handler
                   gpointer,    // data 
                   GClosureNotify, // NULL
                   GConnectFlags); // 0

  if (!g_signal_connect_data)
    throw "g_signal_connect_data is unavailable";

  return g_signal_connect_data;
});

XPCOMUtils.defineLazyGetter(this, "g_object_unref", function() {
  var g_object_unref =
    libgobject.declare("g_object_unref",
                   ctypes.default_abi,
                   ctypes.void_t,
                   gpointer);

  if (!g_object_unref)
    throw "g_object_unref is unavailable";

  return g_object_unref;
});


XPCOMUtils.defineLazyGetter(this, "GFunc", function() {
  return ctypes.void_t.ptr;
});

// intended for g_list_foreach.
/* NOTE: if we needed more/different args, we'd need to implement another
   FunctionType */
XPCOMUtils.defineLazyGetter(this, "GFunc_t", function() {
  var GFunc_t = ctypes.FunctionType(
    ctypes.default_abi, ctypes.void_t,
    [gpointer, gpointer]
  ).ptr;
  if (!GFunc_t)
    throw "GFunc_t is unavailable";

  return GFunc_t;
});

XPCOMUtils.defineLazyGetter(this, "GList", function() {
  return ctypes.StructType("GList");
});

// void                g_list_free                         (GList *list);
XPCOMUtils.defineLazyGetter(this, "g_list_free", function() {
  var g_list_free = libgobject.declare(
    "g_list_free", ctypes.default_abi, ctypes.void_t,
    GList.ptr
  );

  if (!g_list_free)
    throw "g_list_free is unavailable";

  return g_list_free;
});

// guint               g_list_length                       (GList *list);
XPCOMUtils.defineLazyGetter(this, "g_list_length", function() {
  var g_list_length = libgobject.declare(
    "g_list_length", ctypes.default_abi, guint,
    GList.ptr
  );

  if (!g_list_length)
    throw "g_list_length is unavailable";

  return g_list_length;
});

XPCOMUtils.defineLazyGetter(this, "g_list_foreach", function() {
  var g_list_foreach = libgobject.declare(
    "g_list_foreach", ctypes.default_abi, ctypes.void_t,
    GList.ptr,
    GFunc, // func
    gpointer // user_data
  );

  if (!g_list_foreach)
    throw "g_list_foreach is unavailable";

  return g_list_foreach;
});

var LibGObject = {
  GCallback: GCallback,
  GCallback_t: GCallback_t,
  gpointer: gpointer,
  gulong: gulong,
  guint: guint,
  guint32: guint32,
  gint: gint,
  gchar: gchar,
  gboolean: gboolean,
  GConnectFlags: GConnectFlags,
  GClosureNotify: GClosureNotify,
  g_object_unref: g_object_unref,

  g_signal_connect: function(instance, detailed_signal, handler, data) {
      return g_signal_connect_data(instance, detailed_signal,
                                   handler, data, null, 0);
  },

  GList: GList,
  GFunc: GFunc,
  GFunc_t: GFunc_t,
  g_list_free: g_list_free,
  g_list_length: g_list_length,
  g_list_foreach: g_list_foreach,
};
