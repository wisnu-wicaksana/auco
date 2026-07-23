import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
const execPromise = promisify(exec);

export async function generatePexelsVideos(adeganList, fallbackKeywords = ["nature", "cinematic"]) {
  console.log('[3/3] Mengunduh aset video B-Roll (Pexels) untuk setiap adegan...');
  const pexelsKey = process.env.PEXELS_API_KEY;
  if (!pexelsKey) throw new Error("PEXELS_API_KEY belum diisi di .env");
  
  let usedVideoIds = []; // Mencegah video yang sama dipakai dua kali

  for (let i = 0; i < adeganList.length; i++) {
    const scene = adeganList[i];
    // DURASI SUPER AKURAT (Dalam hitungan Milidetik, tanpa dibulatkan atau ditambah)
    let durasi = scene.exactDuration || 5.0;

    let query = scene.keywords_visual.split(',')[0].trim();
    
    // AUTO-RETRY LOGIC PEXELS PINTAR & DINAMIS
    let searchQueries = [
      query,
      query.split(' ')[0], // Coba kata pertamanya saja (lebih umum)
      fallbackKeywords[0], // Fallback dinamis 1 (Sesuai tema artikel)
      fallbackKeywords[1]  // Fallback dinamis 2 (Sesuai tema artikel)
    ];

    let foundVideo = null;

    for (let q of searchQueries) {
      if (!q) continue;
      const encodedQuery = encodeURIComponent(q);
      const apiUrl = `https://api.pexels.com/videos/search?query=${encodedQuery}&per_page=15&orientation=portrait`;
      
      console.log(`   -> Mencari video Pexels adegan ${i + 1}: [${q}] ...`);
      try {
        const response = await fetch(apiUrl, { headers: { Authorization: pexelsKey } });
        const data = await response.json();
        if (data.videos && data.videos.length > 0) {
            let unusedVideos = data.videos.filter(v => !usedVideoIds.includes(v.id) && v.duration >= durasi);
            if (unusedVideos.length === 0) unusedVideos = data.videos.filter(v => !usedVideoIds.includes(v.id));
            if (unusedVideos.length === 0) unusedVideos = data.videos;
            
            const randomVideoIndex = Math.floor(Math.random() * unusedVideos.length);                                                                                                                                                                 
            foundVideo = unusedVideos[randomVideoIndex];
            break; // Jika ketemu, hentikan loop pencarian (tidak perlu fallback)
        }
      } catch (e) {
          console.error(`   [WARNING] Gagal menarik data Pexels untuk [${q}]`);
      }
    }

    if (foundVideo) {
        usedVideoIds.push(foundVideo.id);
        let videoFile = foundVideo.video_files.find(v => v.quality === 'hd') || foundVideo.video_files[0];
        const videoUrl = videoFile.link; 

        console.log(`   -> Mengunduh video Pexels untuk adegan ${i + 1}...`);
        const vidResponse = await fetch(videoUrl);
        const arrayBuffer = await vidResponse.arrayBuffer();
        
        // Taruh di folder temp
        const rawFilename = `workspace/temp/raw_adegan_${i + 1}.mp4`;
        fs.writeFileSync(rawFilename, Buffer.from(arrayBuffer));

        console.log(`   -> Menyeragamkan resolusi video adegan ${i + 1} tepat ${durasi} detik...`);
        const finalFilename = `workspace/temp/adegan_${i + 1}.mp4`;
        const formatCmd = `ffmpeg -y -stream_loop -1 -i ${rawFilename} -t ${durasi} -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30,eq=contrast=1.15:saturation=1.2:brightness=-0.02" -c:v libx264 -an ${finalFilename}`;
        await execPromise(formatCmd);
        
        if (fs.existsSync(rawFilename)) fs.unlinkSync(rawFilename); // Hapus raw file
        console.log(`   [OK] Tersimpan dan diformat: ${finalFilename}`);
    } else {
        console.log(`   [ERROR] Seluruh pencarian dan fallback gagal. Video tidak ditemukan.`);
    }
  }
}
