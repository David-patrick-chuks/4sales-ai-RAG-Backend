import { GoogleGenAI, createPartFromUri, createUserContent } from '@google/genai';
import dotenv from 'dotenv';
import fs from 'fs';
import mime from 'mime-types';
import path from 'path';
dotenv.config();

// Gather all Gemini API keys from env
function getGeminiApiKeys(): string[] {
  const keys: string[] = [];
  if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY);
  for (let i = 1; i <= 10; i++) {
    const key = process.env[`GEMINI_API_KEY_${i}` as any];
    if (key) keys.push(key);
  }
  return keys;
}

export class GeminiAudioTranscriber {
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

  // Accepts a file path or buffer
  async transcribeAudio(audio: Buffer, originalName: string, retryCount = 0, maxRetries = 3): Promise<string> {
    let tempPath: string | null = null;
    let uploadedFile: any = null;

    try {
      const extension = path.extname(originalName) || '.mp3';
      tempPath = path.join(process.cwd(), `temp-audio-${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`);
      fs.writeFileSync(tempPath, audio);

      const mimeType = mime.lookup(tempPath);
      if (!mimeType || !mimeType.startsWith('audio/')) {
        throw new Error('Unsupported file format. Only audio files are allowed.');
      }
      // Upload the audio file to Gemini server
      uploadedFile = await this.ai.files.upload({
        file: tempPath,
        config: { mimeType: mimeType },
      });
      if (!uploadedFile?.uri || !uploadedFile.mimeType) {
        throw new Error('File upload failed, URI or MIME type is missing.');
      }
      const systemPrompt = `You are an AI assistant creating a detailed, factual log of multimedia content for a Retrieval-Augmented Generation (RAG) system. Your output must be a comprehensive account of the file's contents, including spoken words, on-screen text, visual descriptions, and actions. Present this information in clear, well-structured paragraphs. The goal is to create a rich, self-contained document that captures all information present in the media. Do not use any framing language or meta-commentary like "This video contains...". Begin the description directly.`;
      const result = await this.ai.models.generateContent({
        model: 'gemini-1.5-flash',
        config: {
          responseMimeType: 'text/plain',
          systemInstruction: systemPrompt,
        },
        contents: createUserContent([
          createPartFromUri(uploadedFile.uri, uploadedFile.mimeType),
          `Generate a detailed log of the audio's content. Transcribe all spoken dialogue. Describe any significant non-dialogue sounds or music. The final output should be a detailed, paragraph-based summary of everything that can be heard in the audio.`,
        ]),
      });

      const text = result.text;
      // console.log(result.text);
      // console.log('[DEBUG] Raw Gemini Response:', JSON.stringify(text, null, 2));

      if (!text) {
        throw new Error('Invalid response from the model (empty transcript).');
      }

      console.log('[DEBUG] Successfully transcribed audio text.');

      return text;
    } catch (error: any) {
      console.error('[DEBUG] Error in transcribeAudio:', error);
      if (retryCount < maxRetries) {
        if (error.message && (error.message.includes('429') || error.message.includes('503'))) {
          console.error(`🚨 API key ${this.currentApiKeyIndex + 1} limit exhausted or service unavailable, switching...`);
          this.switchApiKey();
          await new Promise((resolve) => setTimeout(resolve, 5000));
          return this.transcribeAudio(audio, originalName, retryCount + 1, maxRetries);
        }
      }
      console.error('⚠ Error processing audio:', error.message);
      throw error;
    } finally {
      // Clean up uploaded file from Gemini server
      if (uploadedFile?.name) {
        try {
          await this.ai.files.delete({ name: uploadedFile.name });
        } catch (delError: any) {
          console.error(`Failed to delete uploaded Gemini file ${uploadedFile.uri}: ${delError.message}`);
        }
      }
      // Clean up local temp file
      if (tempPath && fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    }
  }
} 