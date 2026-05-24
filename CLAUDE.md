# Obsidian Money — AI CLI Integration Skill

## WHAT IS THIS?
You are interacting with the Obsidian Money financial management system.
When the user pastes transaction data, you should append it to the correct monthly log file so the background AI Daemon can parse and sync it to the database.

## ARCHITECTURE
```
vault/01_Monthly_Logs/YYYY-MM.md  ← Monthly log files
  > [!todo] 📥 Unsynced Transactions  ← Insert here
agent/src/daemon.ts                ← Watches for changes, auto-parses
agent/src/index.ts                 ← AI parsing + Supabase sync
```

## HOW TO ADD A TRANSACTION

### Step 1: Determine the correct monthly log file
```bash
# Current month file path:
MONTH=$(date +%Y-%m)
FILE="vault/01_Monthly_Logs/${MONTH}.md"
```

### Step 2: Insert the line into the Unsynced section
The line MUST be inserted as a callout list item: `> - <transaction text>`
Insert AFTER the line `> [!todo] 📥 Unsynced Transactions` and its description line.

### Step 3: The background daemon will auto-sync
The daemon watches for file changes and will:
1. Parse the text using AI (model from .env)
2. Create the transaction in Supabase
3. Update account balances
4. Create debt records if a person is mentioned
5. Calculate cashback
6. Replace the unsynced line with a synced table row

## SUPPORTED INPUT FORMATS

### Natural Language (Vietnamese)
```
> - ăn trưa 55k Vpbank
> - Lâm shopee zakka 115k -8% Tpbank
> - Hương vay 300k từ Vpbank
> - nhận lương 20tr Tpbank
> - chuyển 1tr từ Tpbank sang MoMo
> - cafe 35k MoMo phí 2k
```

### Google Sheet Tab-Separated (6 or 7 columns)
```
> - Out	06-05	Điện T4	1.971.346	1,00	Power
> - Out	06-05	Điện T4	1.971.346	1,00	Power	Tpbank
> - In	15-05	Lương tháng 5	20.000.000	0,00	Tpbank
```
Format: `Type\tDate\tNotes\tAmount\t%Back\tShopSource[\tAccount]`

### Mixed (Person + Sheet format)
```
> - Lâm Tpbank Out	06-05	Điện T4	1.971.346	1,00	Power
```
The AI parser understands person names prepended before sheet data.

## AUTO-CREATE BEHAVIOR
- **New Person**: If `person_name` doesn't exist in DB, it's auto-created in `people` table
- **New Account**: If `account_name` doesn't exist, a cash-type account is auto-created
- After creating new entities, run `npm run generate-pages` to create their Obsidian pages

## EXAMPLE: Full workflow via CLI
```bash
cd /Users/rei/Library/Mobile\ Documents/com~apple~CloudDocs/github2026/biz-docs

# Method 1: Append directly
echo '> - My Tpbank Out	06-05	Điện T4	1.971.346	1,00	Power' >> vault/01_Monthly_Logs/$(date +%Y-%m).md

# Method 2: Use the CLI tool
npm run cli -- "My Tpbank mua đồ 200k -5%"

# Method 3: Interactive CLI
npm run cli
```

## IMPORTANT PATHS
- Vault: `vault/`
- Agent code: `agent/src/`
- Monthly logs: `vault/01_Monthly_Logs/`
- Account pages: `vault/02_Accounts/`
- People pages: `vault/03_People/`
- Dashboard: `vault/00_Dashboard/Dashboard.md`
- Guides: `vault/99_System/Guides/`
- Blueprint: `vault/99_System/Blueprint.md`

## AFTER ADDING TRANSACTIONS
The daemon toast notifications will appear on macOS:
1. "Đang phân tích X giao dịch..." (parsing started)
2. "Đã đồng bộ thành công X giao dịch." (done)

No manual action needed. Just paste and wait ~5 seconds.

## AUTOMATED AGENT WORKFLOW (FOR AGENTS)
When the user asks you to "add a transaction", "sync transactions", or provides transaction data:

### Flow: Parse → Preview → Approve → Submit → Sync
1. **Parse**: Extract transactions from user input following rules in `agent/skills/01_transaction_parsing.md`.
2. **Preview (MANDATORY)**: Display a summary table of ALL parsed transactions BEFORE submitting. Include: Date, Amount, Notes, % CB, Shop Source, Back Source. **Wait for user approval**.
3. **Submit to Supabase**: Insert each transaction into `transactions` table. Look up `sheet_id` from `people` table first.
4. **Trigger n8n Webhook**: POST each transaction to the n8n webhook. The webhook URL must be resolved from n8n's SQLite DB (not hardcoded):
   ```bash
   sqlite3 /Users/rei/.n8n/database.sqlite "SELECT webhookPath FROM webhook_entity;"
   ```
5. **Mark synced**: Only set `synced_at` after webhook returns 200 OK.

### Reference Implementation
See `agent/src/scripts/sync_transactions_custom.ts` for a complete working example of the parse → insert → webhook flow.

### n8n Sync Architecture (v1.6.0)
- Workflow JSON: `n8n/google_sheets_sync_workflow.json`
- Apps Script: `n8n/google_apps_script.js`
- Import script: `n8n/import_and_activate.py`
- **CRITICAL**: n8n writes to Google Sheets via raw `values:batchUpdate` API with disjoint ranges (A:C, E:H, K). It NEVER touches columns D, I, J which contain formulas. Do NOT switch back to the n8n GSheets node for writing transactions.
- Webhook `responseMode` is `lastNode` (sequential execution — prevents duplicate sheet creation).

### Google Sheets Template
Each person's spreadsheet must have a `Template` tab. When a new cycle (e.g., `2026-06`) is synced for the first time, n8n auto-clones this template.

## IMPORTANT PATHS
- Vault: `vault/`
- Agent code: `agent/src/`
- Monthly logs: `vault/01_Monthly_Logs/`
- Account pages: `vault/02_Accounts/`
- People pages: `vault/03_People/`
- Dashboard: `vault/00_Dashboard/Dashboard.md`
- Guides: `vault/99_System/Guides/`
- Blueprint: `vault/99_System/Blueprint.md`
- Skills: `agent/skills/` (READ THESE FIRST)
- n8n workflow: `n8n/google_sheets_sync_workflow.json`
- n8n Apps Script: `n8n/google_apps_script.js`
- n8n import script: `n8n/import_and_activate.py`
- n8n SQLite DB: `/Users/rei/.n8n/database.sqlite`

