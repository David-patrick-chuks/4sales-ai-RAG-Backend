import { ResponseAudit, IResponseAudit } from '../models/Analytics.js';
import { generateReply } from './gemini.js';

export interface AuditResult {
  hallucinationRiskScore: number;
  hallucinationRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  auditReasoning: string;
  factualAccuracy: number;
  sourceAlignment: number;
  completeness: number;
  relevance: number;
  complianceFlags: string[];
  requiresHumanReview: boolean;
}

export interface AuditConfig {
  enableAuditing: boolean;
  auditThreshold: number; // Score above which to flag for review
  criticalThreshold: number; // Score above which to require immediate review
  auditModel: string;
  auditVersion: string;
}

export class WatchdogService {
  private static config: AuditConfig = {
    enableAuditing: true,
    auditThreshold: 0.7, // High risk threshold
    criticalThreshold: 0.9, // Critical risk threshold
    auditModel: 'gemini-1.5',
    auditVersion: '1.0.0'
  };

  /**
   * Audit an AI response for hallucination risk and quality
   */
  static async auditResponse(
    agentId: string,
    questionId: string,
    question: string,
    response: string,
    confidence: number,
    chunksUsed: number,
    sources: string[]
  ): Promise<AuditResult> {
    
    if (!this.config.enableAuditing) {
      return this.getDefaultAuditResult();
    }

    try {
      console.log(`🔍 Auditing response for agent ${agentId}, question: ${questionId}`);

      // Generate audit prompt
      const auditPrompt = this.generateAuditPrompt(question, response, confidence, chunksUsed, sources);
      
      // Get LLM audit
      const auditResponse = await generateReply(auditPrompt);
      
      // Parse audit results
      const auditResult = this.parseAuditResponse(auditResponse);
      
      // Store audit record
      await this.storeAuditRecord(
        agentId,
        questionId,
        question,
        response,
        confidence,
        chunksUsed,
        sources,
        auditResult
      );

      console.log(`✅ Audit completed - Risk Level: ${auditResult.hallucinationRiskLevel}, Score: ${auditResult.hallucinationRiskScore.toFixed(3)}`);
      
      return auditResult;

    } catch (error) {
      console.error('❌ Audit failed:', error);
      return this.getDefaultAuditResult();
    }
  }

  /**
   * Generate audit prompt for LLM evaluation
   */
  private static generateAuditPrompt(
    question: string,
    response: string,
    confidence: number,
    chunksUsed: number,
    sources: string[]
  ): string {
    return `
You are an expert AI response auditor. Analyze the following AI response for potential hallucination and quality issues.

QUESTION: ${question}

AI RESPONSE: ${response}

CONTEXT:
- Confidence Score: ${confidence}
- Chunks Used: ${chunksUsed}
- Sources: ${sources.join(', ') || 'None'}

Please evaluate this response and provide a JSON response with the following structure:

{
  "hallucinationRiskScore": 0.0-1.0,
  "hallucinationRiskLevel": "low|medium|high|critical",
  "auditReasoning": "Detailed explanation of your assessment",
  "factualAccuracy": 0.0-1.0,
  "sourceAlignment": 0.0-1.0,
  "completeness": 0.0-1.0,
  "relevance": 0.0-1.0,
  "complianceFlags": ["flag1", "flag2"],
  "requiresHumanReview": true/false
}

EVALUATION CRITERIA:
- Hallucination Risk: Does the response contain information not supported by the context?
- Factual Accuracy: Are the facts presented accurate and verifiable?
- Source Alignment: Does the response align with the provided sources?
- Completeness: Does the response fully address the question?
- Relevance: Is the response relevant to the question asked?

COMPLIANCE FLAGS:
- "missing_source": Response lacks proper source attribution
- "potential_hallucination": Contains information not in sources
- "low_confidence": Confidence score is concerning
- "incomplete_response": Response doesn't fully answer the question
- "irrelevant_content": Response contains off-topic information

Respond with ONLY the JSON object, no additional text.
`;
  }

