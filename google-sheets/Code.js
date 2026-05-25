/**
 * Google Apps Script to automatically format and sort monthly sheets.
 * Version: 260524 20:06
 * 
 * INSTRUCTIONS:
 * 1. Open your Google Spreadsheet.
 * 2. Go to Extensions -> Apps Script.
 * 3. Delete any default code and paste this script.
 * 4. Click Save (disk icon).
 * 5. On the left sidebar, click the Clock icon (Triggers).
 * 6. Click "+ Add Trigger" (bottom right).
 * 7. Configure:
 *    - Choose which function to run: handleSpreadsheetChange
 *    - Choose which deployment should run: Head
 *    - Select event source: From spreadsheet
 *    - Select event type: On change (this catches API insertions from n8n)
 * 8. Click Save, authorize the script if prompted.
 */

function handleSpreadsheetChange(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const sheetName = sheet.getName();

  // Only process monthly sheets matching YYYY-MM format
  if (!/^\d{4}-\d{2}$/.test(sheetName)) {
    return;
  }

  const lastRow = sheet.getLastRow();
  const changeType = e ? e.changeType : 'OTHER';

  // Prevent infinite loops on script-triggered updates (changeType === 'OTHER')
  if (changeType === 'OTHER') {
    const cache = CacheService.getScriptCache();
    const cacheKey = "formatted_" + sheetName + "_" + lastRow;
    if (cache.get(cacheKey) === "true") {
      return; // Already formatted this state, skip to prevent recursive loop
    }
    // Set cache flag before modifying sheet to block recursive onChange events
    cache.put(cacheKey, "true", 60);
  }

  // 1. Reconcile deleted transactions from Supabase database
  reconcileSheetWithSupabase(sheet, ss.getId());

  // 2. Format and sort
  formatAndSortSheet(sheet);
}


/**
 * Queries Supabase database for active transactions and deletes sheet rows
 * whose UUID is no longer in the DB.
 */
function reconcileSheetWithSupabase(sheet, spreadsheetId) {
  const sheetName = sheet.getName();
  const supabaseUrl = "https://fyrgmsfsqzofqduiidrj.supabase.co";
  const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5cmdtc2ZzcXpvZnFkdWlpZHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NTcxNDQsImV4cCI6MjA5NDUzMzE0NH0.V15TiTEf0JYYgi42enkGbTNHV0XpHPLPmw3F23G4Bwc";

  try {
    // 1. Fetch person ID from sheet_id mapping in Supabase
    const peopleUrl = supabaseUrl + "/rest/v1/people?sheet_id=eq." + spreadsheetId + "&select=id";
    const pResponse = UrlFetchApp.fetch(peopleUrl, {
      headers: {
        "apikey": supabaseKey,
        "Authorization": "Bearer " + supabaseKey
      },
      muteHttpExceptions: true
    });

    if (pResponse.getResponseCode() !== 200) {
      Logger.log("Failed to fetch person from Supabase: " + pResponse.getContentText());
      return;
    }

    const people = JSON.parse(pResponse.getContentText());
    if (people.length === 0) {
      Logger.log("No person found with sheet ID: " + spreadsheetId);
      return;
    }
    const personId = people[0].id;

    // 2. Fetch active transactions for this person from Supabase
    const txUrl = supabaseUrl + "/rest/v1/transactions?person_id=eq." + personId + "&select=id,metadata&order=occurred_at.asc";
    const tResponse = UrlFetchApp.fetch(txUrl, {
      headers: {
        "apikey": supabaseKey,
        "Authorization": "Bearer " + supabaseKey
      },
      muteHttpExceptions: true
    });

    if (tResponse.getResponseCode() !== 200) {
      Logger.log("Failed to fetch transactions: " + tResponse.getContentText());
      return;
    }

    const txns = JSON.parse(tResponse.getContentText());
    const activeIds = new Set();
    txns.forEach(t => {
      const meta = t.metadata || {};
      const cycle = meta.cycle_tag || meta.debt_cycle_tag || meta.statement_cycle_tag;
      if (cycle === sheetName) {
        activeIds.add(t.id);
      }
    });

    // 3. Read Column A in the sheet and remove rows not in DB
    const lastRow = sheet.getLastRow();
    if (lastRow < 4) return;

    const idsRange = sheet.getRange(4, 1, lastRow - 3, 1);
    const ids = idsRange.getValues();

    let deletedCount = 0;
    // Iterate backwards to avoid shifting index issues when deleting rows
    for (let r = ids.length - 1; r >= 0; r--) {
      const txnId = String(ids[r][0]).trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(txnId);
      if (isUuid && !activeIds.has(txnId)) {
        const rowNum = r + 4; // 1-based, offset by 3 header rows
        Logger.log("Deleting row " + rowNum + " with ID: " + txnId + " because it is not in Supabase.");
        sheet.deleteRow(rowNum);
        deletedCount++;
      }
    }
    
    if (deletedCount > 0) {
      Logger.log("Successfully deleted " + deletedCount + " rows.");
    }
  } catch (error) {
    Logger.log("Error in reconcileSheetWithSupabase: " + error.toString());
  }
}



