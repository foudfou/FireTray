// https://developer.mozilla.org/en/Localizing_extension_descriptions
pref("extensions.{9533f794-00b4-4354-aa15-c2bbda6989f8}.description", "chrome://firetray/locale/overlay.properties");

// Global prefs
pref("browser.tabs.warnOnClose", false);

// Extension prefs

pref("extensions.firetray.hides_on_close", true);
pref("extensions.firetray.hides_on_minimize", true);
pref("extensions.firetray.hides_single_window", false);
pref("extensions.firetray.start_hidden", false);
pref("extensions.firetray.show_icon_on_hide", false);
pref("extensions.firetray.scroll_to_hide", true);
pref("extensions.firetray.scroll_mode", "down_hides");

pref("extensions.firetray.mail_notification", 1);
pref("extensions.firetray.icon_text_color", "#000000");
pref("extensions.firetray.custom_mail_icon", "");
// Ci.nsMsgFolderFlags.Archive|Drafts|Junk|Queue|SentMail|Trash
pref("extensions.firetray.excluded_folders_flags", 1077956352);
// exposed in 1 tree, hence 2 branches: serverTypes, excludedAccounts
pref("extensions.firetray.mail_accounts", '{ "serverTypes": {"pop3":{"order":1,"excluded":false}, "imap":{"order":1,"excluded":false}, "movemail":{"order":2,"excluded":true}, "none":{"order":3,"excluded":false}, "rss":{"order":4,"excluded":true}, "nntp":{"order":5,"excluded":true}}, "excludedAccounts": [] }'); // JSON
