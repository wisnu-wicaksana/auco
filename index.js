#!/usr/bin/env node

import { generateScript, generateCaption } from './src/ai/scriptMaker.js';
import { generateVoiceover } from './src/tts/edgeTTS.js';
import { generatePexelsVideos } from './src/media/pexels.js';
import { generateSubtitle } from './src/ai/whisper.js';
import { renderVideo } from './src/media/ffmpeg.js';
import { scrapeArticle } from './src/utils/scraper.js';
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
      console.log('\n=========================================');
      console.log('🤖 AUCO - Auto Content Creator');
      console.log('=========================================\n');
      rawInput = await askQuestion('Mau buat video tentang topik apa hari ini? (Ketik topik atau paste Link Berita): ');
    }

    let finalArticle = rawInput.trim();
    if (!finalArticle) {
        console.error('\n[ERROR] Anda tidak memasukkan topik atau link sama sekali. Proses dibatalkan.');
        return;
    }

    if (finalArticle.startsWith('http://') || finalArticle.startsWith('https://')) {
        finalArticle = await scrapeArticle(finalArticle);
    }

    // 1. Olah Naskah (Groq)
    const scriptData = await generateScript(finalArticle);

    const audioFile = 'workspace/temp/output_voice.mp3';
    const finalVideo = 'workspace/output/FINAL_VIDEO_TIKTOK.mp4';

    // Mulai generateCaption secara paralel di background
    const captionPromise = generateCaption(scriptData.narasi_lengkap);

    // 2. Olah Voiceover MP3 & Catat Durasi Eksaknya per adegan
    await generateVoiceover(scriptData.adegan, audioFile);

    // 3 & 4. Pexels & Whisper berjalan paralel
    const pexelsPromise = generatePexelsVideos(scriptData.adegan, scriptData.fallback_keywords);
    const subtitlePromise = generateSubtitle(audioFile);
    
    await Promise.all([pexelsPromise, subtitlePromise, captionPromise]);

    // 5. Render Video Final (FFmpeg)
    await renderVideo(scriptData.adegan, audioFile, finalVideo);

    console.log('\n[SUCCESS] 🎉 Proses Selesai! Naskah, Suara Narator, Gambar Visual, dan Subtitle Berhasil Dibuat!');
    console.log(`[INFO] Silakan cek hasilnya di: ${finalVideo}\n`);
  } catch (error) {
    console.error('\n[ERROR] Program Terhenti Karena Kesalahan Fatal:', error.message);
  }
}

main();