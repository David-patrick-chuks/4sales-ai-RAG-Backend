import express, { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import Memory, { IMemory } from '../models/Memory';
import { analyticsService } from '../services/analytics';
import { embedText, generateReply } from '../services/gemini';
import { WatchdogService } from '../services/watchdog';
import { sanitizeAgentId, sanitizeQuestion } from '../utils/security';

const router = express.Router();

// Configuration for retrieval and filtering
const RETRIEVAL_CONFIG = {
  VECTOR_K: 8, // Top-k for vector search (reduced from 20)
  KEYWORD_K: 3, // Top-k for keyword search (reduced from 5)
  MIN_SIMILARITY_SCORE: 0.3, // Lowered from 0.75 to be more lenient
  MAX_CONTEXT_LENGTH: 4000, // Reduced context length for better focus
  CONFIDENCE_THRESHOLD: 0.4, // Lowered from 0.6 to be more lenient
  MAX_CHUNKS: 5 // Maximum chunks to include in context
};

// Agent metadata interface
interface AgentMetadata {
  name?: string;
  tone?: string;
  role?: string;
  do_not_answer_from_general_knowledge?: boolean;
}

// Helper function to get agent metadata from the agents database
const getAgentMetadata = async (agentId: string): Promise<AgentMetadata | null> => {
  try {
    // Connect to the agents database (same MongoDB cluster, different database)
    const agentsDb = mongoose.connection.useDb('agents');
    const Agent = agentsDb.model('Agent', new mongoose.Schema({
      name: String,
      tone: String,
      role: String,
      do_not_answer_from_general_knowledge: Boolean
    }));

    const agent = await Agent.findOne({ _id: agentId }).lean();
    return agent as AgentMetadata | null;
  } catch (error) {
    console.warn(`⚠️ Failed to fetch agent metadata for ${agentId}:`, error);
    return null;
  }
};

// Helper function to extract keywords from question
const extractKeywords = (question: string): string[] => {
  // Simple keyword extraction - remove common words and punctuation
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'what', 'when', 'where', 'why', 'how', 'who', 'which', 'that', 'this', 'these', 'those']);
  
  return question
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 5); // Limit to top 5 keywords
};

// Helper function to calculate cosine similarity
const calculateCosineSimilarity = (vec1: number[], vec2: number[]): number => {
  if (vec1.length !== vec2.length) return 0;
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }
  
  if (norm1 === 0 || norm2 === 0) return 0;
  
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
};

// Helper function to filter and rank results
const filterAndRankResults = (results: any[], question: string, questionVector: number[]): any[] => {
  return results
    .map(result => {
      // Calculate similarity score if embedding exists
      let similarity = 0;
      if (result.embedding && Array.isArray(result.embedding)) {
        similarity = calculateCosineSimilarity(questionVector, result.embedding);
      }
      
      // Calculate confidence based on similarity and other factors
      let confidence = similarity;
      
      // Boost confidence for keyword matches
      const keywords = extractKeywords(question);
      const textLower = result.text.toLowerCase();
      const keywordMatches = keywords.filter(keyword => textLower.includes(keyword)).length;
      if (keywordMatches > 0) {
        confidence += (keywordMatches / keywords.length) * 0.2;
      }
      
      return {
        ...result,
        similarity,
        confidence: Math.min(confidence, 1) // Cap at 1.0
      };
    })
    .filter(result => 
      result.confidence >= RETRIEVAL_CONFIG.CONFIDENCE_THRESHOLD &&
      result.similarity >= RETRIEVAL_CONFIG.MIN_SIMILARITY_SCORE
    )
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, RETRIEVAL_CONFIG.MAX_CHUNKS);
};

// Input validation middleware with security
const validateAskRequest = (req: Request, res: Response, next: NextFunction) => {
  const { agentId, question } = req.body;

  // Sanitize and validate agentId
  const agentIdValidation = sanitizeAgentId(agentId);
  if (!agentIdValidation.isValid) {
    return res.status(400).json({
      error: agentIdValidation.error,
      field: 'agentId'
    });
  }

  // Sanitize and validate question
  const questionValidation = sanitizeQuestion(question);
  if (!questionValidation.isValid) {
    return res.status(400).json({
      error: questionValidation.error,
      field: 'question'
    });
  }

  // Replace with sanitized values
  req.body.agentId = agentIdValidation.sanitized;
  req.body.question = questionValidation.sanitized;

  next();
};

