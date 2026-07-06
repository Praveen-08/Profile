/**
 * Config.gs
 * Central configuration: spreadsheet name, sheet names, column headers,
 * status enums and default seed data. Nothing here should ever be
 * hard-coded elsewhere in the project.
 */

var SPREADSHEET_NAME = 'PK Visuals Business System';

var SHEETS = {
  JOBS: 'Jobs',
  AGENTS: 'Agents',
  AGENCIES: 'Agencies',
  PACKAGES: 'Packages',
  PAYMENTS: 'Payments',
  SETTINGS: 'Settings',
  EMAIL_TEMPLATES: 'EmailTemplates',
  AUDIT_LOG: 'AuditLog'
};

var HEADERS = {
  Jobs: [
    'JobID', 'CreatedDate', 'CreatedBy', 'Status', 'PropertyAddress', 'Street', 'Suburb', 'City',
    'Postcode', 'GoogleMapsLink', 'AgentID', 'AgentName', 'AgentEmail', 'AgentPhone', 'AgencyID',
    'AgencyName', 'AgencyEmail', 'AccountsEmail', 'ShootDate', 'StartTime', 'EndTime',
    'CalendarEventID', 'CalendarEventLink', 'PackageID', 'PackageName', 'PackageDescription',
    'AddOns', 'AmountExGST', 'GST', 'TotalInclGST', 'DriveMainFolderID', 'DriveMainFolderLink',
    'PhotosFolderLink', 'VideosFolderLink', 'FinalDeliveryFolderLink', 'InvoiceFolderLink',
    'DeliveryLinkSent', 'DeliveryStatus', 'DeliverySentDate', 'DeliveryEmailSentTo',
    'InvoiceNumber', 'InvoiceDate', 'DueDate', 'InvoiceStatus', 'InvoicePDFLink', 'PaymentStatus',
    'PaymentDate', 'PaymentMethod', 'AmountPaid', 'BalanceDue', 'Notes', 'InternalNotes', 'LastUpdated'
  ],
  Agents: [
    'AgentID', 'AgentName', 'AgencyID', 'AgencyName', 'Email', 'Phone', 'Instagram',
    'DefaultPackageID', 'Notes', 'Active', 'CreatedDate', 'LastJobDate', 'TotalJobs', 'TotalRevenue'
  ],
  Agencies: [
    'AgencyID', 'AgencyName', 'OfficeEmail', 'OfficePhone', 'OfficeAddress', 'AccountsEmail',
    'Notes', 'Active', 'CreatedDate', 'TotalJobs', 'TotalRevenue'
  ],
  Packages: [
    'PackageID', 'PackageName', 'Description', 'DefaultPriceInclGST', 'IncludesPhotos',
    'IncludesVideo', 'IncludesFloorPlan', 'IncludesDrone', 'IncludesTwilight',
    'DefaultShootDurationMinutes', 'Active'
  ],
  Payments: [
    'PaymentID', 'JobID', 'InvoiceNumber', 'AgentName', 'AgencyName', 'PropertyAddress',
    'PaymentDate', 'AmountReceived', 'PaymentMethod', 'Reference', 'Notes'
  ],
  Settings: ['SettingName', 'SettingValue'],
  EmailTemplates: ['TemplateName', 'Subject', 'BodyHTML', 'BodyPlainText'],
  AuditLog: ['Timestamp', 'User', 'Action', 'JobID', 'Details']
};

var JOB_STATUS = {
  BOOKED: 'Booked',
  SHOOT_COMPLETED: 'Shoot Completed',
  EDITING: 'Editing',
  READY_TO_DELIVER: 'Ready to Deliver',
  DELIVERED: 'Delivered',
  INVOICE_SENT: 'Invoice Sent',
  PAID: 'Paid',
  CANCELLED: 'Cancelled'
};

var PAYMENT_STATUS = {
  NOT_INVOICED: 'Not Invoiced',
  INVOICE_SENT: 'Invoice Sent',
  PART_PAID: 'Part Paid',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  WRITTEN_OFF: 'Written Off'
};

var DELIVERY_STATUS = {
  NOT_READY: 'Not Ready',
  READY_TO_DELIVER: 'Ready to Deliver',
  DELIVERED: 'Delivered'
};

