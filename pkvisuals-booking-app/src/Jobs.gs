/**
 * Jobs.gs
 * The core workflow: creating jobs fast (address + agent + package + date/time),
 * and driving a job through delivery, invoicing and payment.
 */

function generateJobId_() {
  var prefix = getSetting_('JobPrefix', 'JOB');
  var year = new Date().getFullYear();
  var seq = nextSequence_(SHEETS.JOBS, 'JobID', prefix, year);
  return prefix + '-' + year + '-' + pad4_(seq);
}

function calcGstSplit_(totalInclGST) {
  var total = Number(totalInclGST) || 0;
  return {
    TotalInclGST: round2_(total),
    GST: round2_(total * 3 / 23),
    AmountExGST: round2_(total * 20 / 23)
  };
}

function addMinutesToTime_(timeStr, minutes) {
  var parts = String(timeStr).split(':');
  var d = new Date(2000, 0, 1, Number(parts[0]) || 0, Number(parts[1]) || 0);
  d.setMinutes(d.getMinutes() + Number(minutes || 0));
  return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}

function extractDriveFileId_(url) {
  if (!url) return null;
  var m = String(url).match(/[-\w]{25,}/);
  return m ? m[0] : null;
}

/** Client entry point. Optional filters: {status, agentId, agencyId, paymentStatus, packageId, dateFrom, dateTo} */
function getJobs(filters) {
  ensureDatabase_();
  var rows = readAll_(SHEETS.JOBS);
  filters = filters || {};

  return rows.filter(function (j) {
    if (filters.status && j.Status !== filters.status) return false;
    if (filters.agentId && String(j.AgentID) !== String(filters.agentId)) return false;
    if (filters.agencyId && String(j.AgencyID) !== String(filters.agencyId)) return false;
    if (filters.paymentStatus && j.PaymentStatus !== filters.paymentStatus) return false;
    if (filters.packageId && String(j.PackageID) !== String(filters.packageId)) return false;
    if (filters.dateFrom && j.ShootDate && new Date(j.ShootDate) < new Date(filters.dateFrom)) return false;
    if (filters.dateTo && j.ShootDate && new Date(j.ShootDate) > new Date(filters.dateTo)) return false;
    if (filters.search) {
      var haystack = (j.PropertyAddress + ' ' + j.AgentName + ' ' + j.AgencyName + ' ' + j.JobID).toLowerCase();
      if (haystack.indexOf(String(filters.search).toLowerCase()) === -1) return false;
    }
    return true;
  }).sort(function (a, b) { return new Date(b.ShootDate) - new Date(a.ShootDate); });
}

function getJobById(jobId) {
  ensureDatabase_();
  return getById_(SHEETS.JOBS, 'JobID', jobId);
}

/**
 * Client entry point — the fast "new job" workflow.
 * formData: { PropertyAddress, Street, Suburb, City, Postcode, GoogleMapsLink,
 *             AgentID, PackageID, ShootDate, StartTime, EndTime, OverridePrice, Notes }
 */
