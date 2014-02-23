/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

/* FIXME: instantApply pref defaults to false on Windows. But the Firetray pref
window was originaly crafted for instantApply platforms: some UI changes do
also change prefs programmaticaly. For a consistant behaviour across all
instantApply cases, we should probably not set prefs dynamically, that is leave
it all to the UI. See:
http://forums.mozillazine.org/viewtopic.php?f=19&t=2743643
https://groups.google.com/forum/#!topic/mozilla.dev.extensions/SBGIogdIiwE */

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

const PREF_DEFAULT_PANE = "pref-pane-windows";

let log = firetray.Logging.getLogger("firetray.UIOptions");

var firetrayUIOptions = {
  strings: null,
  prefwindow: null,

  onLoad: function(e) {
    log.debug("FULL FEATURED="+firetray.Handler.support['full_feat']);
    this.strings = document.getElementById("firetray-options-strings");
    this.prefwindow = document.getElementById("firetray-preferences");
    if (!this.prefwindow)
      log.error("pref window not found");

    if (firetray.Handler.inMailApp) {
      Cu.import("resource:///modules/mailServices.js");
      Cu.import("resource://firetray/FiretrayMessaging.jsm");
      this.initMailControls();
    } else {
      this.hidePrefPane("pref-pane-mail");
    }

    if (firetray.Handler.isChatProvided() &&
        FIRETRAY_CHAT_SUPPORTED_OS.indexOf(firetray.Handler.runtimeOS) > -1) {
      Cu.import("resource://firetray/"+firetray.Handler.runtimeOS+"/FiretrayChat.jsm");
      this.initChatControls();
    } else {
      this.hidePrefPane("pref-pane-chat");
    };

    this.updateWindowAndIconOptions();
    this.updateScrollOptions();
    this.initAppIconType();
    if (firetray.Handler.support['full_feat']) {
      this.initAppIconNames();
      if (firetray.Handler.inMailApp)
        this.initNewMailIconNames();
    } else {
      this.hideUnsupportedOptions();
    };

    window.sizeToContent();
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

  hideUnsupportedOptions: function() { // full_feat
    // windows prefs
    ['ui_hides_last_only', 'ui_start_hidden', 'ui_show_activates',
     'ui_remember_desktop'].forEach(function(id){
       document.getElementById(id).hidden = true;
     });

    // icon prefs
    ['app_icon_default', 'ui_show_icon_on_hide', 'ui_scroll_hides',
     'ui_radiogroup_scroll'].forEach(function(id){
       document.getElementById(id).hidden = true;
     });
    document.getElementById("ui_scroll_hides").setAttribute("oncommand", void(0));

    // mail prefs
    document.getElementById("newmail_icon_names").hidden = true;
    for (let i=1; i<4; ++i) {
      document.getElementById("radio_mail_notification_newmail_icon_name"+i).
        setAttribute("observes", void(0));
    }
  },

  hidePrefPane: function(name){
    let radio = document.getAnonymousElementByAttribute(this.prefwindow, "pane", name);
    if (radio.selected)
      this.prefwindow.showPane(document.getElementById(PREF_DEFAULT_PANE));
    radio.hidden = true;
  },

  hideChildren: function(group, hiddenval) {
    let children = group.childNodes;
    for (let i=0, len=children.length; i<len ; ++i)
      children[i].hidden = hiddenval;
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
    log.debug("hides_on_close="+hides_on_close+", hides_on_minimize="+hides_on_minimize);
    let doDisable = !(hides_on_close || hides_on_minimize);
    document.getElementById('ui_hides_single_window').disabled = doDisable;
    document.getElementById('ui_hides_last_only').disabled = doDisable;
  },

  updateScrollOptions: function() {
    let ui_scroll_hides = document.getElementById("ui_scroll_hides");
    this.disableChildren(document.getElementById("ui_radiogroup_scroll"),
                         !ui_scroll_hides.checked);
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
    log.debug("appIconNames="+appIconNames);
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
      log.debug("val="+val);
      if (val) iconNames.push(val);
    }
    log.debug("iconNames="+iconNames);
    firetray.Utils.setArrayPref(prefIconNames, iconNames);
  },

  disableIconTypeMaybe: function(appIconType) {
    if (firetray.Handler.support['full_feat']) {
      let appIconDefaultGroup = document.getElementById("app_icon_default");
      this.disableNChildren(appIconDefaultGroup, 2,
        (appIconType !== FIRETRAY_APPLICATION_ICON_TYPE_THEMED));
    }

    let appIconCustomGroup = document.getElementById("app_icon_custom");
    this.disableChildren(appIconCustomGroup,
      (appIconType !== FIRETRAY_APPLICATION_ICON_TYPE_CUSTOM));
  },

  initMailControls: function() {
    this.populateExcludedFoldersList();
    this.populateTreeAccountsOrServerTypes();

    this.initMessageCountSettings();
    this.initNotificationSettings();
    this.initMailTrigger();

    this.toggleNotifications(firetray.Utils.prefService.getBoolPref("mail_notification_enabled"));
  },

  initChatControls: function() {
    this.initChatBlinkSettings();
    this.toggleChatIcon(firetray.Utils.prefService.getBoolPref("chat_icon_enable"));
  },

  initNotificationSettings: function() {
    document.getElementById("ui_radio_mail_notification_unread_count").value =
      FIRETRAY_NOTIFICATION_MESSAGE_COUNT;
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

  initChatBlinkSettings: function() {
    document.getElementById("ui_chat_icon_blink_style_normal").value =
      FIRETRAY_CHAT_ICON_BLINK_STYLE_NORMAL;
    document.getElementById("ui_chat_icon_blink_style_fade").value =
      FIRETRAY_CHAT_ICON_BLINK_STYLE_FADE;

    let blinkStyle = document.getElementById("ui_chat_icon_blink_style");
    let prefBlinkStyle = firetray.Utils.prefService.getIntPref("chat_icon_blink_style");
    blinkStyle.selectedIndex = this.radioGetIndexByValue(blinkStyle, prefBlinkStyle);
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
    log.debug("updateNotificationSettings");
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

  updateChatBlinkSettings: function() {
    let radioBlinkStyle = document.getElementById("ui_chat_icon_blink_style");
    let blinkStyle = +radioBlinkStyle.getItemAtIndex(radioBlinkStyle.selectedIndex).value;
    firetray.Utils.prefService.setIntPref("chat_icon_blink_style", blinkStyle);
  },

  disableNotificationMaybe: function(notificationSetting) {
    log.debug("disableNotificationMaybe: "+notificationSetting);

    let iconTextColor = document.getElementById("icon_text_color");
    this.disableChildren(iconTextColor,
      (notificationSetting !== FIRETRAY_NOTIFICATION_MESSAGE_COUNT));

    if (firetray.Handler.support['full_feat']) {
      let newMailIconNames = document.getElementById("newmail_icon_names");
      this.disableNChildren(newMailIconNames, 2,
        (notificationSetting !== FIRETRAY_NOTIFICATION_NEWMAIL_ICON));
    }

    let customIconGroup = document.getElementById("custom_mail_icon");
    this.disableChildren(customIconGroup,
      (notificationSetting !== FIRETRAY_NOTIFICATION_CUSTOM_ICON));
  },

  disableMessageCountMaybe: function(msgCountType) {
    log.debug("disableMessageCountMaybe: "+msgCountType);
    let msgCountTypeIsNewMessages = (msgCountType === FIRETRAY_MESSAGE_COUNT_TYPE_NEW);

    let notificationUnreadCount = document.getElementById("ui_mail_notification_unread_count");
    this.disableElementsRecursive(notificationUnreadCount, msgCountTypeIsNewMessages);

    let radioMailNotify = document.getElementById("ui_radiogroup_mail_notification");
    let mailNotificationType = +radioMailNotify.getItemAtIndex(radioMailNotify.selectedIndex).value;
    if (msgCountTypeIsNewMessages && (mailNotificationType === FIRETRAY_NOTIFICATION_MESSAGE_COUNT)) {
      radioMailNotify.selectedIndex = this.radioGetIndexByValue(radioMailNotify, FIRETRAY_NOTIFICATION_NEWMAIL_ICON);
      if (firetray.Handler.support['full_feat']) {
        let newMailIconNames = document.getElementById("newmail_icon_names");
        this.disableNChildren(newMailIconNames, 2, false);
      }
      firetray.Utils.prefService.setIntPref("mail_notification_type", FIRETRAY_NOTIFICATION_NEWMAIL_ICON);
    }
  },

  toggleNotifications: function(enabled) { // Messaging init/shutdown done in PrefListener
    if (enabled) {
      document.getElementById("broadcaster-notification-disabled")
        .removeAttribute("disabled"); // UI update (enables!)

      let prefMailNotificationType = firetray.Utils.prefService.getIntPref("mail_notification_type");
      this.disableNotificationMaybe(prefMailNotificationType);

      let radioMessageCountType = document.getElementById("ui_message_count_type");
      let messageCountType = +radioMessageCountType.getItemAtIndex(radioMessageCountType.selectedIndex).value;
      this.disableMessageCountMaybe(messageCountType);

    } else {
      document.getElementById("broadcaster-notification-disabled")
        .setAttribute("disabled", "true"); // UI update
    }
  },

  toggleChatIcon: function(enabled) {
    if (enabled) {
      document.getElementById("broadcaster-chat-icon-disabled")
        .removeAttribute("disabled"); // UI update (enables!)

      this.toggleChatIconBlink(
        firetray.Utils.prefService.getBoolPref("chat_icon_blink"));

    } else {
      document.getElementById("broadcaster-chat-icon-disabled")
        .setAttribute("disabled", "true"); // UI update
    }
  },

  toggleChatIconBlink: function(enabled) {
      this.disableElementsRecursive(document.getElementById("ui_chat_icon_blink_style"), !enabled);
  },

  chooseAppIconFile: function() {
    let updateIcon = firetray.Handler.setIconImageDefault.bind(firetray.Handler);
    this._chooseIconFile("app_icon_custom_filename");
  },

  chooseMailIconFile: function() {
    let updateIcon = firetray.Messaging.updateIcon.bind(firetray.Messaging);
    this._chooseIconFile("custom_mail_icon_filename", updateIcon);
  },

  _chooseIconFile: function(elementId, callback) {
    const nsIFilePicker = Ci.nsIFilePicker;
    var filePicker = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);

    let fpCallback = { done: function(aResult) {
      if (aResult == nsIFilePicker.returnOK ||
          aResult == nsIFilePicker.returnReplace) {
        let filenameElt = document.getElementById(elementId);
        filenameElt.value = filePicker.file.path;
        let prefpane = firetrayUIOptions.getAncestorPrefpane(filenameElt);
        prefpane.userChangedValue(filenameElt);

        callback.call();
      }
    }};

    filePicker.init(window, "Select Icon", nsIFilePicker.modeOpen); // FIXME: i18n
    filePicker.appendFilters(nsIFilePicker.filterImages);
    filePicker.open(fpCallback);
  },

  getAncestorPrefpane: function(elt) {
    let prefpanes = firetray.Utils.XPath(elt, 'ancestor::xul:prefpane');
    if (prefpanes.length !== 1)
      throw new RangeError("not single prefpane found for '"+elt.getAttribute("id")+"'");
    return prefpanes[0];
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
      log.debug("folder: "+folderType);
      if (!(FLDRS_UNINTERESTING[folderType] & prefExcludedFoldersFlags)) {
        excludedFoldersList.ensureElementIsVisible(item); // bug 326445
        excludedFoldersList.addItemToSelection(item); // doesn't trigger onselect
      }
    }
  },

  updateExcludedFoldersPref: function() {
    let excludedFoldersList = document.getElementById('excluded_folders_list');

    log.debug("LAST SELECTED: "+excludedFoldersList.currentItem.label);
    let excludedFoldersFlags = null;
    for (let i = 0, len=excludedFoldersList.itemCount; i<len; ++i) {
      let folder = excludedFoldersList.getItemAtIndex(i);
      if (folder.selected)
        excludedFoldersFlags &= ~FLDRS_UNINTERESTING[folder.value];
      else
        excludedFoldersFlags |= FLDRS_UNINTERESTING[folder.value];
    }
    log.debug("excluded folders flags: "+excludedFoldersFlags);

    firetray.Utils.prefService.setIntPref("excluded_folders_flags",
                                          excludedFoldersFlags);

    firetray.Messaging.updateMsgCountWithCb();
  },

  /**
   * should be called only for excludedAccounts
   */
  _disableTreeRow: function(row, disable) {
    let that = this;
    try {
      let cells = row.childNodes; // .getElementsByTagName('treecell');
      log.debug("CELLS: "+cells);
      for (let i=0, len=cells.length; i<len; ++i) {
        log.debug("i: "+i+", cell:"+cells[i]);
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
      log.error(e);
    }
  },

  /**
   * needed for triggering actual preference change and saving
   */
  _userChangeValueTree: function(event) {
    if (event.attrName == "label") log.debug("label changed!");
    if (event.attrName == "value") log.debug("value changed!");
    document.getElementById("pref-pane-mail")
      .userChangedValue(document.getElementById("ui_tree_mail_accounts"));

    firetray.Messaging.updateMsgCountWithCb();
  },

  _userChangeValueTreeServerTypes: function(event) {
    if (event.attrName === "value") { // checkbox
      let checkboxCell = event.originalTarget;
      let tree = document.getElementById("ui_tree_mail_accounts");

      let subRows = firetray.Utils.XPath(
        checkboxCell,
        'ancestor::xul:treeitem[1]/child::xul:treechildren/xul:treeitem/xul:treerow');
      log.debug("subRows="+subRows);
      for (let i=0, len=subRows.length; i<len; ++i) {
        firetrayUIOptions._disableTreeRow(
          subRows[i], (checkboxCell.getAttribute("value") === "false"));
      }

    } else if (event.attrName == "label") { // text
      log.warn("NOT IMPLEMENTED YET: move row to new rank"); // TODO
    }

    this._userChangeValueTree(event);
  },

  /**
   * NOTE: account exceptions for unread messages count are *stored* in
   * preferences as excluded, but *shown* as "not included"
   */
  // FIXME: this function is too long !
  // FIXME: tree not updated if accounts or favorite added/removed
  populateTreeAccountsOrServerTypes: function() {
    let that = this;

    let mailAccounts = firetray.Utils.getObjPref("mail_accounts");
    let serverTypes = mailAccounts["serverTypes"];
    let accountsExcluded = mailAccounts["excludedAccounts"];
    let accountsByServerType = firetray.Messaging.accountsByServerType();
    log.debug(JSON.stringify(accountsByServerType));

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
    log.debug("serverTypesSorted: "+serverTypesSorted);

    let target = document.getElementById("ui_mail_accounts");
    for (let i=0, len=serverTypesSorted.length; i<len; ++i) {
      let serverTypeName = serverTypesSorted[i];

      let typeItem = document.createElement('treeitem');
      typeItem.setAttribute("container",true);
      typeItem.setAttribute("open",true);

      let typeRow = document.createElement('treerow');
      typeItem.appendChild(typeRow);

      // account_or_server_type_name
      let cellName = document.createElement('treecell');
      cellName.setAttribute('label',serverTypeName);
      cellName.setAttribute('editable',false);
      typeRow.appendChild(cellName);

      // account_or_server_type_excluded => checkbox
      let cellExcluded = document.createElement('treecell');
      cellExcluded.setAttribute('value',!serverTypes[serverTypeName].excluded);
      cellExcluded.addEventListener( // CAUTION: removeEventListener in onQuit()
        'DOMAttrModified', that._userChangeValueTreeServerTypes, true);
      typeRow.appendChild(cellExcluded);

      // account_or_server_type_order
      let cellOrder = document.createElement('treecell');
      cellOrder.setAttribute('label',serverTypes[serverTypeName].order);
      cellOrder.addEventListener( // CAUTION: removeEventListener in onQuit()
        'DOMAttrModified', that._userChangeValueTreeServerTypes, true);
      typeRow.appendChild(cellOrder);

      target.appendChild(typeItem);

      // add actual accounts as children
      let accountChildren = document.createElement('treechildren');
      let typeAccounts = accountsByServerType[serverTypeName];
      log.debug("type: "+serverTypeName+", Accounts: "+JSON.stringify(typeAccounts));
      if (typeof(typeAccounts) == "undefined")
        continue;

      let rowDisabled = (cellExcluded.getAttribute("value") === "false");
      for (let i=0, len=typeAccounts.length; i<len; ++i) {
        let account = typeAccounts[i];
        let accountItem = document.createElement('treeitem');
        accountItem.setAttribute("container",true);
        accountItem.setAttribute("open",true);

        let accountRow = document.createElement('treerow');

        // account_or_server_type_name
        let accountCell = document.createElement('treecell');
        accountCell.setAttribute('id', account.key);
        accountCell.setAttribute('label',account.name);
        accountCell.setAttribute('editable',false);
        if (rowDisabled === true)
          accountCell.setAttribute('properties', "disabled");
        accountRow.appendChild(accountCell);

        // account_or_server_type_excluded => checkbox
        accountCell = document.createElement('treecell');
        accountCell.setAttribute('value',(accountsExcluded.indexOf(account.key) < 0));
        if (rowDisabled === true) {
          accountCell.setAttribute('properties', "disabled");
          accountCell.setAttribute('editable', "false");
        } else {
          accountCell.addEventListener(  // CAUTION: removeEventListener in onQuit()
            'DOMAttrModified', that._userChangeValueTree, true);
        }
        accountRow.appendChild(accountCell);

        // account_or_server_type_order - UNUSED (added for consistency)
        accountCell = document.createElement('treecell');
        accountCell.setAttribute('editable',false);
        if (rowDisabled === true)
          accountCell.setAttribute('properties', "disabled");
        accountRow.appendChild(accountCell);

        // we must initialize sub-cells correctly to prevent prefsync at a
        // stage where the pref will be incomplete
        /* this._disableTreeRow(
         accountRow, (cellExcluded.getAttribute("value") === "false")); */
        accountItem.appendChild(accountRow);
        accountChildren.appendChild(accountItem);

        // add favorite folders
        let folderChildren = document.createElement('treechildren');
        let folderChildrenCount = 0;
        let msgAccount = MailServices.accounts.getIncomingServer(account.key);
        firetray.Messaging.applyToSubfolders(msgAccount.rootFolder, true, function(folder) {
          if (!(folder.flags & Ci.nsMsgFolderFlags.Favorite)) return;

          log.debug("adding folder favorite="+folder.prettyName);
          let folderItem = document.createElement('treeitem');
          let folderRow = document.createElement('treerow');

          // folder name
          let folderCell = document.createElement('treecell');
          folderCell.setAttribute('id', folder.name);
          folderCell.setAttribute('label',folder.prettyName);
          folderCell.setAttribute('editable',false);
          folderCell.setAttribute('properties', "disabled");
          folderRow.appendChild(folderCell);

          // checkbox
          folderCell = document.createElement('treecell');
          folderCell.setAttribute('editable', "false");
          folderCell.setAttribute('properties', "disabled");
          folderRow.appendChild(folderCell);

          // order - UNUSED
          folderCell = document.createElement('treecell');
          folderCell.setAttribute('editable', "false");
          folderCell.setAttribute('properties', "disabled");
          folderRow.appendChild(folderCell);

          folderItem.appendChild(folderRow);
          folderChildren.appendChild(folderItem);
          ++folderChildrenCount;
        });

        if (folderChildrenCount)
          accountItem.appendChild(folderChildren);
      }

      typeItem.appendChild(accountChildren);
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

    log.debug("VIEW="+ tree.view + ", rowCount="+tree.view.rowCount);
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
      log.debug("account: "+accountOrServerTypeName+", "+accountOrServerTypeExcluded);

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
    log.debug("prefStr"+prefStr);

    /* return the new prefString to be stored by pref system */
    return prefStr;
  },

  onKeyPressTreeAccountsOrServerTypes: function(event) {
    log.debug("TREE KEYPRESS: "+event.originalTarget);
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
    firetrayUIOptions.onLoad(e); },
  false);
window.addEventListener(
  'unload', function (e) {
    removeEventListener('unload', arguments.callee, true);
    firetrayUIOptions.onQuit(e); },
  false);
