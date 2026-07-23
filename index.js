import { generateScript, generateCaption } from './src/ai/scriptMaker.js';
import { generateVoiceover } from './src/tts/edgeTTS.js';
import { generatePexelsVideos } from './src/media/pexels.js';
import { generateSubtitle } from './src/ai/whisper.js';
import { renderVideo } from './src/media/ffmpeg.js';
import { scrapeArticle } from './src/utils/scraper.js';
import { exec } from 'child_process';
import { promisify } from 'util';
const execPromise = promisify(exec);

// Contoh Input (Bisa berupa TEKS PANJANG atau cukup LINK BERITA!)
const sampleArticle = 'https://news.detik.com/berita/d-8586497/besok-24-juli-peringati-hari-kebaya-nasional-2026-apakah-libur';

async function main() {
  try {
    // 0. Deteksi apakah input berupa Link atau Teks biasa
    let finalArticle = sampleArticle.trim();
    if (finalArticle.startsWith('http://') || finalArticle.startsWith('https://')) {
        finalArticle = await scrapeArticle(finalArticle);
    }

    // 1. Olah Naskah (Groq)
    const scriptData = await generateScript(finalArticle);
    console.log('\n[INFO] Hasil Naskah JSON:');
    console.log(JSON.stringify(scriptData, null, 2));

    const audioFile = 'workspace/temp/output_voice.mp3';
    const finalVideo = 'workspace/output/FINAL_VIDEO_TIKTOK.mp4';

    // 2. Olah Voiceover MP3 & Catat Durasi Eksaknya per adegan
    await generateVoiceover(scriptData.adegan, audioFile);

    // 3. Olah Visual Video B-Roll (Pexels) dengan Auto-Fallback Dinamis
    await generatePexelsVideos(scriptData.adegan, scriptData.fallback_keywords);
    
    // 4. Olah Caption (Groq)
    await generateCaption(scriptData.narasi_lengkap);

    // 5. Olah Subtitle (Whisper)
    await generateSubtitle(audioFile);

    // 6. Render Video Final (FFmpeg)
    await renderVideo(scriptData.adegan, audioFile, finalVideo);

    console.log('\n[SUKSES] Naskah, Suara Narator, dan Gambar Visual Berhasil Dibuat!');
    console.log(`[INFO] Silakan cek hasilnya di: ${finalVideo}`);
  } catch (error) {
    console.error('\n[ERROR] Terjadi Kesalahan:', error);
  }
}

main();