import Redis from 'ioredis';
import { embedText } from './gemini.js';

// Redis client configuration
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  lazyConnect: true,
  showFriendlyErrorStack: process.env.NODE_ENV !== 'production'
});

// Cache configuration
const CACHE_CONFIG = {
  EMBEDDING_TTL: 12 * 60 * 60, // 12 hours
  ANSWER_TTL: 60 * 60, // 1 hour
  CONTEXT_TTL: 30 * 60, // 30 minutes
  MAX_CACHE_SIZE: 1000, // Max items per agent
  SIMILARITY_THRESHOLD: 0.85 // Threshold for considering embeddings similar
};

export interface CachedAnswer {
  question: string;
  answer: string;
  confidence: number;
  sources: string[];
  timestamp: number;
  usage_count: number;
}

export interface CachedContext {
  question: string;
  context: string;
  chunks_used: number;
  timestamp: number;
}

export class CacheService {
  /**
   * Get cached embedding for text
   */
  static async getCachedEmbedding(text: string, agentId: string): Promise<number[] | null> {
    try {
      const key = `embedding:${agentId}:${this.hashText(text)}`;
      const cached = await redis.get(key);
      
      if (cached) {
        console.log(`📦 Cache hit for embedding (${text.substring(0, 50)}...)`);
        return JSON.parse(cached);
      }
      
      return null;
    } catch (error) {
      console.error('❌ Cache get error:', error);
      return null;
    }
  }

  /**
   * Cache embedding for text
   */
  static async cacheEmbedding(text: string, embedding: number[], agentId: string): Promise<void> {
    try {
      const key = `embedding:${agentId}:${this.hashText(text)}`;
      await redis.setex(key, CACHE_CONFIG.EMBEDDING_TTL, JSON.stringify(embedding));
      console.log(`💾 Cached embedding for text (${text.substring(0, 50)}...)`);
    } catch (error) {
      console.error('❌ Cache set error:', error);
    }
  }

  /**
   * Get cached answer for similar question
   */
  static async getCachedAnswer(question: string, agentId: string): Promise<CachedAnswer | null> {
    try {
      const key = `answers:${agentId}`;
      const answers = await redis.lrange(key, 0, -1);
      
      for (const answerStr of answers) {
        const answer: CachedAnswer = JSON.parse(answerStr);
        
        // Check if questions are similar
        if (this.areQuestionsSimilar(question, answer.question)) {
          console.log(`📦 Cache hit for similar question: "${answer.question}"`);
          
          // Update usage count
          answer.usage_count++;
          await this.updateCachedAnswerUsage(agentId, answer);
          
          return answer;
        }
      }
      
      return null;
    } catch (error) {
      console.error('❌ Cache get answer error:', error);
      return null;
    }
  }

  /**
   * Cache answer for question
   */
  static async cacheAnswer(
    question: string, 
    answer: string, 
    confidence: number, 
    sources: string[], 
    agentId: string
  ): Promise<void> {
    try {
      const cachedAnswer: CachedAnswer = {
        question,
        answer,
        confidence,
        sources,
        timestamp: Date.now(),
        usage_count: 1
      };

      const key = `answers:${agentId}`;
      
      // Add to list
      await redis.lpush(key, JSON.stringify(cachedAnswer));
      
      // Trim to max size
      await redis.ltrim(key, 0, CACHE_CONFIG.MAX_CACHE_SIZE - 1);
      
      // Set TTL
      await redis.expire(key, CACHE_CONFIG.ANSWER_TTL);
      
      console.log(`💾 Cached answer for question: "${question.substring(0, 50)}..."`);
    } catch (error) {
      console.error('❌ Cache answer error:', error);
    }
  }

  /**
   * Get cached context for similar question
   */
  static async getCachedContext(question: string, agentId: string): Promise<CachedContext | null> {
    try {
      const key = `contexts:${agentId}`;
      const contexts = await redis.lrange(key, 0, -1);
      
      for (const contextStr of contexts) {
        const context: CachedContext = JSON.parse(contextStr);
        
        // Check if questions are similar
        if (this.areQuestionsSimilar(question, context.question)) {
          console.log(`📦 Cache hit for context: "${context.question}"`);
          return context;
        }
      }
      
      return null;
    } catch (error) {
      console.error('❌ Cache get context error:', error);
      return null;
    }
  }

