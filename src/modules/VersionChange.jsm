var EXPORTED_SYMBOLS = [ "VersionChange" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/AddonManager.jsm");
Cu.import("resource://firetray/commons.js");


/**
 * handles version changes.
 * http://mike.kaply.com/2011/02/02/running-add-on-code-at-first-run-and-upgrade/
 */
var VersionChange = {

  curVersion: null,

  versionComparator: Cc["@mozilla.org/xpcom/version-comparator;1"]
    .getService(Ci.nsIVersionComparator),

  watch: function() {
    AddonManager.addAddonListener(this.uninstallListener);
    AddonManager.getAddonByID(FIRETRAY_ID, this.onVersionChange.bind(this));
    F.LOG("version change watching enabled");
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
    F.LOG("VERSION: "+addon.version);

    this.curVersion = addon.version;
    var firstrun = firetray.Utils.prefService.getBoolPref("firstrun");

    if (firstrun) {
      F.LOG("FIRST RUN");
      this.initPrefs();
      this._applyHooks("install");

    } else {
      try {
        var installedVersion = firetray.Utils.prefService.getCharPref("installedVersion");
        var versionDelta = this.versionComparator.compare(this.curVersion, installedVersion);
        if (versionDelta > 0) {
          firetray.Utils.prefService.setCharPref("installedVersion", this.curVersion);
          F.LOG("UPGRADE");
          this._applyHooks("upgrade");
        }

      } catch (ex) {
        F.LOG("REINSTALL");
        this.initPrefs();
        this._applyHooks("reinstall");
      }
    }
  },

  initPrefs: function() {
    firetray.Utils.prefService.setBoolPref("firstrun", false);
    firetray.Utils.prefService.setCharPref("installedVersion", VersionChange.curVersion);
  },

  _hooks: [],      // collection of callbacks {id: 1, categories: [], fun: function}

  addHook: function(categories, fun) {
    if (!firetray.js.isArray(categories)) throw new CategoryError();
    let id = this._hooks.push({})-1;
    this._hooks[id] = {id: id, categories: categories, fun: fun};
    return id;
  },

  removeHook: function(id) {return this._hooks[id].splice(id-1, 1);},
  removeCategoryFromHook: function(category, id) {
    throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
  },

  _applyHooks: function(category) {
    for (let i=0,len=this._hooks.length; i<len; ++i) {
      let cb = this._hooks[i];
      if (cb.categories.indexOf(category)) cb.fun(this.curVersion);
    }
  }

};
