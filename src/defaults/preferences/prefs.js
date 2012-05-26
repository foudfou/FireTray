// https://developer.mozilla.org/en/Localizing_extension_descriptions
pref("extensions.{9533f794-00b4-4354-aa15-c2bbda6989f8}.description", "chrome://firetray/locale/overlay.properties");

// Extension prefs
pref("extensions.firetray.firstrun", true);

pref("extensions.firetray.hides_on_close", true);
pref("extensions.firetray.hides_on_minimize", true);
pref("extensions.firetray.hides_single_window", true);
pref("extensions.firetray.start_hidden", false);
pref("extensions.firetray.show_activates", false);
pref("extensions.firetray.remember_desktop", false);

pref("extensions.firetray.app_icon_type", 0);
pref("extensions.firetray.app_browser_icon_names", '["web-browser", "internet-web-browser"]');
pref("extensions.firetray.app_mail_icon_names", '["indicator-messages", "applications-email-panel"]');
pref("extensions.firetray.app_default_icon_names", '[]');
pref("extensions.firetray.app_icon_filename", "");
pref("extensions.firetray.new_mail_icon_names", '["indicator-messages-new", "mail-message-new"]');
pref("extensions.firetray.show_icon_on_hide", false);
pref("extensions.firetray.scroll_hides", true);
pref("extensions.firetray.scroll_mode", "down_hides");

pref("extensions.firetray.message_count_type", 0);
pref("extensions.firetray.folder_count_recursive", true);
pref("extensions.firetray.mail_notification_enabled", true);
pref("extensions.firetray.mail_notification_type", 0);
pref("extensions.firetray.icon_text_color", "#000000");
pref("extensions.firetray.custom_mail_icon", "");
pref("extensions.firetray.new_mail_script", "");
pref("extensions.firetray.no_new_mail_script", "");
// Ci.nsMsgFolderFlags.Archive|Drafts|Junk|Queue|SentMail|Trash|Virtual
pref("extensions.firetray.excluded_folders_flags", 1077956384);
// exposed in 1 tree, hence 2 branches: serverTypes, excludedAccounts
pref("extensions.firetray.mail_accounts", '{ "serverTypes": {"pop3":{"order":1,"excluded":false}, "imap":{"order":1,"excluded":false}, "movemail":{"order":2,"excluded":true}, "none":{"order":3,"excluded":false}, "rss":{"order":4,"excluded":true}, "nntp":{"order":5,"excluded":true}}, "excludedAccounts": [] }'); // JSON
