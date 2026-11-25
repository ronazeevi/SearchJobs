// Job search dashboard (tab "דשבורד"):
//  - 3 pie charts at the top (rows 1-20)
//  - summary tables from row 21 (formulas)
//  - a list of all jobs (columns H-M from row 21) with a status dropdown;
//    a status change there is written back to the database tab "גיליון1".
// Run setupDashboard() once from the Apps Script editor (it asks for permission).

const DATA_SHEET = 'גיליון1';
const DASH_SHEET = 'דשבורד';
const TOP = 20;                 // rows reserved for the charts
const START_ROW = TOP + 1;      // first row of the tables and the job list
const FIRST_COL = 7;            // column G (hidden: source row number)
const SHOW = ['תפקיד', 'חברה', 'סוג תפקיד', 'תאריך', 'קישור למשרה', 'סטטוס'];
const STATUSES = ['חדש', 'הוגש', 'ראיון', 'נדחה', 'הצעה'];

// One-time setup: make room for the charts, build them, fill the list, start the 5-minute refresh.
function setupDashboard() {
  const dash = SpreadsheetApp.getActive().getSheetByName(DASH_SHEET);
  if (String(dash.getRange(1, 1).getValue()).trim() === 'סוג תפקיד') {
    dash.insertRowsBefore(1, TOP); // tables move down to row 21, formulas adjust
  }
  buildCharts_(dash);
  formatDashboard_(dash);
  installTrigger_();
  refreshJobs();
}

// Adds a "דשבורד" menu when the sheet is opened. (Runs by itself; not meant to be run from the editor.)
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('דשבורד')
      .addItem('רענון רשימת המשרות', 'refreshJobs')
      .addItem('בנייה מחדש של הדשבורד', 'setupDashboard')
      .addToUi();
  } catch (err) {
    // Run from the editor there is no sheet UI; do the setup instead.
    setupDashboard();
  }
}

const COLORS = ['#4C78A8', '#F58518', '#54A24B', '#E45756', '#72B7B2', '#B279A2', '#9D755D', '#BAB0AC'];

function buildCharts_(dash) {
  const b = START_ROW;
  // Old helper location (D33:E36) is no longer used.
  if (String(dash.getRange(b + 12, 4).getValue()) === 'מצב קורות חיים') dash.getRange(b + 12, 4, 4, 2).clearContent();
  // Helper table for the CV pie, in hidden columns Y:Z.
  dash.getRange(1, 25, 4, 2).setFormulas([
    ['="מצב קורות חיים"', '="מספר"'],
    ['="הוגשו"', '=E' + (b + 9)],
    ['="נוצרו, טרם הוגשו"', '=MAX(E' + (b + 8) + '-E' + (b + 9) + ',0)'],
    ['="ללא קו""ח"', '=MAX(E' + (b + 7) + '-E' + (b + 8) + ',0)'],
  ]);
  dash.hideColumns(25, 2);

  dash.getCharts().forEach(c => dash.removeChart(c));
  const pie = (range, title, offsetX) => dash.insertChart(
    dash.newChart()
      .asPieChart()
      .addRange(range)
      .setNumHeaders(1)
      .setHiddenDimensionStrategy(Charts.ChartHiddenDimensionStrategy.SHOW_BOTH)
      .setPosition(1, 1, offsetX, 8)
      .setOption('title', title)
      .setOption('titleTextStyle', { fontSize: 15, bold: true, color: '#1F3864' })
      .setOption('width', 400)
      .setOption('height', 390)
      .setOption('pieHole', 0.45)
      .setOption('pieSliceText', 'value')
      .setOption('pieSliceTextStyle', { fontSize: 13, color: '#ffffff' })
      .setOption('legend', { position: 'bottom', textStyle: { fontSize: 12 } })
      .setOption('chartArea', { left: 10, top: 45, width: '94%', height: '70%' })
      .setOption('colors', COLORS)
      .build());

  pie(dash.getRange(b, 1, 30, 2), 'משרות לפי סוג תפקיד', 10);
  pie(dash.getRange(b, 4, 6, 2), 'משרות לפי סטטוס', 420);
  pie(dash.getRange(1, 25, 4, 2), 'קורות חיים', 830);
}

