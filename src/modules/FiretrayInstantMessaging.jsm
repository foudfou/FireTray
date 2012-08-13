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

  init: function() {
    if (this.initialized) {
      F.WARN("InstantMessaging already initialized");
      return;
    }
    F.LOG("Enabling InstantMessaging");

    firetray.Utils.addObservers(firetray.InstantMessaging, [
      // "*" // debugging
      "account-connected", "account-disconnected", "idle-time-changed",
      "new-directed-incoming-message", "new-text", "new-ui-conversation",
      "status-changed", "unread-im-count-changed", "visited-status-resolution"
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
    // case "visited-status-resolution":
      this.updateIcon();
      break;

    case "unread-im-count-changed":
      break;

    case "new-directed-incoming-message": // when PM or cited in channel: new-directed-incoming-message: [xpconnect wrapped (nsISupports, nsIClassInfo, prplIMessage)] null
      break;

    default:
      F.WARN("unhandled topic: "+topic);
    }
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
