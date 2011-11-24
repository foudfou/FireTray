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

const TREEROW_ACCOUNT_OR_SERVER_TYPE_NAME     = 0;
const TREEROW_ACCOUNT_OR_SERVER_TYPE_EXCLUDED = 1;
const TREEROW_ACCOUNT_OR_SERVER_TYPE_ORDER    = 2;
const TREELEVEL_SERVER_TYPES      = 0;
const TREELEVEL_EXCLUDED_ACCOUNTS = 1;

firetray.UIOptions = {
  strings: null,

  onLoad: function() {
    this.strings = document.getElementById("firetray-options-strings");

    if(firetray.Handler.inMailApp) {
      Cu.import("resource://firetray/FiretrayMessaging.jsm");
      this.initMailControls();
    } else {
      let mailTab = document.getElementById("mail_tab");
      this.hideElement(mailTab, true);
    }

  },

  onQuit: function() {
    // cleaning: removeEventListener on cells
    // NOTE: not sure this is necessary on window close
    let tree = document.getElementById("ui_tree_mail_accounts");
    let that = this;
    for (let i=0; i < tree.view.rowCount; i++) {
      let cells = tree.view.getItemAtIndex(i).getElementsByTagName("treecell");
      if (tree.view.getLevel(i) === TREELEVEL_SERVER_TYPES) {
        // account_or_server_type_excluded, account_or_server_type_order
        [cells[1], cells[2]].map(
          function(c) {
            c.removeEventListener(
              'DOMAttrModified', that._userChangeValueTreeServerTypes, true);
          });
      } else if (tree.view.getLevel(i) === TREELEVEL_EXCLUDED_ACCOUNTS) {
        cells[1].removeEventListener(
          'DOMAttrModified', that._userChangeValueTree, true);
      }
    }
  },

  hideElement: function(targetNode, hiddenval) {
    targetNode.hidden = hiddenval;
  },

  disableGroup: function(group, disableval) {
    try {
      for(var i=0; i< group.childNodes.length; i++)
        group.childNodes[i].disabled = disableval;
    } catch(e) {}
  },

  initMailControls: function() {
    this.initNotificationSettings();
    this.populateExcludedFoldersList();
    this.populateTreeAccountsOrServerTypes();
  },

  initNotificationSettings: function() {
    let radioMailNotify = document.getElementById("radiogroup_mail_notification");
    let prefMailNotification = firetray.Utils.prefService.getIntPref("mail_notification");
    radioMailNotify.selectedIndex = prefMailNotification;
    this._disableNotificationMaybe(radioMailNotify.selectedIndex);
  },

  updateNotificationSettings: function() {
    let radioMailNotify = document.getElementById("radiogroup_mail_notification");
    let notificationSetting = radioMailNotify.selectedIndex;
    let prefMailNotification =
      firetray.Utils.prefService.setIntPref("mail_notification", notificationSetting);
    this._disableNotificationMaybe(notificationSetting);
  },

  _disableNotificationMaybe: function(notificationSetting) {
    let iconTextColor = document.getElementById("icon_text_color");
    this.disableGroup(iconTextColor,
                      (notificationSetting !== NOTIFICATION_UNREAD_MESSAGE_COUNT));

    let customIconGroup = document.getElementById("custom_mail_icon");
    this.disableGroup(customIconGroup,
                      (notificationSetting !== NOTIFICATION_CUSTOM_ICON));

    let isNotificationDisabled = (notificationSetting === NOTIFICATION_DISABLED);

    // update UI
    // NOTE: groupbox and caption don't have a 'disabled' attribute !!
    let excludedFoldersList = document.getElementById('excluded_folders_list');
    excludedFoldersList.disabled = isNotificationDisabled;
    let folderGroupboxCaption = document.getElementById('unread_count_folder_exceptions_caption_label');
    folderGroupboxCaption.disabled = isNotificationDisabled;
    this.disableGroup(excludedFoldersList, isNotificationDisabled); // disable listitems also
    let mailAccountsTree = document.getElementById('ui_tree_mail_accounts');
    mailAccountsTree.disabled = isNotificationDisabled;
    let accountsGroupboxCaption = document.getElementById('unread_count_account_exceptions_caption_label');
    accountsGroupboxCaption.disabled = isNotificationDisabled;

    if (isNotificationDisabled)
      firetray.Messaging.disable();
    else {
      firetray.Messaging.enable();
      firetray.Messaging.updateUnreadMsgCount();
    }

  },

  chooseMailIconFile: function() {
    var filepath = document.getElementById("custom_mail_icon_filename");
    this._chooseIconFile(filepath);
    firetray.Messaging.updateUnreadMsgCount();
  },

  _chooseIconFile: function(iconFilename) {
	  const nsIFilePicker = Ci.nsIFilePicker;
	  var filePicker = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
	  filePicker.init(window, "Select Icon", nsIFilePicker.modeOpen); // FIXME: i18n
	  filePicker.appendFilters(nsIFilePicker.filterImages);

	  var rv = filePicker.show();
	  if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace) {
		  iconFilename.value = filePicker.file.path;
		  var prefpane = document.getElementById("pane1");
		  prefpane.userChangedValue(iconFilename);
	  }
  },

  populateExcludedFoldersList: function() {
    let excludedFoldersList = document.getElementById('excluded_folders_list');

    let prefExcludedFoldersFlags = firetray.Utils.prefService
      .getIntPref("excluded_folders_flags");
    for(let folderType in FLDRS_UNINTERESTING) {
      let localizedFolderType = this.strings.getString(folderType);

      let item = excludedFoldersList.appendItem(localizedFolderType, folderType);
      LOG("folder: "+folderType);
      if (FLDRS_UNINTERESTING[folderType] & prefExcludedFoldersFlags)
        excludedFoldersList.addItemToSelection(item); // doesn't trigger onselect
    }
  },

  updateExcludedFoldersPref: function() {
    let excludedFoldersList = document.getElementById('excluded_folders_list');

    LOG("LAST SELECTED: "+excludedFoldersList.currentItem.label);
    let excludedFoldersFlags = null;
    for(let i = 0; i < excludedFoldersList.selectedCount; i++) {
      let folderType = excludedFoldersList.getSelectedItem(i).value;
      excludedFoldersFlags |= FLDRS_UNINTERESTING[folderType];
    }
    LOG("excluded folders flags: "+excludedFoldersFlags);

    firetray.Utils.prefService.setIntPref("excluded_folders_flags",
                                          excludedFoldersFlags);

    firetray.Messaging.updateUnreadMsgCount();
  },

  /**
   * should be called only for excludedAccounts
   */
  _disableTreeRow: function(row, disable) {
    let that = this;
    try {
      let cells = row.childNodes; // .getElementsByTagName('treecell');
      LOG("CELLS: "+cells);
      for (let i=0; i< cells.length; i++) {
        LOG("i: "+i+", cell:"+cells[i]);
        if (disable === true) {
          cells[i].setAttribute('properties', "disabled");
          if (i === TREEROW_ACCOUNT_OR_SERVER_TYPE_EXCLUDED) {
            cells[i].removeEventListener(
              'DOMAttrModified', that._userChangeValueTree, true);
            cells[i].setAttribute('editable', "false");
          }
        } else {
          cells[i].removeAttribute('properties');
          if (i === TREEROW_ACCOUNT_OR_SERVER_TYPE_EXCLUDED) {
            cells[i].addEventListener(
              'DOMAttrModified', that._userChangeValueTree, true);
            cells[i].setAttribute('editable', "true");
          }
        }
      }
    } catch(e) {
      ERROR(e);
    }
  },

  /**
   * needed for triggering actual preference change and saving
   */
  _userChangeValueTree: function(event) {
    if (event.attrName == "label") LOG("label changed!");
    if (event.attrName == "value") LOG("value changed!");
    document.getElementById("pane1")
      .userChangedValue(document.getElementById("ui_tree_mail_accounts"));

    firetray.Messaging.updateUnreadMsgCount();
  },

  _userChangeValueTreeServerTypes: function(event) {
    if (event.attrName === "value") { // checkbox
      let checkboxCell = event.originalTarget;
      let tree = document.getElementById("ui_tree_mail_accounts");

      let subRows = firetray.Utils.XPath(
        checkboxCell,
        'ancestor::xul:treeitem[1]/descendant::xul:treechildren//xul:treerow');
      LOG("subRows="+subRows);
      for (let i=0; i<subRows.length; i++) {
        firetray.UIOptions._disableTreeRow(
          subRows[i], (checkboxCell.getAttribute("value") === "false"));
      }

    } else if (event.attrName == "label") { // text
      // TODO: move row to new rank
    }

    this._userChangeValueTree(event);
  },

  /**
   * NOTE: account exceptions for unread messages count are *stored* in
   * preferences as excluded, but *shown* as "not included"
   */
  // FIXME: this function is too long !
  populateTreeAccountsOrServerTypes: function() {
    let that = this;
    let prefPane = document.getElementById("pane1");

    let mailAccounts = firetray.Utils.getObjPref("mail_accounts");
    let serverTypes = mailAccounts["serverTypes"];
    let accountsExcluded = mailAccounts["excludedAccounts"];
    let accountsByServerType = firetray.Messaging.accountsByServerType();
    LOG(JSON.stringify(accountsByServerType));

    // sort serverTypes according to order
    let serverTypesSorted = Object.keys(serverTypes);
    serverTypesSorted.sort(function(a,b) {
      if (serverTypes[a].order
          < serverTypes[b].order)
        return -1;
      if (serverTypes[a].order
          > serverTypes[b].order)
        return 1;
      return 0; // no sorting
    });
    LOG("serverTypesSorted: "+serverTypesSorted);

    let target = document.getElementById("ui_mail_accounts");
    for (let i=0; i<serverTypesSorted.length; i++) {
      let serverTypeName = serverTypesSorted[i];

      let item = document.createElement('treeitem');
      item.setAttribute("container",true);
      item.setAttribute("open",true);

      let row = document.createElement('treerow');
      item.appendChild(row);

      // account_or_server_type_name
      let cellName = document.createElement('treecell');
      cellName.setAttribute('label',serverTypeName);
      cellName.setAttribute('editable',false);
      row.appendChild(cellName);

      // account_or_server_type_excluded => checkbox
      let cellExcluded = document.createElement('treecell');
      cellExcluded.setAttribute('value',!serverTypes[serverTypeName].excluded);
      cellExcluded.addEventListener( // CAUTION: removeEventListener in onQuit()
        'DOMAttrModified', that._userChangeValueTreeServerTypes, true);
      row.appendChild(cellExcluded);

      // account_or_server_type_order
      let cellOrder = document.createElement('treecell');
      cellOrder.setAttribute('label',serverTypes[serverTypeName].order);
      cellOrder.addEventListener( // CAUTION: removeEventListener in onQuit()
        'DOMAttrModified', that._userChangeValueTreeServerTypes, true);
      row.appendChild(cellOrder);

      target.appendChild(item);

      // add actual accounts as children
      let subChildren = document.createElement('treechildren');
      let typeAccounts = accountsByServerType[serverTypeName];
      LOG("type: "+serverTypeName+", Accounts: "+JSON.stringify(typeAccounts));
      if (typeof(typeAccounts) == "undefined")
        continue;

      let rowDisabled = (cellExcluded.getAttribute("value") === "false");
      for (let i=0; i<typeAccounts.length; i++) {
        let subItem = document.createElement('treeitem');
        let subRow = document.createElement('treerow');

        // account_or_server_type_name
        cell = document.createElement('treecell');
        cell.setAttribute('id', typeAccounts[i].key);
        cell.setAttribute('label',typeAccounts[i].name);
        cell.setAttribute('editable',false);
        if (rowDisabled === true)
          cell.setAttribute('properties', "disabled");
        subRow.appendChild(cell);

        // account_or_server_type_excluded => checkbox
        let cell = document.createElement('treecell');
        cell.setAttribute('value',(accountsExcluded.indexOf(typeAccounts[i].key) < 0));
        if (rowDisabled === true) {
          cell.setAttribute('properties', "disabled");
          cell.setAttribute('editable', "false");
        } else {
          cell.addEventListener(  // CAUTION: removeEventListener in onQuit()
            'DOMAttrModified', that._userChangeValueTree, true);
        }
        subRow.appendChild(cell);

        // account_or_server_type_order - UNUSED (added for consistency)
        cell = document.createElement('treecell');
        cell.setAttribute('editable',false);
        if (rowDisabled === true)
          cell.setAttribute('properties', "disabled");
        subRow.appendChild(cell);

        // we must initialize sub-cells correctly to prevent prefsync at a
        // stage where the pref will be incomplete
        /* this._disableTreeRow(
           subRow, (cellExcluded.getAttribute("value") === "false")); */
        subItem.appendChild(subRow);
        subChildren.appendChild(subItem);
      }
      item.appendChild(subChildren);

    }

    let tree = document.getElementById("ui_tree_mail_accounts");
    tree.addEventListener("keypress", that.onKeyPressTreeAccountsOrServerTypes, true);
  },

  /*
   * Save the "mail_accounts" preference. This is called by the pref's system
   * when the GUI element is altered.
   */
  saveTreeAccountsOrServerTypes: function() {
    let tree = document.getElementById("ui_tree_mail_accounts");

    LOG("VIEW="+ tree.view + ", rowCount="+tree.view.rowCount);
    let prefObj = {"serverTypes":{}, "excludedAccounts":[]};
    for (let i=0; i < tree.view.rowCount; i++) {
      let accountOrServerTypeName = tree.view.getCellText(
        i, tree.columns.getNamedColumn("account_or_server_type_name"));
      let accountOrServerTypeExcluded = (
        tree.view.getCellValue(
          i, tree.columns.getNamedColumn("account_or_server_type_excluded"))
        !== 'true');
      let accountOrServerTypeOrder = parseInt(
        tree.view.getCellText(
          i, tree.columns.getNamedColumn("account_or_server_type_order")));

      LOG("account: "+accountOrServerTypeName+", "+accountOrServerTypeExcluded);

      if (tree.view.getLevel(i) === TREELEVEL_SERVER_TYPES) {
        prefObj["serverTypes"][accountOrServerTypeName] =
          { order: accountOrServerTypeOrder, excluded: accountOrServerTypeExcluded };

      } else if (tree.view.getLevel(i) === TREELEVEL_EXCLUDED_ACCOUNTS) {
        if (!accountOrServerTypeExcluded)
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

  onKeyPressTreeAccountsOrServerTypes: function(event) {
    LOG("TREE KEYPRESS: "+event.originalTarget);
    let tree = document.getElementById("ui_tree_mail_accounts");
    let col = tree.editingColumn; // col.index

    // only int allowed
    if (col == tree.columns.getNamedColumn("account_or_server_type_order")) {
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
