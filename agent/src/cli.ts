#!/usr/bin/env tsx
/**
 * Obsidian Money CLI
 * Paste natural language OR Sheet-format rows → append to Monthly Log → Daemon auto-syncs
 *
 * Usage:
 *   npx tsx src/cli.ts
 *   npx tsx src/cli.ts "ăn trưa 55k Vpbank"
 *   npx tsx src/cli.ts "Out\t06-05\tĐiện T4\t1.971.346\t1,00\tPower"
 */
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import * as dotenv from 'dotenv';
dotenv.config();

const vaultPath = process.env.OBSIDIAN_VAULT_PATH || path.resolve(__dirname, '../../vault');

function getCurrentMonthFile(): string {
  const d = new Date();
  const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const dir = path.resolve(vaultPath, '01_Monthly_Logs');
  return path.join(dir, `${monthStr}.md`);
}

function appendToUnsynced(rawLine: string) {
  const filePath = getCurrentMonthFile();
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File không tồn tại: ${filePath}`);
    console.error(`   Hãy chạy daemon một lần để tạo file tháng hiện tại.`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  
  // Insert after the Unsynced callout header line
  const unsyncedHeader = '> [!todo] 📥 Unsynced Transactions';
  const insertIdx = content.indexOf(unsyncedHeader);
  if (insertIdx === -1) {
    console.error('❌ Không tìm thấy section Unsynced trong file log.');
    process.exit(1);
  }

  // Find the end of the callout header block (first empty line after header)
  const afterHeader = content.indexOf('\n', insertIdx) + 1;
  // Check if next line is callout description
  const nextLine = content.substring(afterHeader, content.indexOf('\n', afterHeader));
  let insertAt: number;
  if (nextLine.startsWith('> ') && !nextLine.startsWith('> -')) {
    // Skip description line, insert after it
    insertAt = content.indexOf('\n', afterHeader) + 1;
  } else {
    insertAt = afterHeader;
  }

  const newEntry = `> - ${rawLine}\n`;
  const newContent = content.slice(0, insertAt) + newEntry + content.slice(insertAt);
  fs.writeFileSync(filePath, newContent, 'utf8');

  console.log(`\n✅ Đã thêm vào Unsynced:\n   "${rawLine}"`);
  console.log(`📄 File: ${path.basename(filePath)}`);
  console.log(`🤖 Daemon sẽ tự động parse trong ~2 giây...`);
  console.log(`   (Đảm bảo daemon đang chạy: npm run watch-vault)\n`);
}

async function interactiveMode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const modelName = process.env.AI_MODEL || 'claude-3-5-sonnet';

  console.log('\n╔════════════════════════════════════════╗');
  console.log('║  🤖  Obsidian Money CLI                ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`🧠 AI Model Active: [${modelName}]`);
  console.log('Nhập giao dịch (natural language hoặc Sheet format)');
  console.log('Gõ "exit" hoặc Ctrl+C để thoát.\n');
  console.log('📌 Ví dụ natural: ăn trưa 55k Vpbank');
  console.log('📌 Ví dụ sheet:   Out\t06-05\tĐiện T4\t1.971.346\t1,00\tPower');
  console.log('─'.repeat(50));

  const prompt = () => {
    rl.question('\n💸 Paste txn: ', (input) => {
      const trimmed = input.trim();
      if (!trimmed || trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
        console.log('\n👋 Tạm biệt!');
        rl.close();
        process.exit(0);
      }

      // Support multiple lines (batch paste)
      const lines = trimmed.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      for (const line of lines) {
        appendToUnsynced(line);
      }

      prompt(); // Continue prompting
    });
  };

  prompt();
}

// Main: if arg provided, use directly. Otherwise interactive mode.
const arg = process.argv.slice(2).join(' ').trim();
if (arg) {
  // Support tab-separated from shell (unescape \t)
  const unescaped = arg.replace(/\\t/g, '\t');
  appendToUnsynced(unescaped);
} else {
  interactiveMode();
}
