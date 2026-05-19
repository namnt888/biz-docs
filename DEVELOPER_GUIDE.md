# 📘 Obsidian Money - Developer Guide & Roadmap

Welcome to the developer manual and project memory file for **Obsidian Money**. If you are a new AI agent assisting the user, please read this document first to understand the architecture, database schema, accomplishments, and roadmap.

---

## 🏗️ Project Architecture

Obsidian Money is an automated personal finance system combining:
1. **Obsidian Vault (Frontend)**: Standard Markdown logs, templates, and dynamic `dataviewjs` script blocks querying Supabase realtime.
2. **Supabase (Backend/Database)**: PostgreSQL database storing transactions, accounts, debts, and cashback cycles.
3. **Agent Daemon (Middle-tier)**: Node.js/TypeScript daemon in the `agent/` folder using:
   - `chokidar` to monitor monthly markdown logs.
   - LLMs to parse natural language inputs or Google Sheet rows pasted into `## 📥 Unsynced Transactions`.
   - Automatic account balance calculations, cashback rollup entries, and FIFO debt repayment logic.

---

## 🗄️ Supabase Database Schema

Below is the database table structures and relationships:

```mermaid
erDiagram
    accounts {
        uuid id PK
        text name
        text type "bank, credit_card, wallet, cash"
        numeric current_balance
        text currency "VND"
    }
    people {
        uuid id PK
        text name
        text status "active, inactive"
    }
    transactions {
        uuid id PK
        timestamp occurred_at
        text type "expense, income, transfer_in, transfer_out, cashback, debt, repayment"
        numeric amount
        text note
        uuid account_id FK
        uuid person_id FK
        text cashback_mode
        numeric cashback_share_percent
        numeric cashback_share_fixed
        jsonb metadata "category_name, service_fee, final_price, etc"
    }
    debts {
        uuid id PK
        uuid person_id FK
        uuid transaction_id FK
        text debt_role "lent, borrowed"
        numeric original_amount
        numeric repaid_amount
        numeric remaining_amount
        text status "pending, partial, settled"
    }
    cashback_cycles {
        uuid id PK
        uuid account_id FK
        text cycle_tag "YYYY-MM"
        numeric spent_amount
        numeric virtual_profit
        numeric real_awarded
    }
```

---

## ✅ Accomplished Features

We have completed the following core features:
1. **AI Parse & Year Inference**: AI daemon extracts natural language entries (including tab-separated sheets) and infers dates using the current log file's year context (e.g. `2025-06.md` forces DD-MM dates to resolve to 2025).
2. **Live Watcher**: Realtime file monitoring with iCloud polling enabled. Unsynced transactions are parsed, inserted into Supabase, and cleared from the log file.
3. **Recent Added Logs**: Under `## ⚡ Recent Added` in monthly logs, a dynamic DataviewJS widget renders the 5 most recently created transactions across the system.
4. **My Personal Finance Report**: A dedicated dashboard at `vault/00_Dashboard/My_Report.md` that displays **personal cashflow** cards and tables, completely excluding relationship debts and internal bank transfers.
5. **Ecosystem Page Generator**: Running `npm run generate-pages` compiles and regenerates all Account, People Index, and People Year files with unified column layouts (`Loại` styled as colored In/Out HTML tags placed before Date/Cycle columns) and correct relative folders links.

---

## 🗺️ Next Steps & Roadmap

Here are the planned features for upcoming sprints:

### 1. Connecting DBeaver (Database View Setup)
- Help the user connect a free database client (like DBeaver) to the Supabase PostgreSQL database to view tables without loading the web dashboard.
- **Connection Details**: Retrieve connection string/host details from Supabase Project Settings -> Database.

### 2. Obsidian QuickAdd setup (Modal Form & Quick Add)
- Configure the Obsidian **QuickAdd** plugin or hotkey mapping.
- Enable the user to hit a shortcut to trigger a Modal Form for quick transaction entry (which appends text to the active monthly log's `Unsynced` section).

### 3. Google Sheets Sync using n8n
- Build or configure an n8n workflow that triggers whenever a new transaction is inserted in Supabase.
- Write the transactions automatically to the user's master Google Sheets ledger.

---

## 🤖 Instructions for the Next Assistant Session
1. **Always read this guide** before refactoring or writing new queries.
2. Check `agent/src/index.ts` to see daemon execution flow and `agent/src/scripts/generate_pages.ts` for vault pages generation.
3. Keep the styling aesthetic high: use HSL colors, modern typography, glassmorphism, and clean structures in any UI/DataviewJS edits.
4. Suppress verbose console outputs and maintain error safety for all network calls.
