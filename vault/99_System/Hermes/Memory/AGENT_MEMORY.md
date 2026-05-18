# 🧠 Agent Memory — Obsidian Money

> Persistent context file. Any AI agent (Claude, Codex, Gemini, Hermes) should read this FIRST.

## System Identity
- **Project**: Obsidian Money — Personal Finance Management via Obsidian + Supabase + AI
- **Owner**: Rei (namnt888)
- **Repo**: `biz-docs` on GitHub
- **Vault Path**: `/Users/rei/Library/Mobile Documents/com~apple~CloudDocs/github2026/biz-docs/vault`
- **Agent Path**: `agent/src/` (TypeScript, tsx runtime)

## Architecture
```
Obsidian Vault (Markdown) ← Human writes/reads
        ↕ (chokidar watcher)
AI Daemon (agent/src/daemon.ts) → watches Monthly Logs
        ↕
AI Parser (agent/src/index.ts) → calls LLM to parse text → JSON
        ↕
Supabase DB (PostgreSQL) → accounts, transactions, debts, cashback_cycles
        ↕ (Webhook)
n8n → Google Sheets sync
```

## Key Database Tables
| Table | Purpose |
|---|---|
| `accounts` | Bank accounts, wallets (id, name, type, current_balance) |
| `transactions` | All financial transactions (amount, type, account_id, person_id) |
| `debts` | Debt tracking FIFO (person_id, original_amount, remaining_amount, status) |
| `cashback_cycles` | Monthly cashback tracking per account |
| `people` | People involved in debts/shared expenses |
| `categories` | Expense categories |

## Current Model Config
- **AI Gateway**: `AI_BASE_URL` from `.env` (default: local 9Router at port 20128)
- **Model**: `AI_MODEL` from `.env` (default: `rei` via 9Router or `google/gemini-2.5-flash`)

## Vault Structure
```
vault/
├── 00_Dashboard/     ← DataviewJS dashboards (live Supabase queries)
├── 01_Monthly_Logs/  ← 2026-05.md, 2026-06.md (main data entry)
├── 02_Accounts/      ← Auto-generated per account
├── 03_People/        ← Auto-generated per person (with year sub-pages)
└── 99_System/
    ├── Blueprint.md  ← Project roadmap & architecture
    ├── Guides/       ← User manuals (Vietnamese)
    ├── Hermes/       ← THIS FOLDER (Agent Memory, Skills, Sessions)
    └── QuickAdd/     ← Obsidian macro scripts
```

## Important NPM Scripts
```bash
npm run watch-vault     # Start AI Daemon (background watcher)
npm run cli             # Interactive CLI for transaction input
npm run generate-pages  # Regenerate Account/People Obsidian pages from Supabase
```

## What the Agent CAN Do
1. ✅ Append transactions to Monthly Log → Daemon auto-parses
2. ✅ Create new People/Accounts automatically if not found in DB
3. ✅ Track debts (FIFO), cashback cycles, account balances
4. ✅ Generate Obsidian pages with DataviewJS dashboards
5. ✅ Parse natural language AND Google Sheet tab-separated format

## What the Agent CANNOT Do (Yet)
1. ❌ Edit/Delete existing transactions (need Supabase Dashboard manually)
2. ❌ Batch transfer between accounts
3. ❌ Generate charts (Obsidian Charts plugin installed but not wired)

## User Preferences
- Language: Vietnamese for UI, mixed Viet/Eng for code
- Likes: Toast notifications, backlinks everywhere, tables with CB breakdown
- Format: Callouts for sections, Markdown tables for synced txn
- Debt display: Summary + Cycle-based grouping, NOT month+cycle duplicate
