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
    populateTree();
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
 * Save the Schedules List to the "extensions.hpsched.schedules" preference.
 * This is called by the pref's system when the GUI element is altered.
 */
function saveTree() {
  let tree = document.getElementById("optTree");
  let items = document.getElementById("rows").childNodes;

  let prefObj = {};
  for (let i=0; i < items.length; i++) {
    let cells = items[i].getElementsByTagName("treecell");
    LOG("CELLS:"+ tree.view.getCellText(i,
                                        tree.columns["name"]));
                                        // tree.columns.getColumnAt(0)));
                                        // tree.columns.getNamedColumn("name")));
    prefObj[cells[0].label] = {regex: cells[1].label, subs: cells[2].label};
  }

  let prefStr = JSON.stringify(prefObj);
  // let prefStr = JSON.stringify(treeView.model);
  LOG("prefStr"+prefStr);

  /* return the new prefString to be stored by pref system */
  return prefStr;
}

function addItem() {
  let targetTree = document.getElementById("rows");

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

function populateTree() {
  let prefPane = document.getElementById("pane1");

  let prefStr = firetray.Utils.prefService.getCharPref("jsondata");
  let prefObj = JSON.parse(prefStr);

  let targetTree = document.getElementById("rows");
  for (r in prefObj) {
    let name = prefObj[r];

    let item = document.createElement('treeitem');
    let row = document.createElement('treerow');
    item.appendChild(row);

    let cell = document.createElement('treecell');
    cell.setAttribute('label',r);
    cell.addEventListener
    ('change', function() {
       LOG("CHANGE: "+ firetray.Utils.prefService.getCharPref("jsondata"));
       document.getElementById("pane1")
         .userChangedValue(document.getElementById("optTree"));
     });
    cell.addEventListener('input', LOG("INPUT"));
    // cell.oninput = 'document.getElementById("pane1").userChangedValue(document.getElementById("optTree"));';
    row.appendChild(cell);

    cell = document.createElement('treecell');
    cell.setAttribute('label',name.regex);
    row.appendChild(cell);

    cell = document.createElement('treecell');
    cell.setAttribute('label',name.subs);
    row.appendChild(cell);

    targetTree.appendChild(item);
  }
}
