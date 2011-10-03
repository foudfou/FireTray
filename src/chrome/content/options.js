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

    // setView();
    // initView();
    populateTreeServerTypes();
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
        that.updateMailAccountsExcluded(that.accountBoxId);});
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
  }

};

// input.onkeypress = function(evt) {
//     evt = evt || window.event;
//     var charCode = evt.which || evt.keyCode;
//     var charStr = String.fromCharCode(charCode);
//     if (/\d/.test(charStr)) {
//         return false;
//     }
// };

/*
var treeView = {
  model : {},
  treeBox: null,
  get rowCount(){return this.model.length;},
  getCellText : function(row,column) { return this.model[row][column.id]; },
  setTree: function(treeBox){ this.treeBox = treeBox; },
  isContainer: function(row){ return false; },
  isEditable: function(idx, column)  { return true; },
  isSeparator: function(row){ return false; },
  isSorted: function(){ return false; },
  getLevel: function(row){ return 0; },
  getImageSrc: function(row,col){ return null; },
  getRowProperties: function(row,props){},
  getCellProperties: function(row,col,props){},
  getColumnProperties: function(colid,col,props){},
  setCellText: function (row, col, val){this.model[row][col.id] = val;}
};

function setView(){
  try {
    var str = firetray.Utils.prefService.getCharPref("jsondata");
    treeView.model = JSON.parse(str);
  } catch (err) {
    treeView.model = [];
  }
  LOG("setView " + treeView.model.length);
  document.getElementById('optTree').view = treeView;
}

function deleteSelection(){
  var t = document.getElementById('optTree');
  treeView.model.splice(t.currentIndex, 1);
  treeView.treeBox.rowCountChanged(t.currentIndex, -1);
}

function addItem(){
  treeView.model[treeView.model.length] =  {name:"new label", regex:"new regex", subs:"new subs"};
  treeView.treeBox.rowCountChanged(treeView.model.length-1, 1);
}

function saveList(){
  let str = JSON.stringify(treeView.model);
  LOG(str);
  // firetray.Utils.prefService.setCharPref("jsondata", str);
  return str;
}

// window.addEventListener('unload', saveList, false);
*/

/*
function initView() {
  let tree = document.getElementById("optTree");

  var oldView = tree.view;
  var newView = {
    __proto__: oldView,
    setCellText: function(row, col, value) {
      oldView.setCellText(row, col, value);
      LOG("Text changed for a tree cell!");
      document.getElementById("pane1").userChangedValue(tree);
    }
  };
  tree.view = newView;
  LOG("initView");
}
*/

/*
 * Save the Schedules List to the "extensions.hpsched.schedules" preference.
 * This is called by the pref's system when the GUI element is altered.
 */
function saveTreeServerTypes() {
  let tree = document.getElementById("ui_tree_server_types");
  let items = document.getElementById("ui_server_types").childNodes;

  LOG("VIEW="+ tree.view);
  let prefObj = {};
  for (let i=0; i < tree.view.rowCount; i++) {
    let cells = items[i].getElementsByTagName("treecell");
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
}

function addItem() {
  let targetTree = document.getElementById("ui_server_types");

  let item = document.createElement('treeitem');
  let row = document.createElement('treerow');
  item.appendChild(row);

  let cell = document.createElement('treecell');
  row.appendChild(cell);
  cell = document.createElement('treecell');
  row.appendChild(cell);
  cell = document.createElement('treecell');
  row.appendChild(cell);

  targetTree.appendChild(item);
}

function populateTreeServerTypes() {
  let prefPane = document.getElementById("pane1");

  let prefStr = firetray.Utils.prefService.getCharPref("server_types");
  let prefObj = JSON.parse(prefStr);

  let targetTree = document.getElementById("ui_server_types");
  for (serverTypeName in prefObj) {
    let name = prefObj[serverTypeName];

    let item = document.createElement('treeitem');
    let row = document.createElement('treerow');
    item.appendChild(row);

    // server_type_excluded => checkbox
    let cell = document.createElement('treecell');
    cell.setAttribute('value',prefObj[serverTypeName].excluded);
    // FIXME: we need to removeEventListener() !!! onunload ?
    cell.addEventListener(
      'DOMAttrModified', function(event) {
        if (event.attrName == "label") LOG("label changed!");
        if (event.attrName == "value") LOG("value changed!");
        document.getElementById("pane1")
          .userChangedValue(document.getElementById("ui_tree_server_types"));
     });
    row.appendChild(cell);

    // server_type_name
    cell = document.createElement('treecell');
    cell.setAttribute('label',serverTypeName);
    // FIXME: refactor !!
    cell.addEventListener(
      'DOMAttrModified', function(event) {
        if (event.attrName == "label") LOG("label changed!");
        if (event.attrName == "value") LOG("value changed!");
        document.getElementById("pane1")
          .userChangedValue(document.getElementById("ui_tree_server_types"));
     });
    row.appendChild(cell);

    // server_type_order
    cell = document.createElement('treecell');
    cell.setAttribute('label',prefObj[serverTypeName].order);
    row.appendChild(cell);

    targetTree.appendChild(item);
  }
}