// Fonts, widths, header colors, status colors.
function formatDashboard_(dash) {
  const b = START_ROW;
  const head = (r, c, w) => dash.getRange(r, c, 1, w)
    .setBackground('#1F3864').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');

  dash.setHiddenGridlines(true);
  dash.getRange(1, 1, dash.getMaxRows(), 15).setFontFamily('Arial').setFontSize(11).setVerticalAlignment('middle');
  dash.setRowHeights(b, dash.getMaxRows() - b + 1, 26);

  // Column widths: A-B role table, D-E status + summary, H-M job list.
  [[1, 150], [2, 90], [3, 25], [4, 140], [5, 90], [6, 25],
   [8, 240], [9, 160], [10, 120], [11, 100], [12, 80], [13, 110]]
    .forEach(([c, w]) => dash.setColumnWidth(c, w));

  head(b, 1, 2);
  head(b, 4, 2);
  dash.getRange(b + 1, 1, 30, 2).setBorder(null, null, true, null, null, true, '#D9D9D9', SpreadsheetApp.BorderStyle.SOLID);
  dash.getRange(b + 1, 4, 5, 2).setBorder(null, null, true, null, null, true, '#D9D9D9', SpreadsheetApp.BorderStyle.SOLID);
  dash.getRange(b + 1, 2, 30, 1).setHorizontalAlignment('center');
  dash.getRange(b + 1, 5, 5, 1).setHorizontalAlignment('center');

  // Summary cards (D28:E30).
  dash.getRange(b + 7, 4, 3, 2).setBackground('#EEF3FB').setFontWeight('bold')
    .setBorder(true, true, true, true, true, true, '#ffffff', SpreadsheetApp.BorderStyle.SOLID_THICK);
  dash.getRange(b + 7, 5, 3, 1).setFontSize(16).setFontColor('#1F3864').setHorizontalAlignment('center');

  // Status colors in the job list.
  const statusRange = dash.getRange(b + 1, FIRST_COL + SHOW.length, 500, 1);
  const colors = { 'חדש': '#E8EAED', 'הוגש': '#D2E3FC', 'ראיון': '#FEEFC3', 'נדחה': '#FAD2CF', 'הצעה': '#CEEAD6' };
  const rules = dash.getConditionalFormatRules().filter(r =>
    !r.getRanges().some(x => x.getColumn() === statusRange.getColumn()));
  Object.keys(colors).forEach(v => rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo(v).setBackground(colors[v]).setRanges([statusRange]).build()));
  dash.setConditionalFormatRules(rules);
}

// Short date, and a "פתיחה" link instead of a long URL.
function cell_(header, v) {
  if (header === 'תאריך' && v) {
    const d = v instanceof Date ? v : new Date(v);
    return isNaN(d) ? v : Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }
  if (header === 'קישור למשרה' && /^https?:/.test(String(v))) {
    return '=HYPERLINK("' + String(v).replace(/"/g, '""') + '","פתיחה")';
  }
  return v;
}

function headerIndex_(headers) {
  const map = {};
  headers.forEach((h, i) => { map[String(h).trim()] = i; });
  return map;
}

