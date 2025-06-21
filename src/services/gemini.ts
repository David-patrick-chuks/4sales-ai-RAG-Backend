import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';

dotenv.config();

class GeminiService {
  private apiKeys: string[];
  private currentApiKeyIndex: number = 0;
  private clients: GoogleGenAI[] = [];

  constructor() {
    // Initialize API keys from environment variables
    this.apiKeys = [];
    for (let i = 1; i <= 10; i++) {
      const key = process.env[`GEMINI_API_KEY_${i}`] || process.env.GEMINI_API_KEY;
      if (key) {
        this.apiKeys.push(key);
      }
    }

    if (this.apiKeys.length === 0) {
      throw new Error('No Gemini API keys found in environment variables');
    }

    // Initialize clients for each API key
    this.clients = this.apiKeys.map(key => new GoogleGenAI({ apiKey: key }));
    
    console.log(`🔑 Initialized Gemini service with ${this.apiKeys.length} API keys`);
  }

  private switchApiKey(): void {
    this.currentApiKeyIndex = (this.currentApiKeyIndex + 1) % this.apiKeys.length;
    console.log(`🔄 Switched to API key ${this.currentApiKeyIndex + 1}/${this.apiKeys.length}`);
  }

  private getCurrentClient(): GoogleGenAI {
    return this.clients[this.currentApiKeyIndex];
  }

  async embedText(text: string, retryCount: number = 0, maxRetries: number = 3): Promise<number[]> {
    try {
      const ai = this.getCurrentClient();
      const res = await ai.models.embedContent({
        model: "models/text-embedding-004", // 768 dimensions
        contents: text
      });
      
      return res.embeddings?.[0]?.values ?? [];
    } catch (error: any) {
      if (retryCount < maxRetries) {
        if (error.message?.includes("429") || error.message?.includes("Too Many Requests")) {
          console.error(`🚨 API key ${this.currentApiKeyIndex + 1} limit exhausted, switching...`);
          this.switchApiKey();
          await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds
          return this.embedText(text, retryCount + 1, maxRetries);
        } else if (error.message?.includes("503") || error.message?.includes("Service Unavailable")) {
          console.error("⏳ Service is unavailable. Retrying in 3 seconds...");
          await new Promise((resolve) => setTimeout(resolve, 3000));
          return this.embedText(text, retryCount + 1, maxRetries);
        } else if (error.message?.includes("500") || error.message?.includes("Internal Server Error")) {
          console.error("⚠️ Internal server error. Retrying in 2 seconds...");
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return this.embedText(text, retryCount + 1, maxRetries);
        } else {
          console.error("⚠️ Error embedding text:", error.message);
          throw error;
        }
      } else {
        console.error("❌ Maximum retry attempts reached for embedding. Using fallback embedding.");
        // Return a fallback embedding (zeros) instead of crashing
        return new Array(768).fill(0);
      }
    }
  }

  async generateReply(promptText: string, retryCount: number = 0, maxRetries: number = 3): Promise<string> {
    try {
      const ai = this.getCurrentClient();
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: promptText
      });
      
      return response.text || "No response generated";
    } catch (error: any) {
      if (retryCount < maxRetries) {
        if (error.message?.includes("429") || error.message?.includes("Too Many Requests")) {
          console.error(`🚨 API key ${this.currentApiKeyIndex + 1} limit exhausted, switching...`);
          this.switchApiKey();
          await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds
          return this.generateReply(promptText, retryCount + 1, maxRetries);
        } else if (error.message?.includes("503") || error.message?.includes("Service Unavailable")) {
          console.error("⏳ Service is unavailable. Retrying in 3 seconds...");
          await new Promise((resolve) => setTimeout(resolve, 3000));
          return this.generateReply(promptText, retryCount + 1, maxRetries);
        } else if (error.message?.includes("500") || error.message?.includes("Internal Server Error")) {
          console.error("⚠️ Internal server error. Retrying in 2 seconds...");
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return this.generateReply(promptText, retryCount + 1, maxRetries);
        } else {
          console.error("⚠️ Error generating reply:", error.message);
          throw error;
        }
      } else {
        console.error("❌ Maximum retry attempts reached for generation. Using fallback response.");
        // Return a fallback response instead of crashing
        return "I apologize, but I'm currently experiencing technical difficulties. Please try again later or contact support if the issue persists.";
      }
    }
  }

  // Get service status
  getStatus(): { apiKeysCount: number; currentKeyIndex: number } {
    return {
      apiKeysCount: this.apiKeys.length,
      currentKeyIndex: this.currentApiKeyIndex
    };
  }
}

// Create singleton instance
const geminiService = new GeminiService();

// Export the functions with retry logic
export async function embedText(text: string): Promise<number[]> {
  return geminiService.embedText(text);
}

export async function generateReply(promptText: string): Promise<string> {
  return geminiService.generateReply(promptText);
}

// Export service for advanced usage
export { geminiService };