function createJob(formData) {
  ensureDatabase_();
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    if (!formData.PropertyAddress) throw new Error('Property address is required.');
    if (!formData.AgentID) throw new Error('Agent is required.');
    if (!formData.PackageID) throw new Error('Package is required.');
    if (!formData.ShootDate) throw new Error('Shoot date is required.');
    if (!formData.StartTime) throw new Error('Shoot time is required.');

    var agent = getAgentById(formData.AgentID);
    if (!agent) throw new Error('Selected agent was not found.');
    var agency = getAgencyById(agent.AgencyID);
    if (!agency) throw new Error('Selected agent has no valid agency.');
    var pkg = getPackageById(formData.PackageID);
    if (!pkg) throw new Error('Selected package was not found.');

    var startTime = formData.StartTime;
    var endTime = formData.EndTime || addMinutesToTime_(startTime, pkg.DefaultShootDurationMinutes || 30);
    var totalInclGST = formData.OverridePrice ? Number(formData.OverridePrice) : Number(pkg.DefaultPriceInclGST) || 0;
    var gstSplit = calcGstSplit_(totalInclGST);
    var jobId = generateJobId_();
    var now = new Date();

    var job = {
      JobID: jobId,
      CreatedDate: now,
      CreatedBy: Session.getActiveUser().getEmail() || 'System',
      Status: JOB_STATUS.BOOKED,
      PropertyAddress: formData.PropertyAddress,
      Street: formData.Street || '',
      Suburb: formData.Suburb || '',
      City: formData.City || '',
      Postcode: formData.Postcode || '',
      GoogleMapsLink: formData.GoogleMapsLink || ('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(formData.PropertyAddress)),
      AgentID: agent.AgentID,
      AgentName: agent.AgentName,
      AgentEmail: agent.Email,
      AgentPhone: agent.Phone,
      AgencyID: agency.AgencyID,
      AgencyName: agency.AgencyName,
      AgencyEmail: agency.OfficeEmail,
      AccountsEmail: agency.AccountsEmail || agency.OfficeEmail,
      ShootDate: formData.ShootDate,
      StartTime: startTime,
      EndTime: endTime,
      CalendarEventID: '',
      CalendarEventLink: '',
      PackageID: pkg.PackageID,
      PackageName: pkg.PackageName,
      PackageDescription: pkg.Description,
      AddOns: formData.AddOns || '',
      AmountExGST: gstSplit.AmountExGST,
      GST: gstSplit.GST,
      TotalInclGST: gstSplit.TotalInclGST,
      DriveMainFolderID: '',
      DriveMainFolderLink: '',
      PhotosFolderLink: '',
      VideosFolderLink: '',
      FinalDeliveryFolderLink: '',
      InvoiceFolderLink: '',
      DeliveryLinkSent: '',
      DeliveryStatus: DELIVERY_STATUS.NOT_READY,
      DeliverySentDate: '',
      DeliveryEmailSentTo: '',
      InvoiceNumber: '',
      InvoiceDate: '',
      DueDate: '',
      InvoiceStatus: 'Not Sent',
      InvoicePDFLink: '',
      PaymentStatus: PAYMENT_STATUS.NOT_INVOICED,
      PaymentDate: '',
      PaymentMethod: '',
      AmountPaid: 0,
      BalanceDue: gstSplit.TotalInclGST,
      Notes: formData.Notes || '',
      InternalNotes: '',
      LastUpdated: now
    };

    var warnings = [];

    try {
      Object.assign(job, createJobFolders_(job.PropertyAddress, job.AgentName, job.JobID, job.ShootDate));
    } catch (e) {
      warnings.push('Drive folders could not be created: ' + e.message);
    }

    try {
      Object.assign(job, createCalendarEvent_(job));
    } catch (e) {
      warnings.push('Calendar event could not be created: ' + e.message);
    }

    if (warnings.length) job.InternalNotes = warnings.join(' | ');

    appendRow_(SHEETS.JOBS, job);

    try {
      sendBookingConfirmationEmail_(job);
    } catch (e) {
      warnings.push('Booking confirmation email failed: ' + e.message);
      updateRow_(SHEETS.JOBS, 'JobID', jobId, { InternalNotes: warnings.join(' | ') });
    }

    incrementAgentStats_(agent.AgentID, 1, 0, job.ShootDate);
    incrementAgencyStats_(agency.AgencyID, 1, 0);
    logAction_(null, 'Job created', jobId, job.PropertyAddress + ' / ' + job.AgentName);

    job.__warnings = warnings;
    return job;
  } finally {
    lock.releaseLock();
  }
}

var EDITABLE_JOB_FIELDS_ = [
  'PropertyAddress', 'Street', 'Suburb', 'City', 'Postcode', 'GoogleMapsLink',
  'AgentID', 'PackageID', 'ShootDate', 'StartTime', 'EndTime', 'AddOns',
  'TotalInclGST', 'Notes', 'InternalNotes', 'Status'
];

