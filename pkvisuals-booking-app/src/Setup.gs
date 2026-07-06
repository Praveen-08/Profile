/**
 * Setup.gs
 * Idempotent database bootstrap. Safe to call on every request — it only
 * creates sheets/rows that are missing, never overwrites existing data.
 */

function ensureDatabase_() {
  Object.keys(HEADERS).forEach(function (sheetName) {
    getSheet_(sheetName);
  });

  ensureSettings_();
  ensurePackages_();
  ensureEmailTemplates_();
}

function ensureSettings_() {
  var sheet = getSheet_(SHEETS.SETTINGS);
  var existing = readAll_(SHEETS.SETTINGS);
  var existingNames = existing.map(function (r) { return r.SettingName; });

  DEFAULT_SETTINGS.forEach(function (pair) {
    if (existingNames.indexOf(pair[0]) === -1) {
      sheet.appendRow(pair);
    }
  });
}

function ensurePackages_() {
  var existing = readAll_(SHEETS.PACKAGES);
  if (existing.length > 0) return;

  DEFAULT_PACKAGES.forEach(function (p, i) {
    appendRow_(SHEETS.PACKAGES, {
      PackageID: 'PKG-' + pad4_(i + 1),
      PackageName: p[0],
      Description: p[1],
      DefaultPriceInclGST: p[2],
      IncludesPhotos: p[3],
      IncludesVideo: p[4],
      IncludesFloorPlan: p[5],
      IncludesDrone: p[6],
      IncludesTwilight: p[7],
      DefaultShootDurationMinutes: p[8],
      Active: p[9]
    });
  });
}

function ensureEmailTemplates_() {
  var existing = readAll_(SHEETS.EMAIL_TEMPLATES);
  var existingNames = existing.map(function (r) { return r.TemplateName; });

  DEFAULT_EMAIL_TEMPLATES.forEach(function (t) {
    if (existingNames.indexOf(t.TemplateName) === -1) {
      appendRow_(SHEETS.EMAIL_TEMPLATES, {
        TemplateName: t.TemplateName,
        Subject: t.Subject,
        BodyHTML: '',
        BodyPlainText: t.BodyPlainText
      });
    }
  });
}

/** Manual entry point — run once from the Apps Script editor if you want to force setup. */
function runSetup() {
  ensureDatabase_();
  Logger.log('PK Visuals database ready: ' + getDatabase_().getUrl());
}
