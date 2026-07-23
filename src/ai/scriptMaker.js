import Groq from 'groq-sdk';
import 'dotenv/config';
import fs from 'fs';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function generateScript(textArticle) {
  console.log('[1/3] Memproses naskah dengan Groq Llama 3 API (Pengganti Gemini)...');

  const prompt = `
Ubah artikel berikut menjadi naskah video pendek TikTok/Reels.

Artikel:
${textArticle}

PENTING: Kembalikan jawaban HANYA dalam format JSON valid tanpa format markdown (seperti \`\`\`json), dengan struktur persis seperti ini:
{
"hook": "Kalimat pertama yang ekstrem, provokatif, dan memicu rasa penasaran level dewa di 3 detik awal.",
"narasi_lengkap": "Gabungan seluruh kalimat narasi dari awal sampai akhir yang akan dibaca oleh voiceover",
"fallback_keywords": ["kata1", "kata2"], // Berikan 2 kata benda bahasa Inggris super UMUM yang mewakili TEMA UTAMA artikel ini. (Misal artikel tentang Nyamuk -> ["insects", "nature"]. Jika tentang Luar angkasa -> ["space", "universe"]. Jika tentang Uang -> ["money", "finance"]).
"adegan": [
  {
    "detik": "0-7",
    "narasi": "teks narasi adegan 1",
    "keywords_visual": "HANYA 1 ATAU 2 KATA BAHASA INGGRIS (Subjek Utama + Aksi Sederhana). Pexels bodoh dan akan memberi video ngawur jika terlalu spesifik! SELALU cantumkan nama subjek utamanya. Contoh BENAR: 'leopard', 'leopard walking', 'lion sleeping'. Contoh SALAH: 'lion sound wave', 'leopard climbing tree'. Semakin sederhana, semakin akurat videonya!"
  }
]
}
`;  

  const response = await groq.chat.completions.create({
    messages: [
      { role: "system", content: "You are a helpful assistant that strictly outputs valid JSON." },
      { role: "user", content: prompt }
    ],
    model: 'llama-3.3-70b-versatile',
    response_format: { type: "json_object" }
  });

  const cleanJsonText = response.choices[0]?.message?.content || "{}";
  return JSON.parse(cleanJsonText);
}

export async function generateCaption(narasi) {
  console.log('[5/6] Groq (Llama 3) sedang menulis Caption TikTok/Reels...');
  
  const prompt = `
Saya punya video dengan narasi berikut: "${narasi}".
Buatkan caption TikTok yang sangat mengundang interaksi (engagement), gunakan bahasa gaul Indonesia, dan sertakan 3-5 hashtag yang relevan. Jangan terlalu panjang.
`;

  const chatCompletion = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'llama-3.3-70b-versatile',
  });

  const caption = chatCompletion.choices[0]?.message?.content || "";
  fs.writeFileSync('workspace/output/CAPTION_TIKTOK.txt', caption);
  console.log('\n[INFO] Hasil Caption TikTok/Reels:\n----------------------------------\n' + caption + '\n----------------------------------\n');
  console.log('   [OK] Caption tersimpan di: workspace/output/CAPTION_TIKTOK.txt');
}
