/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = [ "firetray" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://firetray/ctypes/winnt/win32.jsm");
Cu.import("resource://firetray/ctypes/winnt/user32.jsm");
Cu.import("resource://firetray/commons.js");
firetray.Handler.subscribeLibsForClosing([user32]);

let log = firetray.Logging.getLogger("firetray.PopupMenu");

if ("undefined" == typeof(firetray.StatusIcon))
  log.error("This module MUST be imported from/after StatusIcon !");

// popupmenu items
const IDM_PREF    = 100;
const IDM_QUIT    = 200;
const IDM_NEW_MSG = 300;
const IDM_NEW_WND = 400;
const IDM_RESET   = 500;


firetray.PopupMenu = {
  initialized: false,
  menu: null,

  init: function() {
    this.create();

    this.initialized = true;
    return true;
  },

  shutdown: function() {
    this.destroy();

    log.debug("Disabling PopupMenu");
    this.initialized = false;
  },

  create: function() {
    this.menu = user32.CreatePopupMenu(); // FIXME: destroy
    log.debug("menu="+this.menu);

    var addMenuSeparator = false;

    this.insertMenuItem('Quit', 'quit', IDM_QUIT);
    user32.InsertMenuW(this.menu, 0, user32.MF_BYPOSITION|user32.MF_SEPARATOR, 0, null);
    this.insertMenuItem('Preferences', 'prefs', IDM_PREF);

    if (firetray.Handler.inBrowserApp) {
      this.insertMenuItem('NewWindow', 'new-wnd', IDM_NEW_WND);
      addMenuSeparator = true;
    }

    if (firetray.Handler.inMailApp) {
      this.insertMenuItem('NewMessage', 'new-msg', IDM_NEW_MSG);
      this.insertMenuItem('ResetIcon', 'reset', IDM_RESET);
      addMenuSeparator = true;
    }

    if (addMenuSeparator) {
      user32.InsertMenuW(this.menu, 2, user32.MF_BYPOSITION|user32.MF_SEPARATOR, 0, null);
    }

    // // We'll user InsertMenuW for hidden windows:
    // user32.InsertMenuW(this.menu, 0, user32.MF_BYPOSITION|user32.MF_STRING, IDM_CLOSE, "Close"); // FIXME: ampersand doesn't work ?

    log.debug("PopupMenu created");
  },

  destroy: function() {
    user32.DestroyMenu(this.menu);
    log.debug("PopupMenu destroyed");
  },

  insertMenuItem: function(itemName, iconName, actionId) {
    var menuItemLabel = firetray.Utils.strings.GetStringFromName("popupMenu.itemLabel."+itemName);
    let mii = new user32.MENUITEMINFOW();
    // BUG: ctypes doesn't detect wrong field assignments mii.size = ... ('size' undefined)
    mii.cbSize = user32.MENUITEMINFOW.size;
    mii.fMask = user32.MIIM_ID | user32.MIIM_STRING | user32.MIIM_DATA;
    mii.wID = actionId;
    // mii.dwItemData = win32.ULONG_PTR(actionId);
    mii.dwTypeData = win32._T(menuItemLabel);
    /* Under XP, putting a bitmap into hbmpItem results in ugly icons. We
     should probably use HBMMENU_CALLBACK as explained in
     http://www.nanoant.com/programming/themed-menus-icons-a-complete-vista-xp-solution.
     But for now, we just don't display icons in XP-. */
    if (win32.WINVER >= win32.WIN_VERSIONS["Vista"]) {
      mii.fMask |= user32.MIIM_BITMAP;
      mii.hbmpItem = firetray.StatusIcon.bitmaps.get(iconName);
    }
    log.debug("mii="+mii);
    if (!user32.InsertMenuItemW(this.menu, 0, true, mii.address())) {
      log.error("InsertMenuItemW failed winLastError="+ctypes.winLastError);
    }
  },

  processMenuItem: function(itemId) {
    switch (itemId) {
    case IDM_PREF: firetray.Handler.openPrefWindow(); break;
    case IDM_QUIT: firetray.Handler.quitApplication(); break;
    case IDM_NEW_MSG: firetray.Handler.openMailMessage(); break;
    case IDM_NEW_WND: firetray.Handler.openBrowserWindow(); break;
    case IDM_RESET: firetray.Handler.setIconImageDefault(); break;
    default:
      log.error("no action for itemId ("+itemId+")");
    }
  }

}; // firetray.PopupMenu

firetray.Handler.showHidePopupMenuItems = firetray.PopupMenu.showHideWindowItems;
