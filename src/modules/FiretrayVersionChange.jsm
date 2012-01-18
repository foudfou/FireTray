var EXPORTED_SYMBOLS = [ "firetray" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/AddonManager.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://firetray/commons.js");

const FIRETRAY_ID = "{9533f794-00b4-4354-aa15-c2bbda6989f8}";
const FIRETRAY_SPLASH_PAGE = "http://foudfou.github.com/FireTray/";

/**
 * handles version changes, by doing things like opening a tab for release notes
 */
firetray.VersionChange = {

  watch: function() {
    AddonManager.addAddonListener(this.uninstallListener);
    AddonManager.getAddonByID(FIRETRAY_ID, this.onVersionChange.bind(this));
    LOG("version change watching enabled");
  },

  // we need to remove pref 'installedVersion' on uninstalling to be able to
  // detect reinstall later
  uninstallListener: {
    onUninstalling: function(addon) {
      if (addon.id !== FIRETRAY_ID) return;
      firetray.Utils.prefService.clearUserPref("installedVersion");
    },
    onOperationCancelled: function(addon) {
      if (addon.id !== FIRETRAY_ID) return;
      let beingUninstalled = (addon.pendingOperations & AddonManager.PENDING_UNINSTALL) != 0;
      if (beingUninstalled)
        firetray.Utils.prefService.clearUserPref("installedVersion");
    }
  },

  openMailTab: function() {
    let mail3PaneWindow = Services.wm.getMostRecentWindow("mail:3pane");
    if (mail3PaneWindow) {
      var tabmail = mail3PaneWindow.document.getElementById("tabmail");
      mail3PaneWindow.focus();
    }

    if (tabmail) {
      var timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
      timer.initWithCallback({ notify: function() {
        LOG("openMailTab");
        tabmail.openTab("contentTab", {contentPage: FIRETRAY_SPLASH_PAGE});
      }}, FIRETRAY_BROWSER_STARTUP_DELAY_MILLISECONDS, Ci.nsITimer.TYPE_ONE_SHOT);
    }
  },

  openBrowserTab: function() {
    let win = Services.wm.getMostRecentWindow("navigator:browser");
    WARN("WIN="+win);
    if (win) {
      var mainWindow = win.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
            .getInterface(Components.interfaces.nsIWebNavigation)
            .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
            .rootTreeItem
            .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
            .getInterface(Components.interfaces.nsIDOMWindow);

      mainWindow.setTimeout(function(win){
        LOG("openBrowser");
        mainWindow.gBrowser.selectedTab = mainWindow.gBrowser.addTab(FIRETRAY_SPLASH_PAGE);
      }, 1000);
    }
  },

  openTab: function() {
    let appId = Services.appinfo.ID;
    if (appId === THUNDERBIRD_ID)
      this.openMailTab();
    else if (appId === FIREFOX_ID || appId === SEAMONKEY_ID)
      this.openBrowserTab();
    else
      ERROR("unsupported application");
  },

  onVersionChange: function(addon) {
    LOG("VERSION: "+addon.version);

    var curVersion = addon.version;
    var firstrun = firetray.Utils.prefService.getBoolPref("firstrun");

    if (firstrun) {
      firetray.Utils.prefService.setBoolPref("firstrun", false);
      firetray.Utils.prefService.setCharPref("installedVersion", curVersion);
      WARN("FIRST RUN");
      this.openTab();

    } else {
      try {
        var installedVersion = firetray.Utils.prefService.getCharPref("installedVersion");
        var versionDelta = Cc["@mozilla.org/xpcom/version-comparator;1"].getService(Ci.nsIVersionComparator)
              .compare(curVersion, installedVersion);
        if (versionDelta > 0) {
          firetray.Utils.prefService.setCharPref("installedVersion", curVersion);
          WARN("UPGRADE");
          this.openTab();
        }
      } catch (ex) {
        WARN("REINSTALL");
        this.openTab();
      }
    }
  }

};