/** Client entry point: edits a job without breaking existing Drive/Calendar links. */
function updateJob(jobId, updates) {
  ensureDatabase_();
  var job = getJobById(jobId);
  if (!job) throw new Error('Job not found: ' + jobId);

  var patch = {};
  EDITABLE_JOB_FIELDS_.forEach(function (f) {
    if (updates.hasOwnProperty(f)) patch[f] = updates[f];
  });

  if (patch.AgentID && String(patch.AgentID) !== String(job.AgentID)) {
    var agent = getAgentById(patch.AgentID);
    if (!agent) throw new Error('Selected agent was not found.');
    var agency = getAgencyById(agent.AgencyID);
    patch.AgentName = agent.AgentName;
    patch.AgentEmail = agent.Email;
    patch.AgentPhone = agent.Phone;
    if (agency) {
      patch.AgencyID = agency.AgencyID;
      patch.AgencyName = agency.AgencyName;
      patch.AgencyEmail = agency.OfficeEmail;
      patch.AccountsEmail = agency.AccountsEmail || agency.OfficeEmail;
    }
  }

  if (patch.PackageID && String(patch.PackageID) !== String(job.PackageID)) {
    var pkg = getPackageById(patch.PackageID);
    if (!pkg) throw new Error('Selected package was not found.');
    patch.PackageName = pkg.PackageName;
    patch.PackageDescription = pkg.Description;
    if (!patch.hasOwnProperty('TotalInclGST')) patch.TotalInclGST = pkg.DefaultPriceInclGST;
  }

  if (patch.hasOwnProperty('TotalInclGST')) {
    var split = calcGstSplit_(patch.TotalInclGST);
    patch.TotalInclGST = split.TotalInclGST;
    patch.GST = split.GST;
    patch.AmountExGST = split.AmountExGST;
    patch.BalanceDue = round2_(split.TotalInclGST - (Number(job.AmountPaid) || 0));
  }

  patch.LastUpdated = new Date();
  updateRow_(SHEETS.JOBS, 'JobID', jobId, patch);

  var merged = Object.assign({}, job, patch);
  if (patch.ShootDate || patch.StartTime || patch.EndTime || patch.PropertyAddress) {
    updateCalendarEvent_(merged);
  }

  logAction_(null, 'Job edited', jobId, Object.keys(patch).join(', '));
  return getJobById(jobId);
}

/** Client entry point. */
function cancelJob(jobId, reason) {
  ensureDatabase_();
  var job = getJobById(jobId);
  if (!job) throw new Error('Job not found: ' + jobId);

  updateRow_(SHEETS.JOBS, 'JobID', jobId, {
    Status: JOB_STATUS.CANCELLED,
    InternalNotes: (job.InternalNotes ? job.InternalNotes + ' | ' : '') + 'Cancelled: ' + (reason || ''),
    LastUpdated: new Date()
  });
  logAction_(null, 'Job cancelled', jobId, reason || '');
  return getJobById(jobId);
}

function resolveDeliveryLink_(job, options) {
  if (options.folderChoice === 'main') return job.DriveMainFolderLink;
  if (options.folderChoice === 'custom') return options.customLink;
  return job.FinalDeliveryFolderLink || job.DriveMainFolderLink;
}

/** Client entry point. options: {folderChoice: 'final'|'main'|'custom', customLink} */
function sendDeliveryEmail(jobId, options) {
  ensureDatabase_();
  options = options || {};
  var job = getJobById(jobId);
  if (!job) throw new Error('Job not found: ' + jobId);

  var link = resolveDeliveryLink_(job, options);
  if (!link) throw new Error('No delivery link available. Upload files to Drive first or provide a custom link.');

  sendDeliveryEmailMessage_(job, link);

  var now = new Date();
  updateRow_(SHEETS.JOBS, 'JobID', jobId, {
    DeliveryLinkSent: link,
    DeliveryStatus: DELIVERY_STATUS.DELIVERED,
    DeliverySentDate: now,
    DeliveryEmailSentTo: job.AgentEmail,
    Status: JOB_STATUS.DELIVERED,
    LastUpdated: now
  });
  logAction_(null, 'Delivery email sent', jobId, link);
  return getJobById(jobId);
}

