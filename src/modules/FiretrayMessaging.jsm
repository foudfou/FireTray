/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = [ "firetray", "FLDRS_UNINTERESTING" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource:///modules/mailServices.js");
Cu.import("resource://gre/modules/PluralForm.jsm");
Cu.import("resource://firetray/commons.js");
Cu.import("resource://firetray/FiretrayInstantMessaging.jsm");

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
  currentMsgCount: null,
  observedTopics: {},

  init: function() {
    if (this.initialized) {
      F.WARN("Messaging already initialized");
      return;
    }
    F.LOG("Enabling Messaging");

    firetray.Utils.addObservers(firetray.Messaging, [ "account-added",
      "account-removed"]);

    let that = this;
    MailServices.mailSession.AddFolderListener(that.mailSessionListener,
                                               that.mailSessionListener.notificationFlags);

    // FIXME: add im-icon pref
    // FIXME: watch out account-added !!
    if (Services.prefs.getBoolPref("mail.chat.enabled") && this.existsIMAccount()) {
      firetray.InstantMessaging.init();
      firetray.Handler.isIMEnabled = true;
    }

    this.initialized = true;
  },

  shutdown: function() {
    if (!this.initialized) return;
    F.LOG("Disabling Messaging");

    firetray.InstantMessaging.shutdown();

    MailServices.mailSession.RemoveFolderListener(this.mailSessionListener);

    firetray.Utils.removeAllObservers(firetray.Messaging);

    this.initialized = false;
  },

  // FIXME: this should definetely be done in InstantMessaging, but IM accounts
  // seem not be initialized at this stage (Exception... "'TypeError:
  // this._items is undefined' when calling method:
  // [nsISimpleEnumerator::hasMoreElements]"), and we're unsure if we should
  // initAccounts() ourselves...
  existsIMAccount: function() {
    let accounts = new this.Accounts();
    for (let accountServer in accounts)
      if (accountServer.type === 'im')  {
        F.LOG("found im server: "+accountServer.prettyName);
        return true;
      }

    return false;
  },

  observe: function(subject, topic, data) {
    F.LOG("RECEIVED Messaging: "+topic+" subject="+subject+" data="+data);
    switch (topic) {
    case "account-removed":
      this.cleanExcludedAccounts();
      if (subject.QueryInterface(Ci.imIAccount) && !this.existsIMAccount())
        firetray.InstantMessaging.shutdown();
      // FIXME: clean InstantMessaging.accounts or just update (?)
      break;
    case "account-added":
      if (subject.QueryInterface(Ci.imIAccount) && !firetray.InstantMessaging.initialized)
        firetray.InstantMessaging.init();
      // FIXME: clean InstantMessaging.accounts or just update (?)
      break;
    default:
      F.WARN("unhandled topic: "+topic);
    }
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

  // https://bugzilla.mozilla.org/show_bug.cgi?id=715799 for TB15+
  // mozINewMailNotificationService (alternative message counting)
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
      this.onMsgCountChange(item, property, oldValue, newValue);
    },

    OnItemBoolPropertyChanged: function(item, property, oldValue, newValue) { // NewMessages (per folder)
      F.LOG("OnItemBoolPropertyChanged "+property+" for folder "+item.prettyName+" was "+oldValue+" became "+newValue+" NEW MESSAGES="+item.getNumNewMessages(true));
      this.onMsgCountChange(item, property, oldValue, newValue);
    },

    OnItemPropertyFlagChanged: function(item, property, oldFlag, newFlag) {
      F.LOG("OnItemPropertyFlagChanged"+property+" for "+item+" was "+oldFlag+" became "+newFlag);
    },

    OnItemEvent: function(item, event) {
      F.LOG("OnItemEvent"+event+" for folder "+item.prettyName);
    },

    onMsgCountChange: function(item, property, oldValue, newValue) {
      let excludedFoldersFlags = firetray.Utils.prefService.getIntPref("excluded_folders_flags");
      let msgCountType = firetray.Utils.prefService.getIntPref("message_count_type");

      if (!(item.flags & excludedFoldersFlags)) {
        let prop = property.toString();
        if (msgCountType === FIRETRAY_MESSAGE_COUNT_TYPE_UNREAD &&
            prop === "TotalUnreadMessages") {
          firetray.Messaging.updateMsgCountWithCb();
        } else if (msgCountType === FIRETRAY_MESSAGE_COUNT_TYPE_NEW &&
                   prop === "NewMessages") {
          if (oldValue === true && newValue === false)
            item.setNumNewMessages(0); // https://bugzilla.mozilla.org/show_bug.cgi?id=727460
          firetray.Messaging.updateMsgCountWithCb();
        }
      }
    }
  },

  /**
   * @param callback: optional callback to call when msgCount changed.
   */
  updateMsgCountWithCb: function(callback) {
    F.LOG("updateMsgCountWithCb");
    if (!this.initialized) return;

    if ("undefined" === typeof(callback) || !callback) callback = function() { // default
      firetray.Messaging.updateIcon(msgCount);

      let mailChangeTriggerFile = firetray.Utils.prefService.getCharPref("mail_change_trigger");
      if (mailChangeTriggerFile)
        firetray.Messaging.runProcess(mailChangeTriggerFile, [msgCount.toString()]);
    };

    let msgCount;
    let msgCountType = firetray.Utils.prefService.getIntPref("message_count_type");
    F.LOG("msgCountType="+msgCountType);
    if (msgCountType === FIRETRAY_MESSAGE_COUNT_TYPE_UNREAD) {
      msgCount = this.countMessages(this.unreadMsgCountIterate);
    } else if (msgCountType === FIRETRAY_MESSAGE_COUNT_TYPE_NEW) {
      msgCount = this.countMessages(this.newMsgCountIterate);
    } else
      F.ERROR('unknown message count type');

    if (msgCount !== this.currentMsgCount) {
      callback.call(this);
      this.currentMsgCount = msgCount;
    } else {
      F.LOG("message count unchanged");
    }

  },

  updateIcon: function(msgCount) {
    if ("undefined" === typeof(msgCount)) msgCount = this.currentMsgCount;

    let localizedTooltip;
    let msgCountType = firetray.Utils.prefService.getIntPref("message_count_type");
    if (msgCountType === FIRETRAY_MESSAGE_COUNT_TYPE_UNREAD) {
      localizedTooltip = PluralForm.get(
        msgCount,
        firetray.Utils.strings.GetStringFromName("tooltip.unread_messages"))
        .replace("#1", msgCount);
      F.LOG(localizedTooltip);
    } else if (msgCountType === FIRETRAY_MESSAGE_COUNT_TYPE_NEW) {
      localizedTooltip = firetray.Utils.strings.GetStringFromName("tooltip.new_messages");
    } else
      F.ERROR('unknown message count type');

    if (msgCount == 0) {
      firetray.Handler.setIconImageDefault();
      firetray.Handler.setIconTooltipDefault();

    } else if (msgCount > 0) {
      let prefMailNotification = firetray.Utils.prefService.getIntPref('mail_notification_type');
      switch (prefMailNotification) {
      case FIRETRAY_NOTIFICATION_UNREAD_MESSAGE_COUNT:
        let prefIconTextColor = firetray.Utils.prefService.getCharPref("icon_text_color");
        firetray.Handler.setIconText(msgCount.toString(), prefIconTextColor);
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

    let msgCount = 0;
    try {
      let accounts = new this.Accounts();
      for (let accountServer in accounts) {
        if (accountServer.type === 'im') continue; // IM messages are counted elsewhere
        F.LOG("is servertype excluded: "+serverTypes[accountServer.type].excluded+", account exclusion index: "+excludedAccounts.indexOf(accountServer.key));
        if (serverTypes[accountServer.type].excluded ||
            (excludedAccounts.indexOf(accountServer.key) >= 0))
          continue;

        let rootFolder = accountServer.rootFolder; // nsIMsgFolder
        if (rootFolder.hasSubFolders) {
          let subFolders = rootFolder.subFolders;
          while (subFolders.hasMoreElements()) {
            let folder = subFolders.getNext().QueryInterface(Ci.nsIMsgFolder);
            if (!(folder.flags & excludedFoldersFlags)) {
              msgCount = folderCountFunction(folder, msgCount);
            }
          }
        }
      }
    } catch (x) {
      F.ERROR(x);
    }
    F.LOG("Total New="+msgCount);
    return msgCount;
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
  },

  runProcess: function(filepath, args) {
    F.LOG("runProcess="+filepath+" args="+args);
    try {
      // create a file for the process
      var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile); // TODO: nsILocalFile merged into the nsIFile in Gecko 14
      file.initWithPath(filepath);

      // create the process
      var process = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
      process.init(file);

      process.run(false, args, args.length);
    } catch(x) {F.ERROR(x);}
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
