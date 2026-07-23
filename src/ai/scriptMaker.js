import Groq from 'groq-sdk';
import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ==========================================
// HELPERS
// ==========================================

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const safeJsonParse = (jsonString) => {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('\n[ERROR] Gagal memparsing JSON dari response AI.');
    console.error('[INFO] Response mentah:');
    console.error(jsonString);
    console.error('\n[ERROR] Penyebab:', error.message);
    throw new Error('Format JSON dari AI tidak valid.');
  }
};

const saveJson = async (data, filepath) => {
  try {
    const dir = path.dirname(filepath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(data, null, 2));
    console.log(`[SUCCESS] Naskah tersimpan di: ${filepath}`);
  } catch (error) {
    console.error(`[ERROR] Gagal menyimpan file ${filepath}:`, error.message);
  }
};

const validateScript = (data) => {
  const requiredKeys = ['title', 'hook', 'narasi_lengkap', 'fallback_keywords', 'adegan'];
  for (const key of requiredKeys) {
    if (!data[key]) {
      throw new Error(`Validasi gagal: Key "${key}" tidak ditemukan dalam JSON.`);
    }
  }
  
  if (!Array.isArray(data.adegan) || data.adegan.length === 0) {
    throw new Error('Validasi gagal: "adegan" harus berupa array dan tidak boleh kosong.');
  }
  
  return true;
};

const retryRequest = async (requestFn, maxRetries = 3) => {
  let attempt = 0;
  
  while (attempt <= maxRetries) {
    try {
      return await requestFn();
    } catch (error) {
      attempt++;
      
      const isRateLimit = error.status === 429;
      const isTimeout = error.name === 'AbortError' || error.message.toLowerCase().includes('timeout');
      const isNetworkError = error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT';
      
      if (isRateLimit || isTimeout || isNetworkError) {
        if (attempt > maxRetries) {
          console.error(`[ERROR] Maksimal retry (${maxRetries}x) tercapai. Proses dihentikan.`);
          throw error;
        }
        
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
        console.warn(`[WARNING] Request gagal (Percobaan ${attempt}/${maxRetries}). Menunggu ${delay}ms sebelum mencoba lagi...`);
        console.warn(`[INFO] Detail error: ${error.message}`);
        await sleep(delay);
      } else {
        // Jangan retry untuk error selain 429, timeout, atau network error
        throw error;
      }
    }
  }
};

// ==========================================
// CORE FUNCTIONS
// ==========================================

