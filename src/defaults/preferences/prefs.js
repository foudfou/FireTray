// https://developer.mozilla.org/en/Localizing_extension_descriptions
pref("extensions.moztrayray@foudil.fr.description", "chrome://moztray/locale/overlay.properties");

// Extension prefs
pref("extensions.moztray.enabled", true);
pref("extensions.moztray.add_temporary_exceptions", true);
pref("extensions.moztray.notify", true);
pref("extensions.moztray.bypass_issuer_unknown", true);
pref("extensions.moztray.bypass_self_signed", true);

// Set the environment settings
pref("browser.ssl_override_behavior", 2);
pref("browser.xul.error_pages.expert_bad_cert", true);
