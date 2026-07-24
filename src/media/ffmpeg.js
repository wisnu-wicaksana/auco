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
    logger.warn('Failed to detect hardware encoder, falling back to libx264.');
  }
  return 'libx264';
}

export async function renderVideo(scenesList, audioFile, outputFile) {
  logger.step(6, 'Stitching Audio and Visuals into an MP4 Video (FFmpeg)...');

  try {
    let validScenes = [];
    
    for (let i = 0; i < scenesList.length; i++) {
      const adeganPath = PATHS.getAdeganPath(i + 1);
      if (fs.existsSync(adeganPath)) {
        validScenes.push({ path: adeganPath, duration: scenesList[i].exactDuration ?? 5 });
      } else {
        logger.warn(`Scene ${i + 1} video not found, it will be skipped in rendering.`);
      }
    }
    
    if (validScenes.length === 0) {
      logger.error('No Pexels videos were successfully downloaded. Render aborted.');
      return;
    }

    const encoder = await getBestEncoder();
    logger.info(`Using Video Encoder: ${encoder} (Cross-Platform Hardware Acceleration)`);

    let ffmpegInputs = '';
    let filterComplex = '';
    let concatLabels = '';

    validScenes.forEach((scene, i) => {
      ffmpegInputs += `-stream_loop -1 -i "${path.resolve(scene.path)}" `;
      filterComplex += `[${i}:v]fps=30,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,trim=duration=${scene.duration},setpts=PTS-STARTPTS,format=yuv420p[v${i}];`;
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

    logger.info('Rendering video (Single-Pass) using filter_complex...');
    await execPromise(ffmpegCmd);
    
    logger.success(`RENDER COMPLETE! Video saved as: ${outputFile}`);
  } catch (error) {
    logger.error(`Failed to render video: ${error.message}`);
  } finally {
    logger.info('Cleaning up workspace...');
    if (fs.existsSync(PATHS.TEMP_LIST)) fs.unlinkSync(PATHS.TEMP_LIST);
    if (fs.existsSync(PATHS.TEMP_SUBTITLE)) fs.unlinkSync(PATHS.TEMP_SUBTITLE);
    for (let i = 0; i < scenesList.length; i++) {
        const file = PATHS.getAdeganPath(i + 1);
        if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  }
}
