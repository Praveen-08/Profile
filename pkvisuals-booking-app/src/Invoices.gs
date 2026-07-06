/**
 * Invoices.gs
 * Generates a PDF invoice (via a temporary Google Doc, exported to PDF and
 * discarded) and saves it into the job's Invoice Drive folder.
 */

function generateInvoiceNumber_() {
  var prefix = getSetting_('InvoicePrefix', 'PKV');
  var year = new Date().getFullYear();
  var seq = nextSequence_(SHEETS.JOBS, 'InvoiceNumber', prefix, year);
  return prefix + '-' + year + '-' + pad4_(seq);
}

function boldTableRow_(table, rowIndex) {
  var row = table.getRow(rowIndex);
  for (var c = 0; c < row.getNumCells(); c++) {
    row.getCell(c).editAsText().setBold(true);
  }
}

function buildInvoiceDoc_(job) {
  var settings = getSettingsMap_();
  var doc = DocumentApp.create('TEMP Invoice ' + job.InvoiceNumber);
  var body = doc.getBody();
  body.clear();

  body.appendParagraph(settings.BusinessName || 'PK Visuals')
    .setHeading(DocumentApp.ParagraphHeading.TITLE);
  body.appendParagraph(settings.BusinessEmail || '');
  if (settings.GSTNumber) body.appendParagraph('GST Number: ' + settings.GSTNumber);
  body.appendParagraph('');

  body.appendParagraph('TAX INVOICE').setHeading(DocumentApp.ParagraphHeading.HEADING1);

  var infoTable = body.appendTable([
    ['Invoice Number', job.InvoiceNumber || ''],
    ['Invoice Date', formatDate_(job.InvoiceDate)],
    ['Due Date', formatDate_(job.DueDate)]
  ]);
  infoTable.setBorderWidth(0);

  body.appendParagraph('');
  body.appendParagraph('Bill To:').setHeading(DocumentApp.ParagraphHeading.HEADING3);
  body.appendParagraph(job.AgentName || '');
  body.appendParagraph(job.AgencyName || '');
  if (job.AgentEmail) body.appendParagraph(job.AgentEmail);

  body.appendParagraph('');
  body.appendParagraph('Property:').setHeading(DocumentApp.ParagraphHeading.HEADING3);
  body.appendParagraph(job.PropertyAddress || '');

  body.appendParagraph('');
  var lineTable = body.appendTable([
    ['Description', 'Amount'],
    [job.PackageName + (job.AddOns ? (' + ' + job.AddOns) : ''), formatMoney_(job.AmountExGST)],
    ['GST', formatMoney_(job.GST)],
    ['Total (incl GST)', formatMoney_(job.TotalInclGST)]
  ]);
  boldTableRow_(lineTable, 0);
  boldTableRow_(lineTable, lineTable.getNumRows() - 1);

  body.appendParagraph('');
  body.appendParagraph('Payment Details:').setHeading(DocumentApp.ParagraphHeading.HEADING3);
  body.appendParagraph('Account Name: ' + (settings.BankAccountName || ''));
  body.appendParagraph('Account Number: ' + (settings.BankAccountNumber || ''));
  body.appendParagraph('Reference: ' + (job.InvoiceNumber || job.JobID));

  body.appendParagraph('');
  body.appendParagraph('Thank you for your business.');

  doc.saveAndClose();
  return doc;
}

/** Client entry point: builds (or rebuilds) the invoice PDF for a job. */
function createInvoicePDF(jobId) {
  ensureDatabase_();
  var job = getJobById(jobId);
  if (!job) throw new Error('Job not found: ' + jobId);
  if (job.Status === JOB_STATUS.CANCELLED) throw new Error('Cannot invoice a cancelled job.');

  var updates = {};
  if (!job.InvoiceNumber) {
    updates.InvoiceNumber = generateInvoiceNumber_();
    job.InvoiceNumber = updates.InvoiceNumber;
  }
  if (!job.InvoiceDate) {
    updates.InvoiceDate = new Date();
    job.InvoiceDate = updates.InvoiceDate;
  }
  if (!job.DueDate) {
    var terms = Number(getSetting_('PaymentTermsDays', '7')) || 7;
    var due = new Date(job.InvoiceDate);
    due.setDate(due.getDate() + terms);
    updates.DueDate = due;
    job.DueDate = due;
  }

  var doc = buildInvoiceDoc_(job);
  var pdfBlob = DriveApp.getFileById(doc.getId()).getAs(MimeType.PDF)
    .setName('Invoice ' + job.InvoiceNumber + ' - ' + job.PropertyAddress + '.pdf');

  var invoiceFolder = getInvoiceFolder_(job);
  var file = invoiceFolder ? invoiceFolder.createFile(pdfBlob) : DriveApp.createFile(pdfBlob);
  DriveApp.getFileById(doc.getId()).setTrashed(true);

  updates.InvoicePDFLink = file.getUrl();
  updates.LastUpdated = new Date();
  updateRow_(SHEETS.JOBS, 'JobID', jobId, updates);

  logAction_(null, 'Invoice created', jobId, job.InvoiceNumber);
  return Object.assign({}, job, updates, { __pdfFileId: file.getId() });
}
