/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

/* for now, logging facilities (imported from logging.jsm) and Services are
   automatically provided by this module */
var EXPORTED_SYMBOLS =
  [ "firetray", "FIRETRAY_ID", "FIRETRAY_VERSION", "FIRETRAY_PREF_BRANCH",
    "FIRETRAY_SPLASH_PAGE", "FIRETRAY_APPLICATION_ICON_TYPE_THEMED",
    "FIRETRAY_APPLICATION_ICON_TYPE_CUSTOM",
    "FIRETRAY_NOTIFICATION_UNREAD_MESSAGE_COUNT",
    "FIRETRAY_NOTIFICATION_NEWMAIL_ICON", "FIRETRAY_NOTIFICATION_CUSTOM_ICON",
    "FIRETRAY_IM_STATUS_AVAILABLE", "FIRETRAY_IM_STATUS_AWAY",
    "FIRETRAY_IM_STATUS_BUSY", "FIRETRAY_IM_STATUS_OFFLINE",
    "FIRETRAY_ACCOUNT_SERVER_TYPE_IM",
    "FIRETRAY_DELAY_BROWSER_STARTUP_MILLISECONDS",
    "FIRETRAY_DELAY_NOWAIT_MILLISECONDS",
    "FIRETRAY_DELAY_PREF_CLEANING_MILLISECONDS",
    "FIRETRAY_MESSAGE_COUNT_TYPE_UNREAD", "FIRETRAY_MESSAGE_COUNT_TYPE_NEW",
    "FIRETRAY_FIREFOX_ID", "FIRETRAY_THUNDERBIRD_ID", "FIRETRAY_SONGBIRD_ID",
    "FIRETRAY_SUNBIRD_ID", "FIRETRAY_SEAMONKEY_ID", "FIRETRAY_CHATZILLA_ID" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://firetray/logging.jsm");

const FIRETRAY_VERSION     = "0.4.3"; // needed for sync call of onVersionChange() :(
const FIRETRAY_PREF_BRANCH = "extensions.firetray.";
const FIRETRAY_ID          = "{9533f794-00b4-4354-aa15-c2bbda6989f8}";
const FIRETRAY_SPLASH_PAGE = "http://foudfou.github.com/FireTray/";

const FIRETRAY_APPLICATION_ICON_TYPE_THEMED = 0;
const FIRETRAY_APPLICATION_ICON_TYPE_CUSTOM = 1;

const FIRETRAY_MESSAGE_COUNT_TYPE_UNREAD         = 0;
const FIRETRAY_MESSAGE_COUNT_TYPE_NEW            = 1;

const FIRETRAY_NOTIFICATION_UNREAD_MESSAGE_COUNT = 0;
const FIRETRAY_NOTIFICATION_NEWMAIL_ICON         = 1;
const FIRETRAY_NOTIFICATION_CUSTOM_ICON          = 2;

const FIRETRAY_IM_STATUS_AVAILABLE = "user-available";
const FIRETRAY_IM_STATUS_AWAY      = "user-away";
const FIRETRAY_IM_STATUS_BUSY      = "user-busy";
const FIRETRAY_IM_STATUS_OFFLINE   = "user-offline";

const FIRETRAY_ACCOUNT_SERVER_TYPE_IM = "im";

const FIRETRAY_DELAY_BROWSER_STARTUP_MILLISECONDS = 500;
const FIRETRAY_DELAY_NOWAIT_MILLISECONDS          = 0;
const FIRETRAY_DELAY_PREF_CLEANING_MILLISECONDS   = 15*60*1000;

const FIRETRAY_FIREFOX_ID     = "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}";
const FIRETRAY_THUNDERBIRD_ID = "{3550f703-e582-4d05-9a08-453d09bdfdc6}";
const FIRETRAY_SONGBIRD_ID    = "songbird@songbirdnest.com";
const FIRETRAY_SUNBIRD_ID     = "{718e30fb-e89b-41dd-9da7-e25a45638b28}";
const FIRETRAY_SEAMONKEY_ID   = "{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}";
const FIRETRAY_CHATZILLA_ID   = "{59c81df5-4b7a-477b-912d-4e0fdf64e5f2}";

/**
 * firetray namespace.
 */
if ("undefined" == typeof(firetray)) {
  var firetray = {};
};

let log = firetray.Logging.getLogger("firetray.commons");

firetray.Utils = {
  prefService: Services.prefs.getBranch(FIRETRAY_PREF_BRANCH),
  strings: Services.strings.createBundle("chrome://firetray/locale/overlay.properties"),

  addObservers: function(handler, topics){
    topics.forEach(function(topic){
      if (this.observedTopics[topic]) {
        log.warn(topic+" already registred for "+handler);
        return;
      }

      Services.obs.addObserver(this, topic, false);
      this.observedTopics[topic] = true;
      log.debug("registred "+topic+" for "+handler);
    }, handler);
  },

  removeObservers: function(handler, topics) {
    topics.forEach(function(topic){
      Services.obs.removeObserver(this, topic);
      delete this.observedTopics[topic];
    }, handler);
  },

  removeAllObservers: function(handler) {
    for (let topic in handler.observedTopics)
      Services.obs.removeObserver(handler, topic);
    handler.observedTopics = {};
  },

  getObjPref: function(prefStr) {
    try {
      var objPref = JSON.parse(
        firetray.Utils.prefService.getCharPref(prefStr));
    } catch (x) {
      log.error(x);
    }
    return objPref;
  },
  setObjPref: function(prefStr, obj) {
    log.debug(obj);
    try {
      firetray.Utils.prefService.setCharPref(prefStr, JSON.stringify(obj));
    } catch (x) {
      log.error(x);
    }
  },

  getArrayPref: function(prefStr) {
    let arrayPref = this.getObjPref(prefStr);
    if (!firetray.js.isArray(arrayPref)) throw new TypeError();
    return arrayPref;
  },
  setArrayPref: function(prefStr, aArray) {
    if (!firetray.js.isArray(aArray)) throw new TypeError();
    this.setObjPref(prefStr, aArray);
  },

  QueryInterfaces: function(obj) {
    for each (i in Components.interfaces)
      try {
        if (obj instanceof i) log.debug (i);
      } catch(x) {}
  },

  // adapted from http://forums.mozillazine.org/viewtopic.php?p=921150#921150
  chromeToPath: function(aPath) {
    if (!aPath || !(/^chrome:/.test(aPath)))
      return null;              // not a chrome url

    let uri = Services.io.newURI(aPath, "UTF-8", null);
    let registeryValue = Cc['@mozilla.org/chrome/chrome-registry;1']
      .getService(Ci.nsIChromeRegistry)
      .convertChromeURL(uri).spec;
    log.debug(registeryValue);

    if (/^file:/.test(registeryValue))
      registeryValue = this._urlToPath(registeryValue);
    else
      registeryValue = this._urlToPath("file://"+registeryValue);

    return registeryValue;
  },

  _urlToPath: function (aPath) {
    if (!aPath || !/^file:/.test(aPath))
      return null;

    let protocolHandler = Cc["@mozilla.org/network/protocol;1?name=file"]
      .createInstance(Ci.nsIFileProtocolHandler);
    return protocolHandler.getFileFromURLSpec(aPath).path;
  },

  dumpObj: function(obj) {
    let str = "";
    for(i in obj) {
      try {
        str += "obj["+i+"]: " + obj[i] + "\n";
      } catch(e) {
        str += "obj["+i+"]: Unavailable\n";
      }
    }
    log.debug(str);
  },

  _nsResolver: function(prefix) {
    var ns = {
      xul: "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"
    };
    return ns[prefix] || null;
  },

  // adapted from http://code.google.com/p/jslibs/wiki/InternalTipsAndTricks
  XPath: function(ref, xpath) {
    var doc = ref.ownerDocument || ref;

    const XPathResult = Ci.nsIDOMXPathResult;
    try {
      let that = this;
      var result = doc.evaluate(xpath, ref, that._nsResolver,
                                XPathResult.ANY_TYPE, null);
    } catch (x) {
      log.error(x);
    }
    log.debug("XPathResult="+result.resultType);

    switch (result.resultType) {
    case XPathResult.NUMBER_TYPE:
      return result.numberValue;
    case XPathResult.BOOLEAN_TYPE:
      return result.booleanValue;
    case XPathResult.STRING_TYPE:
      return result.stringValue;
    } // else XPathResult.UNORDERED_NODE_ITERATOR_TYPE

    var list = [];
    try {
      for (let node = result.iterateNext(); node; node = result.iterateNext()) {
        log.debug("node="+node.nodeName);
        switch (node.nodeType) {
        case node.ATTRIBUTE_NODE:
          list.push(node.value);
          break;
        case node.TEXT_NODE:
          list.push(node.data);
          break;
        default:
          list.push(node);
        }
      }
    } catch (x) {
      log.error(x);
    }

    return list;
  },

  timer: function(callback, delay, timerType) {
    var timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    timer.initWithCallback({ notify: callback },
      delay, timerType);
    return timer;
  }

};

////////////////////////// more fundamental helpers //////////////////////////

firetray.js = {
  // http://stackoverflow.com/questions/767486/how-do-you-check-if-a-variable-is-an-array-in-javascript
  isArray: function(o) {
    return this.getType(o) === '[object Array]';
  },
  getType: function(thing) {
    if(thing === null) return "[object Null]"; // special case
    return Object.prototype.toString.call(thing);
  },

  // http://stackoverflow.com/questions/679915/how-do-i-test-for-an-empty-javascript-object-from-json
  isEmpty: function(obj) {
    for(var prop in obj) {
      if(obj.hasOwnProperty(prop))
        return false;
    }
    return true;
  },

  // values of different ctypes objects can never be compared. See:
  // https://developer.mozilla.org/en/js-ctypes/Using_js-ctypes/Working_with_data#Quirks_in_equality
  strEquals: function(obj1, obj2) {
    return obj1.toString() === obj2.toString();
  }
};

// http://stackoverflow.com/questions/18912/how-to-find-keys-of-a-hash
// https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Object/keys
if(!Object.keys) Object.keys = function(o){
  if (o !== Object(o))
    throw new TypeError('Object.keys called on non-object');
  var ret=[],p;
  for(p in o) if(Object.prototype.hasOwnProperty.call(o,p)) ret.push(p);
  return ret;
};

// https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/String/Trim
if(!String.prototype.trim) {
  String.prototype.trim = function () {
    return this.replace(/^\s+|\s+$/g,'');
  };
}
