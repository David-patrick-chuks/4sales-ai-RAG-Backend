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
      const systemPrompt = `You are an AI assistant tasked with creating a complete, word-for-word transcript of audio content for a Retrieval-Augmented Generation (RAG) system. 

Your task is to transcribe ALL spoken words, dialogue, and verbal content exactly as they are spoken. Do NOT summarize, paraphrase, or provide commentary. 

Requirements:
- Transcribe every spoken word verbatim
- Include all dialogue, conversations, and verbal content
- Preserve the exact wording and phrases used
- Do not add descriptions like "the speaker says" or "the audio contains"
- Do not summarize or condense the content
- Focus only on the spoken words, not background sounds or music
- If there are multiple speakers, indicate speaker changes when clear
- If words are unclear or inaudible, mark them as [inaudible] or [unclear]

Output format: A clean, complete transcript of all spoken content, ready for question-answering.`;

      const result = await this.ai.models.generateContent({
        model: 'gemini-1.5-flash',
        config: {
          responseMimeType: 'text/plain',
          systemInstruction: systemPrompt,
        },
        contents: createUserContent([
          createPartFromUri(uploadedFile.uri, uploadedFile.mimeType),
          `Provide a complete, word-for-word transcript of all spoken content in this audio file. Transcribe every word that is spoken, exactly as it is said. Do not summarize or provide commentary - just give me the complete transcript.`,
        ]),
      });

      const text = result.text;
      // console.log(result.text);
      console.log(`[DEBUG] Audio transcript generated (${text?.length || 0} characters)`);
      console.log(`[DEBUG] Transcript preview: "${text?.substring(0, 200) || 'No text'}..."`);

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