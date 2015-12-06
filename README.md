Firetray
=======

**[THIS PROJECT IS DISCONTINUED](https://foudil.fr/blog/209/the-web-is-not-the-platform/)**

Overview
--------

Js-ctypes rewrite of the binary XPCOM version of **Firetray**.

Features
--------

* for all applications:
  * show/hide a single or all windows
  * restore windows to their previous state, position, size
  * restore each window to its original virtual desktop/workspace
  * activate restored windows
  * hide to tray on close
  * hide to tray on minimize
  * start minimized to tray
  * show icon only when hidden to tray
  * mouse scroll on tray icon shows/hides
  * GTK-themable icons
  * StatusNotifierItem support (can be disabled by `with_appindicator` hidden pref)
  * customizable tray icons
  * popup menu (show/hide individual windows, open new windows, quit)
  * command-line `-firetrayShowHide` option (useful for window manager's keyboard shortcuts)
  * command-line `-firetrayPresent` option (activates windows)
  * middle click on the tray icon activates last registered window

* for mail applications:
  * display unread message count in tray icon
  * display biff in tray icon for new messages
  * include/exclude mail accounts to/from messages count
  * include/exclude folders types to/from messages count
  * count in sub-folders recursively
  * handle [Exquilla](https://addons.mozilla.org/fr/thunderbird/addon/exquilla-exchange-web-services/) accounts
  * restrict message count to favorite folders
  * trigger external program on message count change
  * show icon only when new mail (mutually exclusive with *show icon only when hidden to tray*)

* for applications embedding chat (currently only Thunderbird)
  * display additional system tray status icon


Notes
-----

* Under Linux:
  * GTK+ 2.20+ required.
  * libappindicator3 can be used for StatusNotifierItem (KDE, Unity).
* Under Windows, few features are not yet implemented.
* Firetray temporarily unsets:
  * the `tabs.warnOnClose` built-in preference, which otherwise disrupts the handeling of the close event
  * `mail.biff.show_tray_icon` for mail applications

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
  and we can't easily disable them on a per-server basis (only globally, see
  `mail.biff.show_alert`). The proper way would probably be to disable default
  notifications globally, and handle notifications ourselves. This is out of
  the scope of this addon, but you may want to give a try to the
  [MailAlert extension](https://addons.mozilla.org/en-US/thunderbird/addon/mailbox-alert/)

* child windows (compose message, preferences, ...)  are not handled by
  Firetray. For ex., they are not hidden along with there top-level window.

* because of `getNumNewMessages()`'s
  [strange behaviour](https://bugzilla.mozilla.org/show_bug.cgi?id=727460),
  it's impossible to display an accurate count of *new messages*. The best we
  can do is display a biff icon.

* POP users should set
  [http://kb.mozillazine.org/Thunderbird_:_FAQs_:_Automatically_Download_Messages](Automatically
  download new messages) to see new message. See
  [this discussion](https://github.com/foudfou/FireTray/issues/20).

* some features [do not work well under Unity/Compiz](https://github.com/foudfou/FireTray/issues/22).

Acknowledgment
--------------

* Some code borrowed from [Mike Conley](http://mzl.la/messagingmenu "Thanks Mike").
* Some code borrowed from
  [Nils Maier](https://addons.mozilla.org/fr/firefox/addon/minimizetotray-revived/
  "MinToTrayR addon page").
* kind support from Neil Deaking, Bobby Holley
* default icons borrowed from Mozilla, Pidgin, Tango Desktop Project
