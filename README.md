Moztray
=======

Overview
--------

Rewrite attempt of **Firetray** with js-ctypes, with focus on unread message count display.

Notes
-----

* Moztray unsets the `tabs.warnOnClose` built-in preference, which otherwise disrupts the handeling of the close event.
* Experimental non-customizable keyboard shortcut for hiding all windows set to: `accel-shift-w`

* if you're looking for other mozilla-desktop integration:
  * Paul Neulinger's [Gnome-shell-Thunderbird integration](https://github.com/tanwald/gnome-shell-extension-thunderbird-integration "gnome-shell-thunderbird integration")
  * Mike Conley's [Unity-Thunderbird integration](http://mozillalabs.com/messaging/messaging-menu/ "Unity-Thunderbird integration")

KNOWN BUGS
----------

* windows aren't restored with the same z-order, but there is [no means to correct that under Linux](https://bugzilla.mozilla.org/show_bug.cgi?id=156333 "GetZOrderDOMWindowEnumerator is broken on Linux")

Acknowledgment
--------------

* Some code borrowed from [Mike Conley](http://mzl.la/messagingmenu "Thanks Mike").
* kind support from Neil Deaking
