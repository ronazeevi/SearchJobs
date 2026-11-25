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
