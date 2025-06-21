import { createHash } from 'crypto';
import {
    BusinessInsights,
    QuestionAnalytics,
    SimilarityHeatmap,
    SourceAnalytics,
    UnansweredQuery
} from '../models/Analytics.js';

export class AnalyticsService {
  
  /**
   * Generate hash for question deduplication
   */
  private generateQuestionHash(question: string, agentId: string): string {
    return createHash('sha256').update(`${agentId}:${question.toLowerCase().trim()}`).digest('hex');
  }

  /**
   * Track a successful question/answer interaction
   */
  async trackQuestion(
    agentId: string,
    question: string,
    responseTime: number,
    confidence: number,
    fallbackUsed: boolean,
    tokensUsed: number,
    chunksUsed: number,
    chunksSearched: number,
    averageSimilarity: number,
    sources: string[],
    userAgent?: string,
    ipAddress?: string,
    sessionId?: string
  ): Promise<void> {
    try {
      const questionHash = this.generateQuestionHash(question, agentId);
      
      // Track question analytics
      await QuestionAnalytics.create({
        agentId,
        question,
        questionHash,
        responseTime,
        confidence,
        fallbackUsed,
        tokensUsed,
        chunksUsed,
        chunksSearched,
        averageSimilarity,
        sources,
        userAgent,
        ipAddress,
        sessionId
      });

      // Update source analytics
      await this.updateSourceAnalytics(agentId, sources, confidence, tokensUsed);

      // Track similarity heatmap data
      await this.trackSimilarityHeatmap(agentId, question, sources, averageSimilarity, confidence);

      console.log(`📊 Analytics tracked for agent ${agentId}`);
    } catch (error) {
      console.error('❌ Error tracking analytics:', error);
    }
  }

  /**
   * Track an unanswered query
   */
  async trackUnansweredQuery(
    agentId: string,
    question: string,
    confidence: number,
    chunksSearched: number,
    averageSimilarity: number,
    userAgent?: string,
    ipAddress?: string,
    sessionId?: string
  ): Promise<void> {
    try {
      const questionHash = this.generateQuestionHash(question, agentId);
      
      await UnansweredQuery.create({
        agentId,
        question,
        questionHash,
        confidence,
        chunksSearched,
        averageSimilarity,
        userAgent,
        ipAddress,
        sessionId
      });

      console.log(`📊 Unanswered query tracked for agent ${agentId}`);
    } catch (error) {
      console.error('❌ Error tracking unanswered query:', error);
    }
  }

  /**
   * Update source analytics
   */
  private async updateSourceAnalytics(
    agentId: string, 
    sources: string[], 
    confidence: number, 
    tokensUsed: number
  ): Promise<void> {
    for (const source of sources) {
      try {
        const sourceData = await SourceAnalytics.findOne({ 
          agentId, 
          $or: [{ sourceUrl: source }, { fileName: source }] 
        });

        if (sourceData) {
          // Update existing source
          const newUsageCount = sourceData.usageCount + 1;
          const newTotalTokens = sourceData.totalTokensUsed + tokensUsed;
          const newTotalQuestions = sourceData.totalQuestionsAnswered + 1;
          const newAverageConfidence = (
            (sourceData.averageConfidence * sourceData.usageCount + confidence) / newUsageCount
          );

          await SourceAnalytics.updateOne(
            { _id: sourceData._id },
            {
              usageCount: newUsageCount,
              lastUsed: new Date(),
              averageConfidence: newAverageConfidence,
              totalTokensUsed: newTotalTokens,
              totalQuestionsAnswered: newTotalQuestions
            }
          );
        } else {
          // Create new source entry
          await SourceAnalytics.create({
            agentId,
            sourceUrl: source.startsWith('http') ? source : undefined,
            fileName: !source.startsWith('http') ? source : undefined,
            sourceType: this.determineSourceType(source),
            usageCount: 1,
            averageConfidence: confidence,
            totalTokensUsed: tokensUsed,
            totalQuestionsAnswered: 1
          });
        }
      } catch (error) {
        console.error('❌ Error updating source analytics:', error);
      }
    }
  }

  /**
   * Track similarity heatmap data
   */
  private async trackSimilarityHeatmap(
    agentId: string,
    question: string,
    sources: string[],
    averageSimilarity: number,
    confidence: number
  ): Promise<void> {
    try {
      // This would be enhanced with actual chunk data from the response
      await SimilarityHeatmap.create({
        agentId,
        question,
        chunkText: question, // Placeholder - would be actual chunk text
        chunkId: createHash('md5').update(question).digest('hex'),
        similarity: averageSimilarity,
        confidence,
        sourceUrl: sources[0] || undefined,
        sourceType: sources[0] ? this.determineSourceType(sources[0]) : 'unknown'
      });
    } catch (error) {
      console.error('❌ Error tracking similarity heatmap:', error);
    }
  }

