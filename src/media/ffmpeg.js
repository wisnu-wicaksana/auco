import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
const execPromise = promisify(exec);

export async function renderVideo(adeganList, audioFile, outputFile) {
  console.log('[6/6] [INFO] Menjahit Audio dan Gambar menjadi Video MP4 (FFmpeg)...');

  try {
    let concatText = '';
    let validScenes = 0;
    
    // Pastikan adegan benar-benar ada (tidak di-skip karena error pexels)
    for (let i = 0; i < adeganList.length; i++) {
      const adeganPath = `workspace/temp/adegan_${i + 1}.mp4`;
      if (fs.existsSync(adeganPath)) {
        concatText += `file 'adegan_${i + 1}.mp4'\n`;
        validScenes++;
      } else {
        console.warn(`   [WARNING] adegan_${i + 1}.mp4 tidak ditemukan, akan di-skip dalam proses render.`);
      }
    }
    
    if (validScenes === 0) {
      console.error('   [ERROR] Tidak ada satupun file video Pexels yang berhasil diunduh. Render dibatalkan.');
      return;
    }

    fs.writeFileSync('workspace/temp/list.txt', concatText);

    const absAudioFile = path.resolve(audioFile);
    const absOutputFile = path.resolve(outputFile);
    const hasBgm = fs.existsSync('bgm.mp3');
    const absBgm = hasBgm ? path.resolve('bgm.mp3') : '';
    
    // Fallback: Jika audioFile tidak ada atau ukurannya 0, render video tanpa suara narator
    let hasAudio = false;
    if (fs.existsSync(absAudioFile) && fs.statSync(absAudioFile).size > 0) {
      hasAudio = true;
    } else {
      console.warn('   [WARNING] File audio narator tidak valid. Video akan dirender tanpa suara narator (hanya BGM jika ada).');
    }
    
    let ffmpegSingleCmd;
    if (hasBgm && hasAudio) {
      console.log('   [INFO] Ditemukan bgm.mp3! Menambahkan musik latar (BGM)...');
      ffmpegSingleCmd = `cd workspace/temp && ffmpeg -f concat -safe 0 -i list.txt -i "${absAudioFile}" -stream_loop -1 -i "${absBgm}" -filter_complex "[2:a]volume=0.1[bgm];[1:a][bgm]amix=inputs=2:duration=first[a];[0:v]subtitles=subtitle.ass[v]" -map "[v]" -map "[a]" -c:v libx264 -c:a aac -ac 2 -b:a 128k -shortest -y "${absOutputFile}"`;
    } else if (hasAudio) {
      ffmpegSingleCmd = `cd workspace/temp && ffmpeg -f concat -safe 0 -i list.txt -i "${absAudioFile}" -filter_complex "[0:v]subtitles=subtitle.ass[v]" -map "[v]" -map 1:a:0 -c:v libx264 -c:a aac -ac 2 -b:a 128k -shortest -y "${absOutputFile}"`;
    } else if (hasBgm) {
      // Tidak ada audio narator, tapi ada BGM
      console.log('   [INFO] Ditemukan bgm.mp3! Menambahkan musik latar (BGM) (Tanpa narasi)...');
      ffmpegSingleCmd = `cd workspace/temp && ffmpeg -f concat -safe 0 -i list.txt -stream_loop -1 -i "${absBgm}" -filter_complex "[0:v]subtitles=subtitle.ass[v]" -map "[v]" -map 1:a:0 -c:v libx264 -c:a aac -ac 2 -b:a 128k -shortest -y "${absOutputFile}"`;
    } else {
      // Tidak ada audio sama sekali
      ffmpegSingleCmd = `cd workspace/temp && ffmpeg -f concat -safe 0 -i list.txt -filter_complex "[0:v]subtitles=subtitle.ass[v]" -map "[v]" -c:v libx264 -shortest -y "${absOutputFile}"`;
    }

    console.log('   [INFO] Merender dan menggabungkan video, audio, dan subtitle dalam 1 tahap (Bisa memakan waktu beberapa menit)...');
    await execPromise(ffmpegSingleCmd);
    
    console.log(`   [SUCCESS] RENDER SELESAI! Video tersimpan sebagai: ${outputFile}`);
  } catch (error) {
    console.error(`   [ERROR] Gagal melakukan render video:`, error.message);
  } finally {
    console.log('   [INFO] Membersihkan ruang kerja...');
    if (fs.existsSync('workspace/temp/list.txt')) fs.unlinkSync('workspace/temp/list.txt');
    if (fs.existsSync('workspace/temp/subtitle.ass')) fs.unlinkSync('workspace/temp/subtitle.ass');
    for (let i = 0; i < adeganList.length; i++) {
        const file = `workspace/temp/adegan_${i + 1}.mp4`;
        if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  }
}
