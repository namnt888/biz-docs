import chokidar from 'chokidar';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { processDailyLog } from './index';

dotenv.config();

const vaultPath = process.env.OBSIDIAN_VAULT_PATH || '../vault';
const todayFile = path.resolve(vaultPath, '01_Daily_Logs', 'Today.md');

console.log(`\n🤖 Obsidian Money Daemon initialized.`);
console.log(`Watching for realtime changes on: ${todayFile}`);

let isProcessing = false;
let debounceTimer: NodeJS.Timeout | null = null;

// Watch the specific file
const watcher = chokidar.watch(todayFile, {
  persistent: true,
  awaitWriteFinish: {
    stabilityThreshold: 1500, // wait 1.5s after typing stops before triggering
    pollInterval: 200,
  },
});

watcher.on('change', async () => {
  if (isProcessing) return;

  if (debounceTimer) clearTimeout(debounceTimer);

  debounceTimer = setTimeout(async () => {
    isProcessing = true;
    try {
      await processDailyLog();
    } catch (err) {
      console.error('Daemon execution error:', err);
    } finally {
      isProcessing = false;
    }
  }, 500);
});

watcher.on('error', error => console.error(`Watcher error: ${error}`));
