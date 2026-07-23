import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
const execPromise = promisify(exec);

async function getBestEncoder() {
  try {
    const { stdout } = await execPromise('ffmpeg -encoders');
    if (stdout.includes('h264_videotoolbox')) return 'h264_videotoolbox';
    if (stdout.includes('h264_nvenc')) return 'h264_nvenc';
    if (stdout.includes('h264_qsv')) return 'h264_qsv';
    if (stdout.includes('h264_amf')) return 'h264_amf';
  } catch (e) {
    console.warn('   [WARNING] Gagal mendeteksi encoder hardware, menggunakan libx264 default.');
  }
  return 'libx264';
}

export async function renderVideo(adeganList, audioFile, outputFile) {
  console.log('[6/6] [INFO] Menjahit Audio dan Gambar menjadi Video MP4 (FFmpeg)...');

  try {
    let validScenes = [];
    
    // Pastikan adegan benar-benar ada (tidak di-skip karena error pexels)
    for (let i = 0; i < adeganList.length; i++) {
      const adeganPath = `workspace/temp/adegan_${i + 1}.mp4`;
      if (fs.existsSync(adeganPath)) {
        validScenes.push({ path: adeganPath, duration: adeganList[i].exactDuration ?? 5 });
      } else {
        console.warn(`   [WARNING] adegan_${i + 1}.mp4 tidak ditemukan, akan di-skip dalam proses render.`);
      }
    }
    
    if (validScenes.length === 0) {
      console.error('   [ERROR] Tidak ada satupun file video Pexels yang berhasil diunduh. Render dibatalkan.');
      return;
    }

    const encoder = await getBestEncoder();
    console.log(`   [INFO] Menggunakan Video Encoder: ${encoder} (Cross-Platform Hardware Acceleration)`);

    let ffmpegInputs = '';
    let filterComplex = '';
    let concatLabels = '';

    // 1. Build Inputs and Video Filters
    validScenes.forEach((scene, i) => {
      // stream_loop -1 ensures short videos are looped to fit the duration
      ffmpegInputs += `-stream_loop -1 -i "${path.resolve(scene.path)}" `;
      filterComplex += `[${i}:v]trim=duration=${scene.duration},setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30,format=yuv420p[v${i}];`;
      concatLabels += `[v${i}]`;
    });

    filterComplex += `${concatLabels}concat=n=${validScenes.length}:v=1:a=0[concatv];`;
    filterComplex += `[concatv]subtitles=subtitle.ass[finalv]`;

    const absAudioFile = path.resolve(audioFile);
    const absOutputFile = path.resolve(outputFile);
    
    let hasAudio = fs.existsSync(absAudioFile) && fs.statSync(absAudioFile).size > 0;
    
    let audioFilters = '';
    let inputIndex = validScenes.length;
    let mapAudio = '';

    if (hasAudio) {
      ffmpegInputs += `-i "${absAudioFile}" `;
      filterComplex += `;[${inputIndex}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[finala]`;
      mapAudio = `-map "[finala]"`;
    }

    const ffmpegCmd = `cd workspace/temp && ffmpeg -y ${ffmpegInputs} -filter_complex "${filterComplex}" -map "[finalv]" ${mapAudio} -c:v ${encoder} -preset fast -b:v 4M -c:a aac -ac 2 -b:a 128k -shortest "${absOutputFile}"`;

    console.log('   [INFO] Merender video (Single-Pass) dengan filter_complex...');
    await execPromise(ffmpegCmd);
    
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
