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
    let items = document.getElementById("ui_mail_accounts").childNodes;
    for (let i=0; i < items.length; i++) {
      let cells = items[i].getElementsByTagName("treecell");
      // col 2 and 3: server_type_excluded, server_type_order
      [cells[1], cells[2]].map(
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

  _disableGroup: function(group, disableval) {
    try {
      for (let i=0; i< group.childNodes.length; i++)
        group.childNodes[i].disabled = disableval;
    } catch(e) {
      ERROR(e);
    }
  },

  /**
   * needed for triggering actual preference change and saving
   */
  _userChangeValueTreeServerTypes: function(event) {
    if (event.attrName == "label") LOG("label changed!");
    if (event.attrName == "value") LOG("value changed!");
    document.getElementById("pane1")
      .userChangedValue(document.getElementById("ui_tree_mail_accounts"));
  },

  /**
   * NOTE: account exceptions for unread messages count are *stored* in
   * preferences as excluded, but *shown* as "not included"
   */
  populateTreeServerTypes: function() {
    let that = this;
    let prefPane = document.getElementById("pane1");

    let prefStr = firetray.Utils.prefService.getCharPref("mail_accounts");
    LOG("PREF="+prefStr);
    let mailAccounts = JSON.parse(prefStr);
    let serverTypes = mailAccounts["serverTypes"];
    let accountsExcluded = mailAccounts["excludedAccounts"];
    let accountsByServerType = firetray.Messaging.accountsByServerType();
    LOG(JSON.stringify(accountsByServerType));

    let target = document.getElementById("ui_mail_accounts");
    for (let serverTypeName in serverTypes) {
      let name = serverTypes[serverTypeName];

      let item = document.createElement('treeitem');
      item.setAttribute("container",true);
      item.setAttribute("open",true);

      let row = document.createElement('treerow');
      item.appendChild(row);

      // server_type_name
      let cell = document.createElement('treecell');
      cell.setAttribute('label',serverTypeName);
      cell.setAttribute('editable',false);
      row.appendChild(cell);

      // server_type_excluded => checkbox
      cell = document.createElement('treecell');
      cell.setAttribute('value',!serverTypes[serverTypeName].excluded);
      cell.addEventListener(    // CAUTION: removeEventListener in onQuit()
        'DOMAttrModified', function(e) {
          that._userChangeValueTreeServerTypes(e);
          firetray.Messaging.updateUnreadMsgCount();
        }, true);
      row.appendChild(cell);

      // server_type_order
      cell = document.createElement('treecell');
      cell.setAttribute('label',serverTypes[serverTypeName].order);
      cell.addEventListener(    // CAUTION: removeEventListener in onQuit()
        'DOMAttrModified', that._userChangeValueTreeServerTypes, true);
      row.appendChild(cell);

      target.appendChild(item);

      // add actual accounts as children
      let subChildren = document.createElement('treechildren');
      let typeAccounts = accountsByServerType[serverTypeName];
      LOG("type: "+serverTypeName+", Accounts: "+JSON.stringify(typeAccounts));
      if (typeof(typeAccounts) == "undefined")
        continue;

      for (let i=0; i<typeAccounts.length; i++) {
        let subItem = document.createElement('treeitem');
        let subRow = document.createElement('treerow');

        // server_type_name
        cell = document.createElement('treecell');
        cell.setAttribute('id', typeAccounts[i].key);
        cell.setAttribute('label',typeAccounts[i].name);
        cell.setAttribute('editable',false);
        subRow.appendChild(cell);

        // server_type_excluded => checkbox
        let cell = document.createElement('treecell');
        cell.setAttribute('value',(accountsExcluded.indexOf(typeAccounts[i].key) < 0));
        cell.addEventListener(    // CAUTION: removeEventListener in onQuit()
          'DOMAttrModified', function(e) {
            that._userChangeValueTreeServerTypes(e);
            firetray.Messaging.updateUnreadMsgCount();
          }, true);
        subRow.appendChild(cell);

        // server_type_order - UNUSED (added for consistency)
        cell = document.createElement('treecell');
        cell.setAttribute('editable',false);
        subRow.appendChild(cell);

        subItem.appendChild(subRow);
        subChildren.appendChild(subItem);
      }
      item.appendChild(subChildren);

    }

    let tree = document.getElementById("ui_tree_mail_accounts");
    tree.addEventListener("keypress", that.onKeyPressTreeServerTypes, true);
  },

  /*
   * Save the "mail_accounts" preference. This is called by the pref's system
   * when the GUI element is altered.
   */
  saveTreeServerTypes: function() {
    let tree = document.getElementById("ui_tree_mail_accounts");

    LOG("VIEW="+ tree.view + ", rowCount="+tree.view.rowCount);
    let prefObj = {"serverTypes":{}, "excludedAccounts":[]};
    for (let i=0; i < tree.view.rowCount; i++) {
      // TODO: rename server_type_* to account_or_server_type
      let serverTypeName = tree.view.getCellText(
        i, tree.columns.getNamedColumn("server_type_name"));
      let serverTypeExcluded = (
        tree.view.getCellValue(
          i, tree.columns.getNamedColumn("server_type_excluded"))
        !== 'true');
      let serverTypeOrder = parseInt(tree.view.getCellText(
                                       i, tree.columns.getNamedColumn("server_type_order")));

      LOG("SUPER: "+serverTypeName+", "+serverTypeExcluded);

      if (tree.view.getLevel(i) === 0) { // serverTypes
        prefObj["serverTypes"][serverTypeName] =
          { order: serverTypeOrder, excluded: serverTypeExcluded };

      } else if (tree.view.getLevel(i) === 1) { // excludedAccounts
        if (!serverTypeExcluded)
          continue;
        let rowNode = tree.view.getItemAtIndex(i).firstChild; // treerow
        let rowCells = rowNode.getElementsByTagName('treecell');
        let serverKey = rowCells[0].id;
        prefObj["excludedAccounts"].push(serverKey);

      } else
        continue;

    }

    let prefStr = JSON.stringify(prefObj);
    LOG("prefStr"+prefStr);

    /* return the new prefString to be stored by pref system */
    return prefStr;
  },

  onKeyPressTreeServerTypes: function(event) {
    LOG("TREE KEYPRESS: "+event.originalTarget);
    let tree = document.getElementById("ui_tree_mail_accounts");
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
