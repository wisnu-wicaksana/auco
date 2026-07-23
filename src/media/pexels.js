import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const TEMP_DIR = 'workspace/temp';
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
    console.log(`   [INFO] Mencari video untuk: ${q}`);
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
      console.warn(`   [WARNING] Gagal melakukan pencarian untuk: ${q} (${err.message})`);
    }
  }
  return null;
}

async function downloadFile(url, filepath) {
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`Download gagal: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(filepath, buffer);
}

async function formatVideo(input, output, duration) {
  const args = [
    '-y', '-stream_loop', '-1', '-i', input, '-t', String(duration),
    '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30,eq=contrast=1.12:saturation=1.15:brightness=-0.01',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-pix_fmt', 'yuv420p', '-an', output
  ];
  await execFileAsync('ffmpeg', args);
}

async function processScene(scene, index, fallbackKeywords, pexelsKey, usedVideoIds) {
  try {
    const duration = Number(scene.exactDuration ?? 5);
    const baseQuery = scene.keywords_visual?.split(',')[0]?.trim()?.toLowerCase();
    const searchQueries = [...new Set([baseQuery, baseQuery?.split(' ').slice(0, 2).join(' '), ...fallbackKeywords].filter(Boolean))];

    const video = await findBestVideo(searchQueries, duration, pexelsKey, usedVideoIds);

    if (!video) {
      console.warn(`   [WARNING] Adegan ${index + 1}: video Pexels tidak ditemukan. Akan dilewati.`);
      return null;
    }

    usedVideoIds.add(video.id);

    const videoFile = video.video_files.find(v => v.quality === 'hd') ?? video.video_files.find(v => v.width >= 1080) ?? video.video_files[0];
    const rawPath = path.join(TEMP_DIR, `raw_adegan_${index + 1}.mp4`);
    const finalPath = path.join(TEMP_DIR, `adegan_${index + 1}.mp4`);

    console.log(`   [INFO] Mengunduh adegan ${index + 1}...`);
    await downloadFile(videoFile.link, rawPath);

    console.log(`   [INFO] Memformat adegan ${index + 1} dengan FFmpeg...`);
    await formatVideo(rawPath, finalPath, duration);

    await fs.unlink(rawPath).catch(() => {});
    console.log(`   [SUCCESS] Adegan ${index + 1} siap: ${finalPath}`);
    return finalPath;
  } catch (error) {
    console.error(`   [ERROR] Gagal memproses adegan ${index + 1}:`, error.message);
    return null;
  }
}

export async function generatePexelsVideos(adeganList, fallbackKeywords = ['nature', 'cinematic']) {
  console.log('[3/6] [INFO] Mengunduh aset video B-Roll (Pexels)...');
  const pexelsKey = process.env.PEXELS_API_KEY;

  if (!pexelsKey) {
    console.error('[ERROR] PEXELS_API_KEY belum diisi. Melewati pengunduhan Pexels.');
    return [];
  }

  await fs.mkdir(TEMP_DIR, { recursive: true });
  const usedVideoIds = new Set();
  const results = [];

  for (let i = 0; i < adeganList.length; i += MAX_CONCURRENT) {
    const batch = adeganList.slice(i, i + MAX_CONCURRENT);
    const batchResults = await Promise.all(
      batch.map((scene, idx) => processScene(scene, i + idx, fallbackKeywords, pexelsKey, usedVideoIds))
    );
    results.push(...batchResults);
  }

  return results.filter(Boolean);
}