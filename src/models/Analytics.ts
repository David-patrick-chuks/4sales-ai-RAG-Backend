import mongoose, { Document, Schema } from 'mongoose';

// Question Analytics
export interface IQuestionAnalytics extends Document {
  agentId: string;
  question: string;
  questionHash: string; // For deduplication
  timestamp: Date;
  responseTime: number;
  confidence: number;
  fallbackUsed: boolean;
  tokensUsed: number;
  chunksUsed: number;
  chunksSearched: number;
  averageSimilarity: number;
  sources: string[];
  userAgent?: string;
  ipAddress?: string;
  sessionId?: string;
}

// Source Analytics
export interface ISourceAnalytics extends Document {
  agentId: string;
  sourceUrl?: string;
  sourceType: 'document' | 'website' | 'youtube' | 'audio' | 'video';
  fileName?: string;
  usageCount: number;
  lastUsed: Date;
  averageConfidence: number;
  totalTokensUsed: number;
  totalQuestionsAnswered: number;
}

// Unanswered Query Analytics
export interface IUnansweredQuery extends Document {
  agentId: string;
  question: string;
  questionHash: string;
  timestamp: Date;
  confidence: number;
  chunksSearched: number;
  averageSimilarity: number;
  userAgent?: string;
  ipAddress?: string;
  sessionId?: string;
}

// Similarity Heatmap Data
export interface ISimilarityHeatmap extends Document {
  agentId: string;
  question: string;
  chunkText: string;
  chunkId: string;
  similarity: number;
  confidence: number;
  timestamp: Date;
  sourceUrl?: string;
  sourceType: string;
}

// Business Insights
export interface IBusinessInsights extends Document {
  agentId: string;
  date: Date;
  totalQuestions: number;
  answeredQuestions: number;
  unansweredQuestions: number;
  averageConfidence: number;
  averageResponseTime: number;
  totalTokensUsed: number;
  topSources: Array<{
    sourceUrl?: string;
    fileName?: string;
    usageCount: number;
    averageConfidence: number;
  }>;
  topQuestions: Array<{
    question: string;
    count: number;
    averageConfidence: number;
  }>;
  userSessions: number;
  uniqueUsers: number;
}

// User Feedback and Retraining Suggestions
export interface IUserFeedback extends Document {
  agentId: string;
  questionId: string; // Reference to the original question
  question: string;
  originalReply: string;
  confidence: number;
  userSatisfaction: 'positive' | 'negative' | 'neutral' | 'explicit_negative';
  feedbackText?: string; // User's explicit feedback
  timestamp: Date;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  // Retraining suggestion data
  suggestedTopics: string[];
  suggestedSources: string[];
  confidenceThreshold: number;
  chunksUsed: number;
  averageSimilarity: number;
  sources: string[];
}

// Retraining Suggestions
export interface IRetrainingSuggestion extends Document {
  agentId: string;
  suggestionType: 'low_confidence' | 'user_feedback' | 'unanswered_pattern' | 'topic_gap';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  suggestedTopics: string[];
  suggestedSources: string[];
  confidence: number;
  affectedQuestions: string[]; // Array of question hashes
  createdAt: Date;
  status: 'pending' | 'implemented' | 'dismissed';
  implementedAt?: Date;
  implementationNotes?: string;
}

// Response Audit & Hallucination Detection
export interface IResponseAudit extends Document {
  agentId: string;
  questionId: string;
  question: string;
  response: string;
  confidence: number;
  chunksUsed: number;
  sources: string[];
  // Hallucination detection
  hallucinationRiskScore: number; // 0-1 scale
  hallucinationRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  auditReasoning: string; // LLM's reasoning for the score
  // Quality metrics
  factualAccuracy: number; // 0-1 scale
  sourceAlignment: number; // How well response aligns with sources
  completeness: number; // 0-1 scale
  relevance: number; // 0-1 scale
  // Metadata
  auditTimestamp: Date;
  auditModel: string; // Which LLM performed the audit
  auditVersion: string;
  // Compliance flags
  complianceFlags: string[]; // e.g., ['missing_source', 'potential_hallucination']
  requiresHumanReview: boolean;
  reviewedBy?: string;
  reviewNotes?: string;
  reviewTimestamp?: Date;
}

