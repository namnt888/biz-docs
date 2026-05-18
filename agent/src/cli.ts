#!/usr/bin/env tsx
/**
 * 🤖 Obsidian Money CLI — Standalone Transaction Input Terminal
 *
 * Usage (interactive):
 *   npm run cli
 *
 * Usage (one-shot):
 *   npm run cli -- "ăn trưa 55k Vpbank"
 *   npm run cli -- "Out	06-05	Điện T4	1.971.346	1,00	Power	Tpbank"
 */
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const vaultPath = process.env.OBSIDIAN_VAULT_PATH || path.resolve(__dirname, '../../vault');
const modelName = process.env.AI_MODEL || 'google/gemini-2.5-flash';
const aiBaseUrl = process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1';

const COLORS = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};
const c = (color: keyof typeof COLORS, text: string) => `${COLORS[color]}${text}${COLORS.reset}`;

function getCurrentMonthFile(): string {
  const d = new Date();
  const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const dir = path.resolve(vaultPath, '01_Monthly_Logs');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${monthStr}.md`);
}

function appendToUnsynced(rawLine: string): boolean {
  const filePath = getCurrentMonthFile();
  if (!fs.existsSync(filePath)) {
    console.log(c('red', `❌ File không tồn tại: ${filePath}`));
    console.log(c('yellow', '   Tip: Chạy "npm run watch-vault" một lần để tạo file tháng.'));
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const unsyncedHeader = '> [!todo] 📥 Unsynced Transactions';
  const insertIdx = content.indexOf(unsyncedHeader);
  if (insertIdx === -1) {
    console.log(c('red', '❌ Không tìm thấy section [!todo] Unsynced trong file log.'));
    return false;
  }

  // Find insertion point (after callout description line if present)
  const afterHeader = content.indexOf('\n', insertIdx) + 1;
  const nextLine = content.substring(afterHeader, content.indexOf('\n', afterHeader));
  let insertAt: number;
  if (nextLine.startsWith('> ') && !nextLine.startsWith('> -')) {
    insertAt = content.indexOf('\n', afterHeader) + 1;
  } else {
    insertAt = afterHeader;
  }

  const newEntry = `> - ${rawLine}\n`;
  const newContent = content.slice(0, insertAt) + newEntry + content.slice(insertAt);
  fs.writeFileSync(filePath, newContent, 'utf8');
  return true;
}

function printHelp() {
  console.log(`
${c('bold', 'Các lệnh đặc biệt:')}
  ${c('cyan', 'help')}    — Xem hướng dẫn này
  ${c('cyan', 'exit')}    — Thoát CLI
  ${c('cyan', 'status')}  — Kiểm tra file tháng hiện tại
  ${c('cyan', 'clear')}   — Xóa màn hình

${c('bold', 'Định dạng nhập liệu:')}
  ${c('green', 'Natural:')}  ăn trưa 55k Vpbank
             Lâm shopee 115k -8% Tpbank
             nhận lương 20tr Tpbank
             Hương vay 300k Vpbank
             chuyển 1tr Tpbank sang MoMo

  ${c('green', 'Sheet:')}    Out\\t06-05\\tĐiện T4\\t1.971.346\\t1,00\\tPower\\tTpbank
  (Tab-separated từ Google Sheets, cột cuối là account nếu muốn chỉ định)

  ${c('green', 'Batch:')}    Paste nhiều dòng cùng lúc — mỗi dòng là 1 txn
`);
}

function printStatus() {
  const filePath = getCurrentMonthFile();
  const exists = fs.existsSync(filePath);
  console.log(`\n📄 File tháng: ${c('cyan', path.basename(filePath))}`);
  console.log(`   Path: ${c('dim', filePath)}`);
  console.log(`   Tồn tại: ${exists ? c('green', '✅ Có') : c('red', '❌ Không — hãy chạy watch-vault trước')}`);
  if (exists) {
    const content = fs.readFileSync(filePath, 'utf8');
    const unsyncedMatches = content.match(/^> - .+/gm) || [];
    const tableRows = content.match(/^\| `[a-f0-9]+` \|/gm) || [];
    console.log(`   Unsynced pending: ${c('yellow', String(unsyncedMatches.length))} dòng`);
    console.log(`   Đã sync (table rows): ${c('green', String(tableRows.length))} txn`);
  }
}

async function interactiveMode() {
  console.clear();
  console.log(c('bold', c('cyan', `
╔══════════════════════════════════════════════╗
║        🤖  Obsidian Money CLI  v1.0          ║
╚══════════════════════════════════════════════╝`)));
  console.log(`  ${c('dim', `AI Model : ${modelName}`)}`);
  console.log(`  ${c('dim', `Gateway  : ${aiBaseUrl}`)}`);
  console.log(`  ${c('dim', `Vault    : ${vaultPath}`)}`);
  console.log(`  ${c('yellow', 'Gõ "help" để xem hướng dẫn, "exit" để thoát.')}`);
  console.log(c('dim', '─'.repeat(50)));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });

  // Graceful exit on Ctrl+C
  rl.on('SIGINT', () => {
    console.log(c('yellow', '\n\n👋 Tạm biệt!'));
    process.exit(0);
  });

  const prompt = () => {
    rl.question(`\n${c('cyan', '💸')} ${c('bold', 'Paste txn')}: `, (input) => {
      const trimmed = input.trim();

      if (!trimmed) { prompt(); return; }

      switch (trimmed.toLowerCase()) {
        case 'exit': case 'quit': case 'q':
          console.log(c('yellow', '\n👋 Tạm biệt!'));
          rl.close(); process.exit(0);
        case 'help': case '?': case 'h':
          printHelp(); prompt(); return;
        case 'status': case 's':
          printStatus(); prompt(); return;
        case 'clear': case 'cls':
          console.clear(); prompt(); return;
      }

      // Support multi-line batch paste
      const lines = trimmed.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      let successCount = 0;
      for (const line of lines) {
        const ok = appendToUnsynced(line);
        if (ok) {
          successCount++;
          console.log(c('green', `  ✅ Đã thêm: "${line}"`));
        }
      }

      if (successCount > 0) {
        console.log(c('dim', `  📄 → ${path.basename(getCurrentMonthFile())}`));
        console.log(c('dim', `  🤖 AI Daemon sẽ parse qua model [${modelName}] trong ~2 giây...`));
        console.log(c('dim', `  🔔 Toast sẽ hiện ở góc phải Mac khi xong.`));
      }

      prompt();
    });
  };

  prompt();
}

// ── Main ──
const arg = process.argv.slice(2).join(' ').trim();
if (arg) {
  const unescaped = arg.replace(/\\t/g, '\t');
  const ok = appendToUnsynced(unescaped);
  if (ok) {
    console.log(`✅ Đã thêm: "${unescaped}"`);
    console.log(`🤖 [${modelName}] sẽ parse qua daemon...`);
  }
} else {
  interactiveMode();
}
