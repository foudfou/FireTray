// https://developer.mozilla.org/en/Localizing_extension_descriptions
pref("extensions.skipcerterror@foudil.fr.description", "chrome://mozt/locale/overlay.properties");

// Extension prefs
pref("extensions.mozt.enabled", true);
pref("extensions.mozt.add_temporary_exceptions", true);
pref("extensions.mozt.notify", true);
pref("extensions.mozt.bypass_issuer_unknown", true);
pref("extensions.mozt.bypass_self_signed", true);

// Set the environment settings
pref("browser.ssl_override_behavior", 2);
pref("browser.xul.error_pages.expert_bad_cert", true);
