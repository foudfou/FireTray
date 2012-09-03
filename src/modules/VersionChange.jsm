var EXPORTED_SYMBOLS = [ "VersionChange" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/AddonManager.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://firetray/commons.js");

/**
 * handles version changes.
 * http://mike.kaply.com/2011/02/02/running-add-on-code-at-first-run-and-upgrade/
 */
var VersionChange = {

  initialized: false,
  addonId: FIRETRAY_ID,
  addonVersion: null,
  addonPrefs: (function(){return Services.prefs.getBranch(FIRETRAY_PREF_BRANCH);})(),

  launch: function() {
    AddonManager.getAddonByID(FIRETRAY_ID, this.applyHooksAndWatchUninstall.bind(this));
  },

  versionComparator: Cc["@mozilla.org/xpcom/version-comparator;1"]
    .getService(Ci.nsIVersionComparator),

  applyHooksAndWatchUninstall: function(addon) {
    this.addonVersion = addon.version;
    this.onVersionChange(this.addonVersion);
    AddonManager.addAddonListener(this.uninstallListener);
    F.LOG("version change watching enabled");
  },

  // we need to remove pref 'installedVersion' on uninstalling to be able to
  // detect reinstall later
  uninstallListener: {
    onUninstalling: function(addon) {
      if (addon.id !== this.addonId) return;
      this.addonPrefs.clearUserPref("installedVersion");
    },
    onOperationCancelled: function(addon) {
      if (addon.id !== this.addonId) return;
      let beingUninstalled = (addon.pendingOperations & AddonManager.PENDING_UNINSTALL) != 0;
      if (beingUninstalled)
        this.addonPrefs.clearUserPref("installedVersion");
    }
  },

  onVersionChange: function() {
    F.LOG("VERSION: "+this.addonVersion);

    var firstrun = this.addonPrefs.getBoolPref("firstrun");

    if (firstrun) {
      F.LOG("FIRST RUN");
      this.initPrefs();
      this._applyHooks("install");

    } else {
      try {
        var installedVersion = this.addonPrefs.getCharPref("installedVersion");
        var versionDelta = this.versionComparator.compare(this.addonVersion, installedVersion);
        if (versionDelta > 0) {
          this.addonPrefs.setCharPref("installedVersion", this.addonVersion);
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
    this.addonPrefs.setBoolPref("firstrun", false);
    this.addonPrefs.setCharPref("installedVersion", VersionChange.addonVersion);
  },

  _hooks: [], // collection of callbacks {id: 1, categories: [], fun: function}

  addHook: function(categories, fun) {
    if (Object.prototype.toString.call(categories) !== "[object Array]") throw new TypeError();
    let id = this._hooks.push({})-1;
    this._hooks[id] = {id: id, categories: categories, fun: fun};
    return id;
  },

  removeHook: function(id) {return this._hooks[id].splice(id-1, 1);},
  removeCategoryFromHook: function(category, id) {
    throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
  },

  _applyHooks: function(category) {
    try {
      F.LOG("_hooks.len="+this._hooks.length+" category="+category);
      for (let i=0,len=this._hooks.length; i<len; ++i) {
        let cb = this._hooks[i];
        if (cb.categories.indexOf(category) > -1) cb.fun();
        else F.LOG("cb id="+cb.id+" not in category: "+cb.categories+"\n"+cb.fun);
      }
    } catch(x){F.ERROR(x);}
  }

};
