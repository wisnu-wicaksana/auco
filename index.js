import { generateScript, generateCaption } from './src/ai/scriptMaker.js';
import { generateVoiceover } from './src/tts/edgeTTS.js';
import { generatePexelsVideos } from './src/media/pexels.js';
import { generateSubtitle } from './src/ai/whisper.js';
import { renderVideo } from './src/media/ffmpeg.js';
import { exec } from 'child_process';
import { promisify } from 'util';
const execPromise = promisify(exec);

// Contoh Topik Berita (Durasi ~1 Menit)
const sampleArticle = `
Judul Video: Bangkit dari Kegagalan: Mengapa Kamu Harus Terus Melangkah?
Pernahkah kamu merasa dunia seolah runtuh saat rencanamu hancur berantakan? Ditolak kerja berkali-kali, gagal masuk universitas impian, atau bisnis yang baru dirintis tiba-tiba bangkrut. Rasanya sangat wajar jika kamu ingin menyerah saat itu juga. Tapi, tahukah kamu rahasia terbesar dari orang-orang super sukses di dunia ini?

Mereka semua pernah gagal, dan kegagalan mereka jauh lebih menyakitkan dari yang bisa kita bayangkan. Bedanya, mereka tidak pernah mengizinkan kegagalan itu menjadi titik akhir dari cerita hidup mereka. Kegagalan bukanlah kebalikan dari kesuksesan, melainkan bagian yang tak terpisahkan dari proses menuju kesuksesan itu sendiri.

Setiap kali kamu jatuh, kamu sebenarnya sedang diajarkan cara untuk bangkit dengan lebih kuat dan lebih cerdas. Luka yang kamu rasakan hari ini akan menjadi senjata terkuatmu di masa depan. Jangan pernah membandingkan langkah pertamamu dengan langkah ke-100 milik orang lain. Waktumu pasti akan tiba.

Ingatlah selalu, bintang tidak akan pernah bisa bersinar terang tanpa adanya kegelapan malam. Jadi, hapus air matamu, ambil napas dalam-dalam, dan mulailah melangkah lagi. Karena satu-satunya cara untuk benar-benar kalah adalah dengan berhenti mencoba!
`;

async function main() {
  try {
    // 1. Olah Naskah (Groq)
    const scriptData = await generateScript(sampleArticle);
    console.log('\n📄 Hasil Naskah JSON:');
    console.log(JSON.stringify(scriptData, null, 2));

    const audioFile = 'workspace/temp/output_voice.mp3';
    const finalVideo = 'workspace/output/FINAL_VIDEO_TIKTOK.mp4';

    // 2. Olah Voiceover MP3 (Edge-TTS)
    await generateVoiceover(scriptData.narasi_lengkap, audioFile);

    // [SINKRONISASI PRESISI] Hitung durasi audio asli menggunakan FFprobe
    const { stdout } = await execPromise(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${audioFile}`);
    const totalAudioDuration = parseFloat(stdout);
    
    // Bagikan total durasi ke setiap adegan
    const totalChars = scriptData.adegan.reduce((sum, scene) => sum + scene.narasi.length, 0);
    for (let i = 0; i < scriptData.adegan.length; i++) {
      const portion = scriptData.adegan[i].narasi.length / totalChars;
      scriptData.adegan[i].exactDuration = totalAudioDuration * portion;
    }

    // 3. Olah Visual Video B-Roll (Pexels) dengan Auto-Fallback Dinamis
    await generatePexelsVideos(scriptData.adegan, scriptData.fallback_keywords);
    
    // 4. Olah Caption (Groq)
    await generateCaption(scriptData.narasi_lengkap);

    // 5. Olah Subtitle (Whisper)
    await generateSubtitle(audioFile);

    // 6. Render Video Final (FFmpeg)
    await renderVideo(scriptData.adegan, audioFile, finalVideo);

    console.log('\n🎉 [SUKSES] Naskah, Suara Narator, dan Gambar Visual Berhasil Dibuat!');
    console.log(`👉 Silakan cek hasilnya di: ${finalVideo}`);
  } catch (error) {
    console.error('\n❌ Terjadi Kesalahan:', error);
  }
}

main();