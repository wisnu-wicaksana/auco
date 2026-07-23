import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { EdgeTTS } = require('node-edge-tts');

const execPromise = promisify(exec);

export async function generateVoiceover(adeganList, outputFile) {
  console.log('[2/3] Mengubah naskah menjadi suara narator (Edge-TTS)...');

  let listContent = '';

  for (let i = 0; i < adeganList.length; i++) {
    const scene = adeganList[i];
    const chunkText = scene.narasi.trim();
    if (!chunkText) continue;

    const chunkFile = `workspace/temp/voice_chunk_${i}.mp3`;
    const tts = new EdgeTTS({
      voice: 'id-ID-GadisNeural',
      lang: 'id-ID',
      outputFormat: 'audio-24khz-48kbitrate-mono-mp3'
    });

    console.log(`   -> Menyuarakan adegan ${i + 1}/${adeganList.length}...`);
    try {
      await tts.ttsPromise(chunkText, chunkFile);
    } catch (e) {
      console.log(`   -> [Retry] Mengulang adegan ${i + 1}...`);
      await tts.ttsPromise(chunkText, chunkFile);
    }
    
    // UKUR DURASI AUDIO ADEGAN INI SECARA AKURAT!
    const { stdout } = await execPromise(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${chunkFile}`);
    scene.exactDuration = parseFloat(stdout);

    listContent += `file 'voice_chunk_${i}.mp3'\n`;
  }

  // Simpan urutan file di dalam folder temp
  fs.writeFileSync('workspace/temp/voice_list.txt', listContent);
  
  console.log(`   -> Menggabungkan potongan suara menjadi utuh...`);
  // FFmpeg dipanggil dengan cwd = workspace/temp/
  await execPromise(`cd workspace/temp && ffmpeg -y -f concat -safe 0 -i voice_list.txt -c copy ../../${outputFile}`);

  // Pembersihan file sementara
  if (fs.existsSync('workspace/temp/voice_list.txt')) fs.unlinkSync('workspace/temp/voice_list.txt');
  for (let i = 0; i < adeganList.length; i++) {
    if (fs.existsSync(`workspace/temp/voice_chunk_${i}.mp3`)) fs.unlinkSync(`workspace/temp/voice_chunk_${i}.mp3`);
  }

  console.log(`[OK] Suara utuh berhasil disimpan di: ${outputFile}`);
}