/** Client entry point: emails the invoice. Requires the PDF to already exist (Create Invoice first). */
function sendInvoice(jobId) {
  ensureDatabase_();
  var job = getJobById(jobId);
  if (!job) throw new Error('Job not found: ' + jobId);
  if (!job.InvoicePDFLink) throw new Error('Create the invoice PDF before sending it.');

  var fileId = extractDriveFileId_(job.InvoicePDFLink);
  var blob = null;
  try {
    if (fileId) blob = DriveApp.getFileById(fileId).getBlob();
  } catch (e) {
    blob = null;
  }

  sendInvoiceEmailMessage_(job, blob);

  var updates = {
    InvoiceStatus: 'Invoice Sent',
    PaymentStatus: PAYMENT_STATUS.INVOICE_SENT,
    Status: JOB_STATUS.INVOICE_SENT,
    LastUpdated: new Date()
  };
  if (!job.InvoiceDate) updates.InvoiceDate = new Date();
  if (!job.DueDate) {
    var terms = Number(getSetting_('PaymentTermsDays', '7')) || 7;
    var due = new Date(updates.InvoiceDate || job.InvoiceDate);
    due.setDate(due.getDate() + terms);
    updates.DueDate = due;
  }

  updateRow_(SHEETS.JOBS, 'JobID', jobId, updates);
  logAction_(null, 'Invoice sent', jobId, job.InvoiceNumber);
  return getJobById(jobId);
}

/** Client entry point. payment: {PaymentDate, AmountReceived, PaymentMethod, Reference, Notes} */
function markPaid(jobId, payment) {
  ensureDatabase_();
  var job = getJobById(jobId);
  if (!job) throw new Error('Job not found: ' + jobId);

  var amountReceived = Number(payment.AmountReceived) || 0;
  if (amountReceived <= 0) throw new Error('Amount received must be greater than zero.');

  var paymentRows = readAll_(SHEETS.PAYMENTS);
  var paymentId = 'PMT-' + pad4_(paymentRows.length + 1);

  appendRow_(SHEETS.PAYMENTS, {
    PaymentID: paymentId,
    JobID: jobId,
    InvoiceNumber: job.InvoiceNumber,
    AgentName: job.AgentName,
    AgencyName: job.AgencyName,
    PropertyAddress: job.PropertyAddress,
    PaymentDate: payment.PaymentDate || new Date(),
    AmountReceived: amountReceived,
    PaymentMethod: payment.PaymentMethod || '',
    Reference: payment.Reference || '',
    Notes: payment.Notes || ''
  });

  var newAmountPaid = round2_((Number(job.AmountPaid) || 0) + amountReceived);
  var newBalance = round2_(Number(job.TotalInclGST) - newAmountPaid);
  var fullyPaid = newBalance <= 0.01;

  var updates = {
    AmountPaid: newAmountPaid,
    BalanceDue: fullyPaid ? 0 : newBalance,
    PaymentDate: payment.PaymentDate || new Date(),
    PaymentMethod: payment.PaymentMethod || '',
    PaymentStatus: fullyPaid ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.PART_PAID,
    LastUpdated: new Date()
  };
  if (fullyPaid) updates.Status = JOB_STATUS.PAID;

  updateRow_(SHEETS.JOBS, 'JobID', jobId, updates);

  incrementAgentStats_(job.AgentID, 0, amountReceived);
  incrementAgencyStats_(job.AgencyID, 0, amountReceived);

  logAction_(null, 'Payment recorded', jobId, formatMoney_(amountReceived) + ' via ' + (payment.PaymentMethod || ''));
  return getJobById(jobId);
}
