import chokidar from 'chokidar';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { processDailyLog } from './index';

dotenv.config();

const vaultPath = process.env.OBSIDIAN_VAULT_PATH || '../vault';
const monthlyLogsDir = path.resolve(vaultPath, '01_Monthly_Logs');

console.log(`\n🤖 Obsidian Money Daemon initialized.`);
console.log(`Watching for realtime changes on directory: ${monthlyLogsDir}`);

let isProcessing = false;
let debounceTimer: NodeJS.Timeout | null = null;

// Watch monthly logs directory directly with polling enabled for iCloud Drive compatibility
const watcher = chokidar.watch(monthlyLogsDir, {
  persistent: true,
  ignoreInitial: true,
  usePolling: true,
  interval: 1000, // Poll every 1 second
  awaitWriteFinish: {
    stabilityThreshold: 1500, // wait 1.5s after typing stops before triggering
    pollInterval: 200,
  },
});

watcher.on('all', async (event, filePath) => {
  if (event !== 'change' && event !== 'add') return;
  if (!filePath.endsWith('.md')) return;

  if (isProcessing) return;

  if (debounceTimer) clearTimeout(debounceTimer);

  debounceTimer = setTimeout(async () => {
    isProcessing = true;
    try {
      console.log(`\n📄 Detected change in ${path.basename(filePath)}. Triggering sync...`);
      await processDailyLog(filePath);
    } catch (err) {
      console.error('Daemon execution error:', err);
    } finally {
      isProcessing = false;
    }
  }, 500);
});

watcher.on('error', error => console.error(`Watcher error: ${error}`));