export async function generateScript(textArticle) {
  console.log('[1/6] [INFO] Memproses naskah dengan Groq Llama 3 API...');

  const prompt = `
Ubah artikel berikut menjadi naskah video pendek TikTok/Reels.

Artikel:
${textArticle}

ATURAN WAJIB:
1. Output HARUS murni format JSON valid.
2. Tidak boleh menggunakan markdown (seperti \`\`\`json).
3. Tidak boleh ada penjelasan atau teks sebelum/sesudah JSON.
4. Tidak boleh ada komentar di dalam JSON.
5. Total narasi maksimal 150 kata.
6. Setiap adegan maksimal 25 kata.
7. Hook (kalimat pertama) maksimal 12 kata, memancing rasa penasaran tinggi, cepat, dan pacing ala TikTok.
8. Keywords visual: MAKSIMAL 2 kata dalam bahasa Inggris. Kata pertama WAJIB subjek, kata kedua aksi sederhana.
   CONTOH VALID: "lion", "lion walking", "dog running", "woman reading", "chef cooking".
   CONTOH TIDAK VALID: "lion in africa", "lion with sunset", "lion hunting zebra", "woman reading newspaper indoors".

STRUKTUR JSON YANG DIHARAPKAN:
{
  "title": "Judul singkat untuk file",
  "hook": "Teks hook (maks 12 kata)",
  "narasi_lengkap": "Seluruh narasi disatukan di sini (maks 150 kata)",
  "estimated_duration": 60,
  "thumbnail_prompt": "Prompt untuk membuat thumbnail",
  "fallback_keywords": [
    "nature",
    "animals"
  ],
  "adegan": [
    {
      "detik": "0-6",
      "duration": 6,
      "narasi": "Teks narasi adegan 1",
      "keywords_visual": "lion walking"
    }
  ]
}

CONTOH JSON YANG BENAR:
{
  "title": "Misteri Laut Dalam",
  "hook": "Tahukah kamu apa yang bersembunyi di laut dalam?",
  "narasi_lengkap": "Tahukah kamu apa yang bersembunyi di laut dalam? Lebih dari delapan puluh persen lautan bumi masih belum terpetakan. Makhluk bercahaya aneh dan gurita raksasa hidup dalam kegelapan abadi ini. Tekanannya sangat ekstrem hingga bisa menghancurkan kapal selam. Namun, kehidupan justru berkembang biak di sana. Siapa tahu monster apa lagi yang menanti di bawah sana?",
  "estimated_duration": 30,
  "thumbnail_prompt": "Scary giant glowing octopus in dark deep ocean",
  "fallback_keywords": [
    "ocean",
    "underwater"
  ],
  "adegan": [
    {
      "detik": "0-5",
      "duration": 5,
      "narasi": "Tahukah kamu apa yang bersembunyi di laut dalam?",
      "keywords_visual": "dark ocean"
    },
    {
      "detik": "5-12",
      "duration": 7,
      "narasi": "Lebih dari delapan puluh persen lautan bumi masih belum terpetakan.",
      "keywords_visual": "map glowing"
    },
    {
      "detik": "12-20",
      "duration": 8,
      "narasi": "Makhluk bercahaya aneh dan gurita raksasa hidup dalam kegelapan abadi ini.",
      "keywords_visual": "octopus swimming"
    }
  ]
}
`;

  try {
    const requestFn = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 detik timeout

      try {
        const response = await groq.chat.completions.create({
          messages: [
            { role: "system", content: "You are a helpful assistant that strictly outputs valid JSON only without markdown formatting." },
            { role: "user", content: prompt }
          ],
          model: 'llama-3.3-70b-versatile',
          temperature: 0.7,
        }, { signal: controller.signal });
        
        return response;
      } finally {
        clearTimeout(timeoutId);
      }
    };

    const response = await retryRequest(requestFn, 3);
    const cleanJsonText = response.choices[0]?.message?.content || "{}";
    
    const scriptData = safeJsonParse(cleanJsonText);
    
    console.log('[INFO] Memvalidasi struktur JSON naskah...');
    validateScript(scriptData);
    
    await saveJson(scriptData, 'workspace/output/script.json');
    console.log('[SUCCESS] Naskah berhasil dibuat dan divalidasi!');
    
    return scriptData;
  } catch (error) {
    console.error('\n[ERROR] Terjadi kesalahan fatal pada generateScript:', error.message);
    throw error;
  }
}

export async function generateCaption(narasi) {
  console.log('[5/6] [INFO] Groq sedang menulis Caption TikTok/Reels...');
  
  const prompt = `
Saya punya video dengan narasi berikut: "${narasi}".

Tolong buatkan caption TikTok.
ATURAN:
- Maksimal 2 kalimat.
- Gunakan bahasa Indonesia santai (gaul) yang memancing komentar.
- Harus ada 1 pertanyaan di akhir kalimat.
- Jangan terlalu banyak emoji (maksimal 2).
- Sertakan 3-5 hashtag yang relevan di akhir.
`;

  try {
    const requestFn = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      try {
        const response = await groq.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model: 'llama-3.3-70b-versatile',
          temperature: 0.9,
        }, { signal: controller.signal });
        
        return response;
      } finally {
        clearTimeout(timeoutId);
      }
    };

    const response = await retryRequest(requestFn, 3);
    const caption = response.choices[0]?.message?.content || "";
    
    const captionPath = 'workspace/output/CAPTION_TIKTOK.txt';
    await fs.mkdir(path.dirname(captionPath), { recursive: true });
    await fs.writeFile(captionPath, caption);
    
    console.log('\n[INFO] Hasil Caption TikTok/Reels:\n----------------------------------\n' + caption + '\n----------------------------------\n');
    console.log(`[SUCCESS] Caption tersimpan di: ${captionPath}`);
    
    return caption;
  } catch (error) {
    console.error('\n[ERROR] Terjadi kesalahan saat membuat caption:', error.message);
    console.warn('[WARNING] Menggunakan caption default sebagai fallback.');
    return "Tonton video ini sampai habis ya! Gimana pendapat kalian? 👇 #video #faktaunik";
  }
}