var DEFAULT_SETTINGS = [
  ['BusinessName', 'PK Visuals'],
  ['BusinessEmail', 'Info@pkvisuals.com'],
  ['AdminEmail', 'praveen@pkvisuals.com'],
  ['GSTNumber', ''],
  ['DriveParentFolderID', ''],
  ['CalendarID', 'primary'],
  ['InvoicePrefix', 'PKV'],
  ['JobPrefix', 'JOB'],
  ['PaymentTermsDays', '7'],
  ['BankAccountName', 'PK Visuals'],
  ['BankAccountNumber', ''],
  ['GooglePlacesApiKey', '']
];

// PackageName, Description, DefaultPriceInclGST, Photos, Video, FloorPlan, Drone, Twilight, DurationMins, Active
var DEFAULT_PACKAGES = [
  ['Photos Only', 'Professional real estate photography.', 170, true, false, false, false, false, 30, true],
  ['Floor Plan or Aerial Photos', 'Floor plan and/or aerial drone photos.', 150, false, false, true, true, false, 20, true],
  ['Standard Photo Package', 'Full photography package for listing.', 350, true, false, false, false, false, 45, true],
  ['Dusk Photo Package', 'Twilight photography package.', 500, true, false, false, false, true, 60, true],
  ['Video Only', 'Standalone property video.', 450, false, true, false, false, false, 60, true],
  ['Standard Video & Photos', 'Combined video and photography package.', 800, true, true, false, false, false, 90, true],
  ['Dusk Video & Photos', 'Combined twilight video and photography package.', 950, true, true, false, false, true, 90, true],
  ['Signature Reel', 'Cinematic agent/property reel.', 600, false, true, false, false, false, 60, true],
  ['Social Media Content Video', 'Short-form social media content video.', 350, false, true, false, false, false, 45, true]
];

var DEFAULT_EMAIL_TEMPLATES = [
  {
    TemplateName: 'BookingConfirmation',
    Subject: 'Booking Confirmed – {{PropertyAddress}}',
    BodyPlainText:
      'Hi {{AgentName}},\n\n' +
      'Thanks for booking PK Visuals.\n\n' +
      'Your shoot has been confirmed for:\n\n' +
      'Property:\n{{PropertyAddress}}\n\n' +
      'Date & Time:\n{{ShootDate}} at {{StartTime}}\n\n' +
      'Package:\n{{PackageName}}\n\n' +
      'Price:\n{{TotalInclGST}} incl GST\n\n' +
      'Delivery:\nPhotos are delivered in 24 hours.\nVideos are delivered in 48 hours.\n\n' +
      'Please make sure the property is ready before the scheduled time.\n\n' +
      'Kind regards,\nPraveen\nPK Visuals\nInfo@pkvisuals.com'
  },
  {
    TemplateName: 'DeliveryEmail',
    Subject: '{{DeliverySubjectVerb}} – {{PropertyAddress}}',
    BodyPlainText:
      'Hi {{AgentName}},\n\n' +
      'Your files for {{PropertyAddress}} are now ready.\n\n' +
      'You can download them here:\n\n{{DeliveryLink}}\n\n' +
      'Please download and save a copy to your own system.\n\n' +
      'Kind regards,\nPraveen\nPK Visuals\nInfo@pkvisuals.com'
  },
  {
    TemplateName: 'InvoiceEmail',
    Subject: 'Invoice {{InvoiceNumber}} – {{PropertyAddress}}',
    BodyPlainText:
      'Hi {{AgentName}},\n\n' +
      'Please find attached the invoice for {{PropertyAddress}}.\n\n' +
      'Invoice number:\n{{InvoiceNumber}}\n\n' +
      'Total:\n{{TotalInclGST}} incl GST\n\n' +
      'Due date:\n{{DueDate}}\n\n' +
      'Kind regards,\nPraveen\nPK Visuals\nInfo@pkvisuals.com'
  },
  {
    TemplateName: 'PaymentReminder',
    Subject: 'Payment Reminder – Invoice {{InvoiceNumber}}',
    BodyPlainText:
      'Hi {{AgentName}},\n\n' +
      'This is a friendly reminder that invoice {{InvoiceNumber}} for {{PropertyAddress}} ' +
      'totalling {{TotalInclGST}} incl GST was due on {{DueDate}} and remains unpaid.\n\n' +
      'Please arrange payment at your earliest convenience.\n\n' +
      'Kind regards,\nPraveen\nPK Visuals\nInfo@pkvisuals.com'
  }
];
