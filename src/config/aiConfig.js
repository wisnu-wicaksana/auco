import Groq from 'groq-sdk';
import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

export const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
export const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const withTimeout = (promise, ms) => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Timeout dari API (Melebihi batas waktu)')), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
};

export const safeJsonParse = (jsonString) => {
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

export const retryRequest = async (requestFn, maxRetries = 2) => {
  let attempt = 0;
  
  while (attempt <= maxRetries) {
    try {
      return await requestFn();
    } catch (error) {
      attempt++;
      
      const isRateLimit = error.status === 429;
      const isTimeout = error.name === 'AbortError' || error.message?.toLowerCase().includes('timeout');
      const isNetworkError = error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT';
      const isApiError = error.message?.toLowerCase().includes('fetch failed') || error.message?.toLowerCase().includes('internal server error') || error.message?.toLowerCase().includes('overloaded');
      
      if (isRateLimit || isTimeout || isNetworkError || isApiError) {
        if (attempt > maxRetries) {
          throw error;
        }
        
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`   [WARNING] Request gagal (Percobaan ${attempt}/${maxRetries}). Menunggu ${delay}ms sebelum mencoba lagi...`);
        console.warn(`   [INFO] Detail error: ${error.message}`);
        await sleep(delay);
      } else {
        throw error;
      }
    }
  }
};
