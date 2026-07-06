/**
 * Packages.gs
 */

function getPackages() {
  ensureDatabase_();
  return readAll_(SHEETS.PACKAGES);
}

function getPackageById(packageId) {
  ensureDatabase_();
  return getById_(SHEETS.PACKAGES, 'PackageID', packageId);
}

function addPackage(pkg) {
  ensureDatabase_();
  if (!pkg.PackageName) throw new Error('Package name is required.');

  var rows = readAll_(SHEETS.PACKAGES);
  var packageId = 'PKG-' + pad4_(rows.length + 1);

  var record = {
    PackageID: packageId,
    PackageName: pkg.PackageName,
    Description: pkg.Description || '',
    DefaultPriceInclGST: Number(pkg.DefaultPriceInclGST) || 0,
    IncludesPhotos: !!pkg.IncludesPhotos,
    IncludesVideo: !!pkg.IncludesVideo,
    IncludesFloorPlan: !!pkg.IncludesFloorPlan,
    IncludesDrone: !!pkg.IncludesDrone,
    IncludesTwilight: !!pkg.IncludesTwilight,
    DefaultShootDurationMinutes: Number(pkg.DefaultShootDurationMinutes) || 30,
    Active: pkg.Active === false ? false : true
  };
  appendRow_(SHEETS.PACKAGES, record);
  logAction_(null, 'Package created', '', pkg.PackageName);
  return record;
}

function updatePackage(packageId, updates) {
  ensureDatabase_();
  var ok = updateRow_(SHEETS.PACKAGES, 'PackageID', packageId, updates);
  if (!ok) throw new Error('Package not found: ' + packageId);
  logAction_(null, 'Package updated', '', packageId);
  return getPackageById(packageId);
}

function deactivatePackage(packageId) {
  return updatePackage(packageId, { Active: false });
}
