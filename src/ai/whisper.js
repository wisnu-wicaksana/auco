import Groq from 'groq-sdk';
import fs from 'fs';
import 'dotenv/config';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function generateSubtitle(audioFile) {
  console.log('[6/6] Whisper AI sedang menyalin audio menjadi Subtitle (.ass)...');
  
  try {
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(audioFile),
      model: "whisper-large-v3",
      response_format: "verbose_json",
      language: "id" // Paksa bahasa Indonesia
    });

    let assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial Black,70,&H0000FFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,8,4,2,10,10,250,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
    
    if (transcription.segments) {
      transcription.segments.forEach((segment) => {
        const words = segment.text.trim().split(' ');
        const duration = segment.end - segment.start;
        const timePerWord = duration / (words.length || 1);
        
        for (let i = 0; i < words.length; i += 2) {
          const chunkWords = words.slice(i, i + 2).join(' ');
          const chunkStart = segment.start + (i * timePerWord);
          const chunkEnd = chunkStart + (timePerWord * 2);
          
          const formatTimeASS = (seconds) => {
            const date = new Date(seconds * 1000);
            const h = Math.floor(seconds / 3600);
            const m = String(date.getUTCMinutes()).padStart(2, '0');
            const s = String(date.getUTCSeconds()).padStart(2, '0');
            const cs = String(Math.floor(date.getUTCMilliseconds() / 10)).padStart(2, '0');
            return `${h}:${m}:${s}.${cs}`;
          };

          const startTimeASS = formatTimeASS(chunkStart);
          const endTimeASS = formatTimeASS(Math.min(chunkEnd, segment.end)); 
          
          const colors = [ '&H00FFFFFF'];
          const randomColor = colors[Math.floor(Math.random() * colors.length)];
          
          assContent += `Dialogue: 0,${startTimeASS},${endTimeASS},Default,,0,0,0,,{\\c${randomColor}}${chunkWords}\n`;
        }
      });
    } else {
      assContent += `Dialogue: 0,0:00:00.00,0:00:10.00,Default,,0,0,0,,${transcription.text || ''}\n`;
    }

    fs.writeFileSync('workspace/temp/subtitle.ass', assContent);
    console.log('   [OK] Subtitle tersimpan di: workspace/temp/subtitle.ass');
  } catch (error) {
    console.error('   [ERROR] Gagal membuat subtitle:', error);
  }
}
