import { GoogleGenAI, createPartFromUri, createUserContent } from '@google/genai';
import dotenv from 'dotenv';
import fs from 'fs';
import mime from 'mime-types';
import path from 'path';
dotenv.config();

function getGeminiApiKeys(): string[] {
  const keys: string[] = [];
  if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY);
  for (let i = 1; i <= 10; i++) {
    const key = process.env[`GEMINI_API_KEY_${i}` as any];
    if (key) keys.push(key);
  }
  return keys;
}

export class VideoProcessor {
  private apiKeys: string[];
  private currentApiKeyIndex: number = 0;
  private ai: GoogleGenAI;

  constructor() {
    this.apiKeys = getGeminiApiKeys();
    if (this.apiKeys.length === 0) throw new Error('No Gemini API keys found in environment variables');
    this.ai = new GoogleGenAI({ apiKey: this.apiKeys[this.currentApiKeyIndex] });
  }

  private switchApiKey() {
    this.currentApiKeyIndex = (this.currentApiKeyIndex + 1) % this.apiKeys.length;
    this.ai = new GoogleGenAI({ apiKey: this.apiKeys[this.currentApiKeyIndex] });
    console.log(`🔄 Switched to API key: ${this.currentApiKeyIndex + 1}`);
  }

  /**
   * Accepts a Buffer or file path, uploads to Gemini, and returns transcript/summary.
   */
  async processVideo(video: Buffer | string, originalName = 'video.mp4', clientMimeType?: string, retryCount = 0, maxRetries = 3): Promise<string> {
    let tempPath: string | null = null;
    let uploadedFile: any = null;
    try {
      // Write buffer to temp file if needed
      if (Buffer.isBuffer(video)) {
        tempPath = path.join(process.cwd(), `temp-video-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`);
        fs.writeFileSync(tempPath, video);
      } else {
        tempPath = video;
        if (!fs.existsSync(tempPath)) throw new Error(`File not found: ${tempPath}`);
      }
      console.log('[DEBUG] videoProcess: originalName:', originalName, 'clientMimeType:', clientMimeType);
      const mimeType = clientMimeType || mime.lookup(originalName) || 'video/mp4';
      if (!mimeType.startsWith('video/')) {
        throw new Error(`Unsupported file format: ${mimeType}. Must be a valid video MIME type (e.g., video/mp4, video/mov)`);
      }
      // Upload file
      uploadedFile = await this.ai.files.upload({
        file: tempPath,
        config: { mimeType },
      });

      // Poll for file to become active
      let attempts = 0;
      const maxAttempts = 30; // 30 attempts * 2s = 1 minute timeout
      while (attempts < maxAttempts) {
        const file = await this.ai.files.get({ name: uploadedFile.name });
        if (file.state === 'ACTIVE') {
          break;
        }
        if (file.state === 'FAILED') {
          throw new Error(`File processing failed: ${file.state}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
        attempts++;
      }

      if (attempts === maxAttempts) {
        throw new Error('File processing timed out.');
      }
      const systemPrompt = `You are an AI assistant tasked with creating a clean transcript of video content for a Retrieval-Augmented Generation (RAG) system.

Your task is to extract ONLY:
1. All spoken words and dialogue (verbatim)
2. Any on-screen text, captions, or written content
3. Important text that appears in the video

Requirements:
- Transcribe every spoken word exactly as spoken
- Include all on-screen text and captions
- Do NOT include timestamps, scene descriptions, or visual details
- Do NOT describe what you see (colors, camera angles, etc.)
- Do NOT add commentary or summaries
- Focus only on the actual text content (spoken and written)
- If there are multiple speakers, indicate speaker changes when clear
- If words are unclear, mark them as [inaudible]

Output format: A clean transcript containing only the spoken words and on-screen text, ready for question-answering.`;

      // Generate content
      const result = await this.ai.models.generateContent({
        model: 'gemini-1.5-flash-latest', // Using 1.5-flash for better video support
        config: {
          responseMimeType: 'text/plain',
          systemInstruction: systemPrompt,
        },
        contents: createUserContent([
          createPartFromUri(uploadedFile.uri, uploadedFile.mimeType),
          `Extract ONLY the spoken words and on-screen text from this video. Do not include timestamps, scene descriptions, or visual details. Provide a clean transcript of the actual content that can be heard or read.`,
        ]),
      });
      const response = await result.text;
      const text = response;
      if (!text || !text.trim()) {
        throw new Error('Generated content is empty or invalid');
      }
      
      console.log(`[DEBUG] Video transcript generated (${text.length} characters)`);
      console.log(`[DEBUG] Transcript preview: "${text.substring(0, 200)}..."`);
      
      return text;
    } catch (error: any) {
      if (retryCount < maxRetries && (error.message?.includes('429') || error.message?.includes('503'))) {
        console.log(`API error (retry ${retryCount + 1}/${maxRetries}) for key ${this.currentApiKeyIndex + 1}: ${error.message}`);
        this.switchApiKey();
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, retryCount + 1)));
        return this.processVideo(video, originalName, clientMimeType, retryCount + 1, maxRetries);
      } else {
        console.error(`Error processing video: ${error.message}`);
        throw new Error(error.message);
      }
    } finally {
      // Clean up uploaded file
      if (uploadedFile) {
        try {
          await this.ai.files.delete({ name: uploadedFile.name });
        } catch (err: any) {
          console.error(`Failed to delete uploaded file: ${err.message}`);
        }
      }
      // Clean up temp file if used
      if (Buffer.isBuffer(video) && tempPath && fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch (err: any) {
          console.error(`Failed to delete temp file: ${err.message}`);
        }
      }
    }
  }
} 