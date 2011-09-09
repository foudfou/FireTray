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
 * The Original Code is Moztray
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

var EXPORTED_SYMBOLS = [ "gobject" ];

const GOBJECT_LIBNAME = "gobject-2.0";
const GOBJECT_ABIS = [ 0 ];

const Cu = Components.utils;
const Cc = Components.classes;
const Ci = Components.interfaces;

Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://moztray/ctypes-utils.jsm");

function gobject_defines(lib) {
  this.gpointer = ctypes.voidptr_t;
  this.gulong = ctypes.unsigned_long;
  this.guint = ctypes.unsigned_int;
  this.guint32 = ctypes.uint32_t;
  this.guint16 = ctypes.uint16_t;
  this.gint = ctypes.int;
  this.gchar = ctypes.unsigned_char;
  this.gboolean = this.gint;
  this.gfloat = ctypes.float;
  this.GCallback = ctypes.voidptr_t;
  this.GClosureNotify = this.gpointer;
  this.GConnectFlags = this.guint;
  this.GFunc = ctypes.void_t.ptr;
  this.GList = ctypes.StructType("GList");

  /* NOTE: if we needed more/different args, we'd need to implement another
     FunctionType */
  this.GCallback_t = ctypes.FunctionType(
    ctypes.default_abi, ctypes.void_t, [this.gpointer, this.guint, this.gpointer]).ptr;
  // intended for g_list_foreach.
  this.GFunc_t = ctypes.FunctionType(
    ctypes.default_abi, ctypes.void_t, [this.gpointer, this.gpointer]).ptr;

  lib.lazy_bind("g_object_unref", ctypes.void_t, this.gpointer);
  lib.lazy_bind("g_signal_connect_data", this.gulong, this.gpointer, this.gchar.ptr, this.GCallback, this.gpointer, this.GClosureNotify, this.GConnectFlags);

  this.g_signal_connect = function(instance, detailed_signal, handler, data) {
    return this.g_signal_connect_data(instance, detailed_signal, handler, data, null, 0);
  }

  lib.lazy_bind("g_object_unref", ctypes.void_t, this.gpointer);
  lib.lazy_bind("g_list_free", ctypes.void_t, this.GList.ptr);
  lib.lazy_bind("g_list_length", this.guint, this.GList.ptr);
  lib.lazy_bind("g_list_foreach", ctypes.void_t, this.GList.ptr, this.GFunc, this.gpointer);

}

if (!gobject) {
  var gobject = new ctypes_library(GOBJECT_LIBNAME, GOBJECT_ABIS, gobject_defines);
}
