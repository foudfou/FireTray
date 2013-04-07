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
  shouldAcknowledgeConvs: {
    ids: {},
    length: function(){return Object.keys(this.ids).length;}
  },

  init: function() {
    if (this.initialized) {
      log.warn("Chat already initialized");
      return;
    }
    log.debug("Enabling Chat");

    firetray.Utils.addObservers(firetray.Chat, [
      // "*", // debugging
      "account-connected", "account-disconnected", "idle-time-changed",
      "new-directed-incoming-message", "status-changed",
      "unread-im-count-changed", "new-text"
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

  // FIXME: the listener should probably attached on the conv entry in the
  // contactlist during startGetAttentionMaybe
  attachSelectListeners: function(win) {
    log.debug("attachSelectListeners");
    ["contactlistbox", "tabmail"].forEach(function(eltId) {
      win.document.getElementById(eltId)
        .addEventListener('select', firetray.Chat.onSelect);
    });
  },

  detachSelectListeners: function(win) {
    ["contactlistbox", "tabmail"].forEach(function(eltId) {
      win.document.getElementById(eltId)
        .removeEventListener('select', firetray.Chat.onSelect);
    });
  },

  observe: function(subject, topic, data) {
    log.debug("RECEIVED Chat: "+topic+" subject="+subject+" data="+data);
    let conv = null;

    switch (topic) {
    case "account-connected":
    case "account-disconnected":
    case "idle-time-changed":
    case "status-changed":
      this.updateIcon();
      break;

    case "new-directed-incoming-message": // when PM or cited in channel
      conv = subject.QueryInterface(Ci.prplIMessage).conversation;
      log.debug("conversation name="+conv.name); // normalizedName shouldn't be necessary
      this.startGetAttentionMaybe(conv);
      break;

    /* Twitter is obviously considered a chatroom, not a private
     conversation. This is why we need to detect incoming messages and switch
     to the conversation differently. The actual read should be caught by
     focus-in-event and 'select' event on tabmail and contactlist */
    case "new-text":
      let msg = subject.QueryInterface(Ci.prplIMessage);
      conv = msg.conversation;
      log.debug("new-text from "+conv.title);
      let account = conv.account.QueryInterface(Ci.imIAccount);
      let proto = account.protocol;

      log.debug("msg from "+msg.who+", alias="+msg.alias+", account.normalizedName="+account.normalizedName);
      if (msg.who === account.normalizedName) break; // ignore msg from self
      if (proto.normalizedName !== 'twitter') break;
      this.startGetAttentionMaybe(conv);
      break;

    case "unread-im-count-changed":
      log.debug("unread-im-count-changed");
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
    log.debug('startGetAttentionMaybe conv.id='+conv.id);
    if (this.shouldAcknowledgeConvs.ids[conv.id]) return; // multiple messages

    let convIsCurrentlyShown =
          this.isConvCurrentlyShown(conv, firetray.Handler.findActiveWindow());
    log.debug("convIsCurrentlyShown="+convIsCurrentlyShown);
    if (convIsCurrentlyShown) return; // don't blink when conv tab already on top

    this.shouldAcknowledgeConvs.ids[conv.id] = conv;
    log.debug(conv.id+' added to shouldAcknowledgeConvs');
    log.debug('shouldAcknowledgeConvs.length='+this.shouldAcknowledgeConvs.length());

    if (this.shouldAcknowledgeConvs.length() > 1) return; // already calling attention

    this.setUrgencyMaybe(conv);
    firetray.ChatStatusIcon.startIconBlinking();
  },

  /**
   * @param xid id of the window that MUST have initiated this event
   */
  stopGetAttentionMaybe: function(xid) {
    log.debug("stopGetAttentionMaybe");
    let shouldAcknowledgeConvsLength = this.shouldAcknowledgeConvs.length();
    log.debug("shouldAcknowledgeConvsLength="+shouldAcknowledgeConvsLength);
    if (!shouldAcknowledgeConvsLength) return;

    let selectedConv = this.getSelectedConv(xid);
    if (!selectedConv) return;

    for (convId in this.shouldAcknowledgeConvs.ids) {
      log.debug(convId+" == "+selectedConv.id);
      if (convId == selectedConv.id) {
        delete this.shouldAcknowledgeConvs.ids[convId];
        break;
      }
    }

    if(this.shouldAcknowledgeConvs.length() === 0) {
      log.debug("do stop icon blinking !!!");
      firetray.ChatStatusIcon.setUrgency(xid, false);
      firetray.ChatStatusIcon.stopIconBlinking();
    }
  },

  onSelect: function(event) {
    log.debug("select event ! ");
    firetray.Chat.stopGetAttentionMaybe(firetray.Handler.findActiveWindow());
  },

  isConvCurrentlyShown: function(conv, activeWin) {
    log.debug("isConvCurrentlyShown");
    let selectedConv = this.getSelectedConv(activeWin);
    if (!selectedConv) return false;

    log.debug("conv.title='"+conv.title+"' selectedConv.title='"+selectedConv.title+"'");
    return (conv.id == selectedConv.id);
  },

  getSelectedConv: function(activeWin) {
    if (!firetray.Handler.windows[activeWin]) return null;
    log.debug("getSelectedConv *");

    let activeChatTab = this.findSelectedChatTab(activeWin);
    if (!activeChatTab) return null;
    log.debug("getSelectedConv **");

    /* for now there is only one Chat tab, so we don't need to
     findSelectedChatTabFromTab(activeChatTab.tabNode). And, as there is only
     one forlderPaneBox, there will also probably be only one contactlistbox
     for all Chat tabs anyway */
    let selectedConv = this.findSelectedConv(activeWin);
    if (!selectedConv) return null;
    log.debug("getSelectedConv ***");

    return selectedConv;
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

  /* there can potentially be multiple windows, each with a Chat tab and the
   same conv open... so we need to handle urgency for all windows */
  setUrgencyMaybe: function(conv) {
    for (let xid in firetray.Handler.windows) {
      let win = firetray.Handler.windows[xid].chromeWin;
      let contactlist = win.document.getElementById("contactlistbox");
      for (let i=0; i<contactlist.itemCount; ++i) {
        let item = contactlist.getItemAtIndex(i);
        if (item.localName !== 'imconv')
          continue;
        /* item.conv is only initialized if chat tab is open */
        if (item.hasOwnProperty('conv') && item.conv.target === conv) {
          firetray.ChatStatusIcon.setUrgency(xid, true);
          break;
        }
      }
    }
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