  /**
   * Cache context for question
   */
  static async cacheContext(
    question: string, 
    context: string, 
    chunksUsed: number, 
    agentId: string
  ): Promise<void> {
    try {
      const cachedContext: CachedContext = {
        question,
        context,
        chunks_used: chunksUsed,
        timestamp: Date.now()
      };

      const key = `contexts:${agentId}`;
      
      // Add to list
      await redis.lpush(key, JSON.stringify(cachedContext));
      
      // Trim to max size
      await redis.ltrim(key, 0, CACHE_CONFIG.MAX_CACHE_SIZE - 1);
      
      // Set TTL
      await redis.expire(key, CACHE_CONFIG.CONTEXT_TTL);
      
      console.log(`💾 Cached context for question: "${question.substring(0, 50)}..."`);
    } catch (error) {
      console.error('❌ Cache context error:', error);
    }
  }

  /**
   * Get or generate embedding with caching
   */
  static async getOrGenerateEmbedding(text: string, agentId: string): Promise<number[]> {
    // Try cache first
    const cached = await this.getCachedEmbedding(text, agentId);
    if (cached) {
      return cached;
    }

    // Generate new embedding
    console.log(`🔄 Generating new embedding for: "${text.substring(0, 50)}..."`);
    const embedding = await embedText(text);
    
    // Cache it
    await this.cacheEmbedding(text, embedding, agentId);
    
    return embedding;
  }

  /**
   * Clear cache for specific agent
   */
  static async clearAgentCache(agentId: string): Promise<void> {
    try {
      const keys = await redis.keys(`*:${agentId}:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`🗑️ Cleared cache for agent: ${agentId}`);
      }
    } catch (error) {
      console.error('❌ Clear cache error:', error);
    }
  }

  /**
   * Get cache statistics for agent
   */
  static async getCacheStats(agentId: string): Promise<any> {
    try {
      const embeddingKeys = await redis.keys(`embedding:${agentId}:*`);
      const answerKeys = await redis.keys(`answers:${agentId}`);
      const contextKeys = await redis.keys(`contexts:${agentId}`);

      const stats = {
        agentId,
        embeddings_cached: embeddingKeys.length,
        answers_cached: answerKeys.length > 0 ? await redis.llen(`answers:${agentId}`) : 0,
        contexts_cached: contextKeys.length > 0 ? await redis.llen(`contexts:${agentId}`) : 0,
        total_keys: embeddingKeys.length + answerKeys.length + contextKeys.length
      };

      return stats;
    } catch (error) {
      console.error('❌ Get cache stats error:', error);
      return { agentId, error: 'Failed to get stats' };
    }
  }

  /**
   * Update usage count for cached answer
   */
  private static async updateCachedAnswerUsage(agentId: string, answer: CachedAnswer): Promise<void> {
    try {
      const key = `answers:${agentId}`;
      const answers = await redis.lrange(key, 0, -1);
      
      // Find and update the answer
      const updatedAnswers = answers.map(ansStr => {
        const ans: CachedAnswer = JSON.parse(ansStr);
        if (ans.question === answer.question && ans.timestamp === answer.timestamp) {
          return JSON.stringify(answer);
        }
        return ansStr;
      });
      
      // Replace the list
      await redis.del(key);
      if (updatedAnswers.length > 0) {
        await redis.lpush(key, ...updatedAnswers);
        await redis.expire(key, CACHE_CONFIG.ANSWER_TTL);
      }
    } catch (error) {
      console.error('❌ Update answer usage error:', error);
    }
  }

  /**
   * Check if two questions are similar
   */
  private static areQuestionsSimilar(q1: string, q2: string): boolean {
    const words1 = q1.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    const words2 = q2.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    
    const commonWords = words1.filter(w => words2.includes(w));
    const similarity = commonWords.length / Math.max(words1.length, words2.length);
    
    return similarity >= 0.7; // 70% word overlap
  }

  /**
   * Hash text for cache key
   */
  private static hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Health check for Redis connection
   */
  static async healthCheck(): Promise<boolean> {
    try {
      await redis.ping();
      return true;
    } catch (error) {
      console.error('❌ Redis health check failed:', error);
      return false;
    }
  }

  /**
   * Close Redis connection
   */
  static async close(): Promise<void> {
    try {
      await redis.quit();
      console.log('🔌 Redis connection closed');
    } catch (error) {
      console.error('❌ Redis close error:', error);
    }
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await CacheService.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await CacheService.close();
  process.exit(0);
});

export default CacheService; 