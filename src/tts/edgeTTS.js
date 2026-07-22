import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { EdgeTTS } = require('node-edge-tts');

const execPromise = promisify(exec);

export async function generateVoiceover(textNarasi, outputFile) {
  console.log('🎙️ [2/3] Mengubah naskah menjadi suara narator (Edge-TTS)...');

  const chunks = textNarasi.match(/[^.!?]+[.!?]+/g) || [textNarasi];
  let listContent = '';

  for (let i = 0; i < chunks.length; i++) {
    const chunkText = chunks[i].trim();
    if (!chunkText) continue;

    const chunkFile = `workspace/temp/voice_chunk_${i}.mp3`;
    const tts = new EdgeTTS({
      voice: 'id-ID-GadisNeural',
      lang: 'id-ID',
      outputFormat: 'audio-24khz-48kbitrate-mono-mp3'
    });

    console.log(`   -> Menyuarakan bagian ${i + 1}/${chunks.length}...`);
    try {
      await tts.ttsPromise(chunkText, chunkFile);
    } catch (e) {
      console.log(`   -> [Retry] Mengulang bagian ${i + 1}...`);
      await tts.ttsPromise(chunkText, chunkFile);
    }
    
    // Kita panggil FFmpeg dari direktori root, jadi path-nya disesuaikan
    listContent += `file 'voice_chunk_${i}.mp3'\n`;
  }

  // Simpan urutan file di dalam folder temp
  fs.writeFileSync('workspace/temp/voice_list.txt', listContent);
  
  console.log(`   -> Menggabungkan ${chunks.length} potongan suara menjadi utuh...`);
  // FFmpeg dipanggil dengan cwd = workspace/temp/ agar path 'voice_chunk_x.mp3' terbaca lurus
  await execPromise(`cd workspace/temp && ffmpeg -y -f concat -safe 0 -i voice_list.txt -c copy ../../${outputFile}`);

  // Pembersihan file sementara
  if (fs.existsSync('workspace/temp/voice_list.txt')) fs.unlinkSync('workspace/temp/voice_list.txt');
  for (let i = 0; i < chunks.length; i++) {
    if (fs.existsSync(`workspace/temp/voice_chunk_${i}.mp3`)) fs.unlinkSync(`workspace/temp/voice_chunk_${i}.mp3`);
  }

  console.log(`✅ Suara utuh berhasil disimpan di: ${outputFile}`);
}
