/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS =
  [ "firetray", "LOG", "WARN", "ERROR", "FIREFOX_ID",
    "THUNDERBIRD_ID", "SEAMONKEY_ID", "isArray", "isEmpty",
    "FT_NOTIFICATION_DISABLED", "FT_NOTIFICATION_UNREAD_MESSAGE_COUNT",
    "FT_NOTIFICATION_NEWMAIL_ICON", "FT_NOTIFICATION_CUSTOM_ICON" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");

const FIREFOX_ID = "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}";
const THUNDERBIRD_ID = "{3550f703-e582-4d05-9a08-453d09bdfdc6}";
const SONGBIRD_ID = "songbird@songbirdnest.com";
const SUNBIRD_ID = "{718e30fb-e89b-41dd-9da7-e25a45638b28}";
const SEAMONKEY_ID = "{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}";
const CHATZILLA_ID = "{59c81df5-4b7a-477b-912d-4e0fdf64e5f2}";

const FT_NOTIFICATION_DISABLED = 0;
const FT_NOTIFICATION_UNREAD_MESSAGE_COUNT = 1;
const FT_NOTIFICATION_NEWMAIL_ICON = 2;
const FT_NOTIFICATION_CUSTOM_ICON = 3;

/**
 * firetray namespace.
 */
if ("undefined" == typeof(firetray)) {
  var firetray = {};
};

// about:config extensions.logging.enabled
["LOG", "WARN", "ERROR"].forEach(function(aName) {
  this.__defineGetter__(aName, function() {
    Components.utils.import("resource://gre/modules/AddonLogging.jsm");
    LogManager.getLogger("firetray", this);
    return this[aName];
  });
}, this);


firetray.Utils = {
  prefService: Services.prefs.getBranch("extensions.firetray."),
  strings: Services.strings.createBundle("chrome://firetray/locale/overlay.properties"),

  getObjPref: function(prefStr) {
    try {
      var objPref = JSON.parse(
        firetray.Utils.prefService.getCharPref(prefStr));
    } catch (x) {
      ERROR(x);
    }
    return objPref;
  },
  setObjPref: function(prefStr, obj) {
    LOG(obj);
    try {
      firetray.Utils.prefService.setCharPref(prefStr, JSON.stringify(obj));
    } catch (x) {
      ERROR(x);
    }
  },

  getArrayPref: function(prefStr) {
    let arrayPref = this.getObjPref(prefStr);
    if (!isArray(arrayPref)) throw new TypeError();
    return arrayPref;
  },
  setArrayPref: function(prefStr, aArray) {
    if (!isArray(aArray)) throw new TypeError();
    this.setObjPref(prefStr, aArray);
  },

  QueryInterfaces: function(obj) {
    for each (i in Components.interfaces) {
      try {
        if (obj instanceof i) { LOG(i); }
      } catch (x) {}
    }
  },

  // adapted from http://forums.mozillazine.org/viewtopic.php?p=921150#921150
  chromeToPath: function(aPath) {
    if (!aPath || !(/^chrome:/.test(aPath)))
      return null;              // not a chrome url

    let uri = Services.io.newURI(aPath, "UTF-8", null);
    let registeryValue = Cc['@mozilla.org/chrome/chrome-registry;1']
      .getService(Ci.nsIChromeRegistry)
      .convertChromeURL(uri).spec;
    LOG(registeryValue);

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
    LOG(str);
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
      ERROR(x);
    }
    LOG("XPathResult="+result.resultType);

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
        LOG("node="+node.nodeName);
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
      ERROR(x);
    }

    return list;
  }

};

// http://stackoverflow.com/questions/767486/how-do-you-check-if-a-variable-is-an-array-in-javascript
function isArray(o) {
  return Object.prototype.toString.call(o) === '[object Array]';
}

// http://stackoverflow.com/questions/18912/how-to-find-keys-of-a-hash
// https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Object/keys
if(!Object.keys) Object.keys = function(o){
  if (o !== Object(o))
    throw new TypeError('Object.keys called on non-object');
  var ret=[],p;
  for(p in o) if(Object.prototype.hasOwnProperty.call(o,p)) ret.push(p);
  return ret;
};

// http://stackoverflow.com/questions/679915/how-do-i-test-for-an-empty-javascript-object-from-json
function isEmpty(obj) {
  for(var prop in obj) {
    if(obj.hasOwnProperty(prop))
      return false;
  }
  return true;
}
