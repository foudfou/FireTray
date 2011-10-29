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
      this.populateTreeServerTypes();
      this.insertMailAccountsExcluded(this.accountBoxId);
    } else {
      this.hideElement("mail_tab");
    }

  },

  onQuit: function() {
    let that = this;

    // cleaning: removeEventListener on cells
    // NOTE: not sure this is necessary on window close
    let items = document.getElementById("ui_server_types").childNodes;
    for (let i=0; i < items.length; i++) {
      let cells = items[i].getElementsByTagName("treecell");
      // col 1 and 3: server_type_excluded, server_type_order
      [cells[0], cells[2]].map(
        function(c) {
          LOG("i: "+i+", cell:"+c);
          c.removeEventListener(
            'DOMAttrModified', that._userChangeValueTreeServerTypes, true);
        });
    }
  },

  hideElement: function(parentId) {
    let targetNode = document.getElementById(parentId);
    targetNode.hidden = true;
  },

  insertMailAccountsExcluded: function(parentId) {
    // the DOM parent where we do appendChild
    let targetNode = document.getElementById(parentId);

    let serverTypes = firetray.Utils.getObjPref('server_types');
    let accounts = new firetray.Messaging.Accounts(true);
    for (let accountServer in accounts) {
      if (serverTypes[accountServer.type].excluded)
        continue;

      let nodeAccount = document.createElement("checkbox");
      let accountServerKey = accountServer.key.toString();
      nodeAccount.setAttribute('id', accountServerKey);
      nodeAccount.setAttribute('label', accountServer.rootFolder.name);
      nodeAccount.setAttribute('checked',
        (firetray.Utils.getArrayPref('accounts_to_exclude').indexOf(accountServerKey) >= 0));
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
    firetray.Utils.setArrayPref('accounts_to_exclude', prefValue);

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
   * Save the "server_types" preference. This is called by the pref's system
   * when the GUI element is altered.
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
    LOG("prefStr"+prefStr);

    /* return the new prefString to be stored by pref system */
    return prefStr;
  },

  /**
   * needed for triggering actual preference change and saving
   */
  _userChangeValueTreeServerTypes: function(event) {
    if (event.attrName == "label") LOG("label changed!");
    if (event.attrName == "value") LOG("value changed!");
    document.getElementById("pane1")
      .userChangedValue(document.getElementById("ui_tree_server_types"));
  },

  populateTreeServerTypes: function() {
    let that = this;
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
      // CAUTION: removeEventListener in onQuit()
      cell.addEventListener(
        'DOMAttrModified', function(e) {
          that._userChangeValueTreeServerTypes(e);
          firetray.Messaging.updateUnreadMsgCount();
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
      cell.addEventListener(
        'DOMAttrModified', that._userChangeValueTreeServerTypes, true);
      row.appendChild(cell);

      target.appendChild(item);
    }

    let tree = document.getElementById("ui_tree_server_types");
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
  }

};


window.addEventListener(
  'load', function (e) {
    removeEventListener('load', arguments.callee, true);
    firetray.UIOptions.onLoad(); },
  false);
window.addEventListener(
  'unload', function (e) {
    removeEventListener('unload', arguments.callee, true);
    firetray.UIOptions.onQuit(); },
  false);
