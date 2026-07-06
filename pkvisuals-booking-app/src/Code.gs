/**
 * Code.gs
 * Web app entry point.
 */

function doGet(e) {
  ensureDatabase_();
  var template = HtmlService.createTemplateFromFile('Index');
  return template.evaluate()
    .setTitle('PK Visuals Control Panel')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .setFaviconUrl('https://www.google.com/s2/favicons?domain=pkvisuals.com');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/** Client entry point: one round trip to fetch everything the SPA needs on load. */
function getBootstrapData() {
  ensureDatabase_();
  return {
    settings: getSettingsMap_(),
    agents: readAll_(SHEETS.AGENTS),
    agencies: readAll_(SHEETS.AGENCIES),
    packages: readAll_(SHEETS.PACKAGES),
    dashboard: getDashboardData(),
    currentUser: Session.getActiveUser().getEmail()
  };
}

function getSpreadsheetUrl() {
  ensureDatabase_();
  return getDatabase_().getUrl();
}
