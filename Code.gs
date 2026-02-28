// ---------- Code.gs ----------
var SPREADSHEET_ID = '1cwUDlYcq4fIvOtmY8LP-cD2z8K52lGanvcQ1w7MjFOE';

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('TSC Label Designer')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Fetch row by code
function getByCode(code) {
  code = String(code || '').trim();
  if (!code) return { status: 'error', message: 'Empty code' };
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheets()[0]; // uses your real first sheet
  const data = sh.getDataRange().getValues();
  const headers = data.shift();
  for (let row of data) {
    if (String(row[0]).trim() === code) {
      const obj = {};
      headers.forEach((h, i) => (obj[h] = row[i]));
      return { status: 'ok', data: obj };
    }
  }
  return { status: 'notfound', message: 'Code not found' };
}

// Template CRUD
function ensureTemplatesSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName('templates');
  if (!sh) sh = ss.insertSheet('templates');
  return sh;
}

function saveTemplate(name, json) {
  const sh = ensureTemplatesSheet();
  const now = new Date();
  const data = sh.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]) === name) {
      sh.getRange(i + 1, 2).setValue(now);
      sh.getRange(i + 1, 3).setValue(JSON.stringify(json));
      return { status: 'ok', action: 'updated' };
    }
  }
  sh.appendRow([name, now, JSON.stringify(json)]);
  return { status: 'ok', action: 'created' };
}

function listTemplates() {
  const sh = ensureTemplatesSheet();
  const data = sh.getDataRange().getValues();
  return data.map(r => ({ name: r[0], created_at: r[1], json: r[2] }));
}

function loadTemplate(name) {
  const sh = ensureTemplatesSheet();
  const data = sh.getDataRange().getValues();
  for (let row of data) {
    if (String(row[0]) === name) return JSON.parse(row[2]);
  }
  return null;
}

function deleteTemplate(name) {
  const sh = ensureTemplatesSheet();
  const data = sh.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]) === name) {
      sh.deleteRow(i + 1);
      return { status: 'ok' };
    }
  }
  return { status: 'notfound' };
}

function getSpreadsheetId() {
  return SPREADSHEET_ID;
}
