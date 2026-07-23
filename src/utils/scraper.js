import * as cheerio from "cheerio";

export async function scrapeArticle(url) {
  console.log(`\n[INFO] [WEB SCRAPER] Mengunjungi dan menyedot berita dari: ${url}`);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7"
      }
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const html = await response.text();
    const $ = cheerio.load(html);

    $("script, style, nav, footer, header, aside, .ad, .advertisement, .comment").remove();

    let articleText = "";
    $("p").each((i, el) => {
      const teks = $(el).text().trim();
      if (teks.length > 20) {
        articleText += teks + "\n";
      }
    });

    const cleanText = articleText.replace(/\s+/g, " ").trim();

    if (cleanText.length < 100) {
      console.warn("[WARNING] Teks yang didapat sangat pendek. Link mungkin diproteksi (diblokir dari mesin).");
    }

    console.log(`[SUCCESS] Berhasil menyedot isi artikel sebanyak ${cleanText.length} huruf!`);
    return cleanText;
  } catch (error) {
    console.error(`[ERROR] Gagal mengekstrak website. Pastikan link dapat diakses publik. (${error.message})`);
    console.warn("[WARNING] Menggunakan teks fallback otomatis...");
    return "Berita hari ini sangat menarik, sayangnya artikel asli gagal dimuat. Buatkan saja naskah acak tentang fakta unik teknologi atau fenomena alam.";
  }
}
