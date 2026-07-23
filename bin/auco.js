#!/usr/bin/env node

import { fileURLToPath } from 'url';
import path from 'path';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../');

const args = process.argv.slice(2);

const child = spawn('node', ['index.js', ...args], {
  cwd: projectRoot,
  stdio: 'inherit'
});

child.on('error', (err) => {
  console.error('[ERROR] Gagal menjalankan auco:', err);
});
