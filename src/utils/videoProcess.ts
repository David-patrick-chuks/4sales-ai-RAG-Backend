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
      const systemPrompt = `You are an AI assistant creating a detailed, factual log of multimedia content for a Retrieval-Augmented Generation (RAG) system. Your output must be a comprehensive account of the file's contents, including spoken words, on-screen text, visual descriptions, and actions. Present this information in clear, well-structured paragraphs. The goal is to create a rich, self-contained document that captures all information present in the media. Do not use any framing language or meta-commentary like "This video contains...". Begin the description directly.`;
      // Generate content
      const result = await this.ai.models.generateContent({
        model: 'gemini-1.5-flash-latest', // Using 1.5-flash for better video support
        config: {
          responseMimeType: 'text/plain',
          systemInstruction: systemPrompt,
        },
        contents: createUserContent([
          createPartFromUri(uploadedFile.uri, uploadedFile.mimeType),
          `Generate a detailed log of the video's content. Transcribe all spoken dialogue and on-screen text. Describe the key visual elements, scenes, and any actions that take place. The final output should be a detailed, paragraph-based summary of everything that happens in the video, both visually and audibly.`,
        ]),
      });
      const response = await result.text;
      const text = response;
      if (!text || !text.trim()) {
        throw new Error('Generated content is empty or invalid');
      }
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