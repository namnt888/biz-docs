# Obsidian Money — Agent Instructions

## 🧠 READ THESE FIRST (Hermes-style Memory + Skills)

Before doing ANYTHING, read the following files to understand the system:

1. **Memory (Context):** `vault/99_System/Hermes/Memory/AGENT_MEMORY.md`
   → Architecture, DB schema, vault structure, user preferences, capabilities

2. **Skills (How-to):**
   - `vault/99_System/Hermes/Skills/SKILL_add_transaction.md` → How to add transactions
   - `vault/99_System/Hermes/Skills/SKILL_generate_pages.md` → How to regenerate pages

3. **Blueprint (Roadmap):** `vault/99_System/Blueprint.md`
   → Project history, completed sprints, future plans

## QUICK REFERENCE

### Add a transaction
```bash
# Method 1: CLI interactive
npm run cli

# Method 2: CLI one-shot
npm run cli -- "ăn trưa 55k Vpbank"

# Method 3: Direct file append (daemon picks up automatically)
echo '> - Lâm shopee 115k -8% Tpbank' >> vault/01_Monthly_Logs/$(date +%Y-%m).md
```

### Start the daemon
```bash
npm run watch-vault
```

### Refresh pages after new account/person
```bash
npm run generate-pages
```

## IMPORTANT
- The daemon MUST be running (`npm run watch-vault`) for auto-parse to work
- New people/accounts are auto-created in Supabase if not found
- All `.env` config is in `agent/.env`
- Toast notifications appear on macOS when transactions are synced
