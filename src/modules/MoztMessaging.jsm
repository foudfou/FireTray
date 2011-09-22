/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = [ "mozt" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource:///modules/mailServices.js");
Cu.import("resource://gre/modules/PluralForm.jsm");
Cu.import("resource://moztray/MoztIconLinux.jsm");
Cu.import("resource://moztray/commons.js");

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
 * mozt namespace.
 */
if ("undefined" == typeof(mozt)) {
  var mozt = {};
};


mozt.Messaging = {
  // TODO: turn into pref
  SERVER_TYPES_EXCLUDED: ["nntp","rss","movemail"], // keep "pop3","imap","none"

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
    // TODO: check if count correctly updated if folder/account creation/deletion
    OnItemIntPropertyChanged: function(folder, property, oldValue, newValue) {
      if (property.toString() === "TotalUnreadMessages" &&
          !(folder.flags & FLDR_UNINTERESTING)) {
        LOG("Unread msgs for folder "+folder.prettyName+" was "+oldValue+" became "+newValue);
        mozt.Messaging.updateUnreadMsgCount();
      }
    }
  },

  /**
   * gets the accounts_to_exclude preference which is a stringified Array
   * containing the keys of the accounts to exclude
   */
  getPrefAccountsExcluded: function() {
    return mozt.Utils.prefService.getCharPref('accounts_to_exclude').split(',') || [];
  },

  /**
   * computes total unread message count
   * TODO: check news accounts shouldn't be considered
   */
  updateUnreadMsgCount: function() {
    LOG("unreadMsgCount");

    this._unreadMsgCount = 0;   // reset
    try {
      let exclCond = function(account) {
        return ( (mozt.Messaging.SERVER_TYPES_EXCLUDED.indexOf(account.type) >= 0)
          || (mozt.Messaging.getPrefAccountsExcluded().indexOf(account.key) >= 0) );
      };

      let accounts = new this.Accounts(exclCond);
      for (let accountServer in accounts) {
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
      mozt.IconLinux.setImageDefault();
      mozt.IconLinux.setTooltipDefault();
    } else if (this._unreadMsgCount > 0) {
      mozt.IconLinux.setText(this._unreadMsgCount.toString(), ICON_TEXT_COLOR);
      let localizedMessage = PluralForm.get(
        this._unreadMsgCount,
        mozt.Utils.strings.GetStringFromName("tooltip.unread_messages"))
        .replace("#1", this._unreadMsgCount);;
      mozt.IconLinux.setTooltip(localizedMessage);
    } else {
      ERROR("negative unread messages' count ?"); // should never happen
      throw "negative message count"; // should never happen
    }

  },

  /**
   * Accounts constructor for iterating over account servers
   * @param exclusionCondition: a function which expresses a condition for excluding accounts
   */
  Accounts: function(exclusionCondition) {
    if (typeof(exclusionCondition) == "undefined") {
      this.exclusionCondition = function(){return false;};
      return;
    } else if (typeof(exclusionCondition) != "function") {
      throw "arg must be a function";
      return;
    } else
      this.exclusionCondition = exclusionCondition;
  }

};

/**
 * make Accounts a Iterator/Generator
 */
mozt.Messaging.Accounts.prototype.__iterator__ = function() {
  let accounts = MailServices.accounts.accounts;
  for (let i = 0; i < accounts.Count(); i++) {
    let account = accounts.QueryElementAt(i, Ci.nsIMsgAccount);
    let accountServer = account.incomingServer;
    LOG("ACCOUNT: "+accountServer.prettyName+" type: "+accountServer.type);
    if ( this.exclusionCondition.call(this, accountServer) )
      continue;

     yield accountServer;
  }
}
