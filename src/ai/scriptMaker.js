import fs from 'fs/promises';
import path from 'path';
import { groq, gemini, withTimeout, safeJsonParse, retryRequest } from '../config/aiConfig.js';
import { logger } from '../utils/logger.js';
import * as PATHS from '../config/paths.js';

const saveJson = async (data, filepath) => {
  try {
    const dir = path.dirname(filepath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(data, null, 2));
    logger.success(`Naskah tersimpan di: ${filepath}`);
  } catch (error) {
    logger.error(`Gagal menyimpan file ${filepath}: ${error.message}`);
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

export async function generateScript(textArticle) {
  logger.step(1, 'Memproses naskah dengan AI (Gemini Utama, Groq Penunjang)...');

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
7. Hook (kalimat pertama adegan pertama) maksimal 12 kata, WAJIB diawali dengan frasa pembuka yang menarik seperti "Tahukah kamu...", "Pernahkah kamu membayangkan...", atau "Ternyata...".
8. Kalimat penutup (di adegan terakhir) WAJIB berupa ajakan interaktif (Call to Action) atau pertanyaan seperti "Bagaimana menurutmu?", "Coba tulis pendapatmu di komentar!", atau "Menurut kalian gimana?".
9. Keywords visual: MAKSIMAL 2 kata dalam bahasa Inggris. Kata pertama WAJIB subjek, kata kedua aksi sederhana.
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
`;

  let scriptData = null;

  try {
    logger.info('[AI-1] Mencoba generate naskah dengan Google Gemini...');
    const requestGemini = async () => {
      const response = await withTimeout(
        gemini.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.9
          }
        }), 
        30000
      );
      return typeof response.text === 'function' ? response.text() : response.text;
    };

    const responseText = await retryRequest(requestGemini, 1);
    scriptData = safeJsonParse(responseText);
    validateScript(scriptData);
    logger.success('Naskah berhasil dibuat menggunakan Gemini!');

  } catch (error) {
    logger.warn(`Gemini gagal diproses (${error.message}). Mengalihkan ke Groq (Llama 3)...`);
    
    try {
      logger.info('[AI-2] Mencoba generate naskah dengan Groq (Fallback)...');
      const requestGroq = async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        try {
          const response = await groq.chat.completions.create({
            messages: [
              { role: "system", content: "You are a helpful assistant that strictly outputs valid JSON only without markdown formatting." },
              { role: "user", content: prompt }
            ],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.7,
          }, { signal: controller.signal });
          return response.choices[0]?.message?.content || "{}";
        } finally {
          clearTimeout(timeoutId);
        }
      };

      const responseText = await retryRequest(requestGroq, 1);
      scriptData = safeJsonParse(responseText);
      validateScript(scriptData);
      logger.success('Naskah berhasil dibuat menggunakan Groq (Fallback)!');
      
    } catch (groqError) {
      logger.error('Kesalahan fatal: Kedua sistem AI (Gemini & Groq) gagal menghasilkan naskah.');
      logger.error(`Error Gemini: ${error.message}`);
      logger.error(`Error Groq: ${groqError.message}`);
      throw new Error('Semua AI gagal menghasilkan naskah.');
    }
  }

  await saveJson(scriptData, PATHS.SCRIPT_OUTPUT);
  return scriptData;
}

export async function generateCaption(narasi) {
  logger.step(5, 'AI sedang menulis Caption TikTok/Reels...');
  
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

  let caption = "";

  try {
    logger.info('[AI-1] Mencoba membuat caption dengan Google Gemini...');
    const requestGemini = async () => {
      const response = await withTimeout(
        gemini.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: prompt,
          config: {
            temperature: 0.9
          }
        }), 
        20000
      );
      return typeof response.text === 'function' ? response.text() : response.text;
    };

    caption = await retryRequest(requestGemini, 1);
    logger.success('Caption berhasil dibuat menggunakan Gemini!');

  } catch (error) {
    logger.warn(`Gemini gagal membuat caption (${error.message}). Mengalihkan ke Groq...`);
    
    try {
      logger.info('[AI-2] Mencoba membuat caption dengan Groq (Fallback)...');
      const requestGroq = async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        try {
          const response = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.9,
          }, { signal: controller.signal });
          return response.choices[0]?.message?.content || "";
        } finally {
          clearTimeout(timeoutId);
        }
      };

      caption = await retryRequest(requestGroq, 1);
      logger.success('Caption berhasil dibuat menggunakan Groq (Fallback)!');
      
    } catch (groqError) {
      logger.error(`Kedua AI gagal membuat caption: ${groqError.message}`);
      logger.warn('Menggunakan caption default sebagai fallback.');
      caption = "Tonton video ini sampai habis ya! Gimana pendapat kalian? 👇 #video #faktaunik";
    }
  }

  await fs.mkdir(path.dirname(PATHS.CAPTION_OUTPUT), { recursive: true });
  await fs.writeFile(PATHS.CAPTION_OUTPUT, caption);
  
  logger.blank('\n----------------------------------\n' + caption + '\n----------------------------------\n');
  logger.success(`Caption tersimpan di: ${PATHS.CAPTION_OUTPUT}`);
  
  return caption;
}
