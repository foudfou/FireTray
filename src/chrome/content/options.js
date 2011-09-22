/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource:///modules/mailServices.js");
Cu.import("resource://moztray/MoztHandler.jsm");
Cu.import("resource://moztray/commons.js");

/**
 * mozt namespace.
 */
if ("undefined" == typeof(mozt)) {
  var mozt = {};
};

mozt.UIOptions = {
  accountBoxId: "accounts_box",

  onLoad: function() {
    if(mozt.Handler.inMailApp) {
      Cu.import("resource://moztray/MoztMessaging.jsm");
      this.insertMailAccountsExcluded(this.accountBoxId);
    }
  },

  insertMailAccountsExcluded: function(parentId) {
    // the DOM parent where we do appendChild
    let targetNode = document.getElementById(parentId);

    // accounts_to_exclude preference is a stringified Array containing the
    // keys of the accounts to exclude
    let accountsExcluded = mozt.Utils.prefService
      .getCharPref('accounts_to_exclude').split(',');

    // TODO: sort servers by type, name
    let accounts = MailServices.accounts.accounts;
    for (let i = 0; i < accounts.Count(); i++) {
      let account = accounts.QueryElementAt(i, Ci.nsIMsgAccount);
      let accountServer = account.incomingServer;
      if (mozt.Messaging.SERVER_TYPES_EXCLUDED.indexOf(accountServer.type) >= 0)
        continue;

      let nodeAccount = document.createElement("checkbox");
      let accountServerKey = accountServer.key.toString();
      nodeAccount.setAttribute('id', accountServerKey);
      nodeAccount.setAttribute('label', accountServer.rootFolder.name);
      nodeAccount.setAttribute('checked',
                               (accountsExcluded.indexOf(accountServerKey) >= 0));
      nodeAccount.setAttribute(
        'oncommand',
        'mozt.UIOptions.updateMailAccountsExcluded(mozt.UIOptions.accountBoxId)');
      targetNode.appendChild(nodeAccount);
    }

    // let disable_notify=prefManager.getIntPref("extensions.firetray.show_mail_notification")==0;
    // this._disableGroup(targetNode,disable_notify);
  },

  updateMailAccountsExcluded: function(parentId) {
    let targetNode = document.getElementById(parentId);

    let prefValue = [];
    for (let i=1; i < targetNode.childNodes.length; i++) {
      if (targetNode.childNodes[i].checked)
        prefValue.push(targetNode.childNodes[i].getAttribute('id'));
    }

    mozt.Utils.prefService.setCharPref('accounts_to_exclude', prefValue.toString());

    mozt.Messaging.updateUnreadMsgCount();
  },

  _disableGroup: function(group, disableval) {
    try {
      for (let i=0; i< group.childNodes.length; i++)
        group.childNodes[i].disabled = disableval;
    } catch(e) {
      ERROR(e);
    }
  }

};