// Copies every job from גיליון1 into the dashboard list, with a status dropdown.
function refreshJobs() {
  const ss = SpreadsheetApp.getActive();
  const data = ss.getSheetByName(DATA_SHEET);
  const dash = ss.getSheetByName(DASH_SHEET);
  const values = data.getDataRange().getValues();
  const idx = headerIndex_(values[0]);

  const out = [['שורה'].concat(SHOW)];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (!row[idx['תפקיד']]) continue;
    out.push([r + 1].concat(SHOW.map(h => cell_(h, idx[h] === undefined ? '' : row[idx[h]]))));
  }

  const width = SHOW.length + 1;
  const old = dash.getRange(START_ROW, FIRST_COL, dash.getMaxRows() - START_ROW + 1, width);
  old.clearContent();
  old.clearDataValidations();
  dash.getRange(START_ROW, FIRST_COL, out.length, width).setValues(out);
  dash.getRange(START_ROW, FIRST_COL + 1, 1, width - 1)
    .setBackground('#1F3864').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
  if (out.length > 1) {
    const body = dash.getRange(START_ROW + 1, FIRST_COL + 1, out.length - 1, width - 1);
    body.setBorder(null, null, true, null, null, true, '#D9D9D9', SpreadsheetApp.BorderStyle.SOLID)
      .setWrap(false).setFontWeight('normal').setBackground(null).setFontColor(null);
    dash.getRange(START_ROW + 1, FIRST_COL + 4, out.length - 1, 3).setHorizontalAlignment('center');
  }
  if (out.length > 1) {
    const rule = SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).build();
    dash.getRange(START_ROW + 1, FIRST_COL + width - 1, out.length - 1, 1).setDataValidation(rule);
  }
  dash.hideColumns(FIRST_COL);
}

// Status changed in the dashboard list -> write it to גיליון1.
// Anything edited in גיליון1 -> refresh the dashboard list.
function onEdit(e) {
  const sh = e.range.getSheet();
  if (sh.getName() === DATA_SHEET) { refreshJobs(); return; }
  if (sh.getName() !== DASH_SHEET) return;

  const statusCol = FIRST_COL + SHOW.length;
  if (e.range.getColumn() !== statusCol || e.range.getRow() <= START_ROW || e.range.getNumRows() > 1) return;
  const srcRow = sh.getRange(e.range.getRow(), FIRST_COL).getValue();
  if (!srcRow) return;

  const data = e.source.getSheetByName(DATA_SHEET);
  const headers = data.getRange(1, 1, 1, data.getLastColumn()).getValues()[0];
  const col = headers.findIndex(h => String(h).trim() === 'סטטוס') + 1;
  if (col < 1) return;
  data.getRange(srcRow, col).setValue(e.value === undefined ? '' : e.value);
}

// New rows from Make don't fire onEdit, so refresh on a timer too.
function installTrigger_() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'refreshJobs')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('refreshJobs').timeBased().everyMinutes(5).create();
}

// ===== Web dashboard =====
// Deploy > New deployment > Web app. The page reads the sheet live and writes status changes back.
function doGet() {
  return HtmlService.createHtmlOutput(PAGE_HTML)
    .setTitle('דשבורד חיפוש עבודה')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getJobs() {
  const values = SpreadsheetApp.getActive().getSheetByName(DATA_SHEET).getDataRange().getDisplayValues();
  const idx = headerIndex_(values[0]);
  const cvKey = Object.keys(idx).find(h => h.indexOf('קורות חיים') === 0);
  const get = (row, h) => (h !== undefined && idx[h] !== undefined ? String(row[idx[h]]).trim() : '');
  const jobs = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (!get(row, 'תפקיד')) continue;
    const raw = get(row, 'תאריך');
    const d = new Date(raw);
    jobs.push({
      row: r + 1,
      title: get(row, 'תפקיד'),
      company: get(row, 'חברה'),
      location: get(row, 'מיקום'),
      roleType: get(row, 'סוג תפקיד'),
      date: raw && !isNaN(d) ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy') : raw,
      url: get(row, 'קישור למשרה'),
      cv: get(row, cvKey),
      status: get(row, 'סטטוס') || 'חדש',
    });
  }
  return jobs.reverse(); // newest first
}

function setJobStatus(row, status) {
  if (STATUSES.indexOf(status) < 0) throw new Error('סטטוס לא חוקי');
  const data = SpreadsheetApp.getActive().getSheetByName(DATA_SHEET);
  const headers = data.getRange(1, 1, 1, data.getLastColumn()).getValues()[0];
  const col = headers.findIndex(h => String(h).trim() === 'סטטוס') + 1;
  if (col < 1 || row < 2 || row > data.getLastRow()) throw new Error('שורה לא נמצאה');
  data.getRange(row, col).setValue(status);
  refreshJobs();
  return true;
}

