/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

var EXPORTED_SYMBOLS = [ "firetray" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");

const FIRETRAY_LOG_LEVEL = "Warn"; // "All" for debugging

const COLOR_NORMAL          = "";
const COLOR_RESET           = "\033[m";
const COLOR_BOLD            = "\033[1m";
const COLOR_RED             = "\033[31m";
const COLOR_GREEN           = "\033[32m";
const COLOR_YELLOW          = "\033[33m";
const COLOR_BLUE            = "\033[34m";
const COLOR_MAGENTA         = "\033[35m";
const COLOR_CYAN            = "\033[36m";
const COLOR_WHITE           = "\033[37m";
const COLOR_BOLD_RED        = "\033[1;31m";
const COLOR_BOLD_GREEN      = "\033[1;32m";
const COLOR_BOLD_YELLOW     = "\033[1;33m";
const COLOR_BOLD_BLUE       = "\033[1;34m";
const COLOR_BOLD_MAGENTA    = "\033[1;35m";
const COLOR_BOLD_CYAN       = "\033[1;36m";
const COLOR_BG_RED          = "\033[41m";
const COLOR_BG_GREEN        = "\033[42m";
const COLOR_BG_YELLOW       = "\033[43m";
const COLOR_BG_BLUE         = "\033[44m";
const COLOR_BG_MAGENTA      = "\033[45m";
const COLOR_BG_CYAN         = "\033[46m";

var colorTermLogColors = {
  "FATAL":  COLOR_BOLD_RED,
  "ERROR":  COLOR_RED,
  "WARN":   COLOR_YELLOW,
  "INFO":   COLOR_GREEN,
  "CONFIG": COLOR_MAGENTA,
  "DEBUG":  COLOR_CYAN,
  "TRACE":  COLOR_NORMAL,
  "ALL":    COLOR_NORMAL
};

if ("undefined" == typeof(firetray)) {
  var firetray = {};
};

// https://wiki.mozilla.org/Labs/JS_Modules#Logging
firetray.Logging = {
  initialized: false,
  LogMod: null,

  init: function() {
    if (this.initialized) return;

    ["resource://gre/modules/Log.jsm",           // FF 27+
     "resource://services-common/log4moz.js",    // FF
     "resource:///app/modules/gloda/log4moz.js", // TB
     "resource://firetray/log4moz.js"]           // default
      .forEach(function(file){
        try {Cu.import(file);} catch(x) {}
      }, this);

    if ("undefined" != typeof(Log)) {
      this.LogMod = Log;
    } else if ("undefined" != typeof(Log4Moz)) {
      this.LogMod = Log4Moz;
    } else {
      let errMsg = "Log module not found";
      dump(errMsg+"\n");
      Cu.reportError(errMsg);
    };

    this.setupLogging("firetray");

    let log = this.getLogger("firetray.Logging");
    log.debug("initialized");

    this.initialized = true;
  },

  setupLogging: function(loggerName) {

    // lifted from log4moz.js
    function SimpleFormatter() {firetray.Logging.LogMod.Formatter.call(this);}
    SimpleFormatter.prototype = Object.create(firetray.Logging.LogMod.Formatter.prototype);
    SimpleFormatter.prototype.constructor = SimpleFormatter;
    SimpleFormatter.prototype.format = function(message) {
      let date = new Date(message.time);
      let dateStr = date.getHours() + ":" + date.getMinutes() + ":" +
            date.getSeconds() + "." + date.getMilliseconds();
      let stringLog = dateStr + " " +
            message.levelDesc + " " + message.loggerName + " " +
            message.message;

      if (message.exception)
        stringLog += message.stackTrace + "\n";

      return stringLog;
    };

    function ColorTermFormatter() {SimpleFormatter.call(this);}
    ColorTermFormatter.prototype = Object.create(SimpleFormatter.prototype);
    ColorTermFormatter.prototype.constructor = ColorTermFormatter;
    ColorTermFormatter.prototype.format = function(message) {
      let color = colorTermLogColors[message.levelDesc];
      let stringLog = SimpleFormatter.prototype.format.call(this, message);
      stringLog = color + stringLog + COLOR_RESET;

      return stringLog;
    };

    // Loggers are hierarchical, affiliation is handled by a '.' in the name.
    this._logger = this.LogMod.repository.getLogger(loggerName);
    // Lowering this log level will affect all of our addon output
    this._logger.level = this.LogMod.Level[FIRETRAY_LOG_LEVEL];

    // A console appender outputs to the JS Error Console
    let simpleFormatter = new SimpleFormatter();
    let capp = new this.LogMod.ConsoleAppender(simpleFormatter);
    capp.level = this.LogMod.Level["Debug"];
    this._logger.addAppender(capp);

    // A dump appender outputs to standard out
    let dumpFormatter;
    if (Services.appinfo.OS.match(/(^Linux|^Darwin|BSD$)/)) {
      dumpFormatter = new ColorTermFormatter();
    } else {
      dumpFormatter = new SimpleFormatter();
    }
    let dapp = new this.LogMod.DumpAppender(dumpFormatter);
    dapp.level = this.LogMod.Level["Debug"];
    this._logger.addAppender(dapp);
  },

  getLogger: function(loggerName){
    return this.LogMod.repository.getLogger(loggerName);
  }

};                              // firetray.Logging

firetray.Logging.init();
