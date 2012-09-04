// https://developer.mozilla.org/en/Chrome/Command_Line

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://firetray/logging.jsm");
Cu.import("resource://firetray/FiretrayHandler.jsm");

let log = firetray.Logging.getLogger("firetray.clhandler");

function firetayCommandLineHandler() {}
firetayCommandLineHandler.prototype = {
  classDescription: "firetayCommandLineHandler",
  classID: Components.ID('{a9c9cc52-4d6c-45c2-a73f-0be1bd60aaa6}'),
  contractID: "@mozilla.org/commandlinehandler/general-startup;1?type=firetray",
  _xpcom_categories: [{
    category: "command-line-handler",
    entry: "m-firetray"
  }],

  QueryInterface: XPCOMUtils.generateQI([
    Ci.nsICommandLineHandler
  ]),

  /* nsICommandLineHandler */
  handle: function clh_handle(cmdLine)
  {
    if (cmdLine.handleFlag("firetray-showHide", false)) {
      log.debug("*** CmdLine call ***");
      firetray.Handler.showHideAllWindows();
      cmdLine.preventDefault = true;
    }
  },

  // NOTE: change the help info as appropriate, but follow the guidelines in
  // nsICommandLineHandler.idl specifically, flag descriptions should start at
  // character 24, and lines should be wrapped at 76 characters with embedded
  // newlines, and finally, the string should end with a newline
  helpInfo: "  -showHide            Minimize to or restore from system tray\n" // https://bugzilla.mozilla.org/show_bug.cgi?id=510882
};

var NSGetFactory = XPCOMUtils.generateNSGetFactory([firetayCommandLineHandler]);
