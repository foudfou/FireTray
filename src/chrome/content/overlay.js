/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

// TODO: Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/ctypes.jsm");
Components.utils.import("resource://moztray/LibC.js");
Components.utils.import("resource://moztray/LibGObject.js");
Components.utils.import("resource://moztray/LibGdkWindow.js");
Components.utils.import("resource://moztray/LibGtkStatusIcon.js");
Components.utils.import("resource://moztray/commons.js");

const MOZT_ICON_DIR = "chrome/skin/";
const MOZT_ICON_SUFFIX = "32.png";



var mozt_getBaseWindow = function(win) {
  var bw;
  try {
    bw = win.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
      .getInterface(Components.interfaces.nsIWebNavigation)
      .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
      .treeOwner
      .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
      .getInterface(Components.interfaces.nsIXULWindow)
      .docShell
      .QueryInterface(Components.interfaces.nsIBaseWindow);
  } catch (ex) {
    bw = null;
    setTimeout(function() {throw ex; }, 0);
    // ignore no-interface exception
  }
  return bw;
};

var mozt_getAllWindows = function() {
  try {
    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
      .getService(Components.interfaces.nsIWindowMediator);
  } catch (err) {
    alert(err);
    return;
  }

  var baseWindows = new Array();
  var e = wm.getEnumerator(null);
  while (e.hasMoreElements()) {
    var w = e.getNext();
    baseWindows[baseWindows.length] = mozt_getBaseWindow(w);
  }

  // e = wm.getEnumerator(null);
  // // e = wm.getXULWindowEnumerator(null);
  // while(e.hasMoreElements()) {
  //   let win = e.getNext().QueryInterface(Components.interfaces.nsIDOMChromeWindow);
  //   // let win = e.getNext().QueryInterface(Components.interfaces.nsIXULWindow);
  //   mozt.Debug.debug("WINDOW TITLE = " + win.document.documentElement.getAttribute("title") );
  // }

  return baseWindows;
};

var mozt_hideToTray = function() {
  mozt.Debug.debug("mozt_hideToTray");
/*
  var toto = gBrowser.getBrowserForDocument(content.document)
    .docShell
    .QueryInterface(Components.interfaces.nsIBaseWindow)
    .parentNativeWindow;
  mozt.Debug.debug("toto: " + toto);
*/
  var baseWindows = mozt_getAllWindows();
  mozt.Debug.dump("baseWindows: " + baseWindows.length);
  for(var i=0; i<baseWindows.length; i++) {
    var bw = baseWindows[i];
    // bw.visibility = false;
    // mozt.Debug.dumpObj(bw);
    if (bw instanceof Ci.nsIBaseWindow) {
      mozt.Debug.debug("bw.visibility: " + bw.visibility);
      mozt.Debug.debug("bw.title: " + bw.title);
      mozt.Debug.debug("bw.parentNativeWindow: " + bw.parentNativeWindow);

      // try {
      //   bw.visibility = false;
      //   // bw.parentNativeWindow = null;
      // } catch (x) {
      //   mozt.Debug.debug(x);
      // }

    }

    // var parentWin = bw.parentNativeWindow;
    // var gdkWin = new LibGdkWindow.GdkWindow.ptr;
    // try {
    //   // gdkWin = ctypes.cast(tmp, LibGdkWindow.GdkWindow.ptr);
    // } catch (x) {
    //   mozt.Debug.debug(x);
    // }
    // if (!gdkWin) mozt.Debug.debug("gdkWin undefined");
    // mozt.Debug.dumpObj(gdkWin);
    // LibGdkWindow.GdkWindowHide(gdkWin);
  }

}

var mozt_trayCb;
var mozt_isHidden = false;
var mozt_trayCbJS = function() {
  if (mozt_isHidden) {
    mozt_isHidden = false;
    mozt_restoreFromTray();
  } else {
    mozt_isHidden = true;
    mozt_hideToTray();
  }
};

