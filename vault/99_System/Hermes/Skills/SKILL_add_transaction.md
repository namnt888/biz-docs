# SKILL: Add Transaction to Obsidian Money

## Purpose
Append a financial transaction to the current monthly log file so the background AI Daemon can parse and sync it to Supabase.

## Prerequisites
- Daemon must be running: `npm run watch-vault`
- Monthly log file must exist (daemon auto-creates on first run)

## Steps

### 1. Determine the current monthly log file
```bash
MONTH=$(date +%Y-%m)
FILE="vault/01_Monthly_Logs/${MONTH}.md"
```

### 2. Format the transaction line
The line MUST start with `> - ` (callout list item format).

#### Natural Language
```
> - ăn trưa 55k Vpbank
> - Lâm shopee zakka 115k -8% Tpbank
> - Hương vay 300k từ Vpbank
> - nhận lương 20tr Tpbank
```

#### Google Sheet Tab-Separated (copy-paste from sheet)
```
> - Out	06-05	Điện T4	1.971.346	1,00	Power	Tpbank
> - In	15-05	Lương T5	20.000.000	0,00	Tpbank
```
Format: `Type\tDate\tNotes\tAmount\t%Back\tShopSource[\tAccount]`

#### Mixed (Person + Account + Sheet)
```
> - Lâm Tpbank Out	06-05	Điện T4	1.971.346	1,00	Power
> - My Vpbank mua đồ 200k -5%
```

### 3. Insert into file
Insert the line AFTER `> [!todo] 📥 Unsynced Transactions` section header.

```bash
# Quick method using sed (insert after Unsynced header):
MONTH=$(date +%Y-%m)
TXN="ăn trưa 55k Vpbank"
sed -i '' "/\[!todo\] 📥 Unsynced Transactions/a\\
> - ${TXN}" "vault/01_Monthly_Logs/${MONTH}.md"
```

Or using the built-in CLI:
```bash
npm run cli -- "ăn trưa 55k Vpbank"
```

### 4. Wait for daemon
- Daemon detects file change within 1.5 seconds
- AI parses the text → creates structured JSON
- Inserts into Supabase (transaction, debt, cashback)
- Updates account balance
- Replaces unsynced line with synced table row
- macOS toast notification appears when done

## Auto-Create Behavior
- **Unknown person** (e.g., "My"): Auto-created in `people` table
- **Unknown account**: Auto-created as `cash` type account
- Run `npm run generate-pages` after to create Obsidian pages for new entities

## Error Handling
- If daemon is not running: the line stays in Unsynced forever (safe)
- If AI fails to parse: warning shown in table, raw text preserved
- If Supabase fails: error logged in terminal, transaction NOT created

## Output
After successful sync, the unsynced line becomes a row in the Markdown table:
```
| `abc12` | 20:15 | [[Lâm]] | [[Tpbank]] | 🔴 | **65,000 đ** | shopee zakka | Net: 59,800đ CB: 5,200đ |
```
