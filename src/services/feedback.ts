import { RetrainingSuggestion, UserFeedback } from '../models/Analytics.js';

export interface FeedbackAnalysis {
  userSatisfaction: 'positive' | 'negative' | 'neutral' | 'explicit_negative';
  confidence: number;
  shouldSuggestRetraining: boolean;
  suggestedTopics: string[];
  suggestedSources: string[];
  retrainingSuggestion?: {
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
  };
}

export class FeedbackService {
  /**
   * Analyze user feedback and determine if retraining is needed
   */
  static async analyzeFeedback(
    agentId: string,
    question: string,
    reply: string,
    confidence: number,
    feedbackText?: string,
    chunksUsed: number = 0,
    averageSimilarity: number = 0,
    sources: string[] = []
  ): Promise<FeedbackAnalysis> {
    
    // Determine user satisfaction based on feedback text and confidence
    const userSatisfaction = this.determineUserSatisfaction(feedbackText, confidence);
    
    // Extract topics from the question
    const suggestedTopics = this.extractTopics(question);
    
    // Determine if retraining should be suggested
    const shouldSuggestRetraining = this.shouldSuggestRetraining(userSatisfaction, confidence, chunksUsed);
    
    // Generate retraining suggestion if needed
    let retrainingSuggestion;
    if (shouldSuggestRetraining) {
      retrainingSuggestion = this.generateRetrainingSuggestion(
        agentId,
        question,
        suggestedTopics,
        userSatisfaction,
        confidence
      );
    }
    
    return {
      userSatisfaction,
      confidence,
      shouldSuggestRetraining,
      suggestedTopics,
      suggestedSources: sources,
      retrainingSuggestion
    };
  }
  
  /**
   * Store user feedback in the database
   */
  static async storeFeedback(
    agentId: string,
    questionId: string,
    question: string,
    originalReply: string,
    confidence: number,
    userSatisfaction: 'positive' | 'negative' | 'neutral' | 'explicit_negative',
    feedbackText?: string,
    sessionId?: string,
    ipAddress?: string,
    userAgent?: string,
    chunksUsed: number = 0,
    averageSimilarity: number = 0,
    sources: string[] = []
  ) {
    const analysis = await this.analyzeFeedback(
      agentId,
      question,
      originalReply,
      confidence,
      feedbackText,
      chunksUsed,
      averageSimilarity,
      sources
    );
    
    // Store the feedback
    const feedback = new UserFeedback({
      agentId,
      questionId,
      question,
      originalReply,
      confidence,
      userSatisfaction,
      feedbackText,
      sessionId,
      ipAddress,
      userAgent,
      suggestedTopics: analysis.suggestedTopics,
      suggestedSources: analysis.suggestedSources,
      confidenceThreshold: confidence,
      chunksUsed,
      averageSimilarity,
      sources
    });
    
    await feedback.save();
    
    // Create retraining suggestion if needed
    if (analysis.shouldSuggestRetraining && analysis.retrainingSuggestion) {
      await this.createRetrainingSuggestion(
        agentId,
        analysis.retrainingSuggestion,
        analysis.suggestedTopics,
        analysis.suggestedSources,
        confidence,
        question
      );
    }
    
    return feedback;
  }
  
  /**
   * Create a retraining suggestion
   */
  static async createRetrainingSuggestion(
    agentId: string,
    suggestion: { title: string; description: string; priority: 'high' | 'medium' | 'low' },
    suggestedTopics: string[],
    suggestedSources: string[],
    confidence: number,
    question: string
  ) {
    // Check if similar suggestion already exists
    const existingSuggestion = await RetrainingSuggestion.findOne({
      agentId,
      title: suggestion.title,
      status: 'pending'
    });
    
    if (existingSuggestion) {
      // Update existing suggestion
      existingSuggestion.affectedQuestions.push(this.hashQuestion(question));
      existingSuggestion.confidence = Math.min(existingSuggestion.confidence, confidence);
      await existingSuggestion.save();
      return existingSuggestion;
    }
    
    // Create new suggestion
    const retrainingSuggestion = new RetrainingSuggestion({
      agentId,
      suggestionType: confidence < 0.5 ? 'low_confidence' : 'user_feedback',
      priority: suggestion.priority,
      title: suggestion.title,
      description: suggestion.description,
      suggestedTopics,
      suggestedSources,
      confidence,
      affectedQuestions: [this.hashQuestion(question)],
      status: 'pending'
    });
    
    await retrainingSuggestion.save();
    return retrainingSuggestion;
  }
  
