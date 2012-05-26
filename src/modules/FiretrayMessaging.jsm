/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = [ "firetray", "FLDRS_UNINTERESTING" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource:///modules/mailServices.js");
Cu.import("resource://gre/modules/PluralForm.jsm");
Cu.import("resource://firetray/commons.js");

const FLDRS_UNINTERESTING = {
  Archive:   Ci.nsMsgFolderFlags.Archive,
  Drafts:    Ci.nsMsgFolderFlags.Drafts,
  Junk:      Ci.nsMsgFolderFlags.Junk,
  Queue:     Ci.nsMsgFolderFlags.Queue,
  SentMail:  Ci.nsMsgFolderFlags.SentMail,
  Templates: Ci.nsMsgFolderFlags.Templates,
  Trash:     Ci.nsMsgFolderFlags.Trash,
  Virtual:   Ci.nsMsgFolderFlags.Virtual
};


firetray.Messaging = {
  initialized: false,
  cleaningTimer: null,
  oldMsgCount: 0,

  init: function() {
    if (this.initialized) {
      F.WARN("Messaging already initialized");
      return;
    }
    F.LOG("Enabling Messaging");

    // there is no means to detect account-removed event
    this.cleaningTimer = firetray.Utils.timer(firetray.Messaging.cleanExcludedAccounts,
      FIRETRAY_DELAY_PREF_CLEANING_MILLISECONDS, Ci.nsITimer.TYPE_REPEATING_SLACK);
    F.LOG(this.cleaningTimer+"="+FIRETRAY_DELAY_PREF_CLEANING_MILLISECONDS);

    let that = this;
    MailServices.mailSession.AddFolderListener(that.mailSessionListener,
                                               that.mailSessionListener.notificationFlags);

    this.initialized = true;
  },

  shutdown: function() {
    if (!this.initialized)
      return;
    F.LOG("Disabling Messaging");

    this.cleaningTimer.cancel();

    MailServices.mailSession.RemoveFolderListener(this.mailSessionListener);
    firetray.Handler.setIconImageDefault();

    this.initialized = false;
  },

  /* removes removed accounts from excludedAccounts pref. NOTE: Can't be called
    at shutdown because MailServices.accounts no longer available */
  cleanExcludedAccounts: function() {
    F.LOG("* cleaning *");
    let mailAccounts = firetray.Utils.getObjPref('mail_accounts');
    let excludedAccounts = mailAccounts["excludedAccounts"];

    // build current list of account server keys
    let accounts = MailServices.accounts.accounts;
    let accountServerKeys = [];
    for (let i=0, len=accounts.Count(); i<len; ++i) {
      let account = accounts.QueryElementAt(i, Ci.nsIMsgAccount);
      accountServerKeys[i] = account.incomingServer.key;
    }

    let newExcludedAccounts = [], cleaningNeeded = 0;
    for (let i=0, len=excludedAccounts.length; i<len; ++i) {
      let excludedAccount = excludedAccounts[i];
      if (accountServerKeys.indexOf(excludedAccount) >= 0)
        newExcludedAccounts.push(excludedAccount);
      else
        cleaningNeeded += 1;
    }

    if (cleaningNeeded) {
      F.LOG("cleaning excluded accounts");
      let prefObj = {"serverTypes":mailAccounts["serverTypes"], "excludedAccounts":newExcludedAccounts};
      firetray.Utils.setObjPref('mail_accounts', prefObj);
    }
  },

  /* http://mxr.mozilla.org/comm-central/source/mailnews/base/public/nsIFolderListener.idl */
  mailSessionListener: {
    notificationFlags:
      // Ci.nsIFolderListener.propertyChanged |
      // Ci.nsIFolderListener.propertyFlagChanged |
      // Ci.nsIFolderListener.event |
      Ci.nsIFolderListener.boolPropertyChanged |
      Ci.nsIFolderListener.intPropertyChanged,

    OnItemPropertyChanged: function(item, property, oldValue, newValue) { // NumNewBiffMessages
      F.LOG("OnItemPropertyChanged "+property+" for folder "+item.prettyName+" was "+oldValue+" became "+newValue+" NEW MESSAGES="+item.getNumNewMessages(true));
    },

    OnItemIntPropertyChanged: function(item, property, oldValue, newValue) { // TotalUnreadMessages, BiffState (per server)
      F.LOG("OnItemIntPropertyChanged "+property+" for folder "+item.prettyName+" was "+oldValue+" became "+newValue+" NEW MESSAGES="+item.getNumNewMessages(true));
      this.updateMsgCount(item, property, oldValue, newValue);
    },

    OnItemBoolPropertyChanged: function(item, property, oldValue, newValue) { // NewMessages (per folder)
      F.LOG("OnItemBoolPropertyChanged "+property+" for folder "+item.prettyName+" was "+oldValue+" became "+newValue+" NEW MESSAGES="+item.getNumNewMessages(true));
      this.updateMsgCount(item, property, oldValue, newValue);
    },

    OnItemPropertyFlagChanged: function(item, property, oldFlag, newFlag) {
      F.LOG("OnItemPropertyFlagChanged"+property+" for "+item+" was "+oldFlag+" became "+newFlag);
    },

    OnItemEvent: function(item, event) {
      F.LOG("OnItemEvent"+event+" for folder "+item.prettyName);
    },

    updateMsgCount: function(item, property, oldValue, newValue) {
      let excludedFoldersFlags = firetray.Utils.prefService.getIntPref("excluded_folders_flags");
      let msgCountType = firetray.Utils.prefService.getIntPref("message_count_type");

      if (!(item.flags & excludedFoldersFlags)) {
        let prop = property.toString();
        if (msgCountType === FIRETRAY_MESSAGE_COUNT_TYPE_UNREAD &&
            prop === "TotalUnreadMessages") {
          firetray.Messaging.updateMsgCount();
        } else if (msgCountType === FIRETRAY_MESSAGE_COUNT_TYPE_NEW &&
                   prop === "NewMessages") {
          if (oldValue === true && newValue === false)
            item.setNumNewMessages(0); // https://bugzilla.mozilla.org/show_bug.cgi?id=727460
          firetray.Messaging.updateMsgCount();
        }
      }
    }
  },
  
  runNewMailScript: function() {
    // create a file for the process
    var file = Components.classes["@mozilla.org/file/local;1"]  
                     .createInstance(Components.interfaces.nsILocalFile);  
    file.initWithPath(firetray.Utils.prefService.getCharPref("new_mail_script"));
    
    // create the process
    var process = Components.classes["@mozilla.org/process/util;1"]  
                        .createInstance(Components.interfaces.nsIProcess);  
    process.init(file);
    
    var args = [ ];  
    process.run(false, args, args.length);
  },
  
  runNoNewMailScript: function() {
    // create a file for the process
    var file = Components.classes["@mozilla.org/file/local;1"]  
                     .createInstance(Components.interfaces.nsILocalFile);  
    file.initWithPath(firetray.Utils.prefService.getCharPref("no_new_mail_script"));
    
    // create the process
    var process = Components.classes["@mozilla.org/process/util;1"]  
                        .createInstance(Components.interfaces.nsIProcess);  
    process.init(file);
    
    var args = [ ];  
    process.run(false, args, args.length);
  },

  /**
   * computes and display new msg count
   */
  updateMsgCount: function() {
    F.LOG("updateMsgCount");
    if (!this.initialized)
      return;

    // initialize
    let newMsgCount, localizedTooltip;
    let msgCountType = firetray.Utils.prefService.getIntPref("message_count_type");
    F.LOG("msgCountType="+msgCountType);
    if (msgCountType === FIRETRAY_MESSAGE_COUNT_TYPE_UNREAD) {
      newMsgCount = this.countMessages(this.unreadMsgCountIterate);
      localizedTooltip = PluralForm.get(
        newMsgCount,
        firetray.Utils.strings.GetStringFromName("tooltip.unread_messages"))
        .replace("#1", newMsgCount);
      F.LOG(localizedTooltip);
    } else if (msgCountType === FIRETRAY_MESSAGE_COUNT_TYPE_NEW) {
      newMsgCount = this.countMessages(this.newMsgCountIterate);
      localizedTooltip = firetray.Utils.strings.GetStringFromName("tooltip.new_messages");
    } else
      F.ERROR('unknown message count type');

    // update icon
    if (newMsgCount == 0) {
      firetray.Handler.setIconImageDefault();
      firetray.Handler.setIconTooltipDefault();
      if (this.oldMsgCount > 0) {
        this.runNoNewMailScript();
      }

    } else if (newMsgCount > 0) {
      this.runNewMailScript();
      let prefMailNotification = firetray.Utils.prefService.getIntPref('mail_notification_type');
      switch (prefMailNotification) {
      case FIRETRAY_NOTIFICATION_UNREAD_MESSAGE_COUNT:
        let prefIconTextColor = firetray.Utils.prefService.getCharPref("icon_text_color");
        firetray.Handler.setIconText(newMsgCount.toString(), prefIconTextColor);
        break;
      case FIRETRAY_NOTIFICATION_NEWMAIL_ICON:
        firetray.Handler.setIconImageNewMail();
        break;
      case FIRETRAY_NOTIFICATION_CUSTOM_ICON:
        let prefCustomIconPath = firetray.Utils.prefService.getCharPref("custom_mail_icon");
        firetray.Handler.setIconImageFromFile(prefCustomIconPath);
        break;
      default:
        F.ERROR("Unknown notification mode: "+prefMailNotification);
      }

      firetray.Handler.setIconTooltip(localizedTooltip);

    } else {
      throw "negative message count"; // should never happen
    }
    this.oldMsgCount = newMsgCount;

  },

  /**
   * computes total unread or new message count.
   */
  countMessages: function(folderCountFunction) {
    let mailAccounts = firetray.Utils.getObjPref('mail_accounts');
    F.LOG("mail accounts from pref: "+JSON.stringify(mailAccounts));
    let serverTypes = mailAccounts["serverTypes"];
    let excludedAccounts = mailAccounts["excludedAccounts"];
    let excludedFoldersFlags = firetray.Utils.prefService
      .getIntPref("excluded_folders_flags");

    let newMsgCount = 0;
    try {
      let accounts = new this.Accounts();
      for (let accountServer in accounts) {
        F.LOG("is servertype excluded: "+serverTypes[accountServer.type].excluded+", account exclusion index: "+excludedAccounts.indexOf(accountServer.key));
        if ( (serverTypes[accountServer.type].excluded)
          || (excludedAccounts.indexOf(accountServer.key) >= 0) )
          continue;

        let rootFolder = accountServer.rootFolder; // nsIMsgFolder
        if (rootFolder.hasSubFolders) {
          let subFolders = rootFolder.subFolders;
          while(subFolders.hasMoreElements()) {
            let folder = subFolders.getNext().QueryInterface(Ci.nsIMsgFolder);
            if (!(folder.flags & excludedFoldersFlags)) {
              newMsgCount = folderCountFunction(folder, newMsgCount);
            }
          }
        }
      }
    } catch (x) {
      F.ERROR(x);
    }
    F.LOG("Total New="+newMsgCount);
    return newMsgCount;
  },

  unreadMsgCountIterate: function(folder, accumulator) {
    let folderCountFunctionName = 'getNumUnread';
    let folderUnreadMsgCount = folder[folderCountFunctionName](
      firetray.Utils.prefService.getBoolPref("folder_count_recursive"));
    F.LOG(folder.prettyName+" "+folderCountFunctionName+"="+folderUnreadMsgCount);
    return accumulator + folderUnreadMsgCount;
  },

  newMsgCountIterate: function(folder, accumulator) {
    if (folder.hasSubFolders && firetray.Utils.prefService.getBoolPref("folder_count_recursive")) {
      F.LOG("hasSubFolders");
      let subFolders = folder.subFolders;
      while(subFolders.hasMoreElements()) {
        let subFolder = subFolders.getNext().QueryInterface(Ci.nsIMsgFolder);
        accumulator = firetray.Messaging.newMsgCountIterate(subFolder, accumulator);
      }
    }
    accumulator = firetray.Messaging.addHasNewMessages(folder, accumulator);
    return accumulator;
  },

  addHasNewMessages: function(folder, accumulator) {
      let folderNewMsgCount = folder.hasNewMessages;
      F.LOG(folder.prettyName+" hasNewMessages="+folderNewMsgCount);
      return accumulator || folderNewMsgCount;
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
  F.LOG("sortByTypeAndName="+this.sortByTypeAndName);

  /* NOTE: sort() not provided by nsIMsgAccountManager.accounts
   (nsISupportsArray, nsICollection). Should be OK to re-build a JS-Array for
   few accounts */
  let accountServers = [];
  for (let i=0, len=accounts.Count(); i<len; ++i) {
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

  for (let i=0, len=accountServers.length; i<len; ++i) {
    F.LOG("ACCOUNT: "+accountServers[i].prettyName+" type: "+accountServers[i].type);
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