function formatAndSortSheet(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 4) return; // No data rows yet (headers are on row 3)
  const sheetName = sheet.getName();
  const monthMatch = sheetName.match(/^(\d{4})-(\d{2})$/);
  const sheetYear = monthMatch ? Number(monthMatch[1]) : null;
  const sheetMonth = monthMatch ? Number(monthMatch[2]) : null;

  // 1. Ensure array formulas exist on Row 3 (Header row) to prevent sorting issues and duplicate collisions
  const d3Range = sheet.getRange("D3");
  const i3Range = sheet.getRange("I3");
  const j3Range = sheet.getRange("J3");

  if (!d3Range.getFormula()) {
    d3Range.setFormula('={"Shop"; ARRAYFORMULA(IF(K4:K=""; ""; LET(mappedRaw; IFERROR(VLOOKUP(TRIM(K4:K); Shop!A:B; 2; FALSE); ""); mapped; IF(mappedRaw=""; TRIM(K4:K); mappedRaw); IF(LEFT(mapped; 4)="http"; IMAGE(mapped; 1); mapped) )))}');
  }
  if (!i3Range.getFormula()) {
    i3Range.setFormula('={"Σ Back"; ARRAYFORMULA(IF(F4:F=""; ""; (IF(ISNUMBER(F4:F); F4:F; VALUE(SUBSTITUTE(F4:F;".";""))) * IF(ISNUMBER(G4:G); G4:G; 0) / 100) + IF(ISNUMBER(H4:H); H4:H; 0)))}');
  }
  if (!j3Range.getFormula()) {
    j3Range.setFormula('={"Final Price"; ARRAYFORMULA(IF(F4:F=""; ""; IF(B4:B="In"; (IF(ISNUMBER(F4:F); F4:F; VALUE(SUBSTITUTE(F4:F;".";""))) * -1) + I4:I; IF(ISNUMBER(F4:F); F4:F; VALUE(SUBSTITUTE(F4:F;".";""))) - I4:I)))}');
  }

  // Clear any accidental formulas in Row 4 to prevent expansion blockage (#REF!)
  const d4Range = sheet.getRange("D4");
  const i4Range = sheet.getRange("I4");
  const j4Range = sheet.getRange("J4");
  if (d4Range.getFormula()) d4Range.clearContent();

  // Remove duplicate transaction IDs by keeping the first occurrence only.
  // This helps recover from repeated restore/sync calls that reinsert the same txn.
  const idsRange = sheet.getRange(4, 1, lastRow - 3, 1);
  const ids = idsRange.getValues();
  const seenIds = new Set();
  for (let r = ids.length - 1; r >= 0; r--) {
    const txnId = String(ids[r][0]).trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(txnId);
    if (!isUuid) continue;
    if (seenIds.has(txnId)) {
      sheet.deleteRow(r + 4);
      continue;
    }
    seenIds.add(txnId);
  }
  if (i4Range.getFormula()) i4Range.clearContent();
  if (j4Range.getFormula()) j4Range.clearContent();

  // Normalize date cells so sorting follows actual calendar order.
  const dateRange = sheet.getRange(4, 3, lastRow - 3, 1);
  const dateValues = dateRange.getValues();
  let datesChanged = false;
  if (sheetYear && sheetMonth) {
    const normalizedDates = dateValues.map(([value]) => {
      if (value instanceof Date) return [value];
      const text = String(value || '').trim();
      const dayMatch = text.match(/^(\d{2})-(\d{2})(?:-(\d{4}))?$/);
      if (!dayMatch) return [value];

      const day = Number(dayMatch[1]);
      const month = Number(dayMatch[2]);
      const year = dayMatch[3] ? Number(dayMatch[3]) : sheetYear;
      if (!day || !month || !year) return [value];

      const normalized = new Date(year, month - 1, day, 12, 0, 0);
      datesChanged = true;
      return [normalized];
    });

    if (datesChanged) {
      dateRange.setValues(normalizedDates);
      dateRange.setNumberFormat('dd-MM');
    }
  }

  const newLastRow = sheet.getLastRow();
  const dataRange = sheet.getRange(4, 1, newLastRow - 3, 11); // A4:K[lastRow]
  dataRange.setBorder(
    true, true, true, true, true, true,
    '#cccccc',
    SpreadsheetApp.BorderStyle.SOLID
  );

  // 3. Sort the entire data range by the Date column (Column C) ascending
  dataRange.sort({ column: 3, ascending: true });
}

/**
 * Handle POST requests to trigger manual reconciliation on all monthly sheets.
 */
function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  const reconciled = [];
  
  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    const sheetName = sheet.getName();
    if (/^\d{4}-\d{2}$/.test(sheetName)) {
      reconcileSheetWithSupabase(sheet, ss.getId());
      formatAndSortSheet(sheet);
      reconciled.push(sheetName);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    reconciled: reconciled
  })).setMimeType(ContentService.MimeType.JSON);
}
