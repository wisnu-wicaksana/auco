# AUCO - Auto Content Creator CLI

AUCO is an intelligent Command Line Interface (CLI) application designed to automate the process of generating short-form video content (such as TikTok, Instagram Reels, and YouTube Shorts) from a simple text prompt or a news article URL.

AUCO orchestrates multiple artificial intelligence and media processing systems to handle scriptwriting, text-to-speech generation, B-Roll video sourcing, and hardware-accelerated video rendering.

## Core Features

- Interactive CLI: Provides a seamless command-line experience. It can be run globally from any directory.
- Primary-Fallback AI Architecture: Utilizes Google Gemini as the primary reasoning engine and automatically switches to Groq Llama 3 for fallback and high-availability.
- Anti-Bot Web Scraper: Bypasses basic bot protections using custom headers to reliably extract content from news URLs.
- Cross-Platform Hardware Acceleration: Automatically detects and utilizes GPU hardware encoders (such as Videotoolbox for macOS, NVENC for Nvidia, QSV for Intel) to render videos rapidly.
- Single-Pass Filter Complex: Completely eliminates double-encoding. The FFmpeg engine trims, scales, loops, and concatenates all visual and audio elements within a single high-efficiency pass.

## Prerequisites

Before installing the application, ensure that your system meets the following requirements:

1. Node.js (version 20 or higher)
2. FFmpeg (Must be installed and accessible from the system path)
   - macOS: brew install ffmpeg
   - Windows: winget install ffmpeg
3. Free API Keys from the following providers:
   - Google AI Studio (Gemini)
   - Groq Cloud
   - Pexels API

## Installation Guide

1. Clone the repository
Clone the AUCO project to your local machine:
git clone https://github.com/wisnu-wicaksana/auco.git
cd auco

2. Install dependencies
Install the required Node.js packages:
npm install

3. Configure Environment Variables
Create a file named .env in the root directory of the project and add your API keys:
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here
PEXELS_API_KEY=your_pexels_api_key_here

4. Register the CLI globally
Run the following command to link the application globally across your operating system:
npm link

Note: If you are using macOS or Linux, you might need to use sudo npm link if you encounter permission errors.

## Usage Instructions

Once installed, you can trigger the application from any directory in your terminal.

Option 1: Interactive Mode
Simply type the command below and the application will prompt you for a topic or URL:
auco

Option 2: Direct Argument
You can pass the topic or the article URL directly as an argument:
auco "interesting facts about the deep ocean"
auco "https://newswebsite.com/article"

## Output Location

Regardless of where you run the CLI command, all generated assets will be neatly organized inside the project directory:
auco/workspace/output/

Inside this directory, you will find:
- FINAL_VIDEO_TIKTOK.mp4 (The finalized, ready-to-upload video)
- CAPTION_TIKTOK.txt (The generated caption and hashtags)
- script.json (The raw JSON script data)

## Disclaimer

This tool is designed for automated content generation purposes. Please respect the terms of service of the respective API providers and websites being scraped.
