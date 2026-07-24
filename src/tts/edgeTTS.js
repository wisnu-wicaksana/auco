import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createRequire } from 'module';
import { logger } from '../utils/logger.js';
import * as PATHS from '../config/paths.js';

const require = createRequire(import.meta.url);
const { EdgeTTS } = require('node-edge-tts');

const execPromise = promisify(exec);

export async function generateVoiceover(scenesList, outputFile) {
  logger.step(2, 'Converting script into voiceover (Edge-TTS)...');

  fs.mkdirSync(PATHS.TEMP_DIR, { recursive: true });

  const promises = scenesList.map(async (scene, i) => {
    const chunkText = scene.narration.trim();
    if (!chunkText) return null;

    const chunkFile = PATHS.getVoiceChunkPath(i);
    const tts = new EdgeTTS({
      voice: 'en-US-ChristopherNeural',
      lang: 'en-US',
      outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
      rate: '+15%',
      pitch: '+5Hz'
    });

    logger.info(`Voicing scene ${i + 1}/${scenesList.length}...`);
    try {
      await tts.ttsPromise(chunkText, chunkFile);
      
      const { stdout } = await execPromise(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${chunkFile}"`);
      scene.exactDuration = parseFloat(stdout);

      return `file 'voice_chunk_${i}.mp3'\n`;
    } catch (e) {
      logger.warn(`Failed to voice scene ${i + 1}. Using fallback duration of 3 seconds. (${e.message})`);
      scene.exactDuration = 3;
      return null;
    }
  });

  const results = await Promise.all(promises);
  const listContent = results.filter(Boolean).join('');

  if (!listContent) {
    logger.error('All audio generation failed. The video might not have a voiceover.');
    fs.writeFileSync(outputFile, '');
    return;
  }

  fs.writeFileSync(PATHS.TEMP_VOICE_LIST, listContent);
  
  logger.info(`Merging voice chunks into a single file...`);
  try {
    await execPromise(`cd "${PATHS.TEMP_DIR}" && ffmpeg -y -f concat -safe 0 -i voice_list.txt -c copy "${outputFile}"`);
    logger.success(`Complete voiceover saved to: ${outputFile}`);
  } catch (error) {
    logger.error(`Failed to merge audio: ${error.message}`);
  } finally {
    if (fs.existsSync(PATHS.TEMP_VOICE_LIST)) fs.unlinkSync(PATHS.TEMP_VOICE_LIST);
    for (let i = 0; i < scenesList.length; i++) {
      const chunkPath = PATHS.getVoiceChunkPath(i);
      if (fs.existsSync(chunkPath)) fs.unlinkSync(chunkPath);
    }
  }
}
