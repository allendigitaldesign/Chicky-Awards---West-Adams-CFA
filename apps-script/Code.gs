/*
 * Backend for the Chicky Awards ballot page. Lives inside the Google Sheet
 * (Extensions > Apps Script) next to Rules.gs, which is a copy of rules.js.
 * It can also be a standalone project at script.google.com: then set SHEET_ID
 * to the ID in the Sheet's address (docs.google.com/spreadsheets/d/<ID>/edit).
 *
 * Every ballot becomes one row on the "Ballots" tab, one column per award.
 * Each voter gets one ballot; delete their row to let them vote again.
 * The "Results" tab is rebuilt after every ballot (and from the
 * Chicky Awards > Refresh results menu after you edit or delete ballots).
 */

var SHEET_ID = '';
var BALLOTS_SHEET = 'Ballots';
var RESULTS_SHEET = 'Results';
var BASE_HEADERS = ['Submitted', 'Voter First Name', 'Voter Last Name'];

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'Your ballot could not be read. Refresh the page and try again.' });
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var result = validateBallot(body, today_());
    if (!result.ok) return json_(result);
    var ballot = result.ballot;

    var sheet = getBallotsSheet_();
    var headers = ensureHeaders_(sheet);
    var key = nameKey(ballot.first, ballot.last);
    var existing = readBallots_(sheet, headers).filter(function (b) {
      return nameKey(b.first, b.last) === key;
    })[0];
    if (existing) {
      return json_({
        ok: false,
        code: 'duplicate',
        error: 'We already have a ballot from ' + ballot.first + ' ' + ballot.last + ' (sent ' + existing.submitted +
          '). Each team member can vote once. Talk to a leader if you need to change it.'
      });
    }

    var row = headers.map(function () { return ''; });
    row[0] = new Date();
    row[1] = ballot.first;
    row[2] = ballot.last;
    ballot.picks.forEach(function (p) {
      row[headers.indexOf(p.awardName)] = p.nominee;
    });
    sheet.appendRow(row);
    refreshResults();

    return json_({ ok: true, ballot: { first: ballot.first, last: ballot.last, picks: ballot.picks } });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json_({ ok: true, service: 'chicky-awards', closed: votingClosed(today_()) });
}

// Rebuilds the Results tab from every row on the Ballots tab.
function refreshResults() {
  var ballotsSheet = getBallotsSheet_();
  var headers = ensureHeaders_(ballotsSheet);
  var ballots = readBallots_(ballotsSheet, headers);
  var tallies = tally(ballots);

  var ss = spreadsheet_();
  var sheet = ss.getSheetByName(RESULTS_SHEET) || ss.insertSheet(RESULTS_SHEET);
  sheet.clear();

  var tz = Session.getScriptTimeZone();
  var rows = [
    ['Chicky Awards results', '', '', ''],
    [ballots.length + ' ballot' + (ballots.length === 1 ? '' : 's') + ' · updated ' +
      Utilities.formatDate(new Date(), tz, 'M/d/yyyy h:mm a'), '', '', ''],
    ['', '', '', ''],
    ['Award', 'Place', 'Nominee', 'Votes']
  ];
  var winnerRows = [];
  tallies.forEach(function (t) {
    if (!t.results.length) {
      rows.push([t.awardName, '', 'No votes yet', '']);
    }
    t.results.forEach(function (r, i) {
      if (r.rank === 1) winnerRows.push(rows.length + 1);
      rows.push([i === 0 ? t.awardName : '', r.rank, r.nominee, r.votes]);
    });
    rows.push(['', '', '', '']);
  });

  sheet.getRange(1, 1, rows.length, 4).setValues(rows);
  sheet.getRange(1, 1).setFontSize(14).setFontWeight('bold');
  sheet.getRange(2, 1).setFontColor('#6d6260');
  sheet.getRange(4, 1, 1, 4).setFontWeight('bold');
  winnerRows.forEach(function (r) {
    sheet.getRange(r, 2, 1, 3).setFontWeight('bold').setBackground('#fbe7ea');
  });
  sheet.setFrozenRows(4);
  sheet.autoResizeColumns(1, 4);
}

// Adds any award that doesn't have a column yet and returns the header row.
function ensureHeaders_(sheet) {
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  var changed = false;
  BASE_HEADERS.concat(AWARDS.map(function (a) { return a.name; })).forEach(function (h) {
    if (headers.indexOf(h) === -1) {
      var blank = headers.indexOf('');
      if (blank > -1) headers[blank] = h; else headers.push(h);
      changed = true;
    }
  });
  if (changed) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.getRange(1, 2, sheet.getMaxRows(), headers.length - 1).setNumberFormat('@');
  }
  return headers;
}

function readBallots_(sheet, headers) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var tz = Session.getScriptTimeZone();
  return sheet.getRange(2, 1, lastRow - 1, headers.length).getValues()
    .filter(function (v) { return String(v[1]).trim() || String(v[2]).trim(); })
    .map(function (v) {
      var picks = {};
      AWARDS.forEach(function (a) {
        var col = headers.indexOf(a.name);
        if (col > -1 && String(v[col]).trim()) picks[a.id] = String(v[col]).trim();
      });
      return {
        submitted: v[0] instanceof Date ? Utilities.formatDate(v[0], tz, 'M/d/yyyy') : String(v[0]),
        first: String(v[1]),
        last: String(v[2]),
        picks: picks
      };
    });
}

function getBallotsSheet_() {
  var ss = spreadsheet_();
  var sheet = ss.getSheetByName(BALLOTS_SHEET);
  if (sheet) return sheet;
  sheet = ss.insertSheet(BALLOTS_SHEET, 0);
  sheet.setFrozenRows(1);
  ensureHeaders_(sheet);
  return sheet;
}

function spreadsheet_() {
  return SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

// Adds a Chicky Awards menu to the Sheet (only when the script lives inside the Sheet).
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Chicky Awards')
    .addItem('Refresh results', 'refreshResults')
    .addToUi();
}

// Run once from the Apps Script editor to create the tabs and grant permissions.
function setup() {
  getBallotsSheet_();
  refreshResults();
}

function today_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