// Question Analytics Schema
const QuestionAnalyticsSchema = new Schema<IQuestionAnalytics>({
  agentId: { type: String, required: true, index: true },
  question: { type: String, required: true },
  questionHash: { type: String, required: true, index: true },
  timestamp: { type: Date, default: Date.now, index: true },
  responseTime: { type: Number, required: true },
  confidence: { type: Number, required: true },
  fallbackUsed: { type: Boolean, default: false },
  tokensUsed: { type: Number, required: true },
  chunksUsed: { type: Number, required: true },
  chunksSearched: { type: Number, required: true },
  averageSimilarity: { type: Number, required: true },
  sources: [{ type: String }],
  userAgent: String,
  ipAddress: String,
  sessionId: String
});

// Source Analytics Schema
const SourceAnalyticsSchema = new Schema<ISourceAnalytics>({
  agentId: { type: String, required: true, index: true },
  sourceUrl: String,
  sourceType: { 
    type: String, 
    required: true, 
    enum: ['document', 'website', 'youtube', 'audio', 'video'] 
  },
  fileName: String,
  usageCount: { type: Number, default: 1 },
  lastUsed: { type: Date, default: Date.now },
  averageConfidence: { type: Number, default: 0 },
  totalTokensUsed: { type: Number, default: 0 },
  totalQuestionsAnswered: { type: Number, default: 1 }
});

// Unanswered Query Schema
const UnansweredQuerySchema = new Schema<IUnansweredQuery>({
  agentId: { type: String, required: true, index: true },
  question: { type: String, required: true },
  questionHash: { type: String, required: true, index: true },
  timestamp: { type: Date, default: Date.now, index: true },
  confidence: { type: Number, required: true },
  chunksSearched: { type: Number, required: true },
  averageSimilarity: { type: Number, required: true },
  userAgent: String,
  ipAddress: String,
  sessionId: String
});

// Similarity Heatmap Schema
const SimilarityHeatmapSchema = new Schema<ISimilarityHeatmap>({
  agentId: { type: String, required: true, index: true },
  question: { type: String, required: true },
  chunkText: { type: String, required: true },
  chunkId: { type: String, required: true },
  similarity: { type: Number, required: true },
  confidence: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now, index: true },
  sourceUrl: String,
  sourceType: String
});

// Business Insights Schema
const BusinessInsightsSchema = new Schema<IBusinessInsights>({
  agentId: { type: String, required: true, index: true },
  date: { type: Date, required: true, index: true },
  totalQuestions: { type: Number, default: 0 },
  answeredQuestions: { type: Number, default: 0 },
  unansweredQuestions: { type: Number, default: 0 },
  averageConfidence: { type: Number, default: 0 },
  averageResponseTime: { type: Number, default: 0 },
  totalTokensUsed: { type: Number, default: 0 },
  topSources: [{
    sourceUrl: String,
    fileName: String,
    usageCount: Number,
    averageConfidence: Number
  }],
  topQuestions: [{
    question: String,
    count: Number,
    averageConfidence: Number
  }],
  userSessions: { type: Number, default: 0 },
  uniqueUsers: { type: Number, default: 0 }
});

// User Feedback Schema
const UserFeedbackSchema = new Schema<IUserFeedback>({
  agentId: { type: String, required: true, index: true },
  questionId: { type: String, required: true, index: true },
  question: { type: String, required: true },
  originalReply: { type: String, required: true },
  confidence: { type: Number, required: true },
  userSatisfaction: { 
    type: String, 
    required: true, 
    enum: ['positive', 'negative', 'neutral', 'explicit_negative'],
    index: true
  },
  feedbackText: String,
  timestamp: { type: Date, default: Date.now, index: true },
  sessionId: String,
  ipAddress: String,
  userAgent: String,
  suggestedTopics: [{ type: String }],
  suggestedSources: [{ type: String }],
  confidenceThreshold: { type: Number, required: true },
  chunksUsed: { type: Number, required: true },
  averageSimilarity: { type: Number, required: true },
  sources: [{ type: String }]
});

