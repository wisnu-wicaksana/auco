import { generateScript, generateCaption } from './src/ai/scriptMaker.js';
import { generateVoiceover } from './src/tts/edgeTTS.js';
import { generatePexelsVideos } from './src/media/pexels.js';
import { generateSubtitle } from './src/ai/whisper.js';
import { renderVideo } from './src/media/ffmpeg.js';
import { scrapeArticle } from './src/utils/scraper.js';
import { logger } from './src/utils/logger.js';
import * as PATHS from './src/config/paths.js';
import readline from 'readline';
import fs from 'fs';

function setupGracefulShutdown() {
  const cleanup = () => {
    logger.blank('\n');
    logger.warn('Received cancellation signal (Ctrl+C). Cleaning up temporary files...');
    try {
      if (fs.existsSync(PATHS.TEMP_DIR)) {
        fs.rmSync(PATHS.TEMP_DIR, { recursive: true, force: true });
        logger.success('Cleanup complete. Goodbye!');
      }
    } catch (err) {
      logger.error(`Failed to clean up temp folder: ${err.message}`);
    }
    process.exit(1);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

async function askQuestion(query, multiline = false) {
  return new Promise(resolve => {
    if (!multiline) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question(query, ans => {
        rl.close();
        resolve(ans);
      });
      return;
    }

    process.stdout.write(query + '\n(You can paste long text. Press ENTER twice on a blank line to finish)\n> ');
    let input = '';
    let emptyLines = 0;
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    
    rl.on('line', (line) => {
      if (line.trim() === '') {
        emptyLines++;
        if (emptyLines >= 2) {
          rl.close();
          resolve(input.trim());
          return;
        }
      } else {
        emptyLines = 0;
      }
      input += line + '\n';
    });
  });
}

async function main() {
  setupGracefulShutdown();
  try {
    let rawInput = process.argv.slice(2).join(' ');

    if (!rawInput) {
      logger.blank('\n=========================================');
      logger.blank(' AUCO - Auto Content ');
      logger.blank('=========================================\n');
      rawInput = await askQuestion('What topic do you want to create a video about today? (Type a topic or paste a News Link): ', true);
    }

    let finalArticle = rawInput.trim();
    if (!finalArticle) {
        logger.error('\nYou did not provide any topic or link. Process aborted.');
        return;
    }

    if (finalArticle.startsWith('http://') || finalArticle.startsWith('https://')) {
        finalArticle = await scrapeArticle(finalArticle);
    }

    const scriptData = await generateScript(finalArticle);
    const targetLanguage = scriptData.language || 'English';
    logger.info(`Detected Language: ${targetLanguage}`);

    const captionPromise = generateCaption(scriptData.full_narration, targetLanguage);

    await generateVoiceover(scriptData.scenes, PATHS.AUDIO_OUTPUT, targetLanguage);

    const pexelsPromise = generatePexelsVideos(scriptData.scenes, scriptData.fallback_keywords);
    const subtitlePromise = generateSubtitle(PATHS.AUDIO_OUTPUT);
    
    await Promise.all([pexelsPromise, subtitlePromise, captionPromise]);

    await renderVideo(scriptData.scenes, PATHS.AUDIO_OUTPUT, PATHS.FINAL_VIDEO);

    logger.blank('\n[SUCCESS] Process Completed! Script, Voiceover, Visuals, and Subtitles generated successfully!');
    logger.blank(`[INFO] Please check your result here: ${PATHS.FINAL_VIDEO}\n`);
  } catch (error) {
    logger.error(`\nProgram Terminated due to Fatal Error: ${error.message}`);
  }
}

main();