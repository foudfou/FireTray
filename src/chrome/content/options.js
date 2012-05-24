/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://firetray/FiretrayHandler.jsm");
Cu.import("resource://firetray/commons.js");

const TREEROW_ACCOUNT_OR_SERVER_TYPE_NAME     = 0;
const TREEROW_ACCOUNT_OR_SERVER_TYPE_EXCLUDED = 1;
const TREEROW_ACCOUNT_OR_SERVER_TYPE_ORDER    = 2;
const TREELEVEL_SERVER_TYPES      = 0;
const TREELEVEL_EXCLUDED_ACCOUNTS = 1;

var firetrayUIOptions = {
  strings: null,

  onLoad: function(e) {
    this.strings = document.getElementById("firetray-options-strings");

    if (firetray.Handler.inMailApp) {
      Cu.import("resource://firetray/FiretrayMessaging.jsm");
      this.initMailControls();
    } else {
      let mailTab = document.getElementById("mail_tab");
      this.hideElement(mailTab, true);
    }

    this.updateWindowAndIconOptions();
    this.updateScrollOptions();
    this.initAppIconType();
    this.initAppIconNames();
    if (firetray.Handler.inMailApp)
      this.initNewMailIconNames();
  },

  onQuit: function(e) {
    // cleaning: removeEventListener on cells
    // NOTE: not sure this is necessary on window close
    let tree = document.getElementById("ui_tree_mail_accounts");
    let that = this;
    for (let i=0, len=tree.view.rowCount; i<len ; ++i) {
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

  disableChildren: function(group, disableval) {
    try {
      let children = group.childNodes;
      for (let i=0, len=children.length; i<len ; ++i)
        children[i].disabled = disableval;
    } catch(e) {}
  },
  disableNChildren: function(group, nth, disableval) {
    try {
      let children = group.childNodes;
      if (nth>children.length) throw new RangeError();
      for (let i=0; i<nth ; ++i) {
        children[i].disabled = disableval;
      }
    } catch(e) {}
  },

  disableElementsRecursive: function(group, disableval) {
    let descendants = firetray.Utils.XPath(group, 'descendant::*');
    try {
      for (let i=0, len=descendants.length; i<len ; ++i)
        descendants[i].disabled = disableval;
    } catch(e) {}
  },

  updateWindowAndIconOptions: function() {
    let hides_on_close    = document.getElementById("ui_hides_on_close").checked;
    let hides_on_minimize = document.getElementById("ui_hides_on_minimize").checked;
    F.LOG("hides_on_close="+hides_on_close+", hides_on_minimize="+hides_on_minimize);
    document.getElementById('ui_hides_single_window').disabled =
      !(hides_on_close || hides_on_minimize);
  },

  updateScrollOptions: function() {
    let scroll_hides = document.getElementById("ui_scroll_hides").checked;
    this.disableChildren(document.getElementById("ui_radiogroup_scroll"), !scroll_hides);
  },

  initAppIconType: function() {
    document.getElementById("ui_app_icon_type_themed").value =
      FIRETRAY_APPLICATION_ICON_TYPE_THEMED;
    document.getElementById("ui_app_icon_type_custom").value =
      FIRETRAY_APPLICATION_ICON_TYPE_CUSTOM;

    let prefAppIconType = firetray.Utils.prefService.getIntPref("app_icon_type");
    document.getElementById("ui_app_icon_type").selectedIndex = prefAppIconType;

    this.disableIconTypeMaybe(prefAppIconType);
  },

  initAppIconNames: function() {
    this.initIconNames(firetray.StatusIcon.prefAppIconNames,
      "app_icon_type_themed_name", firetray.StatusIcon.defaultAppIconName);
  },
  initNewMailIconNames: function() {
    this.initIconNames("new_mail_icon_names",
      "radio_mail_notification_newmail_icon_name", firetray.StatusIcon.defaultNewMailIconName);
  },

  initIconNames: function(prefIconNames, uiIconNameId, defaultIconName) {
    let appIconNames = firetray.Utils.getArrayPref(prefIconNames);
    F.LOG("appIconNames="+appIconNames);
    let len = appIconNames.length;
    if (len>2)
      throw new RangeError("Too many icon names");
    for (let i=0; i<len; ++i) {
      let textbox = document.getElementById(uiIconNameId+(i+1));
      textbox.value = appIconNames[i];
    }
    let textbox = document.getElementById(uiIconNameId+3);
    textbox.value = defaultIconName;
  },

  updateAppIconNames: function(textbox) {
    this.updateIconNames(firetray.StatusIcon.prefAppIconNames, "app_icon_type_themed_name");
  },
  updateNewMailIconNames: function(textbox) {
    this.updateIconNames("new_mail_icon_names", "radio_mail_notification_newmail_icon_name");
  },

  updateIconNames: function(prefIconNames, uiIconNameId) {
    let iconNames = [];
    for (let i=1; i<3; ++i) {
      let textbox = document.getElementById(uiIconNameId+i);
      let val = textbox.value.trim();
      F.LOG("val="+val);
      if (val) iconNames.push(val);
    }
    F.LOG("iconNames="+iconNames);
    firetray.Utils.setArrayPref(prefIconNames, iconNames);
  },

  disableIconTypeMaybe: function(appIconType) {
    let appIconCustomGroup = document.getElementById("app_icon_custom");
    this.disableChildren(appIconCustomGroup,
      (appIconType !== FIRETRAY_APPLICATION_ICON_TYPE_CUSTOM));

    let appIconDefaultGroup = document.getElementById("app_icon_default");
    this.disableNChildren(appIconDefaultGroup, 2,
      (appIconType !== FIRETRAY_APPLICATION_ICON_TYPE_THEMED));
  },

  initMailControls: function() {
    this.populateExcludedFoldersList();
    this.populateTreeAccountsOrServerTypes();

    this.initMessageCountSettings();
    this.initNotificationSettings();
    this.initMailTrigger();

    this.toggleNotifications(firetray.Utils.prefService.getBoolPref("mail_notification_enabled"));
  },

  initNotificationSettings: function() {
    document.getElementById("ui_radio_mail_notification_unread_count").value =
      FIRETRAY_NOTIFICATION_UNREAD_MESSAGE_COUNT;
    document.getElementById("ui_radio_mail_notification_newmail_icon").value =
      FIRETRAY_NOTIFICATION_NEWMAIL_ICON;
    document.getElementById("ui_radio_mail_notification_custom_mail_icon").value =
      FIRETRAY_NOTIFICATION_CUSTOM_ICON;

    document.getElementById("ui_mail_notification_enabled").checked =
      (firetray.Utils.prefService.getBoolPref("mail_notification_enabled"));

    let radioMailNotify = document.getElementById("ui_radiogroup_mail_notification");
    let prefMailNotificationType = firetray.Utils.prefService.getIntPref("mail_notification_type");
    radioMailNotify.selectedIndex = this.radioGetIndexByValue(radioMailNotify, prefMailNotificationType);
    // this.disableNotificationMaybe(prefMailNotificationType); // done in toggleNotifications()
  },

  initMessageCountSettings: function() {
    document.getElementById("ui_message_count_type_unread").value =
      FIRETRAY_MESSAGE_COUNT_TYPE_UNREAD;
    document.getElementById("ui_message_count_type_new").value =
      FIRETRAY_MESSAGE_COUNT_TYPE_NEW;

    let radioMessageCountType = document.getElementById("ui_message_count_type");
    let prefMsgCountType = firetray.Utils.prefService.getIntPref("message_count_type");
    radioMessageCountType.selectedIndex = this.radioGetIndexByValue(radioMessageCountType, prefMsgCountType);
    // this.disableMessageCountMaybe(prefMsgCountType); // done in toggleNotifications()
  },

  radioGetIndexByValue: function(radio, value) {
    for (let i=0, len=radio.itemCount; i<len; ++i)
      if (+radio.getItemAtIndex(i).value == value) return i;
    return -1;
  },

  initMailTrigger: function() {
    document.getElementById("ui_mail_change_trigger").value =
      firetray.Utils.prefService.getCharPref("mail_change_trigger");
  },

  updateMailTrigger: function() {
    let mailTrigger = document.getElementById("ui_mail_change_trigger").value.trim();
    firetray.Utils.prefService.setCharPref("mail_change_trigger", mailTrigger);
  },

  updateNotificationSettings: function() {
    F.LOG("updateNotificationSettings");
    let radioMailNotify = document.getElementById("ui_radiogroup_mail_notification");
    let mailNotificationType = +radioMailNotify.getItemAtIndex(radioMailNotify.selectedIndex).value;
    firetray.Utils.prefService.setIntPref("mail_notification_type", mailNotificationType);
    this.disableNotificationMaybe(mailNotificationType);

    firetray.Messaging.updateIcon();
  },

  updateMessageCountSettings: function() {
    let radioMessageCountType = document.getElementById("ui_message_count_type");
    let messageCountType = +radioMessageCountType.getItemAtIndex(radioMessageCountType.selectedIndex).value;
    this.disableMessageCountMaybe(messageCountType);
  },

  disableNotificationMaybe: function(notificationSetting) {
    F.LOG("disableNotificationMaybe: "+notificationSetting);

    let iconTextColor = document.getElementById("icon_text_color");
    this.disableChildren(iconTextColor,
      (notificationSetting !== FIRETRAY_NOTIFICATION_UNREAD_MESSAGE_COUNT));

    let newMailIconNames = document.getElementById("newmail_icon_names");
    this.disableNChildren(newMailIconNames, 2,
      (notificationSetting !== FIRETRAY_NOTIFICATION_NEWMAIL_ICON));

    let customIconGroup = document.getElementById("custom_mail_icon");
    this.disableChildren(customIconGroup,
      (notificationSetting !== FIRETRAY_NOTIFICATION_CUSTOM_ICON));
  },

  disableMessageCountMaybe: function(msgCountType) {
    F.LOG("disableMessageCountMaybe: "+msgCountType);
    let msgCountTypeIsNewMessages = (msgCountType === FIRETRAY_MESSAGE_COUNT_TYPE_NEW);

    let notificationUnreadCount = document.getElementById("ui_mail_notification_unread_count");
    this.disableElementsRecursive(notificationUnreadCount, msgCountTypeIsNewMessages);

    let radioMailNotify = document.getElementById("ui_radiogroup_mail_notification");
    let mailNotificationType = +radioMailNotify.getItemAtIndex(radioMailNotify.selectedIndex).value;
    if (msgCountTypeIsNewMessages && (mailNotificationType === FIRETRAY_NOTIFICATION_UNREAD_MESSAGE_COUNT)) {
      radioMailNotify.selectedIndex = this.radioGetIndexByValue(radioMailNotify, FIRETRAY_NOTIFICATION_NEWMAIL_ICON);
      let newMailIconNames = document.getElementById("newmail_icon_names");
      this.disableNChildren(newMailIconNames, 2, false);
      firetray.Utils.prefService.setIntPref("mail_notification_type", FIRETRAY_NOTIFICATION_NEWMAIL_ICON);
    }
  },

  toggleNotifications: function(enabled) {
    if (enabled) {
      document.getElementById("broadcaster-notification-disabled")
        .removeAttribute("disabled"); // UI update (enables!)
      if (!firetray.Messaging.initialized) firetray.Messaging.init();
      firetray.Messaging.updateIcon();

      let prefMailNotificationType = firetray.Utils.prefService.getIntPref("mail_notification_type");
      this.disableNotificationMaybe(prefMailNotificationType);

      let radioMessageCountType = document.getElementById("ui_message_count_type");
      let messageCountType = +radioMessageCountType.getItemAtIndex(radioMessageCountType.selectedIndex).value;
      this.disableMessageCountMaybe(messageCountType);

    } else {
      document.getElementById("broadcaster-notification-disabled")
        .setAttribute("disabled", "true"); // UI update
      firetray.Messaging.shutdown();
    }
  },

  chooseAppIconFile: function() {
    var filepath = document.getElementById("app_icon_custom_filename");
    this._chooseIconFile(filepath);
    firetray.Handler.setIconImageDefault();
  },

  chooseMailIconFile: function() {
    var filepath = document.getElementById("custom_mail_icon_filename");
    this._chooseIconFile(filepath);
    firetray.Messaging.updateIcon();
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

  /**
   * NOTE: folder exceptions for unread messages count are *stored* in
   * preferences as excluded, but *shown* as "not included"
   */
  populateExcludedFoldersList: function() {
    let excludedFoldersList = document.getElementById('excluded_folders_list');

    let prefExcludedFoldersFlags = firetray.Utils.prefService
      .getIntPref("excluded_folders_flags");
    for (let folderType in FLDRS_UNINTERESTING) {
      let localizedFolderType = this.strings.getString(folderType);
      let item = excludedFoldersList.appendItem(localizedFolderType, folderType);
      item.setAttribute("observes", "broadcaster-notification-disabled");
      F.LOG("folder: "+folderType);
      if (!(FLDRS_UNINTERESTING[folderType] & prefExcludedFoldersFlags)) {
        excludedFoldersList.ensureElementIsVisible(item); // bug 326445
        excludedFoldersList.addItemToSelection(item); // doesn't trigger onselect
      }
    }
  },

  updateExcludedFoldersPref: function() {
    let excludedFoldersList = document.getElementById('excluded_folders_list');

    F.LOG("LAST SELECTED: "+excludedFoldersList.currentItem.label);
    let excludedFoldersFlags = null;
    for (let i = 0, len=excludedFoldersList.itemCount; i<len; ++i) {
      let folder = excludedFoldersList.getItemAtIndex(i);
      if (folder.selected)
        excludedFoldersFlags &= ~FLDRS_UNINTERESTING[folder.value];
      else
        excludedFoldersFlags |= FLDRS_UNINTERESTING[folder.value];
    }
    F.LOG("excluded folders flags: "+excludedFoldersFlags);

    firetray.Utils.prefService.setIntPref("excluded_folders_flags",
                                          excludedFoldersFlags);

    firetray.Messaging.updateMsgCount();
  },

  /**
   * should be called only for excludedAccounts
   */
  _disableTreeRow: function(row, disable) {
    let that = this;
    try {
      let cells = row.childNodes; // .getElementsByTagName('treecell');
      F.LOG("CELLS: "+cells);
      for (let i=0, len=cells.length; i<len; ++i) {
        F.LOG("i: "+i+", cell:"+cells[i]);
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
      F.ERROR(e);
    }
  },

  /**
   * needed for triggering actual preference change and saving
   */
  _userChangeValueTree: function(event) {
    if (event.attrName == "label") F.LOG("label changed!");
    if (event.attrName == "value") F.LOG("value changed!");
    document.getElementById("pane1")
      .userChangedValue(document.getElementById("ui_tree_mail_accounts"));

    firetray.Messaging.updateMsgCount();
  },

  _userChangeValueTreeServerTypes: function(event) {
    if (event.attrName === "value") { // checkbox
      let checkboxCell = event.originalTarget;
      let tree = document.getElementById("ui_tree_mail_accounts");

      let subRows = firetray.Utils.XPath(
        checkboxCell,
        'ancestor::xul:treeitem[1]/descendant::xul:treechildren//xul:treerow');
      F.LOG("subRows="+subRows);
      for (let i=0, len=subRows.length; i<len; ++i) {
        firetrayUIOptions._disableTreeRow(
          subRows[i], (checkboxCell.getAttribute("value") === "false"));
      }

    } else if (event.attrName == "label") { // text
      F.WARN("NOT IMPLEMENTED YET: move row to new rank"); // TODO
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
    F.LOG(JSON.stringify(accountsByServerType));

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
    F.LOG("serverTypesSorted: "+serverTypesSorted);

    let target = document.getElementById("ui_mail_accounts");
    for (let i=0, len=serverTypesSorted.length; i<len; ++i) {
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
      F.LOG("type: "+serverTypeName+", Accounts: "+JSON.stringify(typeAccounts));
      if (typeof(typeAccounts) == "undefined")
        continue;

      let rowDisabled = (cellExcluded.getAttribute("value") === "false");
      for (let i=0, len=typeAccounts.length; i<len; ++i) {
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

    F.LOG("VIEW="+ tree.view + ", rowCount="+tree.view.rowCount);
    let prefObj = {"serverTypes":{}, "excludedAccounts":[]};
    for (let i=0, len=tree.view.rowCount; i<len; ++i) {
      let accountOrServerTypeName = tree.view.getCellText(
        i, tree.columns.getNamedColumn("account_or_server_type_name"));
      let accountOrServerTypeExcluded = (
        tree.view.getCellValue(
          i, tree.columns.getNamedColumn("account_or_server_type_excluded"))
        !== 'true');
      let accountOrServerTypeOrder = parseInt(
        tree.view.getCellText(
          i, tree.columns.getNamedColumn("account_or_server_type_order")));
      F.LOG("account: "+accountOrServerTypeName+", "+accountOrServerTypeExcluded);

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
    F.LOG("prefStr"+prefStr);

    /* return the new prefString to be stored by pref system */
    return prefStr;
  },

  onKeyPressTreeAccountsOrServerTypes: function(event) {
    F.LOG("TREE KEYPRESS: "+event.originalTarget);
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
    firetrayUIOptions.onLoad(); },
  false);
window.addEventListener(
  'unload', function (e) {
    removeEventListener('unload', arguments.callee, true);
    firetrayUIOptions.onQuit(); },
  false);
