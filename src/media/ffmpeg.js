import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';
import * as PATHS from '../config/paths.js';

const execPromise = promisify(exec);

async function getBestEncoder() {
  try {
    const { stdout } = await execPromise('ffmpeg -encoders');
    if (stdout.includes('h264_videotoolbox')) return 'h264_videotoolbox';
    if (stdout.includes('h264_nvenc')) return 'h264_nvenc';
    if (stdout.includes('h264_qsv')) return 'h264_qsv';
    if (stdout.includes('h264_amf')) return 'h264_amf';
  } catch (e) {
    logger.warn('Gagal mendeteksi encoder hardware, menggunakan libx264 default.');
  }
  return 'libx264';
}

export async function renderVideo(adeganList, audioFile, outputFile) {
  logger.step(6, 'Menjahit Audio dan Gambar menjadi Video MP4 (FFmpeg)...');

  try {
    let validScenes = [];
    
    for (let i = 0; i < adeganList.length; i++) {
      const adeganPath = PATHS.getAdeganPath(i + 1);
      if (fs.existsSync(adeganPath)) {
        validScenes.push({ path: adeganPath, duration: adeganList[i].exactDuration ?? 5 });
      } else {
        logger.warn(`adegan_${i + 1}.mp4 tidak ditemukan, akan di-skip dalam proses render.`);
      }
    }
    
    if (validScenes.length === 0) {
      logger.error('Tidak ada satupun file video Pexels yang berhasil diunduh. Render dibatalkan.');
      return;
    }

    const encoder = await getBestEncoder();
    logger.info(`Menggunakan Video Encoder: ${encoder} (Cross-Platform Hardware Acceleration)`);

    let ffmpegInputs = '';
    let filterComplex = '';
    let concatLabels = '';

    validScenes.forEach((scene, i) => {
      ffmpegInputs += `-stream_loop -1 -i "${path.resolve(scene.path)}" `;
      filterComplex += `[${i}:v]trim=duration=${scene.duration},setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30,format=yuv420p[v${i}];`;
      concatLabels += `[v${i}]`;
    });

    filterComplex += `${concatLabels}concat=n=${validScenes.length}:v=1:a=0[concatv];`;
    filterComplex += `[concatv]subtitles=subtitle.ass[finalv]`;

    const absAudioFile = path.resolve(audioFile);
    const absOutputFile = path.resolve(outputFile);
    
    let hasAudio = fs.existsSync(absAudioFile) && fs.statSync(absAudioFile).size > 0;
    
    let inputIndex = validScenes.length;
    let mapAudio = '';

    if (hasAudio) {
      ffmpegInputs += `-i "${absAudioFile}" `;
      filterComplex += `;[${inputIndex}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[finala]`;
      mapAudio = `-map "[finala]"`;
    }

    const ffmpegCmd = `cd "${PATHS.TEMP_DIR}" && ffmpeg -y ${ffmpegInputs} -filter_complex "${filterComplex}" -map "[finalv]" ${mapAudio} -c:v ${encoder} -preset fast -b:v 4M -c:a aac -ac 2 -b:a 128k -shortest "${absOutputFile}"`;

    logger.info('Merender video (Single-Pass) dengan filter_complex...');
    await execPromise(ffmpegCmd);
    
    logger.success(`RENDER SELESAI! Video tersimpan sebagai: ${outputFile}`);
  } catch (error) {
    logger.error(`Gagal melakukan render video: ${error.message}`);
  } finally {
    logger.info('Membersihkan ruang kerja...');
    if (fs.existsSync(PATHS.TEMP_LIST)) fs.unlinkSync(PATHS.TEMP_LIST);
    if (fs.existsSync(PATHS.TEMP_SUBTITLE)) fs.unlinkSync(PATHS.TEMP_SUBTITLE);
    for (let i = 0; i < adeganList.length; i++) {
        const file = PATHS.getAdeganPath(i + 1);
        if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  }
}