  /**
   * Get retraining suggestions for an agent
   */
  static async getRetrainingSuggestions(agentId: string, limit: number = 10) {
    return await RetrainingSuggestion.find({ agentId, status: 'pending' })
      .sort({ priority: -1, createdAt: -1 })
      .limit(limit);
  }
  
  /**
   * Get feedback summary for an agent
   */
  static async getFeedbackSummary(agentId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const feedback = await UserFeedback.find({
      agentId,
      timestamp: { $gte: startDate }
    });
    
    const totalFeedback = feedback.length;
    const positiveFeedback = feedback.filter(f => f.userSatisfaction === 'positive').length;
    const negativeFeedback = feedback.filter(f => f.userSatisfaction === 'negative' || f.userSatisfaction === 'explicit_negative').length;
    const averageConfidence = feedback.reduce((sum, f) => sum + f.confidence, 0) / totalFeedback || 0;
    
    return {
      totalFeedback,
      positiveFeedback,
      negativeFeedback,
      satisfactionRate: totalFeedback > 0 ? (positiveFeedback / totalFeedback) * 100 : 0,
      averageConfidence,
      needsRetraining: negativeFeedback > positiveFeedback || averageConfidence < 0.6
    };
  }
  
  /**
   * Determine user satisfaction from feedback text and confidence
   */
  private static determineUserSatisfaction(
    feedbackText?: string, 
    confidence: number = 0
  ): 'positive' | 'negative' | 'neutral' | 'explicit_negative' {
    
    if (feedbackText) {
      const text = feedbackText.toLowerCase();
      
      // Explicit negative feedback
      if (text.includes("didn't help") || 
          text.includes("not helpful") || 
          text.includes("wrong") || 
          text.includes("incorrect") ||
          text.includes("useless") ||
          text.includes("bad answer")) {
        return 'explicit_negative';
      }
      
      // Positive feedback
      if (text.includes("helpful") || 
          text.includes("good") || 
          text.includes("correct") || 
          text.includes("thanks") ||
          text.includes("perfect")) {
        return 'positive';
      }
      
      // Neutral feedback
      if (text.includes("ok") || 
          text.includes("fine") || 
          text.includes("alright")) {
        return 'neutral';
      }
    }
    
    // Infer from confidence if no explicit feedback
    if (confidence < 0.4) return 'negative';
    if (confidence > 0.7) return 'positive';
    return 'neutral';
  }
  
  /**
   * Extract topics from a question
   */
  private static extractTopics(question: string): string[] {
    const topics: string[] = [];
    const text = question.toLowerCase();
    
    // Common business topics
    if (text.includes('invoice') || text.includes('billing')) topics.push('invoicing');
    if (text.includes('customer') || text.includes('client')) topics.push('customer service');
    if (text.includes('product') || text.includes('service')) topics.push('products/services');
    if (text.includes('price') || text.includes('cost') || text.includes('pricing')) topics.push('pricing');
    if (text.includes('policy') || text.includes('procedure')) topics.push('policies');
    if (text.includes('technical') || text.includes('support')) topics.push('technical support');
    if (text.includes('account') || text.includes('login')) topics.push('account management');
    if (text.includes('order') || text.includes('purchase')) topics.push('orders');
    if (text.includes('refund') || text.includes('return')) topics.push('refunds/returns');
    if (text.includes('shipping') || text.includes('delivery')) topics.push('shipping');
    
    return topics;
  }
  
  /**
   * Determine if retraining should be suggested
   */
  private static shouldSuggestRetraining(
    userSatisfaction: string,
    confidence: number,
    chunksUsed: number
  ): boolean {
    return (
      userSatisfaction === 'explicit_negative' ||
      userSatisfaction === 'negative' ||
      confidence < 0.5 ||
      chunksUsed === 0
    );
  }
  
  /**
   * Generate retraining suggestion
   */
  private static generateRetrainingSuggestion(
    agentId: string,
    question: string,
    topics: string[],
    userSatisfaction: string,
    confidence: number
  ): { title: string; description: string; priority: 'high' | 'medium' | 'low' } {
    
    const topicText = topics.length > 0 ? topics.join(', ') : 'general topics';
    const priority = userSatisfaction === 'explicit_negative' || confidence < 0.3 ? 'high' : 
                    userSatisfaction === 'negative' || confidence < 0.5 ? 'medium' : 'low';
    
    return {
      title: `Improve ${topicText} knowledge for ${agentId}`,
      description: `The AI struggled with questions about ${topicText}. Consider uploading more documentation related to these topics to improve response quality.`,
      priority
    };
  }
  
  /**
   * Hash a question for deduplication
   */
  private static hashQuestion(question: string): string {
    return question.toLowerCase().replace(/\s+/g, ' ').trim();
  }
} 