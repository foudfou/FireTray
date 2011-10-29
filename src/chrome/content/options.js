/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://firetray/FiretrayHandler.jsm");
Cu.import("resource://firetray/commons.js");

/**
 * firetray namespace.
 */
if ("undefined" == typeof(firetray)) {
  var firetray = {};
};

firetray.UIOptions = {
  accountBoxId: "ui_accounts_box",

  onLoad: function() {
    if(firetray.Handler.inMailApp) {
      Cu.import("resource://firetray/FiretrayMessaging.jsm");
      this.insertMailAccountsExcluded(this.accountBoxId);
      this.populateMailAccountTypes();
    } else {
      this.hideElement("mail_tab");
    }

    this.populateTreeServerTypes();
  },

  onQuit: function() {
    // FIXME: removeEventListener on cells !
  },

  hideElement: function(parentId) {
    let targetNode = document.getElementById(parentId);
    targetNode.hidden = true; //!(appType & Firetray_MAIL);
  },

  populateMailAccountTypes: function() {
    let targetTree = document.getElementById("ui_mail_account_types");

    for (t in firetray.Messaging.SERVER_TYPES) {
      let accType = firetray.Messaging.SERVER_TYPES[t];

      let item = document.createElement('treeitem');
      let row = document.createElement('treerow');
      item.appendChild(row);

      let cell = document.createElement('treecell');
      cell.setAttribute('label',t);
      row.appendChild(cell);

      cell = document.createElement('treecell');
      cell.setAttribute('value',accType.excluded);
      row.appendChild(cell);

      cell = document.createElement('treecell');
      cell.setAttribute('label',accType.order);
      row.appendChild(cell);

      targetTree.appendChild(item);
    }
  },

  insertMailAccountsExcluded: function(parentId) {
    // the DOM parent where we do appendChild
    let targetNode = document.getElementById(parentId);

    let accounts = new firetray.Messaging.Accounts(true);
    for (let accountServer in accounts) {
      if (firetray.Messaging.SERVER_TYPES[accountServer.type].excluded)
        continue;

      let nodeAccount = document.createElement("checkbox");
      let accountServerKey = accountServer.key.toString();
      nodeAccount.setAttribute('id', accountServerKey);
      nodeAccount.setAttribute('label', accountServer.rootFolder.name);
      nodeAccount.setAttribute('checked',
        (firetray.Messaging.getPrefAccountsExcluded().indexOf(accountServerKey) >= 0));
      let that = this;
      nodeAccount.addEventListener('command', function(e){
        that.updateMailAccountsExcluded(that.accountBoxId);}, true);
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
    firetray.Messaging.setPrefAccountsExcluded(prefValue);

    firetray.Messaging.updateUnreadMsgCount();
  },

  _disableGroup: function(group, disableval) {
    try {
      for (let i=0; i< group.childNodes.length; i++)
        group.childNodes[i].disabled = disableval;
    } catch(e) {
      ERROR(e);
    }
  },

  /*
   * Save SERVER_TYPES to the "server_types" preference.
   * This is called by the pref's system when the GUI element is altered.
   */
  saveTreeServerTypes: function() {
    let tree = document.getElementById("ui_tree_server_types");

    LOG("VIEW="+ tree.view + ", rowCount="+tree.view.rowCount);
    let prefObj = {};
    for (let i=0; i < tree.view.rowCount; i++) {
      let serverTypeExcluded = (
        tree.view.getCellValue(
          i, tree.columns.getNamedColumn("server_type_excluded"))
          === 'true');
      let serverTypeName = tree.view.getCellText(
        i, tree.columns.getNamedColumn("server_type_name"));
      let serverTypeOrder = parseInt(tree.view.getCellText(
                                       i, tree.columns.getNamedColumn("server_type_order")));
      LOG("SUPER: "+serverTypeName+", "+serverTypeExcluded);
      prefObj[serverTypeName] =
        { order: serverTypeOrder, excluded: serverTypeExcluded };
    }

    let prefStr = JSON.stringify(prefObj);
    // let prefStr = JSON.stringify(treeView.model);
    LOG("prefStr"+prefStr);

    /* return the new prefString to be stored by pref system */
    return prefStr;
  },

  populateTreeServerTypes: function() {
    let prefPane = document.getElementById("pane1");

    let prefStr = firetray.Utils.prefService.getCharPref("server_types");
    LOG("PREF="+prefStr);
    let prefObj = JSON.parse(prefStr);

    let target = document.getElementById("ui_server_types");
    for (serverTypeName in prefObj) {
      let name = prefObj[serverTypeName];

      let item = document.createElement('treeitem');
      let row = document.createElement('treerow');
      item.appendChild(row);

      // server_type_excluded => checkbox
      let cell = document.createElement('treecell');
      cell.setAttribute('value',prefObj[serverTypeName].excluded);
      // FIXME: we need to removeEventListener() !!! (onQuit)
      cell.addEventListener(
        'DOMAttrModified', function(event) {
          if (event.attrName == "label") LOG("label changed!");
          if (event.attrName == "value") LOG("value changed!");
          document.getElementById("pane1")
            .userChangedValue(document.getElementById("ui_tree_server_types"));
        }, true);
      row.appendChild(cell);

      // server_type_name
      cell = document.createElement('treecell');
      cell.setAttribute('label',serverTypeName);
      cell.setAttribute('editable',false);
      row.appendChild(cell);

      // server_type_order
      cell = document.createElement('treecell');
      cell.setAttribute('label',prefObj[serverTypeName].order);
      // FIXME: refactor !!
      cell.addEventListener(
        'DOMAttrModified', function(event) {
          if (event.attrName == "label") LOG("label changed!");
          if (event.attrName == "value") LOG("value changed!");
          document.getElementById("pane1")
            .userChangedValue(document.getElementById("ui_tree_server_types"));
        }, true);
      row.appendChild(cell);

      target.appendChild(item);
    }

    let tree = document.getElementById("ui_tree_server_types");
    let that = this;
    tree.addEventListener("keypress", that.onKeyPressTreeServerTypes, true);
  },

  onKeyPressTreeServerTypes: function(event) {
    LOG("TREE KEYPRESS: "+event.originalTarget);
    let tree = document.getElementById("ui_tree_server_types");
    let col = tree.editingColumn; // col.index

    // only int allowed
    if (col == tree.columns.getNamedColumn("server_type_order")) {
      let charCode = event.which || event.keyCode;
      let charStr = String.fromCharCode(charCode);
      if (!/\d/.test(charStr))
        event.preventDefault();
    }
  },

};

