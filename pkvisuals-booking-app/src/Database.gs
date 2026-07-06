/**
 * Database.gs
 * Generic spreadsheet access layer. Every other file reads/writes the
 * database through these helpers so the sheet layout only has to be
 * known in one place (Config.gs).
 */

function getDatabase_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SPREADSHEET_ID');
  var ss;

  if (id) {
    try {
      ss = SpreadsheetApp.openById(id);
      return ss;
    } catch (e) {
      // stored id is stale, fall through and re-resolve
    }
  }

  var files = DriveApp.getFilesByName(SPREADSHEET_NAME);
  if (files.hasNext()) {
    ss = SpreadsheetApp.open(files.next());
  } else {
    ss = SpreadsheetApp.create(SPREADSHEET_NAME);
  }
  props.setProperty('SPREADSHEET_ID', ss.getId());
  return ss;
}

function getSheet_(sheetName) {
  var ss = getDatabase_();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    var headers = HEADERS[sheetName];
    if (headers) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

function sheetHeaders_(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0];
}

/** Reads every data row of a sheet into an array of plain objects keyed by header. */
function readAll_(sheetName) {
  var sheet = getSheet_(sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var headers = sheetHeaders_(sheet);
  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  var out = [];
  for (var r = 0; r < values.length; r++) {
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      obj[headers[c]] = values[r][c];
    }
    obj.__row = r + 2;
    out.push(obj);
  }
  return out;
}

/** Appends a plain object as a new row, mapping fields to header order. Returns the row number written. */
function appendRow_(sheetName, obj) {
  var sheet = getSheet_(sheetName);
  var headers = sheetHeaders_(sheet);
  var row = headers.map(function (h) {
    return obj.hasOwnProperty(h) ? obj[h] : '';
  });
  sheet.appendRow(row);
  return sheet.getLastRow();
}

/** Finds the row index (1-based) matching idColumn === idValue, or -1. */
function findRow_(sheetName, idColumn, idValue) {
  var sheet = getSheet_(sheetName);
  var headers = sheetHeaders_(sheet);
  var idIdx = headers.indexOf(idColumn);
  if (idIdx === -1) return -1;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var values = sheet.getRange(2, idIdx + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(idValue)) return i + 2;
  }
  return -1;
}

/** Merges `updates` into the row matching idColumn === idValue. Returns true if a row was updated. */
function updateRow_(sheetName, idColumn, idValue, updates) {
  var sheet = getSheet_(sheetName);
  var headers = sheetHeaders_(sheet);
  var rowIdx = findRow_(sheetName, idColumn, idValue);
  if (rowIdx === -1) return false;

  var current = sheet.getRange(rowIdx, 1, 1, headers.length).getValues()[0];
  for (var c = 0; c < headers.length; c++) {
    var h = headers[c];
    if (updates.hasOwnProperty(h)) {
      current[c] = updates[h];
    }
  }
  sheet.getRange(rowIdx, 1, 1, headers.length).setValues([current]);
  return true;
}

function getById_(sheetName, idColumn, idValue) {
  var rows = readAll_(sheetName);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][idColumn]) === String(idValue)) return rows[i];
  }
  return null;
}

function nextSequence_(sheetName, idColumn, prefix, year) {
  var rows = readAll_(sheetName);
  var pattern = new RegExp('^' + prefix + '-' + year + '-(\\d+)$');
  var max = 0;
  rows.forEach(function (r) {
    var m = pattern.exec(String(r[idColumn]));
    if (m) {
      var n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  });
  return max + 1;
}

function pad4_(n) {
  return ('0000' + n).slice(-4);
}

function round2_(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
