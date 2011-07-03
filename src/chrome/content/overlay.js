/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

/*
 * GLOBAL APPROACH:
 *
 * since we can't avoid the about:certerr page (1), and can't shortcut the
 * internal request to about:certerr gracefully (2), we:
 *
 * - add the cert exception
 * - wait for the full load of the about:certerr page (that's the tricky part)
 * - load the initially requested URL
 *
 * (1) certerror is hardly avoidable since it may be displayed whenever a
 * newsocket is created, see: nsNSSIOLayer.cpp: dialogs->ShowCertError,
 * nsNSSBadCertHandler, nsSSLIOLayerNewSocket,
 * ./netwerk/base/src/nsSocketTransport2.cpp
 *
 * (2) a raw reload of the requested https page works, but is not very clean
 * since it shortcuts the internal request to about:certerr, and produces a
 * harmless *no element found* error (displayed shortly and not too noticeable
 * though)
 */

Components.utils.import("resource://sce/commons.js");

mozt.Main = {

  onLoad: function() {
    // initialization code
    this.initialized = null;
    this.strings = document.getElementById("sce-strings");
    this.overrideService = null;
    this.recentCertsService = null;
    this.notification = {};
    this.stash = {};

    try {
      // Set up preference change observer
      mozt.Utils.prefService.QueryInterface(Ci.nsIPrefBranch2);
      // must stay out of _toggle()
      mozt.Utils.prefService.addObserver("", this, false);

      // Get cert services
      this.overrideService =
        Cc["@mozilla.org/security/certoverride;1"]
        .getService(Components.interfaces.nsICertOverrideService);
      this.recentCertsService = Cc["@mozilla.org/security/recentbadcerts;1"]
        .getService(Ci.nsIRecentBadCertsService);
    }
    catch (ex) {
      Components.utils.reportError(ex);
      return false;
    }

    var enabled = mozt.Utils.prefService.getBoolPref('enabled');
    mozt.Debug.dump('enabled: '+enabled);
    if (enabled)
      this._toggle(true);

    mozt.Debug.dump('SkipCertError LOADED !');
    this.initialized = true;
    return true;
  },

  onQuit: function() {
    // Remove observer
    mozt.Utils.prefService.removeObserver("", this);

    this._toogle(false);

    mozt.Debug.dump('SkipCertError UNLOADED !');
    this.initialized = false;
  },

  // since we are using a TabsProgressListener, it seems we do not need to keep
  // track of WebProgressListeners as indicated on
  // https://developer.mozilla.org/en/XUL_School/Intercepting_Page_Loads#WebProgressListeners
  _toggle: function (enable) {
    mozt.Debug.dump('toggle: '+enable);
    try {
      if (enable) {
        gBrowser.addTabsProgressListener(this.TabsProgressListener);
      } else {
        gBrowser.removeTabsProgressListener(this.TabsProgressListener);
      }
    } catch (ex) {
      Components.utils.reportError(ex);
      return false;
    }
  },

  observe: function(subject, topic, data) {
    // Observer for pref changes
    if (topic != "nsPref:changed") return;
    mozt.Debug.dump('Pref changed: '+data);

    switch(data) {
    case 'enabled':
      var enable = mozt.Utils.prefService.getBoolPref('enabled');
      this._toggle(enable);
      break;
    }
  },

  _getCertException: function(uri, cert) {
    var outFlags = {};
    var outTempException = {};
    var knownCert = mozt.Main.overrideService.hasMatchingOverride(
      uri.asciiHost,
      uri.port,
      cert,
      outFlags,
      outTempException);
    return knownCert;
  },

  _addCertException: function(SSLStatus, uri, cert) {
    var flags = 0;
    if(SSLStatus.isUntrusted)
      flags |= mozt.Main.overrideService.ERROR_UNTRUSTED;
    if(SSLStatus.isDomainMismatch)
      flags |= mozt.Main.overrideService.ERROR_MISMATCH;
    if(SSLStatus.isNotValidAtThisTime)
      flags |= mozt.Main.overrideService.ERROR_TIME;
    mozt.Main.overrideService.rememberValidityOverride(
      uri.asciiHost, uri.port,
      cert,
      flags,
      mozt.Utils.prefService.getBoolPref('add_temporary_exceptions'));
    mozt.Debug.dump("CertEx added");
    mozt.Main.TabsProgressListener._certExceptionJustAdded = true;
    mozt.Debug.dump("certEx changed: " + mozt.Main.TabsProgressListener._certExceptionJustAdded);

    mozt.Main.TabsProgressListener._goto = uri.spec;    // never reset
  },

  _parseBadCertFlags: function(flags) {
    var tag = '';
    var ns = Ci.nsIX509Cert;

    if (flags & ns.NOT_VERIFIED_UNKNOWN)
      tag += ', ' + mozt.Main.strings.getString('NOT_VERIFIED_UNKNOWN');
    if (flags & ns.CERT_REVOKED)
      tag += ', ' + mozt.Main.strings.getString('CERT_REVOKED');
    if (flags & ns.CERT_EXPIRED)
      tag += ', ' + mozt.Main.strings.getString('CERT_EXPIRED');
    if (flags & ns.CERT_NOT_TRUSTED)
      tag += ', ' + mozt.Main.strings.getString('CERT_NOT_TRUSTED');
    if (flags & ns.ISSUER_NOT_TRUSTED)
      tag += ', ' + mozt.Main.strings.getString('ISSUER_NOT_TRUSTED');
    if (flags & ns.ISSUER_UNKNOWN)
      tag += ', ' + mozt.Main.strings.getString('ISSUER_UNKNOWN');
    if (flags & ns.INVALID_CA)
      tag += ', ' + mozt.Main.strings.getString('INVALID_CA');
    if (flags & ns.USAGE_NOT_ALLOWED)
      tag += ', ' + mozt.Main.strings.getString('USAGE_NOT_ALLOWED');
    if (flags & SCE_CERT_SELF_SIGNED)
      tag += ', ' + mozt.Main.strings.getString('CERT_SELF_SIGNED');

    if (tag != "") tag = tag.substr(2);

    return tag;
  },

  notify: function(abrowser) {

    // find the correct tab to display notification on
		var mainWindow = window
      .QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIWebNavigation)
      .QueryInterface(Ci.nsIDocShellTreeItem).rootTreeItem
      .QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);
    var notificationBox = mainWindow.gBrowser.getNotificationBox(abrowser);
    mozt.Main.stash.notificationBox = notificationBox; // stash for later use

    // check notification not already here
    var notificationValue = mozt.Main.notification.type + '_' + mozt.Main.notification.host;
    if (notificationBox.getNotificationWithValue(notificationValue)) {
      mozt.Debug.dump("notificationBox already here");
      return;
    }

    // build notification
    var temporaryException = mozt.Utils.prefService.getBoolPref('add_temporary_exceptions') ?
      mozt.Main.strings.getString('temporaryException') : mozt.Main.strings.getString('permanentException');
    var msgArgs = [];
    var priority = null;  // notificationBox.PRIORITY_INFO_LOW not working ??
    switch (mozt.Main.notification.type) {
    case 'exceptionAdded':
      msgArgs = [temporaryException, mozt.Main.notification.host];
      priority = 'PRIORITY_INFO_LOW';
      break;
    case 'exceptionNotAdded':
      msgArgs = [mozt.Main.notification.dontBypassFlags];
      priority = 'PRIORITY_WARNING_LOW';
      break;
    default:
      break;
    }
		var message = mozt.Main.strings.getFormattedString(
      mozt.Main.notification.type, msgArgs);

    // appendNotification( label , value , image , priority , buttons )
    var notification = notificationBox.appendNotification(
      message, notificationValue, null, notificationBox[priority], null);

    // close notificatioBox if needed (will close automatically if reload)
    var exceptionDialogButton = abrowser.webProgress.DOMWindow
      .document.getElementById('exceptionDialogButton');
    exceptionDialogButton.addEventListener(
      "click", mozt.Main.exceptionDialogButtonOnClick, false);

    mozt.Main.notification = {}; // reset
  },

  exceptionDialogButtonOnClick: function(event) {
    mozt.Main._closeNotificationMaybe();
    event.originalTarget.removeEventListener(
      "click", mozt.Main.exceptionDialogButtonOnClick, false);
  },

  _closeNotificationMaybe: function() {
    if (!mozt.Main.stash.notificationBox)
      return;
    mozt.Main.stash.notificationBox.currentNotification.close();
    mozt.Main.stash.notificationBox = null;
  },


  // a TabProgressListner seems more appropriate than an Observer, which only
  // gets notified for document requests (not internal requests)
  TabsProgressListener: {
    // can't see the necessity of having QueryInterface(aIID) implemented...

    _certExceptionJustAdded: null, // used for communication btw
                                   // onSecurityChange, onStateChange, ...
    _certerrorCount: 0,            // certerr seems called more than once...

    // This method will be called on security transitions (eg HTTP -> HTTPS,
    // HTTPS -> HTTP, FOO -> HTTPS) and *after document load* completion. It
    // might also be called if an error occurs during network loading.
    onSecurityChange: function (aBrowser, aWebProgress, aRequest, aState) {
      var uri = aBrowser.currentURI;
      mozt.Debug.dump("onSecurityChange: uri=" + uri.prePath);

      if (!uri.schemeIs("https")) return;

      this._certerrorCount = 0; // reset

      // retrieve bad cert from nsIRecentBadCertsService
      // NOTE: experience shows that nsIRecentBadCertsService will not provide
      // SSLStatus when cert is known or trusted. That's why we don't try to
      // get it from aRequest
      var port = uri.port;
      if (port == -1) port = 443; // thx http://gitorious.org/perspectives-notary-server/
      var hostWithPort = uri.host + ":" + port;
      mozt.Main.notification.host = uri.host;
      var SSLStatus = mozt.Main.recentCertsService.getRecentBadCert(hostWithPort);

      if (!SSLStatus) {
        mozt.Debug.dump("no SSLStatus for: " + hostWithPort);
        return;
      }

      mozt.Debug.dump("SSLStatus");
      mozt.Debug.dumpObj(SSLStatus);
      var cert = SSLStatus.serverCert;
      mozt.Debug.dump("cert");
      mozt.Debug.dumpObj(cert);

      // check if cert already known/added
      var knownCert = mozt.Main._getCertException(uri, cert);
      if (knownCert) {
        mozt.Debug.dump("known cert: " + knownCert);
        return;
      }

      // Determine cert problems
      var dontBypassFlags = 0;

      // we're only interested in certs with characteristics
      // defined in options (self-signed, issuer unknown, ...)
      cert.QueryInterface(Ci.nsIX509Cert3);
      var isSelfSigned = cert.isSelfSigned;
      mozt.Debug.dump("isSelfSigned:" + isSelfSigned);
      if (isSelfSigned
          && !mozt.Utils.prefService.getBoolPref("bypass_self_signed"))
        dontBypassFlags |= SCE_CERT_SELF_SIGNED;
      // NOTE: isSelfSigned *implies* ISSUER_UNKNOWN (should be handled
      // correctly in option dialog)

      var verificationResult = cert.verifyForUsage(Ci.nsIX509Cert.CERT_USAGE_SSLServer);
      switch (verificationResult) {
      case Ci.nsIX509Cert.ISSUER_NOT_TRUSTED: // including self-signed
        mozt.Debug.dump("issuer not trusted");
      case Ci.nsIX509Cert.ISSUER_UNKNOWN:
        mozt.Debug.dump("issuer unknown");
        mozt.Debug.dump("bypass_issuer_unknown: " + mozt.Utils.prefService.getBoolPref("bypass_issuer_unknown"));
        if (!mozt.Utils.prefService.getBoolPref("bypass_issuer_unknown"))
          dontBypassFlags |= Ci.nsIX509Cert.ISSUER_UNKNOWN;
      default:
        mozt.Debug.dump("verificationResult: " + verificationResult);
        break;
      }
      var dontBypassTag = mozt.Main._parseBadCertFlags(dontBypassFlags);
      mozt.Debug.dump("dontBypassFlags=" + dontBypassFlags + ", " + dontBypassTag);

      // trigger notification
      if (mozt.Utils.prefService.getBoolPref('notify')) {
        mozt.Main.notification.willNotify = true;
        mozt.Debug.dump("onSecurityChange: willNotify");
      }

      // Add cert exception (if bypass allowed by options)
      if (dontBypassFlags == 0) {
        mozt.Main._addCertException(SSLStatus, uri, cert);
        mozt.Main.notification.type = 'exceptionAdded';
      } else {
        mozt.Main.notification.type = 'exceptionNotAdded';
        mozt.Main.notification.dontBypassFlags = dontBypassTag;
      }

    }, // END onSecurityChange

    _getTabIndex: function(abrowser) {
      var tabbrowser = abrowser.getTabBrowser();
      var tabContainer = tabbrowser.tabs;

      var tabIndex = null;
      for (var i = 0; i < tabContainer.length; ++i) {
        if (abrowser == tabbrowser.getBrowserAtIndex(i)) {
          tabIndex = i;
          break;
        }
      }

      return tabIndex;
    },

    // "We can't look for this during onLocationChange since at that point the
    // document URI is not yet the about:-uri of the error page." (browser.js)
    // Experience shows that the order is as follows: badcert
    // (onSecurityChange) leading to about:blank, then request of
    // about:document-onload-blocker, leading to about:certerror (called at
    // least twice)
    onStateChange: function (aBrowser, aWebProgress, aRequest, aStateFlags, aStatus) {

      // aProgress.DOMWindow is the tab/window which triggered the change.
      var originDoc = aWebProgress.DOMWindow.document;
      var originURI = originDoc.documentURI;
      mozt.Debug.dump("onStateChange " + this._getTabIndex(aBrowser) + ": originURI=" + originURI);
      var safeRequestName = mozt.Utils.safeGetName(aRequest);
      mozt.Debug.dump("safeRequestName: " + safeRequestName);

      // WE JUST CAN'T CANCEL THE REQUEST FOR about:certerr |
      // about:document-onload-blocker ...SO WE WAIT FOR IT !
      if (aStateFlags & (Ci.nsIWebProgressListener.STATE_STOP
                          |Ci.nsIWebProgressListener.STATE_IS_REQUEST)) {

        if (/^about:certerr/.test(originURI)) {
          this._certerrorCount++;
          mozt.Debug.dump("certerrorCount=" + this._certerrorCount);

          if (this._certerrorCount < 2) {
            if (aStateFlags & (Ci.nsIWebProgressListener.STATE_STOP
                               |Ci.nsIWebProgressListener.STATE_RESTORING)) {
              // experienced only one certerr call during sessoin restore
              mozt.Debug.dump("restoring");
            } else {
              mozt.Debug.dump("certerrorCount not sufficient");
              return; // wait for last (?) call
            }
          }

          if (this._certExceptionJustAdded) {
            this._certExceptionJustAdded = false; // reset
            mozt.Debug.dump("certEx changed: " + this._certExceptionJustAdded);

            aRequest.cancel(Components.results.NS_BINDING_ABORTED);
            aBrowser.loadURI(this._goto, null, null);
          }

          if (mozt.Main.notification.willNotify) {
            mozt.Debug.dump("onStateChange: willNotify");
            mozt.Main.notify.willNotify = false; // reset
            mozt.Main.notify(aBrowser);
          }

        }

      }

    }, // END onStateChange

    onLocationChange: function() { },
    onProgressChange: function() { },
    onStatusChange: function() { },

  }, // END TabsProgressListener

};


// should be sufficient for a delayed Startup (no need for window.setTimeout())
// https://developer.mozilla.org/en/Extensions/Performance_best_practices_in_extensions
// https://developer.mozilla.org/en/XUL_School/JavaScript_Object_Management.html
window.addEventListener("load", function (e) { mozt.Main.onLoad(); }, false);
window.addEventListener("unload", function(e) { mozt.Main.onQuit(); }, false);