// Retraining Suggestions Schema
const RetrainingSuggestionSchema = new Schema<IRetrainingSuggestion>({
  agentId: { type: String, required: true, index: true },
  suggestionType: { 
    type: String, 
    required: true, 
    enum: ['low_confidence', 'user_feedback', 'unanswered_pattern', 'topic_gap'],
    index: true
  },
  priority: { 
    type: String, 
    required: true, 
    enum: ['high', 'medium', 'low'],
    index: true
  },
  title: { type: String, required: true },
  description: { type: String, required: true },
  suggestedTopics: [{ type: String }],
  suggestedSources: [{ type: String }],
  confidence: { type: Number, required: true },
  affectedQuestions: [{ type: String }],
  createdAt: { type: Date, default: Date.now, index: true },
  status: { 
    type: String, 
    required: true, 
    enum: ['pending', 'implemented', 'dismissed'],
    default: 'pending',
    index: true
  },
  implementedAt: Date,
  implementationNotes: String
});

// Response Audit Schema
const ResponseAuditSchema = new Schema<IResponseAudit>({
  agentId: { type: String, required: true, index: true },
  questionId: { type: String, required: true, index: true },
  question: { type: String, required: true },
  response: { type: String, required: true },
  confidence: { type: Number, required: true },
  chunksUsed: { type: Number, required: true },
  sources: [{ type: String }],
  // Hallucination detection
  hallucinationRiskScore: { type: Number, required: true, min: 0, max: 1 },
  hallucinationRiskLevel: { 
    type: String, 
    required: true, 
    enum: ['low', 'medium', 'high', 'critical'],
    index: true
  },
  auditReasoning: { type: String, required: true },
  // Quality metrics
  factualAccuracy: { type: Number, required: true, min: 0, max: 1 },
  sourceAlignment: { type: Number, required: true, min: 0, max: 1 },
  completeness: { type: Number, required: true, min: 0, max: 1 },
  relevance: { type: Number, required: true, min: 0, max: 1 },
  // Metadata
  auditTimestamp: { type: Date, default: Date.now, index: true },
  auditModel: { type: String, required: true },
  auditVersion: { type: String, required: true },
  // Compliance flags
  complianceFlags: [{ type: String }],
  requiresHumanReview: { type: Boolean, default: false, index: true },
  reviewedBy: String,
  reviewNotes: String,
  reviewTimestamp: Date
});

// Create indexes for better query performance
QuestionAnalyticsSchema.index({ agentId: 1, timestamp: -1 });
QuestionAnalyticsSchema.index({ questionHash: 1, agentId: 1 });
SourceAnalyticsSchema.index({ agentId: 1, usageCount: -1 });
UnansweredQuerySchema.index({ agentId: 1, timestamp: -1 });
SimilarityHeatmapSchema.index({ agentId: 1, timestamp: -1 });
BusinessInsightsSchema.index({ agentId: 1, date: -1 });

export const QuestionAnalytics = mongoose.model<IQuestionAnalytics>('QuestionAnalytics', QuestionAnalyticsSchema);
export const SourceAnalytics = mongoose.model<ISourceAnalytics>('SourceAnalytics', SourceAnalyticsSchema);
export const UnansweredQuery = mongoose.model<IUnansweredQuery>('UnansweredQuery', UnansweredQuerySchema);
export const SimilarityHeatmap = mongoose.model<ISimilarityHeatmap>('SimilarityHeatmap', SimilarityHeatmapSchema);
export const BusinessInsights = mongoose.model<IBusinessInsights>('BusinessInsights', BusinessInsightsSchema);
export const UserFeedback = mongoose.model<IUserFeedback>('UserFeedback', UserFeedbackSchema);
export const RetrainingSuggestion = mongoose.model<IRetrainingSuggestion>('RetrainingSuggestion', RetrainingSuggestionSchema);
export const ResponseAudit = mongoose.model<IResponseAudit>('ResponseAudit', ResponseAuditSchema); 