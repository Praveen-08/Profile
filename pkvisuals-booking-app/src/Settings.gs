/**
 * Settings.gs
 */

function getSettingsMap_() {
  var rows = readAll_(SHEETS.SETTINGS);
  var map = {};
  rows.forEach(function (r) { map[r.SettingName] = r.SettingValue; });
  return map;
}

function getSetting_(name, fallback) {
  var map = getSettingsMap_();
  var v = map[name];
  return (v === undefined || v === null || v === '') ? (fallback || '') : v;
}

/** Client entry point: returns all settings as a plain object. */
function getSettings() {
  ensureDatabase_();
  return getSettingsMap_();
}

/** Client entry point: saves an object of {SettingName: value} pairs. */
function saveSettings(settingsObj) {
  ensureDatabase_();
  Object.keys(settingsObj).forEach(function (name) {
    var updated = updateRow_(SHEETS.SETTINGS, 'SettingName', name, { SettingValue: settingsObj[name] });
    if (!updated) {
      appendRow_(SHEETS.SETTINGS, { SettingName: name, SettingValue: settingsObj[name] });
    }
  });
  logAction_(null, 'Settings updated', '', Object.keys(settingsObj).join(', '));
  return getSettingsMap_();
}

function getEmailTemplates() {
  ensureDatabase_();
  return readAll_(SHEETS.EMAIL_TEMPLATES);
}

function saveEmailTemplate(templateName, fields) {
  ensureDatabase_();
  var updated = updateRow_(SHEETS.EMAIL_TEMPLATES, 'TemplateName', templateName, fields);
  if (!updated) {
    appendRow_(SHEETS.EMAIL_TEMPLATES, Object.assign({ TemplateName: templateName }, fields));
  }
  logAction_(null, 'Email template updated', '', templateName);
  return getEmailTemplates();
}
