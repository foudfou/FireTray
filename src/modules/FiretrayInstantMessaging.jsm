/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = [ "firetray" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource:///modules/imServices.jsm");
Cu.import("resource://firetray/commons.js");
Cu.import("resource://firetray/linux/FiretrayIMStatusIcon.jsm");

// FIXME: rename to firetray.Chat
firetray.InstantMessaging = {
  initialized: false,
  observedTopics: {},
  acknowledgeOnFocus: {},

  init: function() {
    if (this.initialized) {
      F.WARN("InstantMessaging already initialized");
      return;
    }
    F.LOG("Enabling InstantMessaging");

    firetray.Utils.addObservers(firetray.InstantMessaging, [
      // "*" // debugging
      "account-connected", "account-disconnected", "idle-time-changed",
      "new-directed-incoming-message", "status-changed",
      "unread-im-count-changed"
    ]);
    firetray.IMStatusIcon.init();

    this.initialized = true;
  },

  shutdown: function() {
    if (!this.initialized) return;
    F.LOG("Disabling InstantMessaging");

    firetray.IMStatusIcon.shutdown();
    firetray.Utils.removeAllObservers(firetray.InstantMessaging);

    this.initialized = false;
  },

  observe: function(subject, topic, data) {
    F.LOG("RECEIVED InstantMessaging: "+topic+" subject="+subject+" data="+data);
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
        firetray.IMStatusIcon.setIconBlinking(true);
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
      firetray.IMStatusIcon.setIconTooltip(localizedTooltip);
      break;

    default:
      F.WARN("unhandled topic: "+topic);
    }
  },

  stopIconBlinkingMaybe: function() {
    F.LOG("acknowledgeOnFocus.must="+this.acknowledgeOnFocus.must);
    // if (!this.acknowledgeOnFocus.must) return;

    let convIsActiveTabInActiveWin = this.isConvActiveTabInActiveWindow(
      this.acknowledgeOnFocus.conv);
    F.LOG("convIsActiveTabInActiveWin="+convIsActiveTabInActiveWin);

    if (this.acknowledgeOnFocus.must && convIsActiveTabInActiveWin) {
      firetray.IMStatusIcon.setIconBlinking(false);
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
    let userStatus = Services.core.globalUserStatus.statusType;
    F.LOG("IM status="+userStatus);

    let iconName;
    switch (userStatus) {
    case Ci.imIStatusInfo.STATUS_OFFLINE:
      iconName = FIRETRAY_IM_STATUS_OFFLINE;
      break;
    case Ci.imIStatusInfo.STATUS_IDLE:
    case Ci.imIStatusInfo.STATUS_AWAY:
      iconName = FIRETRAY_IM_STATUS_AWAY;
      break;
    case Ci.imIStatusInfo.STATUS_AVAILABLE:
      iconName = FIRETRAY_IM_STATUS_AVAILABLE;
      break;
    case Ci.imIStatusInfo.STATUS_UNAVAILABLE:
      iconName = FIRETRAY_IM_STATUS_BUSY;
      break;
    case Ci.imIStatusInfo.STATUS_UNKNOWN:
    case Ci.imIStatusInfo.STATUS_INVISIBLE:
    case Ci.imIStatusInfo.STATUS_MOBILE:
    default:
        // ignore
    }

    F.LOG("IM status changed="+iconName);
    if (iconName)
      firetray.IMStatusIcon.setIconImage(iconName);
  }

};
