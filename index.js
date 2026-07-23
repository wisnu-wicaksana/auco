import { generateScript, generateCaption } from './src/ai/scriptMaker.js';
import { generateVoiceover } from './src/tts/edgeTTS.js';
import { generatePexelsVideos } from './src/media/pexels.js';
import { generateSubtitle } from './src/ai/whisper.js';
import { renderVideo } from './src/media/ffmpeg.js';
import { scrapeArticle } from './src/utils/scraper.js';

// Contoh Input (Bisa berupa TEKS PANJANG atau cukup LINK BERITA!)
const sampleArticle = 'fakta madu';

async function main() {
  try {
    let finalArticle = sampleArticle.trim();
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

    console.log('\n[SUCCESS] Proses Selesai! Naskah, Suara Narator, Gambar Visual, dan Subtitle Berhasil Dibuat!');
    console.log(`[INFO] Silakan cek hasilnya di: ${finalVideo}`);
  } catch (error) {
    console.error('\n[ERROR] Program Terhenti Karena Kesalahan Fatal:', error.message);
  }
}

main();