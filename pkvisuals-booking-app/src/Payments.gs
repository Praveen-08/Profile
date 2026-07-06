/**
 * Payments.gs
 * Read accessors for the Payments ledger. Payments are written by
 * Jobs.gs#markPaid so the job and payment stay in sync in one place.
 */

function getPayments() {
  ensureDatabase_();
  return readAll_(SHEETS.PAYMENTS).sort(function (a, b) {
    return new Date(b.PaymentDate) - new Date(a.PaymentDate);
  });
}

function getPaymentsForJob(jobId) {
  ensureDatabase_();
  return readAll_(SHEETS.PAYMENTS).filter(function (p) { return String(p.JobID) === String(jobId); });
}