// ----- "Run the process" button: starts the Make scenario through the Make API -----
// One-time: Project Settings > Script properties > add MAKE_TOKEN (a Make API token with scope scenarios:run).
const MAKE_ZONE = 'eu1';
const MAKE_SCENARIO_ID = 8715228; // "Process LinkedIn Job Documents"

function runMakeScenario() {
  const token = PropertiesService.getScriptProperties().getProperty('MAKE_TOKEN');
  if (!token) throw new Error('חסר MAKE_TOKEN בהגדרות הפרויקט ב-Apps Script');
  const res = UrlFetchApp.fetch(
    'https://' + MAKE_ZONE + '.make.com/api/v2/scenarios/' + MAKE_SCENARIO_ID + '/run', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ responsive: false }),
      headers: { Authorization: 'Token ' + token },
      muteHttpExceptions: true,
    });
  const code = res.getResponseCode();
  if (code >= 300) {
    let msg = res.getContentText();
    try { const j = JSON.parse(msg); msg = j.detail || j.message || msg; } catch (e) {}
    throw new Error('Make ' + code + ': ' + msg);
  }
  return JSON.parse(res.getContentText() || '{}');
}

// Run this once from the editor after adding MAKE_TOKEN: it asks for permission and starts one run.
function testMakeConnection() {
  Logger.log(JSON.stringify(runMakeScenario()));
}

