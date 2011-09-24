/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource:///modules/mailServices.js");
Cu.import("resource://firetray/FiretrayHandler.jsm");
Cu.import("resource://firetray/commons.js");

/**
 * firetray namespace.
 */
if ("undefined" == typeof(firetray)) {
  var firetray = {};
};

firetray.UIOptions = {
  accountBoxId: "accounts_box",

  onLoad: function() {
    if(firetray.Handler.inMailApp) {
      Cu.import("resource://firetray/FiretrayMessaging.jsm");
      this.insertMailAccountsExcluded(this.accountBoxId);
    }
  },

  insertMailAccountsExcluded: function(parentId) {
    // the DOM parent where we do appendChild
    let targetNode = document.getElementById(parentId);

    let accounts = new firetray.Messaging.Accounts(true);
    for (let accountServer in accounts) {
      if (firetray.Messaging.SERVER_TYPES_EXCLUDED.indexOf(accountServer.type) >= 0)
        continue;

      let nodeAccount = document.createElement("checkbox");
      let accountServerKey = accountServer.key.toString();
      nodeAccount.setAttribute('id', accountServerKey);
      nodeAccount.setAttribute('label', accountServer.rootFolder.name);
      nodeAccount.setAttribute('checked',
        (firetray.Messaging.getPrefAccountsExcluded().indexOf(accountServerKey) >= 0));
      nodeAccount.setAttribute('oncommand',
        'firetray.UIOptions.updateMailAccountsExcluded(firetray.UIOptions.accountBoxId)');
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

    LOG("accounts_to_exclude:"+prefValue);
    firetray.Utils.prefService.setCharPref('accounts_to_exclude', prefValue.toString());

    firetray.Messaging.updateUnreadMsgCount();
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
