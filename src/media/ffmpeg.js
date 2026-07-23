import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
const execPromise = promisify(exec);

export async function renderVideo(adeganList, audioFile, outputFile) {
  console.log('[4/4] Menjahit Audio dan Gambar menjadi Video MP4 (FFmpeg)...');

  let concatText = '';
  for (let i = 0; i < adeganList.length; i++) {
    // Karena list.txt ada di workspace/temp, nama file cukup relative ke sana
    concatText += `file 'adegan_${i + 1}.mp4'\n`;
  }
  
  fs.writeFileSync('workspace/temp/list.txt', concatText);

  const tempVideo = 'workspace/temp/temp_video.mp4';
  
  // Perhatikan: Karena subtitle.ass ada di workspace/temp, path subttles harus benar
  const ffmpegVideoCmd = `cd workspace/temp && ffmpeg -f concat -safe 0 -i list.txt -c:v libx264 -vf "subtitles=subtitle.ass" -y temp_video.mp4`;
  
  // Penggabungan akhir: output dikembalikan ke root (atau workspace/output)
  let ffmpegMergeCmd;
  if (fs.existsSync('bgm.mp3')) {
    console.log('   -> [INFO] Ditemukan bgm.mp3! Menambahkan musik latar (BGM) ala TikTok...');
    ffmpegMergeCmd = `ffmpeg -i ${tempVideo} -i ${audioFile} -stream_loop -1 -i bgm.mp3 -filter_complex "[2:a]volume=0.1[bgm];[1:a][bgm]amix=inputs=2:duration=first[a]" -map 0:v:0 -map "[a]" -c:v copy -c:a aac -ac 2 -b:a 128k -shortest -y ${outputFile}`;
  } else {
    ffmpegMergeCmd = `ffmpeg -i ${tempVideo} -i ${audioFile} -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -ac 2 -b:a 128k -shortest -y ${outputFile}`;
  }

  try {
    console.log('   -> Tahap 1: Merender urutan gambar (Bisa memakan waktu beberapa menit)...');
    await execPromise(ffmpegVideoCmd);
    
    console.log('   -> Tahap 2: Memasukkan audio ke dalam video...');
    await execPromise(ffmpegMergeCmd);
    
    console.log(`   [OK] RENDER SELESAI! Video tersimpan sebagai: ${outputFile}`);
  } catch (error) {
    console.error(`   [ERROR] Gagal melakukan render video:`, error);
  } finally {
    // Bersihkan seluruh file di workspace/temp/
    console.log('   [INFO] Membersihkan ruang kerja...');
    if (fs.existsSync('workspace/temp/list.txt')) fs.unlinkSync('workspace/temp/list.txt');
    if (fs.existsSync(tempVideo)) fs.unlinkSync(tempVideo);
    if (fs.existsSync('workspace/temp/subtitle.ass')) fs.unlinkSync('workspace/temp/subtitle.ass');
    for (let i = 0; i < adeganList.length; i++) {
        const file = `workspace/temp/adegan_${i + 1}.mp4`;
        if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  }
}
