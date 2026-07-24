import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { EdgeTTS } = require('node-edge-tts');

const execPromise = promisify(exec);

export async function generateVoiceover(adeganList, outputFile) {
  console.log('[2/6] [INFO] Mengubah naskah menjadi suara narator (Edge-TTS)...');

  const promises = adeganList.map(async (scene, i) => {
    const chunkText = scene.narasi.trim();
    if (!chunkText) return null;

    const chunkFile = `workspace/temp/voice_chunk_${i}.mp3`;
    const tts = new EdgeTTS({
      voice: 'id-ID-GadisNeural',
      lang: 'id-ID',
      outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
      rate: '+15%',
      pitch: '+5Hz'
    });

    console.log(`   [INFO] Menyuarakan adegan ${i + 1}/${adeganList.length}...`);
    try {
      await tts.ttsPromise(chunkText, chunkFile);
      
      const { stdout } = await execPromise(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${chunkFile}`);
      scene.exactDuration = parseFloat(stdout);

      return `file 'voice_chunk_${i}.mp3'\n`;
    } catch (e) {
      console.warn(`   [WARNING] Gagal menyuarakan adegan ${i + 1}. Menggunakan durasi fallback 3 detik. (${e.message})`);
      scene.exactDuration = 3;
      return null;
    }
  });

  const results = await Promise.all(promises);
  const listContent = results.filter(Boolean).join('');

  if (!listContent) {
    console.error('   [ERROR] Semua audio gagal di-generate. Video mungkin tidak memiliki suara narator.');
    // Buat file output kosong agar tidak crash
    fs.writeFileSync(outputFile, '');
    return;
  }

  // Simpan urutan file di dalam folder temp
  fs.writeFileSync('workspace/temp/voice_list.txt', listContent);
  
  console.log(`   [INFO] Menggabungkan potongan suara menjadi utuh...`);
  try {
    await execPromise(`cd workspace/temp && ffmpeg -y -f concat -safe 0 -i voice_list.txt -c copy ../../${outputFile}`);
    console.log(`   [SUCCESS] Suara utuh berhasil disimpan di: ${outputFile}`);
  } catch (error) {
    console.error(`   [ERROR] Gagal menggabungkan audio: ${error.message}`);
  } finally {
    if (fs.existsSync('workspace/temp/voice_list.txt')) fs.unlinkSync('workspace/temp/voice_list.txt');
    for (let i = 0; i < adeganList.length; i++) {
      if (fs.existsSync(`workspace/temp/voice_chunk_${i}.mp3`)) fs.unlinkSync(`workspace/temp/voice_chunk_${i}.mp3`);
    }
  }
}
