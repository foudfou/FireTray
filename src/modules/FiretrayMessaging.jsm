/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = [ "firetray" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource:///modules/mailServices.js");
Cu.import("resource://gre/modules/PluralForm.jsm");
Cu.import("resource://firetray/FiretrayIconLinux.jsm");
Cu.import("resource://firetray/commons.js");

const FLDR_UNINTERESTING =
  Ci.nsMsgFolderFlags.Archive |
  Ci.nsMsgFolderFlags.Drafts |
  Ci.nsMsgFolderFlags.Junk |
  Ci.nsMsgFolderFlags.Queue |
  Ci.nsMsgFolderFlags.SentMail |
  Ci.nsMsgFolderFlags.Templates |
  Ci.nsMsgFolderFlags.Trash;
const ICON_TEXT_COLOR = "#00000";

/**
 * firetray namespace.
 */
if ("undefined" == typeof(firetray)) {
  var firetray = {};
};


firetray.Messaging = {
  _unreadMsgCount: 0,

  enable: function() {
    if (this.enabled) {
      WARN("Trying to enable more than once");
      return;
    }

    LOG("Enabling Messaging");
    let that = this;
    let mailSessionNotificationFlags = Ci.nsIFolderListener.intPropertyChanged;
    MailServices.mailSession.AddFolderListener(that.mailSessionListener,
                                               mailSessionNotificationFlags);

    this.enabled = true;
  },

  disable: function() {
    if (!this.enabled)
      return;

    MailServices.mailSession.RemoveFolderListener(this);

    this.enabled = false;
  },

  mailSessionListener: {
    /**
     * @param folder: nsIMsgFolder
     * @param property: nsIAtom
     * @param oldFlag: Old header flag (long).
     * @param newFlag: New header flag (long).
     */
    OnItemIntPropertyChanged: function(folder, property, oldValue, newValue) {
      if (property.toString() === "TotalUnreadMessages" &&
          !(folder.flags & FLDR_UNINTERESTING)) {
        LOG("Unread msgs for folder "+folder.prettyName+" was "+oldValue+" became "+newValue);
        firetray.Messaging.updateUnreadMsgCount();
      }
    }
  },

  /**
   * computes total unread message count
   * TODO: check news accounts shouldn't be considered
   */
  updateUnreadMsgCount: function() {
    LOG("unreadMsgCount");
    let serverTypes = firetray.Utils.getObjPref('server_types');

    this._unreadMsgCount = 0;   // reset
    try {
      let accounts = new this.Accounts();
      for (let accountServer in accounts) {
        if ( (serverTypes[accountServer.type].excluded)
          || (firetray.Utils.getArrayPref('accounts_to_exclude').indexOf(accountServer.key) >= 0) )
          continue;

        let rootFolder = accountServer.rootFolder; // nsIMsgFolder
        if (rootFolder.hasSubFolders) {
          let subFolders = rootFolder.subFolders; // nsIMsgFolder
          while(subFolders.hasMoreElements()) {
            let folder = subFolders.getNext().QueryInterface(Ci.nsIMsgFolder);
            if (!(folder.flags & FLDR_UNINTERESTING))
              LOG(folder.prettyName+" unread="+folder.getNumUnread(true)); // include subfolders
            this._unreadMsgCount += folder.getNumUnread(true);   // reset
          }
        }
      }
    } catch (x) {
      ERROR(x);
    }
    LOG("TotalUnread="+this._unreadMsgCount);

    // update icon
    if (this._unreadMsgCount == 0) {
      firetray.IconLinux.setImageDefault();
      firetray.IconLinux.setTooltipDefault();
    } else if (this._unreadMsgCount > 0) {
      firetray.IconLinux.setText(this._unreadMsgCount.toString(), ICON_TEXT_COLOR);
      let localizedMessage = PluralForm.get(
        this._unreadMsgCount,
        firetray.Utils.strings.GetStringFromName("tooltip.unread_messages"))
        .replace("#1", this._unreadMsgCount);;
      firetray.IconLinux.setTooltip(localizedMessage);
    } else {
      throw "negative message count"; // should never happen
    }

  }

};


/**
 * Accounts Iterator/Generator for iterating over account servers
 * @param sortByTypeAndName: boolean
 */
firetray.Messaging.Accounts = function(sortByTypeAndName) {
  if (typeof(sortByTypeAndName) == "undefined") {
    this.sortByTypeAndName = false;
    return;
  }
  if (typeof(sortByTypeAndName) !== "boolean")
    throw new TypeError();

  this.sortByTypeAndName = sortByTypeAndName;
};
firetray.Messaging.Accounts.prototype.__iterator__ = function() {
  let accounts = MailServices.accounts.accounts;
  LOG("sortByTypeAndName="+this.sortByTypeAndName);

  /* NOTE: sort() not provided by nsIMsgAccountManager.accounts
   (nsISupportsArray, nsICollection). Should be OK to re-build a JS-Array for
   few accounts */
  let accountServers = [];
  for (let i = 0; i < accounts.Count(); i++) {
    let account = accounts.QueryElementAt(i, Ci.nsIMsgAccount);
    let accountServer = account.incomingServer;
    accountServers[i] = accountServer;
  }

  let serverTypes = firetray.Utils.getObjPref('server_types');
  if (this.sortByTypeAndName) {
    accountServers.sort(function(a,b) {
      if (serverTypes[a.type].order
          < serverTypes[b.type].order)
        return -1;
      if (serverTypes[a.type].order
          > serverTypes[b.type].order)
        return 1;
      if (a.prettyName < b.prettyName)
        return -1;
      if (a.prettyName > b.prettyName)
        return 1;
      return 0; // no sorting
    });
  }

  for (i = 0; i < accountServers.length; i++) {
    LOG("ACCOUNT: "+accountServers[i].prettyName+" type: "+accountServers[i].type);
    yield accountServers[i];
  }
};

/**
 * return accounts grouped by server_types.
 *
 * ex: { movemail: {"server1", "server2"}, imap: {"server3"} }
 */
firetray.Messaging.accountsByServerType = function() {
  let accountsByServerType = {};
  let accounts = new firetray.Messaging.Accounts(false);
  for (let accountServer in accounts) {
    let accountServerKey = accountServer.key.toString();
    let accountServerName = accountServer.prettyName;
    let accountServerType = accountServer.type;
    if (typeof(accountsByServerType[accountServerType]) == "undefined")
      accountsByServerType[accountServerType] = [];
    accountsByServerType[accountServerType].push(
      { key: accountServerKey, name: accountServerName });
  }
  return accountsByServerType;
};
