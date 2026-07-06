/**
 * Emails.gs
 * All outbound Gmail/MailApp messages, built from the EmailTemplates sheet
 * so wording can be edited from the Settings page without touching code.
 */

function formatMoney_(n) {
  return '$' + Number(n || 0).toFixed(2);
}

function formatDate_(d) {
  if (!d) return '';
  var date = (d instanceof Date) ? d : new Date(d);
  if (isNaN(date.getTime())) return String(d);
  return Utilities.formatDate(date, Session.getScriptTimeZone() || 'Pacific/Auckland', 'd MMMM yyyy');
}

function getTemplate_(templateName) {
  var rows = readAll_(SHEETS.EMAIL_TEMPLATES);
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].TemplateName === templateName) return rows[i];
  }
  var fallback = DEFAULT_EMAIL_TEMPLATES.filter(function (t) { return t.TemplateName === templateName; })[0];
  return fallback || { Subject: '', BodyPlainText: '' };
}

function renderText_(text, data) {
  return String(text || '').replace(/{{\s*(\w+)\s*}}/g, function (m, key) {
    return data.hasOwnProperty(key) ? data[key] : '';
  });
}

function textToHtml_(text) {
  return String(text || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

function buildEmailData_(job) {
  return {
    AgentName: job.AgentName,
    PropertyAddress: job.PropertyAddress,
    ShootDate: formatDate_(job.ShootDate),
    StartTime: job.StartTime,
    PackageName: job.PackageName,
    TotalInclGST: formatMoney_(job.TotalInclGST),
    InvoiceNumber: job.InvoiceNumber,
    DueDate: formatDate_(job.DueDate),
    DeliveryLink: job.__deliveryLink || '',
    DeliverySubjectVerb: job.__deliverySubjectVerb || 'Photos Delivered'
  };
}

/**
 * Renders `templateName` against `job`, previews it, or sends it.
 * Returns the rendered {subject, bodyText, bodyHtml} when preview=true.
 */
function renderJobEmail_(templateName, job) {
  var tpl = getTemplate_(templateName);
  var data = buildEmailData_(job);
  var subject = renderText_(tpl.Subject, data);
  var bodyText = renderText_(tpl.BodyPlainText, data);
  var bodyHtml = tpl.BodyHTML ? renderText_(tpl.BodyHTML, data) : textToHtml_(bodyText);
  return { subject: subject, bodyText: bodyText, bodyHtml: bodyHtml };
}

function sendEmail_(toEmail, ccEmail, subject, bodyText, bodyHtml, attachments) {
  if (!toEmail) throw new Error('No recipient email address available.');
  var options = { htmlBody: bodyHtml, name: 'PK Visuals' };
  if (ccEmail) options.cc = ccEmail;
  if (attachments && attachments.length) options.attachments = attachments;
  MailApp.sendEmail(toEmail, subject, bodyText, options);
}

function sendBookingConfirmationEmail_(job) {
  var admin = getSetting_('AdminEmail');
  var rendered = renderJobEmail_('BookingConfirmation', job);
  sendEmail_(job.AgentEmail, admin, rendered.subject, rendered.bodyText, rendered.bodyHtml);
  logAction_(null, 'Booking confirmation email sent', job.JobID, 'To: ' + job.AgentEmail);
}

function previewDeliveryEmail(jobId, deliveryLink) {
  ensureDatabase_();
  var job = getJobById(jobId);
  if (!job) throw new Error('Job not found: ' + jobId);
  job.__deliveryLink = deliveryLink;
  job.__deliverySubjectVerb = job.PackageDescription && /video/i.test(job.PackageDescription) ? 'Media Delivered' : (isVideoPackage_(job) ? 'Media Delivered' : 'Photos Delivered');
  return renderJobEmail_('DeliveryEmail', job);
}

function isVideoPackage_(job) {
  var pkg = getPackageById(job.PackageID);
  return !!(pkg && (pkg.IncludesVideo === true || pkg.IncludesVideo === 'TRUE'));
}

function sendDeliveryEmailMessage_(job, deliveryLink) {
  var admin = getSetting_('AdminEmail');
  job.__deliveryLink = deliveryLink;
  job.__deliverySubjectVerb = isVideoPackage_(job) ? 'Media Delivered' : 'Photos Delivered';
  var rendered = renderJobEmail_('DeliveryEmail', job);
  sendEmail_(job.AgentEmail, admin, rendered.subject, rendered.bodyText, rendered.bodyHtml);
  logAction_(null, 'Delivery email sent', job.JobID, 'To: ' + job.AgentEmail + ' Link: ' + deliveryLink);
}

function sendInvoiceEmailMessage_(job, pdfBlob) {
  var admin = getSetting_('AdminEmail');
  var rendered = renderJobEmail_('InvoiceEmail', job);
  var attachments = pdfBlob ? [pdfBlob] : [];
  if (!pdfBlob && job.InvoicePDFLink) {
    rendered.bodyText += '\n\nInvoice PDF:\n' + job.InvoicePDFLink;
    rendered.bodyHtml += '<br><br>Invoice PDF:<br><a href="' + job.InvoicePDFLink + '">' + job.InvoicePDFLink + '</a>';
  }
  sendEmail_(job.AgentEmail, admin, rendered.subject, rendered.bodyText, rendered.bodyHtml, attachments);
  logAction_(null, 'Invoice email sent', job.JobID, 'To: ' + job.AgentEmail + ' Invoice: ' + job.InvoiceNumber);
}

function sendPaymentReminderEmail_(job) {
  var admin = getSetting_('AdminEmail');
  var rendered = renderJobEmail_('PaymentReminder', job);
  sendEmail_(job.AgentEmail, admin, rendered.subject, rendered.bodyText, rendered.bodyHtml);
  logAction_(null, 'Payment reminder email sent', job.JobID, 'To: ' + job.AgentEmail);
}
