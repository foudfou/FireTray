/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

Components.utils.import("resource://firetray/commons.js");
Components.utils.import("resource://firetray/FiretrayHandler.jsm");

if ("undefined" == typeof(Cc)) var Cc = Components.classes;
if ("undefined" == typeof(Ci)) var Ci = Components.interfaces;
if ("undefined" == typeof(Cu)) var Cu = Components.utils;

let log = firetray.Logging.getLogger("firetray.Chrome");

// https://groups.google.com/group/mozilla.dev.extensions/browse_thread/thread/e89e9c2a834ff2b6#
var firetrayChrome = { // each new window gets a new firetrayChrome !

  strings: null,
  winId: null,

  onLoad: function(win) {
    this.strings = document.getElementById("firetray-strings"); // chrome-specific

    log.debug("Handler initialized: "+firetray.Handler.initialized);
    let init = firetray.Handler.initialized || firetray.Handler.init();

    log.debug("ONLOAD"); firetray.Handler.dumpWindows();
    this.winId = firetray.Handler.registerWindow(win);
    win.setTimeout(firetrayChrome.startHiddenMaybe, 0, this.winId);

    win.addEventListener('close', firetrayChrome.onClose, true);

    log.debug('Firetray LOADED: ' + init);
    return true;
  },

  onQuit: function(win) {
    firetray.Handler.unregisterWindow(win);

    /* NOTE: don't do firetray.Handler.initialized=false here, otherwise after
     a window close, a new window will create a new handler (and hence, a new
     tray icon) */
    log.debug('Firetray UNLOADED !');
  },

  /* until we find a fix (TODO), we need to set browser.tabs.warnOnClose=false
   to prevent the popup when closing a window with multiple tabs and when
   hides_on_close is set (we are not actually closing the tabs!). There is no
   use trying to set warnOnClose=false temporarily in onClose, since onClose is
   called *after* the popup */
  onClose: function(event) {
    log.debug('Firetray CLOSE');
    let win = event.originalTarget;
    if (!win instanceof ChromeWindow)
      throw new TypeError('originalTarget not a ChromeWindow');

    let hides_on_close = firetray.Utils.prefService.getBoolPref('hides_on_close');
    let hides_single_window = firetray.Utils.prefService.getBoolPref('hides_single_window');
    log.debug('hides_on_close: '+hides_on_close+', hides_single_window='+hides_single_window);
    if (hides_on_close) {
      if (hides_single_window) {
        firetray.Handler.hideWindow(firetrayChrome.winId);
      } else
        firetray.Handler.hideAllWindows();
      event && event.preventDefault();
    }
  },

  startHiddenMaybe: function(winId) {
    log.debug('startHiddenMaybe'+'. appStarted='+firetray.Handler.appStarted);

    if (firetray.Utils.prefService.getBoolPref('start_hidden') &&
        !firetray.Handler.appStarted) { // !appStarted for new windows !
      firetray.Handler.startupHideWindow(winId);
    }
  }

};

// should be sufficient for a delayed Startup (no need for window.setTimeout())
// https://developer.mozilla.org/en/XUL_School/JavaScript_Object_Management.html
// https://developer.mozilla.org/en/Extensions/Performance_best_practices_in_extensions#Removing_Event_Listeners
window.addEventListener(
  'load', function (e) {
    removeEventListener('load', arguments.callee, true);
    firetrayChrome.onLoad(this); },
  false);
window.addEventListener(
  'unload', function (e) {
    removeEventListener('unload', arguments.callee, true);
    firetrayChrome.onQuit(this); },
  false);
