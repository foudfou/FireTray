/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = [ "firetray", "FLDRS_UNINTERESTING" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource:///modules/mailServices.js");
Cu.import("resource://gre/modules/PluralForm.jsm");
// Cu.import("resource://firetray/FiretrayHandler.jsm");
Cu.import("resource://firetray/commons.js");

const FLDRS_UNINTERESTING = {
  Archive:   Ci.nsMsgFolderFlags.Archive,
  Drafts:    Ci.nsMsgFolderFlags.Drafts,
  Junk:      Ci.nsMsgFolderFlags.Junk,
  Queue:     Ci.nsMsgFolderFlags.Queue,
  SentMail:  Ci.nsMsgFolderFlags.SentMail,
  Templates: Ci.nsMsgFolderFlags.Templates,
  Trash:     Ci.nsMsgFolderFlags.Trash
};

/**
 * firetray namespace.
 */
if ("undefined" == typeof(firetray)) {
  var firetray = {};
};


firetray.Messaging = {
  _unreadMsgCount: 0,
  enabled: false,

  enable: function() {
    if (this.enabled) {
      LOG("Messaging already enabled");
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

    MailServices.mailSession.RemoveFolderListener(this.mailSessionListener);
    firetray.Handler.setImageDefault();

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
      let excludedFoldersFlags = firetray.Utils.prefService
        .getIntPref("excluded_folders_flags");
      if (property.toString() === "TotalUnreadMessages" &&
          !(folder.flags & excludedFoldersFlags)) {
        LOG("Unread msgs for folder "+folder.prettyName+" was "+oldValue+" became "+newValue);
        firetray.Messaging.updateUnreadMsgCount();
      }
    }
  },

  /**
   * computes total unread message count
   */
  updateUnreadMsgCount: function() {
    LOG("unreadMsgCount");
    let prefMailNotification = firetray.Utils.prefService.getIntPref("mail_notification");
    if (prefMailNotification === NOTIFICATION_DISABLED)
      return;

    let mailAccounts = firetray.Utils.getObjPref('mail_accounts');
    let serverTypes = mailAccounts["serverTypes"];
    let excludedAccounts = mailAccounts["excludedAccounts"];
    let excludedFoldersFlags = firetray.Utils.prefService
      .getIntPref("excluded_folders_flags");

    this._unreadMsgCount = 0;   // reset
    try {
      let accounts = new this.Accounts();
      for (let accountServer in accounts) {
        if ( (serverTypes[accountServer.type].excluded)
          || (excludedAccounts.indexOf(accountServer.key) >= 0) )
          continue;

        let rootFolder = accountServer.rootFolder; // nsIMsgFolder
        if (rootFolder.hasSubFolders) {
          let subFolders = rootFolder.subFolders; // nsIMsgFolder
          while(subFolders.hasMoreElements()) {
            let folder = subFolders.getNext().QueryInterface(Ci.nsIMsgFolder);
            if (!(folder.flags & excludedFoldersFlags)) {
              LOG(folder.prettyName+" unread="+folder.getNumUnread(true));
              this._unreadMsgCount += folder.getNumUnread(true); // includes subfolders
            }
          }
        }
      }
    } catch (x) {
      ERROR(x);
    }
    LOG("TotalUnread="+this._unreadMsgCount);

    // update icon
    if (this._unreadMsgCount == 0) {
      firetray.Handler.setImageDefault();
      firetray.Handler.setTooltipDefault();

    } else if (this._unreadMsgCount > 0) {
      switch (prefMailNotification) {

      case NOTIFICATION_UNREAD_MESSAGE_COUNT:
        let prefIconTextColor = firetray.Utils.prefService.getCharPref("icon_text_color");
        firetray.Handler.setText(this._unreadMsgCount.toString(), prefIconTextColor);
        break;
      case NOTIFICATION_NEWMAIL_ICON:
        firetray.Handler.setImage(firetray.Handler.FILENAME_NEWMAIL);
        break;
      case NOTIFICATION_CUSTOM_ICON:
        let prefCustomIconPath = firetray.Utils.prefService.getCharPref("custom_mail_icon");
        firetray.Handler.setImage(prefCustomIconPath);
        break;
      default:
        ERROR("Unknown notification mode");
      }

      let localizedMessage = PluralForm.get(
        this._unreadMsgCount,
        firetray.Utils.strings.GetStringFromName("tooltip.unread_messages"))
        .replace("#1", this._unreadMsgCount);;
      firetray.Handler.setTooltip(localizedMessage);

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

  let mailAccounts = firetray.Utils.getObjPref('mail_accounts');
  let serverTypes = mailAccounts["serverTypes"];
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
 * return accounts grouped by mail_accounts.
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