// Built from dashboard.html
const PAGE_HTML = "<!DOCTYPE html>\n<html lang=\"he\" dir=\"rtl\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>דשבורד חיפוש עבודה</title>\n<style>\n  :root {\n    --bg: #F4F6FA; --card: #FFFFFF; --ink: #1B2333; --muted: #6B7385; --line: #E4E8F0;\n    --brand: #1F3864; --c1: #4C78A8; --c2: #F58518; --c3: #54A24B; --c4: #E45756; --c5: #72B7B2; --c6: #B279A2; --c7: #9D755D;\n  }\n  * { box-sizing: border-box; }\n  body { margin: 0; background: var(--bg); color: var(--ink); font-family: \"Segoe UI\", Arial, sans-serif; }\n  header { background: var(--brand); color: #fff; padding: 22px 28px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }\n  header h1 { margin: 0; font-size: 22px; }\n  header span { opacity: .8; font-size: 13px; }\n  .hright { display: flex; align-items: center; gap: 14px; }\n  .run { background: #fff; color: var(--brand); border: 0; border-radius: 999px; padding: 9px 18px; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,.15); }\n  .run:hover { background: #E8EEF9; }\n  .run:disabled { opacity: .7; cursor: wait; }\n  main { max-width: 1200px; margin: 0 auto; padding: 22px 16px 40px; }\n  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }\n  .kpi, .card { background: var(--card); border-radius: 14px; box-shadow: 0 1px 3px rgba(20,30,60,.08); }\n  .kpi { padding: 16px 18px; }\n  .kpi .v { font-size: 30px; font-weight: 700; color: var(--brand); }\n  .kpi .l { color: var(--muted); font-size: 13px; margin-top: 2px; }\n  .charts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 14px; }\n  .card { padding: 16px 18px; }\n  .card h2 { margin: 0 0 10px; font-size: 15px; }\n  .pie { display: flex; align-items: center; gap: 16px; }\n  .pie svg { flex: none; }\n  .legend { list-style: none; margin: 0; padding: 0; font-size: 13px; flex: 1; min-width: 0; }\n  .legend li { display: flex; align-items: center; gap: 8px; padding: 3px 0; }\n  .legend i { width: 10px; height: 10px; border-radius: 3px; flex: none; }\n  .legend .n { margin-inline-start: auto; font-weight: 600; }\n  .legend .t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n  .jobs { margin-top: 14px; }\n  .bar { display: flex; gap: 10px; align-items: center; justify-content: space-between; flex-wrap: wrap; margin-bottom: 10px; }\n  .bar input, .bar select { border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; font: inherit; font-size: 14px; }\n  .bar input { width: 240px; max-width: 100%; }\n  .tablewrap { overflow-x: auto; }\n  table { width: 100%; border-collapse: collapse; font-size: 14px; }\n  th { text-align: right; color: var(--muted); font-weight: 600; font-size: 12px; padding: 8px 10px; border-bottom: 1px solid var(--line); white-space: nowrap; }\n  td { padding: 9px 10px; border-bottom: 1px solid var(--line); vertical-align: middle; }\n  tr:hover td { background: #FAFBFD; }\n  td.title { font-weight: 600; }\n  td.small { color: var(--muted); white-space: nowrap; }\n  a { color: var(--c1); text-decoration: none; }\n  select.status { border: 0; border-radius: 999px; padding: 5px 12px; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }\n  .s-חדש { background: #E8EAED; color: #3C4043; }\n  .s-הוגש { background: #D2E3FC; color: #174EA6; }\n  .s-ראיון { background: #FEEFC3; color: #7A5B00; }\n  .s-נדחה { background: #FAD2CF; color: #A50E0E; }\n  .s-הצעה { background: #CEEAD6; color: #0D652D; }\n  .toast { position: fixed; bottom: 18px; left: 50%; transform: translateX(-50%); background: var(--ink); color: #fff; padding: 9px 16px; border-radius: 8px; font-size: 13px; opacity: 0; transition: opacity .2s; }\n  .toast.on { opacity: 1; }\n  .loading { text-align: center; color: var(--muted); padding: 60px 0; }\n  @media (max-width: 900px) { .charts { grid-template-columns: 1fr; } .kpis { grid-template-columns: repeat(2, 1fr); } }\n</style>\n</head>\n<body>\n<header>\n  <h1>דשבורד חיפוש עבודה</h1>\n  <div class=\"hright\">\n    <span id=\"updated\">טוען נתונים…</span>\n    <button class=\"run\" id=\"runBtn\" onclick=\"runProcess()\">▶ הפעלת התהליך</button>\n  </div>\n</header>\n<main>\n  <div id=\"app\" class=\"loading\">טוען נתונים מהגיליון…</div>\n</main>\n<div class=\"toast\" id=\"toast\"></div>\n\n<script>\nvar STATUSES = ['חדש', 'הוגש', 'ראיון', 'נדחה', 'הצעה'];\nvar STATUS_COLORS = { 'חדש': '#9AA0A6', 'הוגש': '#4C78A8', 'ראיון': '#F2B701', 'נדחה': '#E45756', 'הצעה': '#54A24B' };\nvar PALETTE = ['#4C78A8', '#F58518', '#54A24B', '#E45756', '#72B7B2', '#B279A2', '#9D755D', '#BAB0AC'];\nvar jobs = [];\n\nfunction esc(s) { return String(s == null ? '' : s).replace(/[&<>\"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[c]; }); }\n\nfunction countBy(list, key) {\n  var m = {};\n  list.forEach(function (j) { var k = j[key] || 'לא צוין'; m[k] = (m[k] || 0) + 1; });\n  return Object.keys(m).map(function (k) { return [k, m[k]]; }).sort(function (a, b) { return b[1] - a[1]; });\n}\n\nfunction donut(pairs, colors) {\n  var total = pairs.reduce(function (s, p) { return s + p[1]; }, 0);\n  var r = 52, c = 2 * Math.PI * r, off = 0, segs = '';\n  pairs.forEach(function (p, i) {\n    if (!p[1]) return;\n    var len = c * p[1] / total;\n    segs += '<circle r=\"' + r + '\" cx=\"70\" cy=\"70\" fill=\"none\" stroke=\"' + colors(p[0], i) + '\" stroke-width=\"22\" stroke-dasharray=\"' + len + ' ' + (c - len) + '\" stroke-dashoffset=\"' + (-off) + '\"></circle>';\n    off += len;\n  });\n  if (!total) segs = '<circle r=\"' + r + '\" cx=\"70\" cy=\"70\" fill=\"none\" stroke=\"#E4E8F0\" stroke-width=\"22\"></circle>';\n  var svg = '<svg width=\"140\" height=\"140\" viewBox=\"0 0 140 140\"><g transform=\"rotate(-90 70 70)\">' + segs + '</g>' +\n    '<text x=\"70\" y=\"68\" text-anchor=\"middle\" font-size=\"24\" font-weight=\"700\" fill=\"#1F3864\">' + total + '</text>' +\n    '<text x=\"70\" y=\"88\" text-anchor=\"middle\" font-size=\"11\" fill=\"#6B7385\">סה\"כ</text></svg>';\n  var legend = '<ul class=\"legend\">' + pairs.map(function (p, i) {\n    return '<li><i style=\"background:' + colors(p[0], i) + '\"></i><span class=\"t\" title=\"' + esc(p[0]) + '\">' + esc(p[0]) + '</span><span class=\"n\">' + p[1] + '</span></li>';\n  }).join('') + '</ul>';\n  return '<div class=\"pie\">' + svg + legend + '</div>';\n}\n\nfunction render() {\n  var total = jobs.length;\n  var withCv = jobs.filter(function (j) { return j.cv; }).length;\n  var submitted = jobs.filter(function (j) { return j.status && j.status !== 'חדש'; }).length;\n  var interviews = jobs.filter(function (j) { return j.status === 'ראיון' || j.status === 'הצעה'; }).length;\n\n  var statusPairs = STATUSES.map(function (s) { return [s, jobs.filter(function (j) { return (j.status || 'חדש') === s; }).length]; });\n  var cvPairs = [['הוגשו', submitted], ['נוצרו, טרם הוגשו', Math.max(withCv - submitted, 0)], ['ללא קו\"ח', Math.max(total - withCv, 0)]];\n  var cvColors = { 'הוגשו': '#54A24B', 'נוצרו, טרם הוגשו': '#4C78A8', 'ללא קו\"ח': '#BAB0AC' };\n\n  var html =\n    '<section class=\"kpis\">' +\n      kpi(total, 'משרות שנמצאו') + kpi(withCv, 'קורות חיים שנוצרו') + kpi(submitted, 'קורות חיים שהוגשו') + kpi(interviews, 'ראיונות והצעות') +\n    '</section>' +\n    '<section class=\"charts\">' +\n      '<div class=\"card\"><h2>משרות לפי סוג תפקיד</h2>' + donut(countBy(jobs, 'roleType'), function (k, i) { return PALETTE[i % PALETTE.length]; }) + '</div>' +\n      '<div class=\"card\"><h2>משרות לפי סטטוס</h2>' + donut(statusPairs, function (k) { return STATUS_COLORS[k]; }) + '</div>' +\n      '<div class=\"card\"><h2>קורות חיים</h2>' + donut(cvPairs, function (k) { return cvColors[k]; }) + '</div>' +\n    '</section>' +\n    '<section class=\"card jobs\">' +\n      '<div class=\"bar\"><h2 style=\"margin:0\">כל המשרות</h2>' +\n        '<div><input id=\"q\" placeholder=\"חיפוש תפקיד או חברה\" oninput=\"drawRows()\"> ' +\n        '<select id=\"f\" onchange=\"drawRows()\"><option value=\"\">כל הסטטוסים</option>' + STATUSES.map(function (s) { return '<option>' + s + '</option>'; }).join('') + '</select></div>' +\n      '</div>' +\n      '<div class=\"tablewrap\"><table><thead><tr><th>תפקיד</th><th>חברה</th><th>סוג תפקיד</th><th>מיקום</th><th>תאריך</th><th>משרה</th><th>קו\"ח</th><th>סטטוס</th></tr></thead>' +\n      '<tbody id=\"rows\"></tbody></table></div>' +\n    '</section>';\n\n  var q = document.getElementById('q'), f = document.getElementById('f');\n  var keep = { q: q ? q.value : '', f: f ? f.value : '' };\n  var app = document.getElementById('app');\n  app.className = '';\n  app.innerHTML = html;\n  document.getElementById('q').value = keep.q;\n  document.getElementById('f').value = keep.f;\n  drawRows();\n}\n\nfunction kpi(v, l) { return '<div class=\"kpi\"><div class=\"v\">' + v + '</div><div class=\"l\">' + l + '</div></div>'; }\n\nfunction drawRows() {\n  var q = document.getElementById('q').value.trim().toLowerCase();\n  var f = document.getElementById('f').value;\n  var list = jobs.filter(function (j) {\n    return (!f || (j.status || 'חדש') === f) &&\n      (!q || (j.title + ' ' + j.company).toLowerCase().indexOf(q) >= 0);\n  });\n  document.getElementById('rows').innerHTML = list.map(function (j) {\n    var st = j.status || 'חדש';\n    return '<tr>' +\n      '<td class=\"title\">' + esc(j.title) + '</td>' +\n      '<td>' + esc(j.company) + '</td>' +\n      '<td class=\"small\">' + esc(j.roleType) + '</td>' +\n      '<td class=\"small\">' + esc(j.location) + '</td>' +\n      '<td class=\"small\">' + esc(j.date) + '</td>' +\n      '<td>' + (j.url ? '<a href=\"' + esc(j.url) + '\" target=\"_blank\" rel=\"noopener\">פתיחה ↗</a>' : '') + '</td>' +\n      '<td class=\"small\">' + (j.cv ? '✓' : '') + '</td>' +\n      '<td><select class=\"status s-' + st + '\" onchange=\"changeStatus(' + j.row + ', this)\">' +\n        STATUSES.map(function (s) { return '<option' + (s === st ? ' selected' : '') + '>' + s + '</option>'; }).join('') +\n      '</select></td>' +\n    '</tr>';\n  }).join('') || '<tr><td colspan=\"8\" class=\"small\" style=\"text-align:center;padding:24px\">אין משרות להצגה</td></tr>';\n}\n\nfunction changeStatus(row, el) {\n  var value = el.value;\n  el.className = 'status s-' + value;\n  el.disabled = true;\n  google.script.run\n    .withSuccessHandler(function () {\n      jobs.forEach(function (j) { if (j.row === row) j.status = value; });\n      toast('הסטטוס עודכן בגיליון');\n      render();\n    })\n    .withFailureHandler(function (e) { el.disabled = false; toast('שגיאה בעדכון: ' + e.message); })\n    .setJobStatus(row, value);\n}\n\nfunction runProcess() {\n  var b = document.getElementById('runBtn');\n  b.disabled = true; b.textContent = '⏳ מפעיל…';\n  google.script.run\n    .withSuccessHandler(function () {\n      toast('התהליך הופעל ב-Make. משרות חדשות יופיעו כאן תוך דקה-שתיים');\n      b.textContent = '⏳ התהליך רץ…';\n      [30000, 60000, 120000].forEach(function (ms) { setTimeout(load, ms); });\n      setTimeout(function () { b.disabled = false; b.textContent = '▶ הפעלת התהליך'; }, 120000);\n    })\n    .withFailureHandler(function (e) {\n      b.disabled = false; b.textContent = '▶ הפעלת התהליך';\n      toast('לא הצלחתי להפעיל: ' + e.message, 6000);\n    })\n    .runMakeScenario();\n}\n\nfunction toast(msg, ms) {\n  var t = document.getElementById('toast');\n  t.textContent = msg; t.className = 'toast on';\n  setTimeout(function () { t.className = 'toast'; }, ms || 2200);\n}\n\nfunction load() {\n  google.script.run\n    .withSuccessHandler(function (data) {\n      jobs = data;\n      document.getElementById('updated').textContent = 'עודכן: ' + new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });\n      render();\n    })\n    .withFailureHandler(function (e) { document.getElementById('app').textContent = 'שגיאה בטעינה: ' + e.message; })\n    .getJobs();\n}\n\nload();\nsetInterval(load, 60000);\n</script>\n</body>\n</html>\n";
