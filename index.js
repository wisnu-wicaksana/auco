import { generateScript, generateCaption } from './src/ai/scriptMaker.js';
import { generateVoiceover } from './src/tts/edgeTTS.js';
import { generatePexelsVideos } from './src/media/pexels.js';
import { generateSubtitle } from './src/ai/whisper.js';
import { renderVideo } from './src/media/ffmpeg.js';
import { scrapeArticle } from './src/utils/scraper.js';
import { logger } from './src/utils/logger.js';
import * as PATHS from './src/config/paths.js';
import readline from 'readline';

async function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

async function main() {
  try {
    let rawInput = process.argv.slice(2).join(' ');

    if (!rawInput) {
      logger.blank('\n=========================================');
      logger.blank(' AUCO - Auto Content');
      logger.blank('=========================================\n');
      rawInput = await askQuestion('Mau buat video tentang topik apa hari ini? (Ketik topik atau paste Link Berita): ');
    }

    let finalArticle = rawInput.trim();
    if (!finalArticle) {
        logger.error('\nAnda tidak memasukkan topik atau link sama sekali. Proses dibatalkan.');
        return;
    }

    if (finalArticle.startsWith('http://') || finalArticle.startsWith('https://')) {
        finalArticle = await scrapeArticle(finalArticle);
    }

    const scriptData = await generateScript(finalArticle);
    const captionPromise = generateCaption(scriptData.narasi_lengkap);

    await generateVoiceover(scriptData.adegan, PATHS.AUDIO_OUTPUT);

    const pexelsPromise = generatePexelsVideos(scriptData.adegan, scriptData.fallback_keywords);
    const subtitlePromise = generateSubtitle(PATHS.AUDIO_OUTPUT);
    
    await Promise.all([pexelsPromise, subtitlePromise, captionPromise]);

    await renderVideo(scriptData.adegan, PATHS.AUDIO_OUTPUT, PATHS.FINAL_VIDEO);

    logger.blank('\n[SUCCESS] Proses Selesai! Naskah, Suara Narator, Gambar Visual, dan Subtitle Berhasil Dibuat!');
    logger.blank(`[INFO] Silakan cek hasilnya di: ${PATHS.FINAL_VIDEO}\n`);
  } catch (error) {
    logger.error(`\nProgram Terhenti Karena Kesalahan Fatal: ${error.message}`);
  }
}

main();