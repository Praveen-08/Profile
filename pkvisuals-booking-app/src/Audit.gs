/**
 * Audit.gs
 * Append-only log of every important action taken in the system.
 */

function logAction_(user, action, jobId, details) {
  appendRow_(SHEETS.AUDIT_LOG, {
    Timestamp: new Date(),
    User: user || Session.getActiveUser().getEmail() || 'System',
    Action: action,
    JobID: jobId || '',
    Details: details || ''
  });
}

function getAuditLogForJob(jobId) {
  ensureDatabase_();
  return readAll_(SHEETS.AUDIT_LOG)
    .filter(function (r) { return String(r.JobID) === String(jobId); })
    .sort(function (a, b) { return new Date(b.Timestamp) - new Date(a.Timestamp); });
}

function getRecentAuditLog(limit) {
  ensureDatabase_();
  var rows = readAll_(SHEETS.AUDIT_LOG);
  rows.sort(function (a, b) { return new Date(b.Timestamp) - new Date(a.Timestamp); });
  return rows.slice(0, limit || 50);
}
