import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { YoutubeTranscript } from 'youtube-transcript';
dotenv.config();

/**
 * Cleans a transcript by removing unwanted annotations and special characters.
 * @param text - The raw transcript text.
 * @returns The cleaned transcript text.
 */
export function cleanTranscript(text: string): string {
  console.log(`[DEBUG] youtubeTranscript: Cleaning raw transcript (length: ${text.length}).`);
  const cleaned = text
    .replace(/\[.*?\]/g, '') // Remove annotations like [Music]
    .replace(/&#39;/g, "'") // Replace HTML entities
    .trim();
  console.log(`[DEBUG] youtubeTranscript: Cleaned transcript (length: ${cleaned.length}). Preview: "${cleaned.substring(0, 100)}..."`);
  return cleaned;
}

/**
 * Extracts the YouTube video ID from a URL.
 * @param url - The YouTube video URL.
 * @returns The extracted video ID.
 * @throws If the URL is invalid.
 */
export function extractVideoId(url: string): string {
  try {
    const parsedUrl = new URL(url);
    let videoId: string | null = null;
    if (parsedUrl.hostname.includes('youtube.com')) {
      videoId = parsedUrl.searchParams.get('v');
    } else if (parsedUrl.hostname === 'youtu.be') {
      videoId = parsedUrl.pathname.split('/')[1];
      const index = videoId.indexOf('?');
      if (index !== -1) videoId = videoId.substring(0, index);
    }
    if (!videoId) throw new Error('Invalid YouTube URL: No video ID found.');
    return videoId;
  } catch (error: any) {
    throw new Error(`Failed to parse YouTube URL: ${error.message}`);
  }
}

/**
 * Fetches the transcript of a YouTube video.
 * @param url - The YouTube video URL.
 * @returns The concatenated transcript text.
 * @throws If the transcript cannot be fetched.
 */
export async function fetchYouTubeTranscript(url: string): Promise<string> {
  try {
    const videoId = extractVideoId(url);
    const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
      lang: 'en',
    });
    console.log(`[DEBUG] youtubeTranscript: Transcript received (items: ${transcript.length}).`);

    // If transcript is empty, throw an error to trigger fallback.
    if (!transcript || transcript.length === 0) {
      throw new Error(`Transcript is unavailable or empty for video ID ${videoId}.`);
    }

    const joinedText = transcript.map((item: any) => item.text).join(' ');
    console.log(`[DEBUG] youtubeTranscript: Fetched transcript successfully (length: ${joinedText.length}).`);
    return joinedText;
  } catch (error: any) {
    // Let the route handler decide what to do. Just re-throw the meaningful errors.
    if (error.message?.includes('Transcript is disabled') || error.message?.includes('unavailable or empty')) {
      throw error;
    }
    throw new Error(`Failed to fetch transcript: ${error.message}`);
  }
}

/**
 * Summarizes a YouTube video using Gemini if transcript is disabled.
 * @param url - The YouTube video URL.
 * @returns The summary text.
 */
export async function summarizeYouTubeVideoWithGemini(url: string): Promise<string> {
  // Use the first available Gemini API key from env
  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_1;
  if (!apiKey) throw new Error('No Gemini API key found in environment variables');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
  const result = await model.generateContent([
    `You are an AI assistant tasked with creating a complete, word-for-word transcript of video content for a Retrieval-Augmented Generation (RAG) system.

Your task is to transcribe ALL spoken words, dialogue, and verbal content exactly as they are spoken. Do NOT summarize, paraphrase, or provide commentary.

Requirements:
* Transcribe every spoken word verbatim
* Include all dialogue, conversations, and verbal content
* Preserve the exact wording and phrases used
* Do not add descriptions like "the speaker says" or "the video contains"
* Do not summarize or condense the content
* Focus only on the spoken words, not background sounds or music
* If there are multiple speakers, indicate speaker changes when clear
* If words are unclear or inaudible, mark them as [inaudible] or [unclear]
* Include any on-screen text, captions, or written content that appears

Output format: A clean, complete transcript of all spoken content and on-screen text, ready for question-answering.`,
    {
      fileData: {
        fileUri: url,
        mimeType: 'video/mp4',
      },
    },
  ]);
  const response = await result.response;
  return response.text();
} 