/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = [ "firetray" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://firetray/ctypes/linux/gdk.jsm");
Cu.import("resource://firetray/ctypes/linux/gio.jsm");
Cu.import("resource://firetray/ctypes/linux/glib.jsm");
Cu.import("resource://firetray/ctypes/linux/gobject.jsm");
Cu.import("resource://firetray/commons.js");
firetray.Handler.subscribeLibsForClosing([gdk, gio, glib, gobject]);

let log = firetray.Logging.getLogger("firetray.StatusIcon");

if ("undefined" == typeof(firetray.Handler))
  log.error("This module MUST be imported from/after FiretrayHandler !");


firetray.StatusIcon = {
  initialized: false,
  callbacks: {}, // pointers to JS functions. MUST LIVE DURING ALL THE EXECUTION
  prefAppIconNames: null,
  prefNewMailIconNames: null,
  defaultAppIconName: null,
  defaultNewMailIconName: null,

  init: function() {
    this.defineIconNames();

    // PopupMenu g_connect's some Handler functions. As these are overridden is
    // StatusIcon implementations, PopupMenu must be initialized *after*
    // implemenations are imported.
    Cu.import("resource://firetray/ctypes/linux/appindicator.jsm");
    if (appind3.available() && this.dbusNotificationWatcherReady()) {
      /* FIXME: Ubuntu14.04/Unity: successfully closing appind3 crashes FF/TB
       during exit, in Ubuntu's unity-menubar.patch's code.
       https://bugs.launchpad.net/ubuntu/+source/firefox/+bug/1393256 */
      // firetray.Handler.subscribeLibsForClosing([appind3]);
      Cu.import("resource://firetray/linux/FiretrayAppIndicator.jsm");
    } else {
      Cu.import("resource://firetray/linux/FiretrayGtkStatusIcon.jsm");
    }

    Cu.import("resource://firetray/linux/FiretrayPopupMenu.jsm");
    if (!firetray.PopupMenu.init())
      return false;

    if (!firetray.StatusIcon.initImpl())
      return false;

    this.initialized = true;
    return true;
  },

  shutdown: function() {
    log.debug("Disabling StatusIcon");
    firetray.StatusIcon.shutdownImpl();
    firetray.PopupMenu.shutdown();
    this.initialized = false;
  },

  defineIconNames: function() {
    this.prefAppIconNames = (function() {
      if (firetray.Handler.inMailApp) {
        return "app_mail_icon_names";
      } else if (firetray.Handler.inBrowserApp) {
        return "app_browser_icon_names";
      } else {
        return "app_default_icon_names";
      }
    })();
    this.defaultAppIconName = firetray.Handler.appName.toLowerCase();

    this.prefNewMailIconNames = "new_mail_icon_names";
    this.defaultNewMailIconName = "mail-unread";
  },

  getAppIconNames: function() {
    let appIconNames = firetray.Utils.getArrayPref(
      firetray.StatusIcon.prefAppIconNames);
    appIconNames.push(firetray.StatusIcon.defaultAppIconName);
    return appIconNames;
  },
  getNewMailIconNames: function() {
    let newMailIconNames = firetray.Utils.getArrayPref(
      firetray.StatusIcon.prefNewMailIconNames);
    newMailIconNames.push(firetray.StatusIcon.defaultNewMailIconName);
    return newMailIconNames;
  },

  loadImageCustom: function() { }, // done in setIconImageCustom

  dbusNotificationWatcherReady: function() {
    let watcherReady = false;

    function error(e) {
      if (!e.isNull()) {
        log.error(e.contents.message);
        glib.g_error_free(e);
      }
    }

    let conn = new gio.GDBusConnection.ptr;
    let err = new glib.GError.ptr(null);
    conn = gio.g_bus_get_sync(gio.G_BUS_TYPE_SESSION, null, err.address());
    if (error(err)) return watcherReady;

    if (!conn.isNull()) {
      let flags = gio.G_DBUS_PROXY_FLAGS_DO_NOT_AUTO_START |
            gio.G_DBUS_PROXY_FLAGS_DO_NOT_LOAD_PROPERTIES |
            gio.G_DBUS_PROXY_FLAGS_DO_NOT_CONNECT_SIGNALS;

      let proxy = gio.g_dbus_proxy_new_for_bus_sync(
        gio.G_BUS_TYPE_SESSION,
        flags,
        null, /* GDBusInterfaceInfo */
        appind3.NOTIFICATION_WATCHER_DBUS_ADDR,
        appind3.NOTIFICATION_WATCHER_DBUS_OBJ,
        appind3.NOTIFICATION_WATCHER_DBUS_IFACE,
        null, /* GCancellable */
        err.address());
      if (error(err)) return watcherReady;

      if (!proxy.isNull()) {
        let owner = gio.g_dbus_proxy_get_name_owner(proxy);
        if (!owner.isNull()) {
          watcherReady = true;
        }
        gobject.g_object_unref(proxy);
      }

      gobject.g_object_unref(conn);
    }

    return watcherReady;
  },

  onScroll: function(direction) {
    if (!firetray.Utils.prefService.getBoolPref("scroll_hides"))
      return false;

    let scroll_mode = firetray.Utils.prefService.getCharPref("scroll_mode");
    switch(direction) {
    case gdk.GDK_SCROLL_UP:
      log.debug("SCROLL UP");
      if (scroll_mode === "down_hides")
        firetray.Handler.showAllWindows();
      else if (scroll_mode === "up_hides")
        firetray.Handler.hideAllWindows();
      break;
    case gdk.GDK_SCROLL_DOWN:
      log.debug("SCROLL DOWN");
      if (scroll_mode === "down_hides")
        firetray.Handler.hideAllWindows();
      else if (scroll_mode === "up_hides")
        firetray.Handler.showAllWindows();
      break;
    default:
      log.error("SCROLL UNKNOWN");
    }

    return true;
  }

}; // firetray.StatusIcon


firetray.Handler.setIconTooltipDefault = function() {
  if (!this.appName)
    throw "application name not initialized";
  this.setIconTooltip(this.appName);
};

firetray.Handler.setIconTooltip = function(toolTipStr) { };
