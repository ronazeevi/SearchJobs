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

function buildCharts_(dash) {
  const b = START_ROW;
  // Helper table for the CV pie (D33:E36): submitted / created not submitted / no CV.
  dash.getRange(b + 12, 4, 4, 2).setFormulas([
    ['="מצב קורות חיים"', '="מספר"'],
    ['="הוגשו"', '=E' + (b + 9)],
    ['="נוצרו, טרם הוגשו"', '=MAX(E' + (b + 8) + '-E' + (b + 9) + ',0)'],
    ['="ללא קו""ח"', '=MAX(E' + (b + 7) + '-E' + (b + 8) + ',0)'],
  ]);

  dash.getCharts().forEach(c => dash.removeChart(c));
  const pie = (range, title, col) => dash.insertChart(
    dash.newChart()
      .asPieChart()
      .addRange(range)
      .setNumHeaders(1)
      .setPosition(1, col, 5, 5)
      .setOption('title', title)
      .setOption('width', 400)
      .setOption('height', 390)
      .setOption('pieSliceText', 'value')
      .build());

  pie(dash.getRange(b, 1, 30, 2), 'משרות לפי סוג תפקיד', 1);   // A:B
  pie(dash.getRange(b, 4, 6, 2), 'משרות לפי סטטוס', 5);        // D21:E26
  pie(dash.getRange(b + 12, 4, 4, 2), 'קורות חיים', 9);         // D33:E36
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
    out.push([r + 1].concat(SHOW.map(h => (idx[h] === undefined ? '' : row[idx[h]]))));
  }

  const width = SHOW.length + 1;
  const old = dash.getRange(START_ROW, FIRST_COL, dash.getMaxRows() - START_ROW + 1, width);
  old.clearContent();
  old.clearDataValidations();
  dash.getRange(START_ROW, FIRST_COL, out.length, width).setValues(out);
  dash.getRange(START_ROW, FIRST_COL, 1, width).setFontWeight('bold');
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