  /**
   * Parse LLM audit response
   */
  private static parseAuditResponse(auditResponse: string): AuditResult {
    try {
      // Extract JSON from response
      const jsonMatch = auditResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in audit response');
      }

      const auditData = JSON.parse(jsonMatch[0]);

      // Validate and normalize scores
      const hallucinationRiskScore = Math.max(0, Math.min(1, auditData.hallucinationRiskScore || 0));
      const factualAccuracy = Math.max(0, Math.min(1, auditData.factualAccuracy || 0));
      const sourceAlignment = Math.max(0, Math.min(1, auditData.sourceAlignment || 0));
      const completeness = Math.max(0, Math.min(1, auditData.completeness || 0));
      const relevance = Math.max(0, Math.min(1, auditData.relevance || 0));

      // Determine risk level
      let hallucinationRiskLevel: 'low' | 'medium' | 'high' | 'critical';
      if (hallucinationRiskScore >= this.config.criticalThreshold) {
        hallucinationRiskLevel = 'critical';
      } else if (hallucinationRiskScore >= this.config.auditThreshold) {
        hallucinationRiskLevel = 'high';
      } else if (hallucinationRiskScore >= 0.4) {
        hallucinationRiskLevel = 'medium';
      } else {
        hallucinationRiskLevel = 'low';
      }

      // Determine if human review is required
      const requiresHumanReview = hallucinationRiskScore >= this.config.auditThreshold;

      return {
        hallucinationRiskScore,
        hallucinationRiskLevel,
        auditReasoning: auditData.auditReasoning || 'No reasoning provided',
        factualAccuracy,
        sourceAlignment,
        completeness,
        relevance,
        complianceFlags: auditData.complianceFlags || [],
        requiresHumanReview
      };

    } catch (error) {
      console.error('Failed to parse audit response:', error);
      return this.getDefaultAuditResult();
    }
  }

  /**
   * Store audit record in database
   */
  private static async storeAuditRecord(
    agentId: string,
    questionId: string,
    question: string,
    response: string,
    confidence: number,
    chunksUsed: number,
    sources: string[],
    auditResult: AuditResult
  ): Promise<void> {
    try {
      const auditRecord = new ResponseAudit({
        agentId,
        questionId,
        question,
        response,
        confidence,
        chunksUsed,
        sources,
        hallucinationRiskScore: auditResult.hallucinationRiskScore,
        hallucinationRiskLevel: auditResult.hallucinationRiskLevel,
        auditReasoning: auditResult.auditReasoning,
        factualAccuracy: auditResult.factualAccuracy,
        sourceAlignment: auditResult.sourceAlignment,
        completeness: auditResult.completeness,
        relevance: auditResult.relevance,
        auditModel: this.config.auditModel,
        auditVersion: this.config.auditVersion,
        complianceFlags: auditResult.complianceFlags,
        requiresHumanReview: auditResult.requiresHumanReview
      });

      await auditRecord.save();
      console.log(`📊 Audit record stored with ID: ${auditRecord._id}`);

    } catch (error) {
      console.error('Failed to store audit record:', error);
    }
  }

  /**
   * Get default audit result for failed audits
   */
  private static getDefaultAuditResult(): AuditResult {
    return {
      hallucinationRiskScore: 0.5,
      hallucinationRiskLevel: 'medium',
      auditReasoning: 'Audit failed - using default assessment',
      factualAccuracy: 0.5,
      sourceAlignment: 0.5,
      completeness: 0.5,
      relevance: 0.5,
      complianceFlags: ['audit_failed'],
      requiresHumanReview: true
    };
  }

  /**
   * Get audit statistics for an agent
   */
  static async getAuditStats(agentId: string, days: number = 30): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const audits = await ResponseAudit.find({
      agentId,
      auditTimestamp: { $gte: startDate }
    });

    const totalAudits = audits.length;
    const criticalAudits = audits.filter(a => a.hallucinationRiskLevel === 'critical').length;
    const highRiskAudits = audits.filter(a => a.hallucinationRiskLevel === 'high').length;
    const mediumRiskAudits = audits.filter(a => a.hallucinationRiskLevel === 'medium').length;
    const lowRiskAudits = audits.filter(a => a.hallucinationRiskLevel === 'low').length;

    const averageRiskScore = totalAudits > 0 
      ? audits.reduce((sum, a) => sum + a.hallucinationRiskScore, 0) / totalAudits 
      : 0;

    const averageAccuracy = totalAudits > 0 
      ? audits.reduce((sum, a) => sum + a.factualAccuracy, 0) / totalAudits 
      : 0;

    const pendingReviews = audits.filter(a => a.requiresHumanReview && !a.reviewedBy).length;

    return {
      totalAudits,
      riskDistribution: {
        critical: criticalAudits,
        high: highRiskAudits,
        medium: mediumRiskAudits,
        low: lowRiskAudits
      },
      averageRiskScore,
      averageAccuracy,
      pendingReviews,
      period: `${days} days`
    };
  }

  /**
   * Get high-risk responses requiring review
   */
  static async getHighRiskResponses(agentId: string, limit: number = 10): Promise<IResponseAudit[]> {
    return await ResponseAudit.find({
      agentId,
      requiresHumanReview: true,
      reviewedBy: { $exists: false }
    })
    .sort({ hallucinationRiskScore: -1, auditTimestamp: -1 })
    .limit(limit);
  }

  /**
   * Update audit configuration
   */
  static updateConfig(newConfig: Partial<AuditConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('🔧 Watchdog configuration updated:', this.config);
  }

  /**
   * Get current configuration
   */
  static getConfig(): AuditConfig {
    return { ...this.config };
  }
}