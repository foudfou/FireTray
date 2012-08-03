/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = [ "firetray", "FLDRS_UNINTERESTING" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://firetray/commons.js");

firetray.InstantMessaging = {
  initialized: false,
  observedTopics: {},

  init: function() {
    if (this.initialized) {
      F.WARN("InstantMessaging already initialized");
      return;
    }
    F.LOG("Enabling InstantMessaging");

    firetray.Utils.addObservers(firetray.InstantMessaging, [ // "*" for debugging
      "idle-time-changed", "new-directed-incoming-message", "new-text",
      "new-ui-conversation", "status-changed", "unread-im-count-changed",
      "visited-status-resolution"
    ]);

    this.initialized = true;
  },

  shutdown: function() {
    if (!this.initialized) return;
    F.LOG("Disabling InstantMessaging");

    Services.obs.removeAllObservers(firetray.InstantMessaging);

    this.initialized = false;
  },

  observe: function(subject, topic, data) {
    F.WARN("RECEIVED InstantMessaging:");
    switch (topic) {
    case "unread-im-count-changed":
      F.WARN("received unread-im-count-changed: "+subject+" "+data);
      break;
    case "new-directed-incoming-message": // when PM or cited in channel: new-directed-incoming-message: [xpconnect wrapped (nsISupports, nsIClassInfo, prplIMessage)] null
      F.WARN("new-directed-incoming-message: "+subject+" "+data);
      break;
    case "visited-status-resolution":
      F.WARN("visited-status-resolution: "+subject+" "+data);
      break;
    case "status-changed":
    case "idle-time-changed":
      break;
    default:
      F.WARN("unhandled topic: "+topic);
    }
  }

};