var mozt_func;
var mozt_funcGdkJS = function(data, userData) {
  try {
    mozt.Debug.debug("GDK Window");
    mozt.Debug.debug(data + "\t" + userData);
  } catch(e) {mozt.Debug.debug(ex);}
};

var mozt_funcGtkJS = function(data, userData) {
  try {
    ctypes.cast(data, LibGtkStatusIcon.GtkWidget.ptr);
    mozt.Debug.debug("GTK Window " + data);
    LibGtkStatusIcon.gtk_widget_hide(data);
  } catch(e) {mozt.Debug.debug(ex);}
};


mozt.Main = {

  onLoad: function() {
    // initialization code
    this.initialized = null;
    this.strings = document.getElementById("moztray-strings");

    try {
      // Set up preference change observer
      mozt.Utils.prefService.QueryInterface(Ci.nsIPrefBranch2);
      mozt.Utils.prefService.addObserver("", this, false);
    }
    catch (ex) {
      Components.utils.reportError(ex);
      return false;
    }

    LibGtkStatusIcon.init();
    this.tray_icon  = LibGtkStatusIcon.gtk_status_icon_new();
    var mozApp = mozt.Utils.appInfoService.name.toLowerCase();
    var icon_filename = MOZT_ICON_DIR + mozApp + MOZT_ICON_SUFFIX;
    LibGtkStatusIcon.gtk_status_icon_set_from_file(this.tray_icon,
                                                   icon_filename);
        // gtk_status_icon_set_tooltip(tray_icon,
        //                             "Example Tray Icon");
        // gtk_status_icon_set_visible(tray_icon, TRUE);

    mozt_trayCb = LibGObject.GCallbackFunction(mozt_trayCbJS);

    LibGObject.g_signal_connect(this.tray_icon, "activate",
                                mozt_trayCb, null);

    try {
      // Experimental stuff...

      var gdkScreen = LibGdkWindow.GdkScreenGetDefault();
      var tl = LibGdkWindow.GdkScreenGetToplevelWindows(gdkScreen);
      mozt.Debug.debug(tl);

      // gboolean            gdk_window_is_visible               (GdkWindow *window);
      mozt_func = LibGObject.GFunc_t(mozt_funcGdkJS);
      LibGObject.g_list_foreach(tl, mozt_func, null);
      var gdkWinCount = LibGObject.g_list_length(tl);
      mozt.Debug.debug('gdkWinCount: ' + gdkWinCount);

      var pid = LibC.getpid();
      mozt.Debug.debug(pid);

      tl = LibGtkStatusIcon.gtk_window_list_toplevels();
      mozt_func = LibGObject.GFunc_t(mozt_funcGtkJS);
      LibGObject.g_list_foreach(tl, mozt_func, null);
      var gtkWinCount = LibGObject.g_list_length(tl);
      mozt.Debug.debug('gtkWinCount: ' + gtkWinCount);

    } catch (x) {
      mozt.Debug.debug(x);
    }

    mozt.Debug.debug('Moztray LOADED !');
    this.initialized = true;
    return true;
  },

  onQuit: function() {
    // Remove observer
    mozt.Utils.prefService.removeObserver("", this);
    LibGtkStatusIcon.shutdown();

    mozt.Debug.dump('Moztray UNLOADED !');
    this.initialized = false;
  },

  observe: function(subject, topic, data) {
    // Observer for pref changes
    if (topic != "nsPref:changed") return;
    mozt.Debug.dump('Pref changed: '+data);

    switch(data) {
    // case 'enabled':
    //   var enable = mozt.Utils.prefService.getBoolPref('enabled');
    //   this._toggle(enable);
    //   break;
    }
  },

};


// should be sufficient for a delayed Startup (no need for window.setTimeout())
// https://developer.mozilla.org/en/Extensions/Performance_best_practices_in_extensions
// https://developer.mozilla.org/en/XUL_School/JavaScript_Object_Management.html
window.addEventListener("load", function (e) { mozt.Main.onLoad(); }, false);
window.addEventListener("unload", function(e) { mozt.Main.onQuit(); }, false);
