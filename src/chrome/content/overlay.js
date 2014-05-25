/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
"use strict";

Components.utils.import("resource://firetray/commons.js");
Components.utils.import("resource://firetray/FiretrayHandler.jsm");

if ("undefined" == typeof(Cc)) var Cc = Components.classes;
if ("undefined" == typeof(Ci)) var Ci = Components.interfaces;
if ("undefined" == typeof(Cu)) var Cu = Components.utils;

// can't use 'log': don't pollute global (chrome) namespace
let firetray_log = firetray.Logging.getLogger("firetray.Chrome");

// https://groups.google.com/group/mozilla.dev.extensions/browse_thread/thread/e89e9c2a834ff2b6#
var firetrayChrome = { // each new window gets a new firetrayChrome !

  strings: null,
  winId: null,

  onLoad: function(win) {
    this.strings = document.getElementById("firetray-strings"); // chrome-specific

    firetray_log.debug("Handler initialized: "+firetray.Handler.initialized);
    let init = firetray.Handler.initialized || firetray.Handler.init();

    firetray_log.debug("ONLOAD"); firetray.Handler.dumpWindows();
    this.winId = firetray.Handler.registerWindow(win);

    win.addEventListener('close', firetrayChrome.onClose, true);
    this.hijackTitlebarButtons();

    firetray_log.debug('Firetray LOADED: ' + init);
    return true;
  },

  /* NOTE: don't do firetray.Handler.initialized=false here, otherwise after a
   window close, a new window will create a new handler (and hence, a new tray
   icon) */
  onQuit: function(win) {
    win.removeEventListener('close', firetrayChrome.onClose, true);
    firetray.Handler.unregisterWindow(win);
    firetray_log.info("windowsCount="+firetray.Handler.windowsCount+", visibleWindowsCount="+firetray.Handler.visibleWindowsCount);
    firetray_log.debug('Firetray UNLOADED !');
  },

  /* until we find a fix (TODO), we need to set browser.tabs.warnOnClose=false
   to prevent the popup when closing a window with multiple tabs and when
   hides_on_close is set (we are not actually closing the tabs!). There is no
   use trying to set warnOnClose=false temporarily in onClose, since onClose is
   called *after* the popup */
  onClose: function(event) {
    firetray_log.debug('Firetray CLOSE');
    let hides_on_close = firetray.Utils.prefService.getBoolPref('hides_on_close');
    firetray_log.debug('hides_on_close: '+hides_on_close);
    if (!hides_on_close) return false;

    let hides_single_window = firetray.Utils.prefService.getBoolPref('hides_single_window');
    let hides_last_only = firetray.Utils.prefService.getBoolPref('hides_last_only');
    firetray_log.debug('hides_single_window='+hides_single_window+', windowsCount='+firetray.Handler.windowsCount);
    if (hides_last_only && (firetray.Handler.windowsCount > 1)) return true;

    if (hides_single_window)
      firetray.Handler.hideWindow(firetrayChrome.winId);
    else
      firetray.Handler.hideAllWindows();

    if (event) event.preventDefault();
    return true;
  },

  /*
   * Minimize/Restore/Close buttons can be overlayed by titlebar (fake) buttons
   * which do not fire the events that we rely on (see Bug 827880). This is why
   * we override the fake buttons' default actions.
   */
  hijackTitlebarButtons: function() {
    this.titlebarDispatch.forEach(function(button) {
      let fInfo = firetrayChrome.replaceCommand(button.id, button.new);
      if (fInfo) {
        button.old = fInfo[0];
        firetray_log.debug('replaced command='+button.id+' type='+fInfo[1]+' func='+fInfo[0]);
        button.type = fInfo[1];
      }
    });
  },

  titlebarDispatch: [
    {id: "titlebar-min", new: function(e){
      firetray_log.debug('  titlebar-min clicked');
      if (!firetray.Handler.onMinimize(firetrayChrome.winId))
        firetrayChrome.applyDefaultCommand("titlebar-min");
    }, old: null, type: null},
    {id: "titlebar-close", new: function(e){
      firetray_log.debug('  titlebar-close clicked');
      if (!firetrayChrome.onClose(null)) {
        firetrayChrome.applyDefaultCommand("titlebar-close");
      }
    }, old: null, type: null}
  ],

  replaceCommand: function(eltId, func) {
    let elt = document.getElementById(eltId);
    if (!elt) {
      firetray_log.debug("Element '"+eltId+"' not found. Command not replaced.");
      return null;
    }

    let command = elt.command;
    let oncommand = elt.getAttribute("oncommand");
    let old = null, type = null;
    if (command) {
      firetray_log.debug('command');
      type = FIRETRAY_XUL_ATTRIBUTE_COMMAND;
      old = elt.command;
      elt.command = null;
      elt.addEventListener('click', func, false);
    } else if (oncommand) {
      firetray_log.debug('oncommand');
      type = FIRETRAY_XUL_ATTRIBUTE_ONCOMMAND;
      let prev = elt.getAttribute("oncommand");
      old = new Function(prev);
      elt.setAttribute("oncommand", void(0));
      elt.addEventListener('command', func, false);
    } else {
      firetray_log.warn('Could not replace oncommand on '+eltId);
    }

    return [old, type];
  },
  applyDefaultCommand: function(key) {
    let callType = this.titlebarDispatch[key]['type'];
    if (callType === FIRETRAY_XUL_ATTRIBUTE_COMMAND) {
      let cmdName = firetrayChrome.titlebarDispatch[key]['old'];
      let cmd = document.getElementById(cmdName);
      cmd.doCommand();

    } else if (callType === FIRETRAY_XUL_ATTRIBUTE_ONCOMMAND) {
      firetrayChrome.titlebarDispatch[key]['old']();

    } else {
      firetray_log.error("Calling type undefined for "+key);
    }
  }

};

// should be sufficient for a delayed Startup (no need for window.setTimeout())
// https://developer.mozilla.org/en/XUL_School/JavaScript_Object_Management.html
// https://developer.mozilla.org/en/Extensions/Performance_best_practices_in_extensions#Removing_Event_Listeners
window.addEventListener(
  'load', function removeOnloadListener(e) {
    removeEventListener('load', removeOnloadListener, true);
    firetrayChrome.onLoad(this); },
  false);
window.addEventListener(
  'unload', function removeOnUnloadListener(e) {
    removeEventListener('unload', removeOnUnloadListener, true);
    firetrayChrome.onQuit(this); },
  false);
