# AUCO - Auto Content Creator

AUCO is an intelligent, highly resilient Command Line Interface (CLI) application designed to fully automate the process of generating short-form video content (TikTok, Instagram Reels, YouTube Shorts) from a simple text prompt or a news article URL.

AUCO orchestrates multiple artificial intelligence and media processing systems to handle scriptwriting, localized text-to-speech, dynamic B-Roll sourcing, and hardware-accelerated rendering.

## Enterprise-Grade Features

- Zero-Latency Auto-Language Detection: Simply type your topic in any language (English, Indonesian, Spanish, Japanese, etc.). AUCO automatically detects the language and synchronizes the AI script, TikTok caption, and native neural TTS Voiceover without ever asking you.
- Primary-Fallback AI Architecture: Utilizes Google Gemini as the primary reasoning engine. If Gemini hits API rate limits (HTTP 429), AUCO instantly and silently switches to Groq (Llama 3 70B) to ensure maximum uptime.
- Ken Burns Image Fallback: If a suitable B-Roll video cannot be found on Pexels, AUCO automatically hunts for a high-quality static image and injects a cinematic "Slow Zoom-In/Pan" (Ken Burns) effect via FFmpeg to maintain visual retention.
- FFprobe Anti-Corrupt Validator: Intercepts and forensically scans every downloaded media file before rendering. Any corrupted or incomplete videos are immediately purged to prevent rendering crashes.
- Single-Pass Filter Complex: Completely eliminates double-encoding. The FFmpeg engine trims, scales, loops, and concatenates all visual and audio elements (including Whisper subtitles) within a single high-efficiency pass.
- Cross-Platform Hardware Acceleration: Automatically detects and utilizes your GPU hardware encoders (Videotoolbox for macOS, NVENC for Nvidia, QSV for Intel) for lightning-fast rendering.
- Graceful Shutdown & Multiline CLI: Supports copy-pasting massive articles directly into the terminal (submit by pressing Enter twice). Safely cleans up temporary workspaces if you cancel the process (Ctrl+C).

## Prerequisites

Before installing, ensure your system meets the following requirements:

1. Node.js (version 20 or higher)
2. FFmpeg & FFprobe (Must be installed and accessible from the system path)
   - macOS: brew install ffmpeg
   - Windows: winget install ffmpeg
3. Free API Keys from the following providers:
   - Google AI Studio (Gemini)
   - Groq Cloud (Llama 3)
   - Pexels API (B-Roll)

## Installation Guide

1. Clone the repository:
```bash
git clone https://github.com/wisnu-wicaksana/auco.git
cd auco
```

2. Install dependencies:
```bash
npm install
```

3. Configure Environment Variables:
Create a file named .env in the root directory and add your keys:
```env
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here
PEXELS_API_KEY=your_pexels_api_key_here
```

4. Register the CLI globally:
```bash
npm link
```
(Note: Use sudo npm link on macOS/Linux if you encounter permission errors.)

## Usage Instructions

Trigger the application from any directory in your terminal.

Option 1: Interactive Multiline Mode (For Long Articles)
If you want to paste a massive article or news text, type the command below and press Enter:
```bash
auco
```
The terminal will wait for your input. 
HOW TO SUBMIT: Because AUCO allows you to paste multi-paragraph articles, pressing Enter once will NOT submit the text (it just creates a new line). 
To tell the system that you are completely finished typing/pasting, you MUST press the [Enter] key TWICE on a new blank line. 
Example workflow:
1. Type `auco`
2. Paste your 1000-word article
3. Press [Enter]
4. Press [Enter] again (The video rendering will now start!)

Option 2: Direct One-Liner (Fastest & Simplest)
If you only have a short topic or a URL, you can skip the interactive mode completely. Just wrap your topic in quotes and pass it as an argument:
```bash
auco "ceritakan sejarah candi borobudur untuk anak-anak"
auco "https://newswebsite.com/article"
```

## Output Location

All generated assets are strictly organized inside the AUCO root project directory, regardless of where you ran the CLI command:
auco/workspace/output/

You will find:
- FINAL_VIDEO_TIKTOK.mp4 (The final rendered video)
- CAPTION_TIKTOK.txt (The localized caption and hashtags)
- script.json (The raw AI blueprint)

## Disclaimer

This tool is designed for automated content generation purposes. Please respect the terms of service of the respective API providers and websites being scraped.
