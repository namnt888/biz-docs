# SKILL: Generate / Refresh Obsidian Pages

## Purpose
Regenerate Account and People pages in the vault from Supabase data. Run this after:
- Adding a new account to Supabase
- A new person being auto-created by the daemon
- Wanting to refresh DataviewJS dashboards

## Command
```bash
cd /Users/rei/Library/Mobile\ Documents/com~apple~CloudDocs/github2026/biz-docs
npm run generate-pages
```

## What It Does
1. Fetches all accounts from `accounts` table
2. Fetches all people from `people` table
3. For each account: creates `vault/02_Accounts/{name}.md` with DataviewJS dashboards
4. For each person: 
   - Creates `vault/03_People/{name}.md` (index page with debt summary + year links)
   - Fetches transactions to determine which years have data
   - Creates `vault/03_People/{name}/{year}.md` for each year

## Output Structure
```
02_Accounts/
├── Tpbank.md         ← Balance, Cashback Cycles, Transaction History
├── Vpbank.md
├── MoMo.md
└── ...

03_People/
├── Lâm.md            ← Debt summary + year links
├── Lâm/
│   ├── 2026.md       ← Transactions grouped by month
│   └── 2024.md
├── Nam.md
└── ...
```

## Notes
- Overwrites existing files (safe — content is generated from DB)
- Does NOT delete files for removed accounts/people
- Requires Supabase credentials in `agent/.env`
