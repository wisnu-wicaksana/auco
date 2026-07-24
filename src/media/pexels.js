import fs from 'fs/promises';
import { logger } from '../utils/logger.js';
import * as PATHS from '../config/paths.js';

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

    if (!video) {
      logger.warn(`Scene ${index + 1}: Pexels video not found. Skipping.`);
      return null;
    }

    usedVideoIds.add(video.id);

    const videoFile = video.video_files.find(v => v.quality === 'hd') ?? video.video_files.find(v => v.width >= 1080) ?? video.video_files[0];
    const finalPath = PATHS.getAdeganPath(index + 1);

    logger.info(`Downloading scene ${index + 1}...`);
    await downloadFile(videoFile.link, finalPath);

    logger.success(`Scene ${index + 1} ready: ${finalPath}`);
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