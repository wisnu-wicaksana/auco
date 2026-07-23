import * as cheerio from "cheerio";

export async function scrapeArticle(url) {
  console.log(
    `\n[WEB SCRAPER] Mengunjungi dan menyedot berita dari: ${url}`,
  );
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const html = await response.text();
    const $ = cheerio.load(html);

    // Buang tag/elemen pengganggu (iklan, tombol navigasi, komentar)
    $(
      "script, style, nav, footer, header, aside, .ad, .advertisement, .comment",
    ).remove();

    let articleText = "";

    // Membaca paragraf-paragraf utama pada artikel
    $("p").each((i, el) => {
      const teks = $(el).text().trim();
      // Hanya ambil paragraf yang cukup panjang (mengabaikan teks pendek seperti "baca juga")
      if (teks.length > 20) {
        articleText += teks + "\n";
      }
    });

    // Pembersihan karakter aneh dan spasi berlebih
    const cleanText = articleText.replace(/\s+/g, " ").trim();

    if (cleanText.length < 100) {
      console.warn(
        "[PERINGATAN] Teks yang didapat sangat pendek. Link mungkin diproteksi (diblokir dari mesin).",
      );
    }

    console.log(
      `[OK] Berhasil menyedot isi artikel sebanyak ${cleanText.length} huruf!`,
    );
    return cleanText;
  } catch (error) {
    console.error(
      "[ERROR] Gagal mengekstrak website. Pastikan link dapat diakses publik.",
      error,
    );
    throw error; // Berhenti jika gagal
  }
}
