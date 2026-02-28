// backend/Code.gs
// Google Apps Script (Apps Script) backend for TSC Label Designer
var SPREADSHEET_ID = '1cwUDlYcq4fIvOtmY8LP-cD2z8K52lGanvcQ1w7MjFOE'; // your sheet id
var TEMPLATE_SHEET_NAME = 'templates';
var DATA_SHEET_NAME = 'MRP_Data';

// Simple router for GET actions: ?action=getByCode&code=123
function doGet(e) {
  var action = (e.parameter.action || '').toString();
  switch(action) {
    case 'getByCode':
      return ContentService.createTextOutput(JSON.stringify(getByCode_(e.parameter.code))).setMimeType(ContentService.MimeType.JSON);
    case 'listTemplates':
      return ContentService.createTextOutput(JSON.stringify(listTemplates_())).setMimeType(ContentService.MimeType.JSON);
    case 'loadTemplate':
      return ContentService.createTextOutput(JSON.stringify(loadTemplate_(e.parameter.name))).setMimeType(ContentService.MimeType.JSON);
    case 'deleteTemplate':
      return ContentService.createTextOutput(JSON.stringify(deleteTemplate_(e.parameter.name))).setMimeType(ContentService.MimeType.JSON);
    case 'getSpreadsheetId':
      return ContentService.createTextOutput(JSON.stringify({sheetId: SPREADSHEET_ID})).setMimeType(ContentService.MimeType.JSON);
    default:
      return ContentService.createTextOutput(JSON.stringify({status:'error', message: 'Invalid action'})).setMimeType(ContentService.MimeType.JSON);
  }
}

// Save template via POST JSON { name: "...", payload: {...} }
function doPost(e) {
  try {
    var body = e.postData.contents;
    var obj = JSON.parse(body);
    if (obj.action === 'saveTemplate' && obj.name && obj.payload) {
      var res = saveTemplate_(obj.name, obj.payload);
      return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService.createTextOutput(JSON.stringify({status:'error', message:'Invalid POST body'})).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({status:'error', message: err.message})).setMimeType(ContentService.MimeType.JSON);
  }
}

/* ---------- Internal helper functions ---------- */

function getByCode_(code) {
  code = String(code || '').trim();
  if (!code) return { status: 'error', message: 'Empty code' };
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh = ss.getSheetByName(DATA_SHEET_NAME);
  if (!sh) return { status: 'error', message: 'Data sheet not found: ' + DATA_SHEET_NAME };
  var values = sh.getDataRange().getValues();
  var headers = values.shift().map(String);
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (String(row[0]).trim() === code) {
      var obj = {};
      for (var j = 0; j < headers.length; j++) obj[headers[j]] = row[j];
      return { status: 'ok', data: obj };
    }
  }
  return { status: 'notfound', message: 'Code not found' };
}

function ensureTemplateSheet_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh = ss.getSheetByName(TEMPLATE_SHEET_NAME);
  if (!sh) sh = ss.insertSheet(TEMPLATE_SHEET_NAME);
  return sh;
}

function saveTemplate_(name, payload) {
  var sh = ensureTemplateSheet_();
  var now = new Date();
  var data = sh.getDataRange().getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]) === name) {
      sh.getRange(i + 1, 2).setValue(now);
      sh.getRange(i + 1, 3).setValue(JSON.stringify(payload));
      return { status: 'ok', action: 'updated' };
    }
  }
  sh.appendRow([name, now, JSON.stringify(payload)]);
  return { status: 'ok', action: 'created' };
}

function listTemplates_() {
  var sh = ensureTemplateSheet_();
  var data = sh.getDataRange().getValues();
  var out = [];
  for (var i = 0; i < data.length; i++) {
    out.push({ name: String(data[i][0]), created_at: data[i][1], json: data[i][2] });
  }
  return out;
}

function loadTemplate_(name) {
  var sh = ensureTemplateSheet_();
  var data = sh.getDataRange().getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]) === name) {
      try { return JSON.parse(data[i][2]); } catch (e) { return null; }
    }
  }
  return null;
}

function deleteTemplate_(name) {
  var sh = ensureTemplateSheet_();
  var data = sh.getDataRange().getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]) === name) {
      sh.deleteRow(i + 1);
      return { status: 'ok' };
    }
  }
  return { status: 'notfound' };
}