/**
 * @swagger
 * /api/ask:
 *   post:
 *     summary: Ask a question to an AI agent
 *     description: Send a question to a specific AI agent and get an intelligent response based on the agent's trained knowledge
 *     tags: [AI Agent]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - agentId
 *               - question
 *             properties:
 *               agentId:
 *                 type: string
 *                 description: Unique identifier for the AI agent
 *                 example: "sales-agent-001"
 *                 maxLength: 100
 *               question:
 *                 type: string
 *                 description: The question to ask the agent
 *                 example: "What are the benefits of our premium plan?"
 *                 maxLength: 1000
 *     responses:
 *       200:
 *         description: Successful response from the AI agent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 agent_id:
 *                   type: string
 *                   description: The agent ID that was queried
 *                 query:
 *                   type: string
 *                   description: The original question asked
 *                 reply:
 *                   type: string
 *                   description: The AI agent's response
 *                 confidence:
 *                   type: number
 *                   format: float
 *                   minimum: 0
 *                   maximum: 1
 *                   description: Confidence score of the response (0-1)
 *                 fallback_used:
 *                   type: boolean
 *                   description: Whether a fallback response was used
 *                 meta:
 *                   type: object
 *                   properties:
 *                     tokens_used:
 *                       type: integer
 *                       description: Number of tokens consumed
 *                     retrieval_time_ms:
 *                       type: integer
 *                       description: Time taken for retrieval in milliseconds
 *                     model:
 *                       type: string
 *                       description: AI model used for generation
 *                     retrieval_strategy:
 *                       type: string
 *                       description: Strategy used for retrieving context
 *                     chunks_used:
 *                       type: integer
 *                       description: Number of knowledge chunks used
 *                     chunks_searched:
 *                       type: integer
 *                       description: Total chunks searched
 *                     chunks_filtered:
 *                       type: integer
 *                       description: Chunks filtered out
 *                     context_length:
 *                       type: integer
 *                       description: Length of context provided to AI
 *                     sources_count:
 *                       type: integer
 *                       description: Number of sources referenced
 *                     average_similarity:
 *                       type: number
 *                       format: float
 *                       description: Average similarity score of used chunks
 *                 question_id:
 *                   type: string
 *                   description: Unique identifier for the question
 *                 agent_metadata:
 *                   type: object
 *                   nullable: true
 *                   description: Agent metadata from the agents database
 *                   properties:
 *                     name:
 *                       type: string
 *                       description: Agent name
 *                       example: "Sales Assistant"
 *                     role:
 *                       type: string
 *                       description: Agent role/function
 *                       example: "Fashion store assistant"
 *                     tone:
 *                       type: string
 *                       description: Communication tone
 *                       example: "friendly"
 *                     do_not_answer_from_general_knowledge:
 *                       type: boolean
 *                       description: Whether to use only trained knowledge
 *                       example: true
 *                 feedback_prompt:
 *                   type: string
 *                   description: Prompt for user feedback
 *                 retraining_suggested:
 *                   type: boolean
 *                   description: Whether retraining is suggested
 *       400:
 *         description: Invalid request parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Error message
 *                 field:
 *                   type: string
 *                   description: Field that caused the error
 *       401:
 *         description: Unauthorized - Invalid API token
 *       404:
 *         description: Agent not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 agent_id:
 *                   type: string
 *                 query:
 *                   type: string
 *                 reply:
 *                   type: string
 *                 confidence:
 *                   type: number
 *                 fallback_used:
 *                   type: boolean
 *                 meta:
 *                   type: object
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Error message
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 path:
 *                   type: string
 *                 method:
 *                   type: string
 */
