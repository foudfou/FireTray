Firetray
=======

Overview
--------

Js-ctypes rewrite of the binary XPCOM version of **Firetray**.

Features
--------

* for all applications:
  * show/hide a single or all windows
  * a window gets restored to its previous state, position, size, virtual desktop
  * optional hide to tray on minimize
  * optional start minimized to tray
  * optional show icon only when hidden to tray

* for mail applications:
  * display unread messages count in tray icon
  * customizable tray icon for mail biff
  * include/exclude mail accounts and folders types to/from unread messages count

Notes
-----

* Firetray unsets the `tabs.warnOnClose` built-in preference, which otherwise disrupts the handeling of the close event.
* Experimental non-customizable keyboard shortcut for hiding all windows set to: `accel-shift-w`

References
----------

* if you're looking for other mozilla-desktop integration:
  * Paul Neulinger's [Gnome-shell-Thunderbird integration](https://github.com/tanwald/gnome-shell-extension-thunderbird-integration "gnome-shell-thunderbird integration")
  * Mike Conley's
    [Unity-Thunderbird integration](http://mozillalabs.com/messaging/messaging-menu/
    "Unity-Thunderbird integration")
  * discontinued [Mozilla New Mail Icon (Biff)](https://addons.mozilla.org/fr/thunderbird/addon/new-mail-icon/)

* [Alltray](http://alltray.trausch.us/ "alltray") launches any applications
  into tray

KNOWN BUGS
----------

* windows aren't restored with the same z-order, but there is [no means to correct that under Linux](https://bugzilla.mozilla.org/show_bug.cgi?id=156333 "GetZOrderDOMWindowEnumerator is broken on Linux")

* notifications for excluded mail account servers are not
  disabled. Newmailalerts are
  [hard-coded](http://mxr.mozilla.org/comm-central/find?string=content/newmailalert)
  and we can't easily disable thme on a per-server basis (only globally, see
  `mail.biff.show_alert`). The proper way would probably be to disable default
  notifications globally, and handle notifications ourselves. This is out of
  the scope of this addon, but you may want to give a try to the
  [MailAlert extension](https://addons.mozilla.org/en-US/thunderbird/addon/mailbox-alert/)

* child windows (compose message, preferences, ...)  are not handled by
  Firetray. For ex., they are not hidden along with there top-level window.

Acknowledgment
--------------

* Some code borrowed from [Mike Conley](http://mzl.la/messagingmenu "Thanks Mike").
* Some code borrowed from
  [Nils Mayer](https://addons.mozilla.org/fr/firefox/addon/minimizetotray-revived/
  "MinToTrayR addon page").
* kind support from Neil Deaking, Bobby Holley

