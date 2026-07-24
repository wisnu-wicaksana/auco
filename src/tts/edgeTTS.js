import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createRequire } from 'module';
import { logger } from '../utils/logger.js';
import * as PATHS from '../config/paths.js';

const require = createRequire(import.meta.url);
const { EdgeTTS } = require('node-edge-tts');

const execPromise = promisify(exec);

export async function generateVoiceover(adeganList, outputFile) {
  logger.step(2, 'Mengubah naskah menjadi suara narator (Edge-TTS)...');

  // Pastikan folder temp tersedia
  fs.mkdirSync(PATHS.TEMP_DIR, { recursive: true });

  const promises = adeganList.map(async (scene, i) => {
    const chunkText = scene.narasi.trim();
    if (!chunkText) return null;

    const chunkFile = PATHS.getVoiceChunkPath(i);
    const tts = new EdgeTTS({
      voice: 'id-ID-GadisNeural',
      lang: 'id-ID',
      outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
      rate: '+15%',
      pitch: '+5Hz'
    });

    logger.info(`Menyuarakan adegan ${i + 1}/${adeganList.length}...`);
    try {
      await tts.ttsPromise(chunkText, chunkFile);
      
      const { stdout } = await execPromise(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${chunkFile}"`);
      scene.exactDuration = parseFloat(stdout);

      return `file 'voice_chunk_${i}.mp3'\n`;
    } catch (e) {
      logger.warn(`Gagal menyuarakan adegan ${i + 1}. Menggunakan durasi fallback 3 detik. (${e.message})`);
      scene.exactDuration = 3;
      return null;
    }
  });

  const results = await Promise.all(promises);
  const listContent = results.filter(Boolean).join('');

  if (!listContent) {
    logger.error('Semua audio gagal di-generate. Video mungkin tidak memiliki suara narator.');
    fs.writeFileSync(outputFile, '');
    return;
  }

  fs.writeFileSync(PATHS.TEMP_VOICE_LIST, listContent);
  
  logger.info(`Menggabungkan potongan suara menjadi utuh...`);
  try {
    await execPromise(`cd "${PATHS.TEMP_DIR}" && ffmpeg -y -f concat -safe 0 -i voice_list.txt -c copy "${outputFile}"`);
    logger.success(`Suara utuh berhasil disimpan di: ${outputFile}`);
  } catch (error) {
    logger.error(`Gagal menggabungkan audio: ${error.message}`);
  } finally {
    if (fs.existsSync(PATHS.TEMP_VOICE_LIST)) fs.unlinkSync(PATHS.TEMP_VOICE_LIST);
    for (let i = 0; i < adeganList.length; i++) {
      const chunkPath = PATHS.getVoiceChunkPath(i);
      if (fs.existsSync(chunkPath)) fs.unlinkSync(chunkPath);
    }
  }
}
