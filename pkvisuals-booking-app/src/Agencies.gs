/**
 * Agencies.gs
 */

function getAgencies() {
  ensureDatabase_();
  return readAll_(SHEETS.AGENCIES);
}

function getAgencyById(agencyId) {
  ensureDatabase_();
  return getById_(SHEETS.AGENCIES, 'AgencyID', agencyId);
}

/** Client entry point. Creates a new agency and returns the created record. */
function addAgency(agency) {
  ensureDatabase_();
  if (!agency.AgencyName) throw new Error('Agency name is required.');

  var rows = readAll_(SHEETS.AGENCIES);
  var agencyId = 'AGY-' + pad4_(rows.length + 1);

  var record = {
    AgencyID: agencyId,
    AgencyName: agency.AgencyName,
    OfficeEmail: agency.OfficeEmail || '',
    OfficePhone: agency.OfficePhone || '',
    OfficeAddress: agency.OfficeAddress || '',
    AccountsEmail: agency.AccountsEmail || agency.OfficeEmail || '',
    Notes: agency.Notes || '',
    Active: agency.Active === false ? false : true,
    CreatedDate: new Date(),
    TotalJobs: 0,
    TotalRevenue: 0
  };
  appendRow_(SHEETS.AGENCIES, record);
  logAction_(null, 'Agency created', '', agency.AgencyName);
  return record;
}

function updateAgency(agencyId, updates) {
  ensureDatabase_();
  var ok = updateRow_(SHEETS.AGENCIES, 'AgencyID', agencyId, updates);
  if (!ok) throw new Error('Agency not found: ' + agencyId);
  logAction_(null, 'Agency updated', '', agencyId);
  return getAgencyById(agencyId);
}

function deactivateAgency(agencyId) {
  return updateAgency(agencyId, { Active: false });
}

function getAgencyAgents(agencyId) {
  ensureDatabase_();
  return readAll_(SHEETS.AGENTS).filter(function (a) { return String(a.AgencyID) === String(agencyId); });
}

function getAgencyJobs(agencyId) {
  ensureDatabase_();
  return readAll_(SHEETS.JOBS).filter(function (j) { return String(j.AgencyID) === String(agencyId); });
}

function incrementAgencyStats_(agencyId, jobDelta, revenueDelta) {
  var agency = getAgencyById(agencyId);
  if (!agency) return;
  updateRow_(SHEETS.AGENCIES, 'AgencyID', agencyId, {
    TotalJobs: (Number(agency.TotalJobs) || 0) + (jobDelta || 0),
    TotalRevenue: round2_((Number(agency.TotalRevenue) || 0) + (revenueDelta || 0))
  });
}
