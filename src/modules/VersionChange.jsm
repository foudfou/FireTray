var EXPORTED_SYMBOLS = [ "VersionChange" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/AddonManager.jsm");
Cu.import("resource://firetray/commons.js");


/**
 * handles version changes.
 * use setInstallHook(), setUpgradeHook(), setReinstallHook()
 * http://mike.kaply.com/2011/02/02/running-add-on-code-at-first-run-and-upgrade/
 */
var VersionChange = {

  curVersion: null,

  versionComparator: Cc["@mozilla.org/xpcom/version-comparator;1"]
    .getService(Ci.nsIVersionComparator),

  watch: function() {
    AddonManager.addAddonListener(this.uninstallListener);
    AddonManager.getAddonByID(FIRETRAY_ID, this.onVersionChange.bind(this));
    firetray.LOG("version change watching enabled");
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

  onVersionChange: function(addon) {
    firetray.LOG("VERSION: "+addon.version);

    this.curVersion = addon.version;
    var firstrun = firetray.Utils.prefService.getBoolPref("firstrun");

    if (firstrun) {
      firetray.WARN("FIRST RUN");
      this.initPrefs();
      this.installHook(this.curVersion);

    } else {
      try {
        var installedVersion = firetray.Utils.prefService.getCharPref("installedVersion");
        var versionDelta = this.versionComparator.compare(this.curVersion, installedVersion);
        if (versionDelta > 0) {
          firetray.Utils.prefService.setCharPref("installedVersion", this.curVersion);
          firetray.WARN("UPGRADE");
          this.upgradeHook(this.curVersion);
        }

      } catch (ex) {
        firetray.WARN("REINSTALL");
        this.initPrefs();
        this.reinstallHook(this.curVersion);
      }
    }
  },

  initPrefs: function() {
    firetray.Utils.prefService.setBoolPref("firstrun", false);
    firetray.Utils.prefService.setCharPref("installedVersion", VersionChange.curVersion);
  },

  installHook: function(ver){},
  upgradeHook: function(ver){},
  reinstallHook: function(ver){},
  setInstallHook: function(fun) {this.installHook = fun;},
  setUpgradeHook: function(fun) {this.upgradeHook = fun;},
  setReinstallHook: function(fun) {this.reinstallHook = fun;}

};
