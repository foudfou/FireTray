/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = [ "firetray" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource:///modules/imServices.jsm");
Cu.import("resource://firetray/commons.js");
Cu.import("resource://firetray/linux/FiretrayChatStatusIcon.jsm");

firetray.Chat = {
  initialized: false,
  observedTopics: {},
  acknowledgeOnFocus: {},

  init: function() {
    if (this.initialized) {
      F.WARN("Chat already initialized");
      return;
    }
    F.LOG("Enabling Chat");

    firetray.Utils.addObservers(firetray.Chat, [
      // "*" // debugging
      "account-connected", "account-disconnected", "idle-time-changed",
      "new-directed-incoming-message", "status-changed",
      "unread-im-count-changed"
    ]);
    firetray.ChatStatusIcon.init();

    this.initialized = true;
  },

  shutdown: function() {
    if (!this.initialized) return;
    F.LOG("Disabling Chat");

    firetray.ChatStatusIcon.shutdown();
    firetray.Utils.removeAllObservers(firetray.Chat);

    this.initialized = false;
  },

  observe: function(subject, topic, data) {
    F.LOG("RECEIVED Chat: "+topic+" subject="+subject+" data="+data);
    switch (topic) {
    case "account-connected":
    case "account-disconnected":
    case "idle-time-changed":
    case "status-changed":
      this.updateIcon();
      break;

    case "new-directed-incoming-message": // when PM or cited in channel
      let conv = subject.QueryInterface(Ci.prplIMessage).conversation;
      F.LOG("conversation name="+conv.name); // normalizedName shouldn't be necessary

      let convIsActiveTabInActiveWin = this.isConvActiveTabInActiveWindow(conv);
      F.LOG("convIsActiveTabInActiveWin="+convIsActiveTabInActiveWin);
      if (!convIsActiveTabInActiveWin) { // don't blink when conv tab already on top
        this.acknowledgeOnFocus.must = true;
        this.acknowledgeOnFocus.conv = conv;
        firetray.ChatStatusIcon.setIconBlinking(true);
      }
      break;

    case "unread-im-count-changed":
      let unreadMsgCount = data;
      if (unreadMsgCount == 0)
        this.stopIconBlinkingMaybe();

      let localizedTooltip = PluralForm.get(
        unreadMsgCount,
        firetray.Utils.strings.GetStringFromName("tooltip.unread_messages"))
        .replace("#1", unreadMsgCount);
      firetray.ChatStatusIcon.setIconTooltip(localizedTooltip);
      break;

    default:
      F.WARN("unhandled topic: "+topic);
    }
  },

  stopIconBlinkingMaybe: function() {
    F.LOG("acknowledgeOnFocus.must="+this.acknowledgeOnFocus.must);
    if (!this.acknowledgeOnFocus.must) return;

    let convIsActiveTabInActiveWin = this.isConvActiveTabInActiveWindow(
      this.acknowledgeOnFocus.conv);
    F.LOG("convIsActiveTabInActiveWin="+convIsActiveTabInActiveWin);

    if (this.acknowledgeOnFocus.must && convIsActiveTabInActiveWin) {
      firetray.ChatStatusIcon.setIconBlinking(false);
      this.acknowledgeOnFocus.must = false;
    }
  },

  isConvActiveTabInActiveWindow: function(conv) {
    let activeWin = firetray.Handler.findActiveWindow(),
        activeChatTab = null;
    if (!firetray.Handler.windows[activeWin]) return false;

    activeChatTab = this.findActiveChatTab(activeWin);
    let convNameRegex = new RegExp(" - "+conv.name+"$");
    return activeChatTab ? convNameRegex.test(activeChatTab.title) : false;
  },

  findActiveChatTab: function(xid) {
    let win = firetray.Handler.windows[xid].chromeWin;
    let tabmail = win.document.getElementById("tabmail");
    let chatTabs = tabmail.tabModes.chat.tabs;
    for each (let tab in chatTabs)
      if (tab.tabNode.selected) return tab;
    return null;
  },

  updateIcon: function() {
    let globalConnectedStatus = this.globalConnectedStatus();
    let userStatus;
    if (globalConnectedStatus)
      userStatus = Services.core.globalUserStatus.statusType;
    else
      userStatus = Ci.imIStatusInfo.STATUS_OFFLINE;
    F.LOG("IM status="+userStatus);

    let iconName;
    switch (userStatus) {
    case Ci.imIStatusInfo.STATUS_OFFLINE: // 1
      iconName = FIRETRAY_IM_STATUS_OFFLINE;
      break;
    case Ci.imIStatusInfo.STATUS_IDLE: // 4
    case Ci.imIStatusInfo.STATUS_AWAY: // 5
      iconName = FIRETRAY_IM_STATUS_AWAY;
      break;
    case Ci.imIStatusInfo.STATUS_AVAILABLE: // 7
      iconName = FIRETRAY_IM_STATUS_AVAILABLE;
      break;
    case Ci.imIStatusInfo.STATUS_UNAVAILABLE: // 6
      iconName = FIRETRAY_IM_STATUS_BUSY;
      break;
    case Ci.imIStatusInfo.STATUS_UNKNOWN: // 0
    case Ci.imIStatusInfo.STATUS_INVISIBLE: // 2
    case Ci.imIStatusInfo.STATUS_MOBILE:    // 3
    default:
        // ignore
    }

    F.LOG("IM status changed="+iconName);
    if (iconName)
      firetray.ChatStatusIcon.setIconImage(iconName);
  },

  globalConnectedStatus: function() {
    let accounts = Services.accounts.getAccounts();
    let globalConnected = false;
    while (accounts.hasMoreElements()) {
      let account = accounts.getNext().QueryInterface(Ci.imIAccount);
      F.LOG("account="+account+" STATUS="+account.statusInfo.statusType+" connected="+account.connected);
      globalConnected = globalConnected || account.connected;
    }
    F.LOG("globalConnected="+globalConnected);
    return globalConnected;
  }

};
