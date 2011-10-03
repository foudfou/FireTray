// https://developer.mozilla.org/en/Localizing_extension_descriptions
pref("extensions.{9533f794-00b4-4354-aa15-c2bbda6989f8}.description", "chrome://firetray/locale/overlay.properties");

// Global prefs
pref("browser.tabs.warnOnClose", false);

// Extension prefs
pref("extensions.firetray.close_hides", true);
pref("extensions.firetray.accounts_to_exclude", "[]"); // JSON
pref("extensions.firetray.server_types", '{"pop3":{"order":1,"excluded":false}, "imap":{"order":1,"excluded":false}, "movemail":{"order":2,"excluded":true}, "none":{"order":3,"excluded":false}, "rss":{"order":4,"excluded":true}, "nntp":{"order":5,"excluded":true} }'); // JSON
