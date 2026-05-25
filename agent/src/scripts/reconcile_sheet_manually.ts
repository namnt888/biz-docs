import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

const homeDir = process.env.HOME || process.env.USERPROFILE || '';
const claspRcPath = path.join(homeDir, '.clasprc.json');

async function refreshAccessToken(creds: any): Promise<string> {
  const tokenUrl = 'https://oauth2.googleapis.com/token';
  const payload = {
    client_id: creds.tokens.default.client_id,
    client_secret: creds.tokens.default.client_secret,
    refresh_token: creds.tokens.default.refresh_token,
    grant_type: 'refresh_token'
  };

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error(`Failed to refresh token: ${res.status} ${await res.text()}`);
  }

  const data = await res.json() as any;
  const newAccessToken = data.access_token;
  if (!newAccessToken) {
    throw new Error("No access_token returned from OAuth refresh.");
  }

  creds.tokens.default.access_token = newAccessToken;
  fs.writeFileSync(claspRcPath, JSON.stringify(creds, null, 2), 'utf8');
  console.log("✅ Successfully refreshed and updated OAuth2 access token in ~/.clasprc.json");
  return newAccessToken;
}

async function main() {
  const personName = process.argv[2] || 'Ashley';
  const cycle = process.argv[3] || '2026-05';

  console.log(`Reconciling sheet for ${personName} and cycle ${cycle}...`);

  // 1. Read clasp access token
  if (!fs.existsSync(claspRcPath)) {
    console.error("❌ clasp credentials not found at:", claspRcPath);
    process.exit(1);
  }
  const creds = JSON.parse(fs.readFileSync(claspRcPath, 'utf8'));
  let accessToken = creds?.tokens?.default?.access_token;
  if (!accessToken) {
    console.error("❌ Access token not found in clasp credentials.");
    process.exit(1);
  }

  // 2. Fetch active transactions for person in cycle from Supabase
  const { data: people } = await supabase.from('people').select('id, sheet_id').eq('name', personName).limit(1);
  if (!people || people.length === 0) {
    console.error(`❌ Person ${personName} not found.`);
    process.exit(1);
  }
  const personId = people[0].id;
  const spreadsheetId = people[0].sheet_id;
  if (!spreadsheetId) {
    console.error(`❌ Person ${personName} has no sheet_id in DB.`);
    process.exit(1);
  }

  const { data: txns, error } = await supabase
    .from('transactions')
    .select('id, metadata, status')
    .eq('person_id', personId);

  if (error) {
    console.error("❌ Error fetching transactions:", error.message);
    process.exit(1);
  }

  // Exclude transactions marked as 'void' so they are not considered active rows
  const activeIds = new Set<string>();
  (txns || []).forEach(t => {
    if (t.status === 'void') return;
    const meta = t.metadata as any || {};
    const c = meta.cycle_tag || meta.debt_cycle_tag || meta.statement_cycle_tag;
    if (c === cycle) {
      activeIds.add(t.id);
    }
  });

  console.log(`Active IDs in DB for ${cycle}:`, Array.from(activeIds));

  // Helper fetch function that handles 401 by refreshing token
  const fetchWithRetry = async (url: string, options: any = {}): Promise<Response> => {
    options.headers = {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`
    };
    
    let res = await fetch(url, options);
    if (res.status === 401) {
      console.log("⚠️ Access token expired. Attempting to refresh token...");
      try {
        accessToken = await refreshAccessToken(creds);
        options.headers.Authorization = `Bearer ${accessToken}`;
        res = await fetch(url, options);
      } catch (err: any) {
        console.error("❌ Failed to refresh access token:", err.message);
      }
    }
    return res;
  };

  // 3. Read sheet tab details to get sheet ID (grid ID) for cycle '2026-05'
  console.log(`Fetching spreadsheet metadata...`);
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`;
  const metaRes = await fetchWithRetry(metaUrl);

  if (!metaRes.ok) {
    console.error(`❌ Failed to fetch spreadsheet metadata:`, metaRes.status, await metaRes.text());
    process.exit(1);
  }

  const metaData = await metaRes.json() as any;
  const targetSheet = (metaData.sheets || []).find((s: any) => s.properties.title === cycle);
  if (!targetSheet) {
    console.log(`⚠️ Sheet tab ${cycle} not found in spreadsheet.`);
    return;
  }
  const sheetId = targetSheet.properties.sheetId;
  console.log(`Found sheet tab ${cycle} with Grid ID: ${sheetId}`);

  // 4. Read Column A values
  console.log(`Fetching Column A values...`);
  const valuesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`'${cycle}'!A:A`)}`;
  const valuesRes = await fetchWithRetry(valuesUrl);

  if (!valuesRes.ok) {
    console.error(`❌ Failed to fetch values:`, valuesRes.status, await valuesRes.text());
    process.exit(1);
  }

  const valuesData = await valuesRes.json() as any;
  const rows = valuesData.values || [];
  console.log(`Read ${rows.length} rows.`);

  // 5. Determine rows to delete
  const deleteRequests: any[] = [];
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // We loop from bottom to top so that we build requests sorted descending
  for (let r = rows.length - 1; r >= 0; r--) {
    const rowVal = rows[r] && rows[r][0] ? String(rows[r][0]).trim() : '';
    if (uuidRegex.test(rowVal)) {
      if (!activeIds.has(rowVal)) {
        console.log(`Row ${r + 1} with ID "${rowVal}" is NOT in Supabase. Deleting...`);
        deleteRequests.push({
          deleteDimension: {
            range: {
              sheetId: sheetId,
              dimension: "ROWS",
              startIndex: r,
              endIndex: r + 1
            }
          }
        });
      }
    }
  }

  if (deleteRequests.length === 0) {
    console.log("✅ No extra rows found. Sheet is already in sync!");
    return;
  }

  // 6. Execute delete requests
  console.log(`Sending batchUpdate to delete ${deleteRequests.length} rows...`);
  const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  const updateRes = await fetchWithRetry(updateUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ requests: deleteRequests })
  });

  if (updateRes.ok) {
    console.log(`✅ Successfully reconciled sheet! Deleted ${deleteRequests.length} extra rows.`);
  } else {
    console.error(`❌ Failed to update sheet:`, updateRes.status, await updateRes.text());
  }
}

main().catch(console.error);
