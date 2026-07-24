import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';
import * as PATHS from '../config/paths.js';

const execPromise = promisify(exec);
const MAX_CONCURRENT = 3;

async function fetchWithTimeout(url, options = {}, timeout = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function findBestVideo(searchQueries, minDuration, pexelsKey, usedVideoIds) {
  for (const q of searchQueries) {
    if (!q) continue;
    logger.info(`Searching video for: ${q}`);
    try {
      const apiUrl = `https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&per_page=20&orientation=portrait`;
      const response = await fetchWithTimeout(apiUrl, { headers: { Authorization: pexelsKey } });
      if (!response.ok) continue;

      const data = await response.json();
      if (!data.videos?.length) continue;

      const candidates = data.videos
        .filter(v => !usedVideoIds.has(v.id))
        .sort((a, b) => Math.abs(a.duration - minDuration) - Math.abs(b.duration - minDuration));

      if (candidates.length > 0) return candidates[0];
    } catch (err) {
      logger.warn(`Search failed for: ${q} (${err.message})`);
    }
  }
  return null;
}

async function findBestImage(searchQueries, pexelsKey) {
  for (const q of searchQueries) {
    if (!q) continue;
    logger.info(`Searching fallback image for: ${q}`);
    try {
      const apiUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=10&orientation=portrait`;
      const response = await fetchWithTimeout(apiUrl, { headers: { Authorization: pexelsKey } });
      if (!response.ok) continue;

      const data = await response.json();
      if (!data.photos?.length) continue;
      
      return data.photos[0];
    } catch (err) {
      logger.warn(`Image search failed for: ${q} (${err.message})`);
    }
  }
  return null;
}

async function downloadFile(url, filepath) {
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(filepath, buffer);
}

async function processScene(scene, index, fallbackKeywords, pexelsKey, usedVideoIds) {
  try {
    const duration = Number(scene.exactDuration ?? 5);
    const baseQuery = scene.visual_keywords?.split(',')[0]?.trim()?.toLowerCase();
    const searchQueries = [...new Set([baseQuery, baseQuery?.split(' ').slice(0, 2).join(' '), ...fallbackKeywords].filter(Boolean))];

    const video = await findBestVideo(searchQueries, duration, pexelsKey, usedVideoIds);
    let isImageFallback = false;
    let fileUrl = '';

    if (video) {
      usedVideoIds.add(video.id);
      const videoFile = video.video_files.find(v => v.quality === 'hd') ?? video.video_files.find(v => v.width >= 1080) ?? video.video_files[0];
      fileUrl = videoFile.link;
    } else {
      logger.warn(`Scene ${index + 1}: Pexels video not found. Attempting to fallback to high-quality Image with Ken Burns effect...`);
      const image = await findBestImage(searchQueries, pexelsKey);
      if (image) {
        isImageFallback = true;
        fileUrl = image.src.large2x || image.src.large || image.src.original;
      } else {
        logger.error(`Scene ${index + 1}: No video AND no image found on Pexels. Skipping.`);
        return null;
      }
    }

    const finalPath = PATHS.getAdeganPath(index + 1);

    if (!isImageFallback) {
      logger.info(`Downloading video for scene ${index + 1}...`);
      await downloadFile(fileUrl, finalPath);
    } else {
      logger.info(`Downloading image for scene ${index + 1} and applying Ken Burns effect...`);
      const tempImagePath = finalPath.replace('.mp4', '.jpg');
      await downloadFile(fileUrl, tempImagePath);
      
      const kenBurnsCmd = `ffmpeg -y -loop 1 -framerate 30 -i "${tempImagePath}" -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0015,1.5)':d=700:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':fps=30" -c:v libx264 -t ${Math.ceil(duration) + 1} -pix_fmt yuv420p "${finalPath}"`;
      
      try {
        await execPromise(kenBurnsCmd);
      } catch (err) {
        logger.error(`Failed to apply Ken Burns effect for scene ${index + 1}: ${err.message}`);
        return null;
      } finally {
        await fs.unlink(tempImagePath).catch(() => {});
      }
    }

    logger.info(`Verifying integrity of scene ${index + 1}...`);
    try {
      const { stdout } = await execPromise(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${finalPath}"`);
      const detectedDuration = parseFloat(stdout);
      if (isNaN(detectedDuration) || detectedDuration < 0.5) {
        throw new Error("File corrupted or too short.");
      }
    } catch (err) {
      logger.error(`Scene ${index + 1} is corrupted (${err.message}). Deleting file...`);
      await fs.unlink(finalPath).catch(() => {});
      return null;
    }

    logger.success(`Scene ${index + 1} ready and verified: ${finalPath}`);
    return finalPath;
  } catch (error) {
    logger.error(`Failed to process scene ${index + 1}: ${error.message}`);
    return null;
  }
}

export async function generatePexelsVideos(scenesList, fallbackKeywords = ['nature', 'cinematic']) {
  logger.step(3, 'Downloading B-Roll video assets (Pexels)...');
  const pexelsKey = process.env.PEXELS_API_KEY;

  if (!pexelsKey) {
    logger.error('PEXELS_API_KEY is missing. Skipping Pexels download.');
    return [];
  }

  await fs.mkdir(PATHS.TEMP_DIR, { recursive: true });
  const usedVideoIds = new Set();
  const results = [];

  for (let i = 0; i < scenesList.length; i += MAX_CONCURRENT) {
    const batch = scenesList.slice(i, i + MAX_CONCURRENT);
    const batchResults = await Promise.all(
      batch.map((scene, idx) => processScene(scene, i + idx, fallbackKeywords, pexelsKey, usedVideoIds))
    );
    results.push(...batchResults);
  }

  return results.filter(Boolean);
}