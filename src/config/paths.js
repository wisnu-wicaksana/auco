import path from 'path';

export const PROJECT_ROOT = process.cwd();
export const WORKSPACE_DIR = path.join(PROJECT_ROOT, 'workspace');
export const TEMP_DIR = path.join(WORKSPACE_DIR, 'temp');
export const OUTPUT_DIR = path.join(WORKSPACE_DIR, 'output');

// File paths
export const AUDIO_OUTPUT = path.join(TEMP_DIR, 'output_voice.mp3');
export const SCRIPT_OUTPUT = path.join(OUTPUT_DIR, 'script.json');
export const CAPTION_OUTPUT = path.join(OUTPUT_DIR, 'CAPTION_TIKTOK.txt');
export const FINAL_VIDEO = path.join(OUTPUT_DIR, 'FINAL_VIDEO_TIKTOK.mp4');

// Temp files
export const TEMP_LIST = path.join(TEMP_DIR, 'list.txt');
export const TEMP_VOICE_LIST = path.join(TEMP_DIR, 'voice_list.txt');
export const TEMP_SUBTITLE = path.join(TEMP_DIR, 'subtitle.ass');

export const getAdeganPath = (index) => path.join(TEMP_DIR, `adegan_${index}.mp4`);
export const getVoiceChunkPath = (index) => path.join(TEMP_DIR, `voice_chunk_${index}.mp3`);
