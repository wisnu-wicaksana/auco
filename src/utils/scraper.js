import * as cheerio from "cheerio";
import { logger } from "./logger.js";

export async function scrapeArticle(url) {
  logger.blank(`\n[INFO] [WEB SCRAPER] Visiting and extracting content from: ${url}`);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
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
      logger.warn("Extracted text is very short. The link might be bot-protected.");
    }

    logger.success(`Successfully extracted article content (${cleanText.length} characters)!`);
    return cleanText;
  } catch (error) {
    logger.error(`Failed to extract website. Ensure the link is publicly accessible. (${error.message})`);
    logger.warn("Using automatic fallback text...");
    return "Today's news is very interesting, unfortunately the original article failed to load. Please generate a random script about unique tech facts or natural phenomena.";
  }
}