  /**
   * Determine source type from source string
   */
  private determineSourceType(source: string): 'document' | 'website' | 'youtube' | 'audio' | 'video' {
    if (source.startsWith('http')) {
      if (source.includes('youtube.com') || source.includes('youtu.be')) {
        return 'youtube';
      }
      return 'website';
    }
    
    const extension = source.toLowerCase().split('.').pop();
    if (['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'].includes(extension || '')) {
      return 'audio';
    }
    if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(extension || '')) {
      return 'video';
    }
    
    return 'document';
  }

  /**
   * Generate daily business insights
   */
  async generateDailyInsights(agentId: string, date: Date = new Date()): Promise<void> {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Get daily statistics
      const [
        totalQuestions,
        answeredQuestions,
        unansweredQueries,
        topSources,
        topQuestions,
        userStats
      ] = await Promise.all([
        QuestionAnalytics.countDocuments({ 
          agentId, 
          timestamp: { $gte: startOfDay, $lte: endOfDay } 
        }),
        QuestionAnalytics.countDocuments({ 
          agentId, 
          timestamp: { $gte: startOfDay, $lte: endOfDay },
          fallbackUsed: false 
        }),
        UnansweredQuery.countDocuments({ 
          agentId, 
          timestamp: { $gte: startOfDay, $lte: endOfDay } 
        }),
        SourceAnalytics.find({ agentId })
          .sort({ usageCount: -1 })
          .limit(10)
          .lean(),
        QuestionAnalytics.aggregate([
          { $match: { agentId, timestamp: { $gte: startOfDay, $lte: endOfDay } } },
          { $group: { _id: '$questionHash', question: { $first: '$question' }, count: { $sum: 1 }, avgConfidence: { $avg: '$confidence' } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]),
        QuestionAnalytics.aggregate([
          { $match: { agentId, timestamp: { $gte: startOfDay, $lte: endOfDay } } },
          { $group: { _id: null, avgConfidence: { $avg: '$confidence' }, avgResponseTime: { $avg: '$responseTime' }, totalTokens: { $sum: '$tokensUsed' }, uniqueSessions: { $addToSet: '$sessionId' }, uniqueUsers: { $addToSet: '$ipAddress' } } }
        ])
      ]);

      const userStatsResult = userStats[0] || { avgConfidence: 0, avgResponseTime: 0, totalTokens: 0, uniqueSessions: [], uniqueUsers: [] };

      // Create or update business insights
      await BusinessInsights.findOneAndUpdate(
        { agentId, date: startOfDay },
        {
          totalQuestions,
          answeredQuestions,
          unansweredQuestions: unansweredQueries,
          averageConfidence: userStatsResult.avgConfidence || 0,
          averageResponseTime: userStatsResult.avgResponseTime || 0,
          totalTokensUsed: userStatsResult.totalTokens || 0,
          topSources: topSources.map(source => ({
            sourceUrl: source.sourceUrl,
            fileName: source.fileName,
            usageCount: source.usageCount,
            averageConfidence: source.averageConfidence
          })),
          topQuestions: topQuestions.map(q => ({
            question: q.question,
            count: q.count,
            averageConfidence: q.avgConfidence
          })),
          userSessions: userStatsResult.uniqueSessions?.length || 0,
          uniqueUsers: userStatsResult.uniqueUsers?.length || 0
        },
        { upsert: true, new: true }
      );

      console.log(`📊 Daily insights generated for agent ${agentId}`);
    } catch (error) {
      console.error('❌ Error generating daily insights:', error);
    }
  }

  /**
   * Get analytics dashboard data
   */
  async getDashboardData(agentId: string, days: number = 30): Promise<any> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const [
        totalQuestions,
        answeredQuestions,
        unansweredQueries,
        averageConfidence,
        topSources,
        topQuestions,
        unansweredQuestions,
        dailyInsights
      ] = await Promise.all([
        QuestionAnalytics.countDocuments({ agentId, timestamp: { $gte: startDate } }),
        QuestionAnalytics.countDocuments({ agentId, timestamp: { $gte: startDate }, fallbackUsed: false }),
        UnansweredQuery.countDocuments({ agentId, timestamp: { $gte: startDate } }),
        QuestionAnalytics.aggregate([
          { $match: { agentId, timestamp: { $gte: startDate } } },
          { $group: { _id: null, avgConfidence: { $avg: '$confidence' } } }
        ]),
        SourceAnalytics.find({ agentId }).sort({ usageCount: -1 }).limit(10).lean(),
        QuestionAnalytics.aggregate([
          { $match: { agentId, timestamp: { $gte: startDate } } },
          { $group: { _id: '$questionHash', question: { $first: '$question' }, count: { $sum: 1 }, avgConfidence: { $avg: '$confidence' } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]),
        UnansweredQuery.find({ agentId, timestamp: { $gte: startDate } })
          .sort({ timestamp: -1 })
          .limit(20)
          .lean(),
        BusinessInsights.find({ agentId, date: { $gte: startDate } })
          .sort({ date: 1 })
          .lean()
      ]);

      return {
        overview: {
          totalQuestions,
          answeredQuestions,
          unansweredQueries,
          averageConfidence: averageConfidence[0]?.avgConfidence || 0,
          answerRate: totalQuestions > 0 ? (answeredQuestions / totalQuestions) * 100 : 0
        },
        topSources,
        topQuestions,
        unansweredQuestions,
        dailyInsights: dailyInsights.map(insight => ({
          date: insight.date,
          totalQuestions: insight.totalQuestions,
          answeredQuestions: insight.answeredQuestions,
          averageConfidence: insight.averageConfidence,
          totalTokensUsed: insight.totalTokensUsed
        }))
      };
    } catch (error) {
      console.error('❌ Error getting dashboard data:', error);
      throw error;
    }
  }

  /**
   * Get top questions for an agent
   */
  async getTopQuestions(agentId: string, limit: number = 20, startDate?: Date): Promise<any[]> {
    try {
      const matchStage: any = { agentId };
      if (startDate) {
        matchStage.timestamp = { $gte: startDate };
      }

      const topQuestions = await QuestionAnalytics.aggregate([
        { $match: matchStage },
        { $group: { 
          _id: '$questionHash', 
          question: { $first: '$question' }, 
          count: { $sum: 1 }, 
          avgConfidence: { $avg: '$confidence' },
          avgResponseTime: { $avg: '$responseTime' },
          lastAsked: { $max: '$timestamp' }
        }},
        { $sort: { count: -1 } },
        { $limit: limit }
      ]);

      return topQuestions;
    } catch (error) {
      console.error('❌ Error getting top questions:', error);
      throw error;
    }
  }

  /**
   * Get top sources for an agent
   */
  async getTopSources(agentId: string, limit: number = 20, startDate?: Date): Promise<any[]> {
    try {
      const matchStage: any = { agentId };
      if (startDate) {
        matchStage.lastUsed = { $gte: startDate };
      }

      const topSources = await SourceAnalytics.find(matchStage)
        .sort({ usageCount: -1 })
        .limit(limit)
        .lean();

      return topSources;
    } catch (error) {
      console.error('❌ Error getting top sources:', error);
      throw error;
    }
  }

  /**
   * Get unanswered queries for an agent
   */
  async getUnansweredQueries(
    agentId: string, 
    limit: number = 50, 
    startDate?: Date, 
    minConfidence: number = 0
  ): Promise<any[]> {
    try {
      const matchStage: any = { 
        agentId, 
        confidence: { $gte: minConfidence } 
      };
      if (startDate) {
        matchStage.timestamp = { $gte: startDate };
      }

      const unansweredQueries = await UnansweredQuery.find(matchStage)
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();

      return unansweredQueries;
    } catch (error) {
      console.error('❌ Error getting unanswered queries:', error);
      throw error;
    }
  }

  /**
   * Get similarity heatmap data
   */
  async getSimilarityHeatmap(
    agentId: string, 
    limit: number = 100, 
    startDate?: Date, 
    minSimilarity: number = 0.5
  ): Promise<any[]> {
    try {
      const matchStage: any = { 
        agentId, 
        similarity: { $gte: minSimilarity } 
      };
      if (startDate) {
        matchStage.timestamp = { $gte: startDate };
      }

      const heatmapData = await SimilarityHeatmap.find(matchStage)
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();

      return heatmapData;
    } catch (error) {
      console.error('❌ Error getting similarity heatmap:', error);
      throw error;
    }
  }

  /**
   * Get business insights for an agent
   */
  async getBusinessInsights(agentId: string, days: number = 30): Promise<any> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const insights = await BusinessInsights.find({ 
        agentId, 
        date: { $gte: startDate } 
      })
        .sort({ date: 1 })
        .lean();

      // Calculate trends
      const trends = this.calculateTrends(insights);

      return {
        insights,
        trends,
        summary: {
          totalDays: insights.length,
          averageQuestionsPerDay: insights.length > 0 ? 
            insights.reduce((sum, day) => sum + day.totalQuestions, 0) / insights.length : 0,
          averageConfidence: insights.length > 0 ? 
            insights.reduce((sum, day) => sum + day.averageConfidence, 0) / insights.length : 0,
          totalTokensUsed: insights.reduce((sum, day) => sum + day.totalTokensUsed, 0)
        }
      };
    } catch (error) {
      console.error('❌ Error getting business insights:', error);
      throw error;
    }
  }

  /**
   * Calculate trends from insights data
   */
  private calculateTrends(insights: any[]): any {
    if (insights.length < 2) {
      return {
        questionsTrend: 0,
        confidenceTrend: 0,
        tokensTrend: 0
      };
    }

    const recent = insights.slice(-7); // Last 7 days
    const previous = insights.slice(-14, -7); // 7 days before that

    const recentAvg = {
      questions: recent.reduce((sum, day) => sum + day.totalQuestions, 0) / recent.length,
      confidence: recent.reduce((sum, day) => sum + day.averageConfidence, 0) / recent.length,
      tokens: recent.reduce((sum, day) => sum + day.totalTokensUsed, 0) / recent.length
    };

    const previousAvg = {
      questions: previous.reduce((sum, day) => sum + day.totalQuestions, 0) / previous.length,
      confidence: previous.reduce((sum, day) => sum + day.averageConfidence, 0) / previous.length,
      tokens: previous.reduce((sum, day) => sum + day.totalTokensUsed, 0) / previous.length
    };

    return {
      questionsTrend: previousAvg.questions > 0 ? 
        ((recentAvg.questions - previousAvg.questions) / previousAvg.questions) * 100 : 0,
      confidenceTrend: previousAvg.confidence > 0 ? 
        ((recentAvg.confidence - previousAvg.confidence) / previousAvg.confidence) * 100 : 0,
      tokensTrend: previousAvg.tokens > 0 ? 
        ((recentAvg.tokens - previousAvg.tokens) / previousAvg.tokens) * 100 : 0
    };
  }

  /**
   * Export analytics data
   */
  async exportAnalytics(agentId: string, days: number = 30, format: string = 'json'): Promise<any> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const [
        questions,
        sources,
        unanswered,
        insights
      ] = await Promise.all([
        QuestionAnalytics.find({ agentId, timestamp: { $gte: startDate } }).lean(),
        SourceAnalytics.find({ agentId }).lean(),
        UnansweredQuery.find({ agentId, timestamp: { $gte: startDate } }).lean(),
        BusinessInsights.find({ agentId, date: { $gte: startDate } }).lean()
      ]);

      const exportData = {
        agentId,
        exportDate: new Date().toISOString(),
        period: { startDate, endDate: new Date() },
        questions,
        sources,
        unanswered,
        insights
      };

      if (format === 'csv') {
        return this.convertToCSV(exportData);
      }

      return exportData;
    } catch (error) {
      console.error('❌ Error exporting analytics:', error);
      throw error;
    }
  }

  /**
   * Convert analytics data to CSV format
   */
  private convertToCSV(data: any): string {
    const csvRows = [];
    
    // Questions CSV
    csvRows.push('=== QUESTIONS ===');
    csvRows.push('Question,Count,Average Confidence,Average Response Time,Last Asked');
    
    const questionStats = data.questions.reduce((acc: any, q: any) => {
      const hash = q.questionHash;
      if (!acc[hash]) {
        acc[hash] = {
          question: q.question,
          count: 0,
          totalConfidence: 0,
          totalResponseTime: 0,
          lastAsked: q.timestamp
        };
      }
      acc[hash].count++;
      acc[hash].totalConfidence += q.confidence;
      acc[hash].totalResponseTime += q.responseTime;
      if (q.timestamp > acc[hash].lastAsked) {
        acc[hash].lastAsked = q.timestamp;
      }
      return acc;
    }, {});

    Object.values(questionStats).forEach((q: any) => {
      csvRows.push(`"${q.question}",${q.count},${(q.totalConfidence / q.count).toFixed(3)},${(q.totalResponseTime / q.count).toFixed(2)},${q.lastAsked}`);
    });

    // Sources CSV
    csvRows.push('\n=== SOURCES ===');
    csvRows.push('Source,Type,Usage Count,Average Confidence,Total Tokens Used');
    
    data.sources.forEach((s: any) => {
      const sourceName = s.sourceUrl || s.fileName || 'Unknown';
      csvRows.push(`"${sourceName}",${s.sourceType},${s.usageCount},${s.averageConfidence.toFixed(3)},${s.totalTokensUsed}`);
    });

    // Unanswered CSV
    csvRows.push('\n=== UNANSWERED QUERIES ===');
    csvRows.push('Question,Confidence,Chunks Searched,Average Similarity,Timestamp');
    
    data.unanswered.forEach((u: any) => {
      csvRows.push(`"${u.question}",${u.confidence.toFixed(3)},${u.chunksSearched},${u.averageSimilarity.toFixed(3)},${u.timestamp}`);
    });

    return csvRows.join('\n');
  }
}

export const analyticsService = new AnalyticsService(); 