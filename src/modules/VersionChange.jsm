var EXPORTED_SYMBOLS = [ "VersionChange" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/AddonManager.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://firetray/logging.jsm");

let log = firetray.Logging.getLogger("firetray.VersionChange");

/**
 * handles version changes.
 * http://mike.kaply.com/2011/02/02/running-add-on-code-at-first-run-and-upgrade/
 */
var VersionChange = {

  initialized:  false,
  addonId:      null,
  addonVersion: null,
  addOnPrefs: null,

  init: function(id, version, prefBranch) {
    log.debug("VersionChange got: id="+id+" ver="+version+" prefBranch="+prefBranch);
    this.addOnId = id;
    this.addonVersion = version;
    this.addOnPrefs = Services.prefs.getBranch(prefBranch);

    this.initialized = true;
  },

  versionComparator: Cc["@mozilla.org/xpcom/version-comparator;1"]
    .getService(Ci.nsIVersionComparator),

  applyHooksAndWatchUninstall: function() {
    if (!this.initialized) throw "VersionChange not initialized";
    this.onVersionChange(this.addonVersion); // AddonManager.getAddonByID() async, whereas we need sync call
    AddonManager.addAddonListener(this.uninstallListener);
    log.debug("version change watching enabled");
  },

  // we need to remove pref 'installedVersion' on uninstalling to be able to
  // detect reinstall later
  uninstallListener: {
    onUninstalling: function(addon) {
      if (addon.id !== this.addonId) return;
      this.addOnPrefs.clearUserPref("installedVersion");
    },
    onOperationCancelled: function(addon) {
      if (addon.id !== this.addonId) return;
      let beingUninstalled = (addon.pendingOperations & AddonManager.PENDING_UNINSTALL) != 0;
      if (beingUninstalled)
        this.addOnPrefs.clearUserPref("installedVersion");
    }
  },

  onVersionChange: function() {
    log.debug("VERSION: "+this.addonVersion);

    var firstrun = this.addOnPrefs.getBoolPref("firstrun");

    if (firstrun) {
      log.debug("FIRST RUN");
      this.initPrefs();
      this._applyHooks("install");

    } else {
      try {
        var installedVersion = this.addOnPrefs.getCharPref("installedVersion");
        var versionDelta = this.versionComparator.compare(this.addonVersion, installedVersion);
        if (versionDelta > 0) {
          this.addOnPrefs.setCharPref("installedVersion", this.addonVersion);
          log.debug("UPGRADE");
          this._applyHooks("upgrade");
        }

      } catch (ex) {
        log.debug("REINSTALL");
        this.initPrefs();
        this._applyHooks("reinstall");
      }
    }

  },

  initPrefs: function() {
    this.addOnPrefs.setBoolPref("firstrun", false);
    this.addOnPrefs.setCharPref("installedVersion", VersionChange.addonVersion);
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
      log.debug("_hooks.len="+this._hooks.length+" category="+category);
      for (let i=0,len=this._hooks.length; i<len; ++i) {
        let cb = this._hooks[i];
        if (cb.categories.indexOf(category) > -1) cb.fun();
        else log.debug("cb id="+cb.id+" not in category: "+cb.categories+"\n"+cb.fun);
      }
    } catch(x){log.error(x);}
  }

};
