/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = [ "firetray" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource:///modules/imServices.jsm");
Cu.import("resource://firetray/commons.js");
Cu.import("resource://firetray/linux/FiretrayChatStatusIcon.jsm");

let log = firetray.Logging.getLogger("firetray.Chat");

firetray.Chat = {
  initialized: false,
  observedTopics: {},
  acknowledgeOnFocus: {},

  init: function() {
    if (this.initialized) {
      log.warn("Chat already initialized");
      return;
    }
    log.debug("Enabling Chat");

    firetray.Utils.addObservers(firetray.Chat, [
      // "*" // debugging
      "account-connected", "account-disconnected", "idle-time-changed",
      "new-directed-incoming-message", "status-changed",
      "unread-im-count-changed"
    ]);

    firetray.ChatStatusIcon.init();
    this.updateIcon();

    this.initialized = true;
  },

  shutdown: function() {
    if (!this.initialized) return;
    log.debug("Disabling Chat");

    firetray.ChatStatusIcon.shutdown();
    firetray.Utils.removeAllObservers(firetray.Chat);

    this.initialized = false;
  },

  observe: function(subject, topic, data) {
    log.debug("RECEIVED Chat: "+topic+" subject="+subject+" data="+data);
    switch (topic) {
    case "account-connected":
    case "account-disconnected":
    case "idle-time-changed":
    case "status-changed":
      this.updateIcon();
      break;

    case "new-directed-incoming-message": // when PM or cited in channel
      let conv = subject.QueryInterface(Ci.prplIMessage).conversation;
      log.debug("conversation name="+conv.name); // normalizedName shouldn't be necessary
      this.startGetAttentionMaybe(conv);
      break;

    case "unread-im-count-changed":
      let unreadMsgCount = data;
      if (unreadMsgCount == 0)
        this.stopGetAttentionMaybe(firetray.Handler.findActiveWindow());

      let localizedTooltip = PluralForm.get(
        unreadMsgCount,
        firetray.Utils.strings.GetStringFromName("tooltip.unread_messages"))
        .replace("#1", unreadMsgCount);
      firetray.ChatStatusIcon.setIconTooltip(localizedTooltip);
      break;

    default:
      log.warn("unhandled topic: "+topic);
    }
  },

  startGetAttentionMaybe: function(conv) {
    log.debug('startGetAttentionMaybe');
    let convIsCurrentlyShown = this.isConvCurrentlyShown(conv);
    log.debug("convIsCurrentlyShown="+convIsCurrentlyShown);
    if (!convIsCurrentlyShown) { // don't blink when conv tab already on top
      this.acknowledgeOnFocus.must = true;
      this.acknowledgeOnFocus.conv = conv;

      /* there can potentially be multiple windows, each with a Chat tab and
       the same conv open... so we need to handle all windows */
      for (let xid in firetray.Handler.windows) {
        let win = firetray.Handler.windows[xid].chromeWin;
        let contactlist = win.document.getElementById("contactlistbox");
        for (let i=0; i<contactlist.itemCount; ++i) {
          let item = contactlist.getItemAtIndex(i);
          if (item.localName !== 'imconv')
            continue;
          if (item.hasOwnProperty('conv') && item.conv.target === conv) {
            firetray.ChatStatusIcon.setUrgency(xid, true);
          }
        }
      }

      firetray.ChatStatusIcon.setIconBlinking(true);
    }
  },

  /**
   * @param xid id of the window that MUST have initiated this event
   */
  stopGetAttentionMaybe: function(xid) {
    log.debug("stopGetAttentionMaybe acknowledgeOnFocus.must="+this.acknowledgeOnFocus.must);
    if (!this.acknowledgeOnFocus.must) return;

    let convIsCurrentlyShown = this.isConvCurrentlyShown(
      this.acknowledgeOnFocus.conv, xid);
    log.debug("convIsCurrentlyShown="+convIsCurrentlyShown);

    if (this.acknowledgeOnFocus.must && convIsCurrentlyShown) {
      firetray.ChatStatusIcon.setUrgency(xid, false);
      firetray.ChatStatusIcon.setIconBlinking(false);
      this.acknowledgeOnFocus.must = false;
    }
  },

  isConvCurrentlyShown: function(conv, activeWin) {
    if (!firetray.Handler.windows[activeWin]) return false;

    let activeChatTab = this.findSelectedChatTab(activeWin);
    if (!activeChatTab) return false;

    // for now there is only one Chat tab, so we don't need to
    // findSelectedChatTabFromTab(activeChatTab.tabNode). And, as there is only
    // one forlderPaneBox, there will also probably be only one contactlistbox
    // for all Chat tabs anyway
    let selectedConv = this.findSelectedConv(activeWin);

    log.debug("conv.title='"+conv.title+"' selectedConv.title='"+selectedConv.title+"'");
    return (conv.id == selectedConv.id);
  },

  findSelectedChatTab: function(xid) {
    let win = firetray.Handler.windows[xid].chromeWin;
    let tabmail = win.document.getElementById("tabmail");
    let chatTabs = tabmail.tabModes.chat.tabs;
    for each (let tab in chatTabs)
      if (tab.tabNode.selected) return tab;
    return null;
  },

  findSelectedConv: function(xid) {
    let win = firetray.Handler.windows[xid].chromeWin;
    let selectedItem = win.document.getElementById("contactlistbox").selectedItem;
    if (!selectedItem || selectedItem.localName != "imconv") return null;
    return selectedItem.conv;
  },

  updateIcon: function() {
    let globalConnectedStatus = this.globalConnectedStatus();
    let userStatus;
    if (globalConnectedStatus)
      userStatus = Services.core.globalUserStatus.statusType;
    else
      userStatus = Ci.imIStatusInfo.STATUS_OFFLINE;
    log.debug("IM status="+userStatus);

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

    log.debug("IM status changed="+iconName);
    if (iconName)
      firetray.ChatStatusIcon.setIconImage(iconName);
  },

  globalConnectedStatus: function() {
    /* Because we may already be connected during init (for ex. when toggling
     the chat_icon_enable pref), we need to updateIcon() during init(). But IM
     accounts' list is not initialized at early stage... */
    try {

      let accounts = Services.accounts.getAccounts();
      let globalConnected = false;

      while (accounts.hasMoreElements()) {
        let account = accounts.getNext().QueryInterface(Ci.imIAccount);
        log.debug("account="+account+" STATUS="+account.statusInfo.statusType+" connected="+account.connected);
        globalConnected = globalConnected || account.connected;
      }
      log.debug("globalConnected="+globalConnected);
      return globalConnected;

    } catch (e if e instanceof Components.Exception &&
             e.result === Components.results.NS_ERROR_XPC_JS_THREW_JS_OBJECT &&
             /_items is undefined/.test(e.message)) {
      return false;             // ignore
    } catch(e) {
      log.error(e); return false;
    }
  }

};
