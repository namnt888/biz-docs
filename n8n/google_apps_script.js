/**
 * Google Apps Script to automatically format and sort monthly sheets.
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
  
  formatAndSortSheet(sheet);
}


function formatAndSortSheet(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 4) return; // No data rows yet (headers are on row 3)
  
  // 1. Set borders on Columns A to K for all data rows (starting from Row 4)
  const dataRange = sheet.getRange(4, 1, lastRow - 3, 11); // A4:K[lastRow]
  dataRange.setBorder(
    true, true, true, true, true, true, 
    '#cccccc', 
    SpreadsheetApp.BorderStyle.SOLID
  );
  
  // 2. Sort the entire data range by the Date column (Column C) ascending
  dataRange.sort({column: 3, ascending: true});

  // 3. Restore static headers on Row 3 (in case they were modified to formulas previously)
  const d3 = sheet.getRange("D3");
  const i3 = sheet.getRange("I3");
  const j3 = sheet.getRange("J3");
  if (d3.getFormula()) d3.setValue("Shop");
  if (i3.getFormula()) i3.setValue("Σ Back");
  if (j3.getFormula()) j3.setValue("Final Price");
  
  // 4. Clear any content/formulas in columns D, I, J (from Row 4 down) to prevent blockages
  sheet.getRange(4, 4, lastRow - 3, 1).clearContent(); // Column D
  sheet.getRange(4, 9, lastRow - 3, 1).clearContent(); // Column I
  sheet.getRange(4, 10, lastRow - 3, 1).clearContent(); // Column J

  // 5. Place the exact template formulas back into D4, I4, J4
  sheet.getRange("D4").setFormula('=ARRAYFORMULA(IF(K4:K=""; ""; LET(mappedRaw; IFERROR(VLOOKUP(TRIM(K4:K); Shop!A:B; 2; FALSE); ""); mapped; IF(mappedRaw=""; TRIM(K4:K); mappedRaw); IF(LEFT(mapped; 4)="http"; IMAGE(mapped; 1); mapped) )))');
  sheet.getRange("I4").setFormula('=ARRAYFORMULA(IF(F4:F=""; ""; (IF(ISNUMBER(F4:F); F4:F; VALUE(SUBSTITUTE(F4:F;".";""))) * IF(ISNUMBER(G4:G); G4:G; 0) / 100) + IF(ISNUMBER(H4:H); H4:H; 0)))');
  sheet.getRange("J4").setFormula('=ARRAYFORMULA(IF(F4:F=""; ""; IF(B4:B="In"; (IF(ISNUMBER(F4:F); F4:F; VALUE(SUBSTITUTE(F4:F;".";""))) * -1) + I4:I; IF(ISNUMBER(F4:F); F4:F; VALUE(SUBSTITUTE(F4:F;".";""))) - I4:I)))');
}
