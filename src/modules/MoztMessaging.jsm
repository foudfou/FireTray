/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = [ "mozt" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource:///modules/mailServices.js");
Cu.import("resource://moztray/commons.js");

const FLDR_UNINTERESTING =
  Ci.nsMsgFolderFlags.Archive |
  Ci.nsMsgFolderFlags.Drafts |
  Ci.nsMsgFolderFlags.Junk |
  Ci.nsMsgFolderFlags.Queue |
  Ci.nsMsgFolderFlags.SentMail |
  Ci.nsMsgFolderFlags.Templates |
  Ci.nsMsgFolderFlags.Trash;

/**
 * mozt namespace.
 */
if ("undefined" == typeof(mozt)) {
  var mozt = {};
};

mozt.Messaging = {
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
    // doesn't seem like we also needed a
    // MailServices.mfn.addListener(that.notificationServiceListener,
    // msgFolderNotificationFlags);

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
    // TODO: check count correctly updated if folder/account creation/deletion
    OnItemIntPropertyChanged: function(folder, property, oldValue, newValue) {
      LOG("OnItemIntPropertyChanged fired with property: "+property);

      switch (property.toString())  {
      case "TotalUnreadMessages":
        if (!(folder.flags & FLDR_UNINTERESTING)) {
          LOG("Unread msgs for folder "+folder.prettyName+" was "+oldValue+" became "+newValue);
          mozt.Messaging.updateUnreadMsgCount();
        }
        break;
      default:
      }
    }
  },

  /**
   * computes total unread message count
   * TODO: check news accounts shouldn't be considered
   */
  updateUnreadMsgCount: function() {
    LOG("unreadMsgCount");
    this._unreadMsgCount = 0;   // reset
    try {
      let accounts = MailServices.accounts.accounts;
      for (let i = 0; i < accounts.Count(); i++) {
        let account = accounts.QueryElementAt(i, Ci.nsIMsgAccount);
        LOG("ACCOUNT: "+account.incomingServer.prettyName+" type: "+account.incomingServer.type);
        let rootFolder = account.incomingServer.rootFolder; // nsIMsgFolder
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
  }

};


function hasMultipleAccounts() {
  let count = 0;
  // We don't want to just call Count() on the account nsISupportsArray, as we
  // want to filter out accounts with "none" as the incoming server type
  // (eg, for Local Folders)
  for (let account in fixIterator(MailServices.accounts.accounts, Ci.nsIMsgAccount)) {
    if (account.incomingServer.type != "none") {
      count++
    }
  }

  return count > 1;
}
