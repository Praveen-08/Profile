/**
 * Drive.gs
 * Creates the year / month / job folder hierarchy inside the configured
 * Drive parent folder and returns all the links Jobs.gs needs to save.
 */

var MONTH_NAMES_ = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function getOrCreateChildFolder_(parentFolder, name) {
  var it = parentFolder.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parentFolder.createFolder(name);
}

function getRootJobsFolder_() {
  var settings = getSettingsMap_();
  var parentId = settings.DriveParentFolderID;

  if (parentId) {
    try {
      return DriveApp.getFolderById(parentId);
    } catch (e) {
      // stored id invalid, fall through and recreate
    }
  }

  var it = DriveApp.getFoldersByName('PK Visuals Jobs');
  var folder = it.hasNext() ? it.next() : DriveApp.createFolder('PK Visuals Jobs');
  saveSettings({ DriveParentFolderID: folder.getId() });
  return folder;
}

function sanitizeFolderName_(name) {
  return String(name).replace(/[\\/:*?"<>|]/g, '-').trim();
}

/**
 * Creates: Root / Year / "MM - Month" / "Address - Agent - JobID" / {Photos, Videos, Final Delivery, Invoice, Admin}
 * Returns an object with all folder ids/links needed by the Jobs sheet.
 */
function createJobFolders_(propertyAddress, agentName, jobId, shootDate) {
  var date = shootDate ? new Date(shootDate) : new Date();
  var year = String(date.getFullYear());
  var monthLabel = ('0' + (date.getMonth() + 1)).slice(-2) + ' - ' + MONTH_NAMES_[date.getMonth()];

  var root = getRootJobsFolder_();
  var yearFolder = getOrCreateChildFolder_(root, year);
  var monthFolder = getOrCreateChildFolder_(yearFolder, monthLabel);

  var jobFolderName = sanitizeFolderName_(propertyAddress) + ' - ' + sanitizeFolderName_(agentName) + ' - ' + jobId;
  var jobFolder = getOrCreateChildFolder_(monthFolder, jobFolderName);

  var photos = getOrCreateChildFolder_(jobFolder, 'Photos');
  var videos = getOrCreateChildFolder_(jobFolder, 'Videos');
  var finalDelivery = getOrCreateChildFolder_(jobFolder, 'Final Delivery');
  var invoice = getOrCreateChildFolder_(jobFolder, 'Invoice');
  getOrCreateChildFolder_(jobFolder, 'Admin');

  return {
    DriveMainFolderID: jobFolder.getId(),
    DriveMainFolderLink: jobFolder.getUrl(),
    PhotosFolderLink: photos.getUrl(),
    VideosFolderLink: videos.getUrl(),
    FinalDeliveryFolderLink: finalDelivery.getUrl(),
    InvoiceFolderLink: invoice.getUrl()
  };
}

function getInvoiceFolder_(job) {
  if (job.DriveMainFolderID) {
    try {
      var jobFolder = DriveApp.getFolderById(job.DriveMainFolderID);
      return getOrCreateChildFolder_(jobFolder, 'Invoice');
    } catch (e) {
      // fall through
    }
  }
  return null;
}