router.post('/', validateAskRequest, async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { agentId, question } = req.body;
    
    console.log(`🔍 Processing question for agent ${agentId}: "${question}"`);

    // Get agent metadata for context-aware responses
    let agentMetadata: AgentMetadata | null = null;
    try {
      agentMetadata = await getAgentMetadata(agentId);
      if (agentMetadata) {
        console.log(`👤 Agent metadata loaded: ${agentMetadata.name} (${agentMetadata.role}) - Tone: ${agentMetadata.tone}`);
      } else {
        console.log(`⚠️ No agent metadata found for ${agentId}`);
      }
    } catch (metadataError) {
      console.warn('⚠️ Failed to load agent metadata:', metadataError);
    }

    // Generate embedding for the question
    let questionVector: number[];
    try {
      questionVector = await embedText(question);
      console.log(`📊 Generated embedding (${questionVector.length} dimensions)`);
      console.log(`📊 Question embedding sample: [${questionVector.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
    } catch (embedError) {
      console.error('❌ Embedding failed, using fallback:', embedError);
      questionVector = new Array(768).fill(0);
    }

    // Check if agent exists in the database
    const agentExists = await Memory.exists({ agentId });
    if (!agentExists) {
      const processingTime = Date.now() - startTime;
      
      // Track unanswered query for non-existent agent
      await analyticsService.trackUnansweredQuery(
        agentId,
        question,
        0,
        0,
        0,
        req.get('User-Agent'),
        req.ip,
        req.session?.id
      );

      return res.status(404).json({ 
        agent_id: agentId,
        query: question,
        reply: `Agent '${agentId}' does not exist. Please check the agent ID or train this agent first.`,
        confidence: 0,
        fallback_used: true,
        meta: {
          tokens_used: Math.ceil(question.length / 4) + 50,
          retrieval_time_ms: processingTime,
          model: "gemini-1.5",
          retrieval_strategy: "none",
          chunks_used: 0,
          chunks_searched: 0,
          chunks_filtered: 0,
          context_length: 0,
          sources_count: 0,
          average_similarity: 0,
          error: 'Agent not found',
          retrieval_config: {
            vector_k: RETRIEVAL_CONFIG.VECTOR_K,
            keyword_k: RETRIEVAL_CONFIG.KEYWORD_K,
            similarity_threshold: RETRIEVAL_CONFIG.MIN_SIMILARITY_SCORE,
            confidence_threshold: RETRIEVAL_CONFIG.CONFIDENCE_THRESHOLD,
            max_chunks: RETRIEVAL_CONFIG.MAX_CHUNKS
          },
          sources: []
        }
      });
    }

    // Vector search with optimized k value
    let vectorResults = [];
    try {
      vectorResults = await Memory.aggregate([
        {
          $search: {
            index: 'vector_index',
            knnBeta: {
              vector: questionVector,
              path: 'embedding',
              k: RETRIEVAL_CONFIG.VECTOR_K
            }
          }
        },
        {
          $match: { agentId: agentId }
        },
        {
          $limit: RETRIEVAL_CONFIG.VECTOR_K
        }
      ]);
      console.log(`🔍 Vector search returned ${vectorResults.length} results`);
    } catch (searchError) {
      console.error('Vector search error:', searchError);
    }

    // Keyword search with optimized k value
    let keywordResults: IMemory[] = [];
    try {
      const keywords = extractKeywords(question);
      if (keywords.length > 0) {
        const regex = keywords.join('|');
        keywordResults = await Memory.find({
          agentId,
          text: { $regex: regex, $options: 'i' }
        }).limit(RETRIEVAL_CONFIG.KEYWORD_K);
        console.log(`🔍 Keyword search returned ${keywordResults.length} results`);
      }
    } catch (keywordError) {
      console.error('Keyword search error:', keywordError);
    }

    // Combine and filter results
    const allResults = [...vectorResults, ...keywordResults];
    console.log(`📊 Total results before filtering: ${allResults.length}`);
    console.log(`📊 Vector results: ${vectorResults.length}, Keyword results: ${keywordResults.length}`);
    
    // Debug: Check embeddings in results
    if (allResults.length > 0) {
      const firstResult = allResults[0];
      console.log(`📊 First result embedding length: ${firstResult.embedding?.length || 'undefined'}`);
      if (firstResult.embedding) {
        console.log(`📊 First result embedding sample: [${firstResult.embedding.slice(0, 5).map((v: number) => v.toFixed(4)).join(', ')}...]`);
      }
    }
    
    const filteredResults = filterAndRankResults(allResults, question, questionVector);
    
    console.log(`📊 Filtered to ${filteredResults.length} high-confidence results`);

    // Deduplicate and build context
    const uniqueTexts = Array.from(new Set(filteredResults.map((r: any) => r.text)));
    let context = uniqueTexts.join('\n\n');

    // Collect source information for the chunks used
    const sourcesUsed = filteredResults
      .filter((r: any) => uniqueTexts.includes(r.text))
      .map((r: any) => ({
        source: r.source,
        sourceUrl: r.sourceUrl,
        sourceMetadata: r.sourceMetadata,
        chunkIndex: r.chunkIndex,
        confidence: r.confidence,
        similarity: r.similarity
      }))
      .filter((source: any, index: number, self: any[]) => 
        index === self.findIndex((s: any) => s.source === source.source && s.sourceUrl === source.sourceUrl)
      );

    // Limit context size for better focus
    if (context.length > RETRIEVAL_CONFIG.MAX_CONTEXT_LENGTH) {
      context = context.slice(0, RETRIEVAL_CONFIG.MAX_CONTEXT_LENGTH);
      console.log(`📝 Context truncated to ${context.length} characters`);
    }

    if (uniqueTexts.length === 0) {
      // Track unanswered query
      const processingTime = Date.now() - startTime;
      const averageSimilarity = 0;
      const confidence = 0;
      
      await analyticsService.trackUnansweredQuery(
        agentId,
        question,
        confidence,
        allResults.length,
        averageSimilarity,
        req.get('User-Agent'),
        req.ip,
        req.session?.id
      );

      return res.status(404).json({ 
        agent_id: agentId,
        query: question,
        reply: "I don't have information about that in my training data.",
        confidence: 0,
        fallback_used: true,
        meta: {
          tokens_used: Math.ceil(question.length / 4) + 50, // Rough estimate for error response
          retrieval_time_ms: processingTime,
          model: "gemini-1.5",
          retrieval_strategy: "hybrid",
          chunks_used: 0,
          chunks_searched: allResults.length,
          chunks_filtered: allResults.length,
          context_length: 0,
          sources_count: 0,
          average_similarity: 0,
          error: 'No relevant information found for this agent',
          retrieval_config: {
            vector_k: RETRIEVAL_CONFIG.VECTOR_K,
            keyword_k: RETRIEVAL_CONFIG.KEYWORD_K,
            similarity_threshold: RETRIEVAL_CONFIG.MIN_SIMILARITY_SCORE,
            confidence_threshold: RETRIEVAL_CONFIG.CONFIDENCE_THRESHOLD,
            max_chunks: RETRIEVAL_CONFIG.MAX_CHUNKS
          },
          sources: []
        }
      });
    }

    console.log(`📝 Sending ${uniqueTexts.length} chunks to Gemini (${context.length} chars)`);
    console.log(`📚 Sources used: ${sourcesUsed.map((s: any) => `${s.source} (sim: ${s.similarity?.toFixed(3)}, conf: ${s.confidence?.toFixed(3)})`).join(', ')}`);
    
    // Build agent context for the prompt
    let agentContext = '';
    if (agentMetadata) {
      agentContext = `
Agent Information:
- Name: ${agentMetadata.name || 'Unknown'}
- Role: ${agentMetadata.role || 'AI Assistant'}
- Tone: ${agentMetadata.tone || 'professional'}
- Use only trained knowledge: ${agentMetadata.do_not_answer_from_general_knowledge ? 'Yes' : 'No'}

`;
    }
    
    const prompt = `
You are ${agentMetadata?.name || 'an expert assistant'} with the role of ${agentMetadata?.role || 'an AI assistant'}.

${agentContext}${agentMetadata?.do_not_answer_from_general_knowledge ? 'IMPORTANT: Use ONLY the context below to answer the question. Do NOT use any general knowledge outside of the provided context.' : 'Use the context below to answer the question. You may supplement with general knowledge if needed.'}

${agentMetadata?.tone ? `Respond in a ${agentMetadata.tone} tone.` : ''}

Context:
${context}

Question: ${question}

Answer:`;

    let reply: string;
    try {
      reply = await generateReply(prompt);
    } catch (genError) {
      console.error('❌ Generation failed, using fallback response:', genError);
      reply = "I apologize, but I'm currently experiencing technical difficulties. Please try again later or contact support if the issue persists.";
    }
    
    const processingTime = Date.now() - startTime;
    
    console.log(`✅ Generated reply in ${processingTime}ms`);
    
    // Calculate overall confidence score
    const overallConfidence = filteredResults.length > 0 
      ? filteredResults.reduce((sum: number, r: any) => sum + r.confidence, 0) / filteredResults.length
      : 0;
    
    // Determine if fallback was used
    const fallbackUsed = reply.includes("I don't have information about that in my training data") || 
                        reply.includes("I apologize, but I'm currently experiencing technical difficulties");
    
    // Calculate average similarity
    const averageSimilarity = filteredResults.length > 0 
      ? filteredResults.reduce((sum: number, r: any) => sum + (r.similarity || 0), 0) / filteredResults.length
      : 0;

    // Track analytics for successful query
    const tokensUsed = Math.ceil(context.length / 4) + Math.ceil(question.length / 4) + Math.ceil(reply.length / 4);
    const sources = sourcesUsed.map((s: any) => s.sourceUrl || s.source).filter(Boolean);
    
    await analyticsService.trackQuestion(
      agentId,
      question,
      processingTime,
      overallConfidence,
      fallbackUsed,
      tokensUsed,
      uniqueTexts.length,
      allResults.length,
      averageSimilarity,
      sources,
      req.get('User-Agent'),
      req.ip,
      req.session?.id
    );

    // Generate unique question ID for tracking
    const questionId = `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Automatically audit the response for hallucination risk
    let auditResult = null;
    try {
      auditResult = await WatchdogService.auditResponse(
        agentId,
        questionId,
        question,
        reply,
        overallConfidence,
        uniqueTexts.length,
        sources
      );
      console.log(`🔍 Response audited - Risk Level: ${auditResult.hallucinationRiskLevel}, Score: ${auditResult.hallucinationRiskScore.toFixed(3)}`);
    } catch (auditError) {
      console.error('❌ Response audit failed:', auditError);
    }
    
    res.json({ 
      agent_id: agentId,
      query: question,
      reply,
      confidence: parseFloat(overallConfidence.toFixed(3)),
      fallback_used: fallbackUsed,
      question_id: questionId,
      agent_metadata: agentMetadata ? {
        name: agentMetadata.name,
        role: agentMetadata.role,
        tone: agentMetadata.tone,
        do_not_answer_from_general_knowledge: agentMetadata.do_not_answer_from_general_knowledge
      } : null,
      feedback_prompt: overallConfidence < 0.6 ? 
        "Was this answer helpful? Reply with feedback to help us improve." : 
        "How was this answer? (optional feedback)",
      retraining_suggested: overallConfidence < 0.5 || fallbackUsed,
      audit: auditResult ? {
        hallucination_risk_score: auditResult.hallucinationRiskScore,
        hallucination_risk_level: auditResult.hallucinationRiskLevel,
        factual_accuracy: auditResult.factualAccuracy,
        source_alignment: auditResult.sourceAlignment,
        completeness: auditResult.completeness,
        relevance: auditResult.relevance,
        compliance_flags: auditResult.complianceFlags,
        requires_human_review: auditResult.requiresHumanReview
      } : null,
      meta: {
        tokens_used: tokensUsed,
        retrieval_time_ms: processingTime,
        model: "gemini-1.5",
        retrieval_strategy: "hybrid",
        chunks_used: uniqueTexts.length,
        chunks_searched: allResults.length,
        chunks_filtered: allResults.length - filteredResults.length,
        context_length: context.length,
        sources_count: sourcesUsed.length,
        average_similarity: parseFloat(averageSimilarity.toFixed(3)),
        retrieval_config: {
          vector_k: RETRIEVAL_CONFIG.VECTOR_K,
          keyword_k: RETRIEVAL_CONFIG.KEYWORD_K,
          similarity_threshold: RETRIEVAL_CONFIG.MIN_SIMILARITY_SCORE,
          confidence_threshold: RETRIEVAL_CONFIG.CONFIDENCE_THRESHOLD,
          max_chunks: RETRIEVAL_CONFIG.MAX_CHUNKS
        },
        sources: sourcesUsed.map((s: any) => ({
          source: s.source,
          source_url: s.sourceUrl,
          chunk_index: s.chunkIndex,
          confidence: s.confidence,
          similarity: s.similarity
        }))
      }
    });
    
  } catch (error) {
    console.error('Ask route error:', error);
    const processingTime = Date.now() - startTime;
    
    // Track failed query
    try {
      await analyticsService.trackUnansweredQuery(
        req.body.agentId,
        req.body.question,
        0,
        0,
        0,
        req.get('User-Agent'),
        req.ip,
        req.session?.id
      );
    } catch (analyticsError) {
      console.error('Failed to track analytics for error:', analyticsError);
    }
    
    res.status(500).json({ 
      error: 'Failed to process question',
      processingTime,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/ask/config - Get current retrieval configuration
router.get('/config', (req: Request, res: Response) => {
  res.json({
    retrievalConfig: RETRIEVAL_CONFIG,
    description: {
      VECTOR_K: 'Number of top vector search results to retrieve',
      KEYWORD_K: 'Number of top keyword search results to retrieve',
      MIN_SIMILARITY_SCORE: 'Minimum cosine similarity threshold',
      MAX_CONTEXT_LENGTH: 'Maximum context length in characters',
      CONFIDENCE_THRESHOLD: 'Minimum confidence score for including chunks',
      MAX_CHUNKS: 'Maximum number of chunks to include in context'
    }
  });
});

// POST /api/ask/config - Update retrieval configuration (for development/testing)
router.post('/config', (req: Request, res: Response) => {
  const { vectorK, keywordK, confidenceThreshold, similarityThreshold, maxContextLength, maxChunks } = req.body;
  
  // Validate and update configuration
  if (vectorK !== undefined && Number.isInteger(vectorK) && vectorK > 0 && vectorK <= 50) {
    RETRIEVAL_CONFIG.VECTOR_K = vectorK;
  }
  
  if (keywordK !== undefined && Number.isInteger(keywordK) && keywordK > 0 && keywordK <= 20) {
    RETRIEVAL_CONFIG.KEYWORD_K = keywordK;
  }
  
  if (confidenceThreshold !== undefined && confidenceThreshold >= 0 && confidenceThreshold <= 1) {
    RETRIEVAL_CONFIG.CONFIDENCE_THRESHOLD = confidenceThreshold;
  }
  
  if (similarityThreshold !== undefined && similarityThreshold >= 0 && similarityThreshold <= 1) {
    RETRIEVAL_CONFIG.MIN_SIMILARITY_SCORE = similarityThreshold;
  }
  
  if (maxContextLength !== undefined && Number.isInteger(maxContextLength) && maxContextLength > 0) {
    RETRIEVAL_CONFIG.MAX_CONTEXT_LENGTH = maxContextLength;
  }
  
  if (maxChunks !== undefined && Number.isInteger(maxChunks) && maxChunks > 0 && maxChunks <= 20) {
    RETRIEVAL_CONFIG.MAX_CHUNKS = maxChunks;
  }
  
  res.json({
    message: 'Configuration updated successfully',
    retrievalConfig: RETRIEVAL_CONFIG
  });
});

export default router; 