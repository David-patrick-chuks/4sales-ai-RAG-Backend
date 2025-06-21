import express, { NextFunction, Request, Response } from 'express';
import { ResponseAudit } from '../models/Analytics.js';
import { WatchdogService } from '../services/watchdog.js';
import { sanitizeAgentId } from '../utils/security.js';

const router = express.Router();

// Input validation middleware
const validateAuditRequest = (req: Request, res: Response, next: NextFunction) => {
  const { agentId, questionId, question, response, confidence, chunksUsed, sources } = req.body;

  // Sanitize and validate agentId
  const agentIdValidation = sanitizeAgentId(agentId);
  if (!agentIdValidation.isValid) {
    return res.status(400).json({
      error: agentIdValidation.error,
      field: 'agentId'
    });
  }

  // Validate required fields
  if (!questionId || typeof questionId !== 'string') {
    return res.status(400).json({
      error: 'questionId is required and must be a string',
      field: 'questionId'
    });
  }

  if (!question || typeof question !== 'string') {
    return res.status(400).json({
      error: 'question is required and must be a string',
      field: 'question'
    });
  }

  if (!response || typeof response !== 'string') {
    return res.status(400).json({
      error: 'response is required and must be a string',
      field: 'response'
    });
  }

  if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
    return res.status(400).json({
      error: 'confidence must be a number between 0 and 1',
      field: 'confidence'
    });
  }

  // Replace with sanitized values
  req.body.agentId = agentIdValidation.sanitized;

  next();
};

/**
 * @swagger
 * /api/watchdog/audit:
 *   post:
 *     summary: Audit an AI agent response for hallucination risk
 *     description: Analyze an AI agent's response to detect potential hallucinations, factual inaccuracies, and compliance issues
 *     tags: [Watchdog]
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
 *               - questionId
 *               - question
 *               - response
 *               - confidence
 *             properties:
 *               agentId:
 *                 type: string
 *                 description: Unique identifier for the AI agent
 *                 example: "sales-agent-001"
 *                 maxLength: 100
 *               questionId:
 *                 type: string
 *                 description: Unique identifier for the question/query
 *                 example: "q_12345"
 *               question:
 *                 type: string
 *                 description: The original question that was asked
 *                 example: "What are the pricing tiers for your service?"
 *               response:
 *                 type: string
 *                 description: The AI agent's response to audit
 *                 example: "Our service has three pricing tiers: Basic ($29/month), Pro ($79/month), and Enterprise (custom pricing)."
 *               confidence:
 *                 type: number
 *                 format: float
 *                 minimum: 0
 *                 maximum: 1
 *                 description: Confidence score of the response
 *                 example: 0.85
 *               chunksUsed:
 *                 type: integer
 *                 description: Number of knowledge chunks used in the response
 *                 example: 3
 *               sources:
 *                 type: array
 *                 items:
 *                   type: object
 *                 description: Sources used in the response
 *     responses:
 *       200:
 *         description: Response audited successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 audit:
 *                   type: object
 *                   properties:
 *                     hallucinationRiskScore:
 *                       type: number
 *                       format: float
 *                       description: Calculated hallucination risk score (0-1)
 *                     hallucinationRiskLevel:
 *                       type: string
 *                       enum: [low, medium, high, critical]
 *                       description: Risk level classification
 *                     requiresHumanReview:
 *                       type: boolean
 *                       description: Whether the response needs human review
 *                     factualAccuracy:
 *                       type: number
 *                       format: float
 *                       description: Factual accuracy score (0-1)
 *                     sourceAlignment:
 *                       type: number
 *                       format: float
 *                       description: Alignment with provided sources (0-1)
 *                     completeness:
 *                       type: number
 *                       format: float
 *                       description: Response completeness score (0-1)
 *                     relevance:
 *                       type: number
 *                       format: float
 *                       description: Response relevance score (0-1)
 *                     complianceFlags:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Any compliance issues detected
 *                     auditReasoning:
 *                       type: string
 *                       description: Explanation of the audit results
 *                 message:
 *                   type: string
 *                   description: User-friendly message about the audit result
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized - Invalid API token
 *       500:
 *         description: Internal server error
 */
router.post('/audit', validateAuditRequest, async (req: Request, res: Response) => {
  try {
    const { 
      agentId, 
      questionId, 
      question, 
      response, 
      confidence, 
      chunksUsed = 0,
      sources = []
    } = req.body;

    console.log(`🔍 Manual audit request for agent ${agentId}, question: ${questionId}`);

    const auditResult = await WatchdogService.auditResponse(
      agentId,
      questionId,
      question,
      response,
      confidence,
      chunksUsed,
      sources
    );

    res.json({
      success: true,
      audit: auditResult,
      message: auditResult.requiresHumanReview 
        ? 'Response flagged for human review due to high hallucination risk.'
        : 'Response passed audit with acceptable risk level.'
    });

  } catch (error) {
    console.error('Watchdog audit error:', error);
    res.status(500).json({
      error: 'Failed to audit response',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /api/watchdog/stats/{agentId}:
 *   get:
 *     summary: Get audit statistics for an agent
 *     description: Retrieve comprehensive audit statistics and risk metrics for an AI agent
 *     tags: [Watchdog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique identifier for the AI agent
 *         example: "sales-agent-001"
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 365
 *           default: 30
 *         description: Number of days to include in statistics
 *         example: 30
 *     responses:
 *       200:
 *         description: Audit statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 stats:
 *                   type: object
 *                   properties:
 *                     totalAudits:
 *                       type: integer
 *                       description: Total number of audits performed
 *                     averageRiskScore:
 *                       type: number
 *                       format: float
 *                       description: Average hallucination risk score
 *                     riskDistribution:
 *                       type: object
 *                       properties:
 *                         low:
 *                           type: integer
 *                           description: Number of low-risk responses
 *                         medium:
 *                           type: integer
 *                           description: Number of medium-risk responses
 *                         high:
 *                           type: integer
 *                           description: Number of high-risk responses
 *                         critical:
 *                           type: integer
 *                           description: Number of critical-risk responses
 *                     humanReviewsRequired:
 *                       type: integer
 *                       description: Number of responses requiring human review
 *                     averageFactualAccuracy:
 *                       type: number
 *                       format: float
 *                       description: Average factual accuracy score
 *                     averageSourceAlignment:
 *                       type: number
 *                       format: float
 *                       description: Average source alignment score
 *                     complianceIssues:
 *                       type: integer
 *                       description: Number of compliance issues detected
 *                     period:
 *                       type: string
 *                       description: Time period covered by statistics
 *       400:
 *         description: Invalid agent ID
 *       401:
 *         description: Unauthorized - Invalid API token
 *       500:
 *         description: Internal server error
 */
router.get('/stats/:agentId', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const days = parseInt(req.query.days as string) || 30;

    // Sanitize agentId
    const agentIdValidation = sanitizeAgentId(agentId);
    if (!agentIdValidation.isValid) {
      return res.status(400).json({
        error: agentIdValidation.error,
        field: 'agentId'
      });
    }

    const stats = await WatchdogService.getAuditStats(agentIdValidation.sanitized!, days);

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Get audit stats error:', error);
    res.status(500).json({
      error: 'Failed to get audit statistics',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /api/watchdog/high-risk/{agentId}:
 *   get:
 *     summary: Get high-risk responses for an agent
 *     description: Retrieve responses that have been flagged as high-risk or requiring human review
 *     tags: [Watchdog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique identifier for the AI agent
 *         example: "sales-agent-001"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Maximum number of high-risk responses to return
 *         example: 10
 *     responses:
 *       200:
 *         description: High-risk responses retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 highRiskResponses:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: Audit record ID
 *                       questionId:
 *                         type: string
 *                         description: Question identifier
 *                       question:
 *                         type: string
 *                         description: The original question
 *                       response:
 *                         type: string
 *                         description: The AI agent's response
 *                       confidence:
 *                         type: number
 *                         format: float
 *                         description: Original confidence score
 *                       hallucinationRiskScore:
 *                         type: number
 *                         format: float
 *                         description: Calculated hallucination risk score
 *                       hallucinationRiskLevel:
 *                         type: string
 *                         enum: [low, medium, high, critical]
 *                         description: Risk level classification
 *                       auditReasoning:
 *                         type: string
 *                         description: Explanation of why this was flagged
 *                       factualAccuracy:
 *                         type: number
 *                         format: float
 *                         description: Factual accuracy score
 *                       sourceAlignment:
 *                         type: number
 *                         format: float
 *                         description: Source alignment score
 *                       completeness:
 *                         type: number
 *                         format: float
 *                         description: Response completeness score
 *                       relevance:
 *                         type: number
 *                         format: float
 *                         description: Response relevance score
 *                       complianceFlags:
 *                         type: array
 *                         items:
 *                           type: string
 *                         description: Compliance issues detected
 *                       auditTimestamp:
 *                         type: string
 *                         format: date-time
 *                         description: When the audit was performed
 *                       sources:
 *                         type: array
 *                         items:
 *                           type: object
 *                         description: Sources used in the response
 *                 total:
 *                   type: integer
 *                   description: Total number of high-risk responses
 *       400:
 *         description: Invalid agent ID
 *       401:
 *         description: Unauthorized - Invalid API token
 *       500:
 *         description: Internal server error
 */
router.get('/high-risk/:agentId', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    // Sanitize agentId
    const agentIdValidation = sanitizeAgentId(agentId);
    if (!agentIdValidation.isValid) {
      return res.status(400).json({
        error: agentIdValidation.error,
        field: 'agentId'
      });
    }

    const highRiskResponses = await WatchdogService.getHighRiskResponses(agentIdValidation.sanitized!, limit);

    res.json({
      success: true,
      highRiskResponses: highRiskResponses.map(audit => ({
        id: audit._id,
        questionId: audit.questionId,
        question: audit.question,
        response: audit.response,
        confidence: audit.confidence,
        hallucinationRiskScore: audit.hallucinationRiskScore,
        hallucinationRiskLevel: audit.hallucinationRiskLevel,
        auditReasoning: audit.auditReasoning,
        factualAccuracy: audit.factualAccuracy,
        sourceAlignment: audit.sourceAlignment,
        completeness: audit.completeness,
        relevance: audit.relevance,
        complianceFlags: audit.complianceFlags,
        auditTimestamp: audit.auditTimestamp,
        sources: audit.sources
      })),
      total: highRiskResponses.length
    });

  } catch (error) {
    console.error('Get high-risk responses error:', error);
    res.status(500).json({
      error: 'Failed to get high-risk responses',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /api/watchdog/review/{id}:
 *   post:
 *     summary: Mark an audit as reviewed by human
 *     description: Update an audit record to indicate it has been reviewed by a human reviewer
 *     tags: [Watchdog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique identifier for the audit record
 *         example: "64f8a1b2c3d4e5f6a7b8c9d0"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reviewedBy
 *             properties:
 *               reviewedBy:
 *                 type: string
 *                 description: Name or ID of the human reviewer
 *                 example: "john.doe@company.com"
 *                 maxLength: 100
 *               reviewNotes:
 *                 type: string
 *                 description: Notes from the human review
 *                 example: "Confirmed this was a hallucination - agent provided incorrect pricing information"
 *                 maxLength: 1000
 *               action:
 *                 type: string
 *                 enum: [confirmed_hallucination, false_positive, approved, rejected]
 *                 description: Action taken based on the review
 *                 example: "confirmed_hallucination"
 *     responses:
 *       200:
 *         description: Audit marked as reviewed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: "Audit marked as reviewed"
 *                 audit:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: Audit record ID
 *                     questionId:
 *                       type: string
 *                       description: Question identifier
 *                     reviewedBy:
 *                       type: string
 *                       description: Name of the reviewer
 *                     reviewTimestamp:
 *                       type: string
 *                       format: date-time
 *                       description: When the review was performed
 *                     complianceFlags:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Updated compliance flags
 *       400:
 *         description: Invalid request parameters
 *       404:
 *         description: Audit record not found
 *       401:
 *         description: Unauthorized - Invalid API token
 *       500:
 *         description: Internal server error
 */
// POST /api/watchdog/review/:id - Mark audit as reviewed
router.post('/review/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reviewedBy, reviewNotes, action } = req.body;

    if (!reviewedBy || typeof reviewedBy !== 'string') {
      return res.status(400).json({
        error: 'reviewedBy is required and must be a string',
        field: 'reviewedBy'
      });
    }

    const audit = await ResponseAudit.findById(id);
    if (!audit) {
      return res.status(404).json({
        error: 'Audit record not found'
      });
    }

    audit.reviewedBy = reviewedBy;
    audit.reviewNotes = reviewNotes;
    audit.reviewTimestamp = new Date();

    // Update compliance flags based on action
    if (action === 'confirmed_hallucination') {
      audit.complianceFlags.push('confirmed_hallucination');
    } else if (action === 'false_positive') {
      audit.complianceFlags.push('false_positive');
    }

    await audit.save();

    res.json({
      success: true,
      message: 'Audit marked as reviewed',
      audit: {
        id: audit._id,
        questionId: audit.questionId,
        reviewedBy: audit.reviewedBy,
        reviewTimestamp: audit.reviewTimestamp,
        complianceFlags: audit.complianceFlags
      }
    });

  } catch (error) {
    console.error('Mark audit as reviewed error:', error);
    res.status(500).json({
      error: 'Failed to mark audit as reviewed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /api/watchdog/config:
 *   get:
 *     summary: Get watchdog configuration
 *     description: Retrieve the current configuration settings for the watchdog service
 *     tags: [Watchdog]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Watchdog configuration retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 config:
 *                   type: object
 *                   properties:
 *                     enableAuditing:
 *                       type: boolean
 *                       description: Whether auditing is enabled
 *                       example: true
 *                     auditThreshold:
 *                       type: number
 *                       format: float
 *                       minimum: 0
 *                       maximum: 1
 *                       description: Threshold for triggering audits (0-1)
 *                       example: 0.7
 *                     criticalThreshold:
 *                       type: number
 *                       format: float
 *                       minimum: 0
 *                       maximum: 1
 *                       description: Threshold for critical risk alerts (0-1)
 *                       example: 0.9
 *                     auditModel:
 *                       type: string
 *                       description: AI model used for auditing
 *                       example: "gemini-pro"
 *                     auditVersion:
 *                       type: string
 *                       description: Version of the audit model
 *                       example: "1.0.0"
 *       401:
 *         description: Unauthorized - Invalid API token
 *       500:
 *         description: Internal server error
 */
// GET /api/watchdog/config - Get watchdog configuration
router.get('/config', (req: Request, res: Response) => {
  const config = WatchdogService.getConfig();
  res.json({
    success: true,
    config
  });
});

/**
 * @swagger
 * /api/watchdog/config:
 *   post:
 *     summary: Update watchdog configuration
 *     description: Update the configuration settings for the watchdog service
 *     tags: [Watchdog]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enableAuditing:
 *                 type: boolean
 *                 description: Whether to enable auditing
 *                 example: true
 *               auditThreshold:
 *                 type: number
 *                 format: float
 *                 minimum: 0
 *                 maximum: 1
 *                 description: Threshold for triggering audits (0-1)
 *                 example: 0.7
 *               criticalThreshold:
 *                 type: number
 *                 format: float
 *                 minimum: 0
 *                 maximum: 1
 *                 description: Threshold for critical risk alerts (0-1)
 *                 example: 0.9
 *               auditModel:
 *                 type: string
 *                 description: AI model to use for auditing
 *                 example: "gemini-pro"
 *               auditVersion:
 *                 type: string
 *                 description: Version of the audit model
 *                 example: "1.0.0"
 *     responses:
 *       200:
 *         description: Watchdog configuration updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: "Watchdog configuration updated"
 *                 config:
 *                   type: object
 *                   properties:
 *                     enableAuditing:
 *                       type: boolean
 *                       description: Whether auditing is enabled
 *                     auditThreshold:
 *                       type: number
 *                       format: float
 *                       description: Threshold for triggering audits
 *                     criticalThreshold:
 *                       type: number
 *                       format: float
 *                       description: Threshold for critical risk alerts
 *                     auditModel:
 *                       type: string
 *                       description: AI model used for auditing
 *                     auditVersion:
 *                       type: string
 *                       description: Version of the audit model
 *       400:
 *         description: Invalid configuration parameters
 *       401:
 *         description: Unauthorized - Invalid API token
 *       500:
 *         description: Internal server error
 */
// POST /api/watchdog/config - Update watchdog configuration
router.post('/config', (req: Request, res: Response) => {
  try {
    const { enableAuditing, auditThreshold, criticalThreshold, auditModel, auditVersion } = req.body;

    const updates: any = {};
    
    if (typeof enableAuditing === 'boolean') {
      updates.enableAuditing = enableAuditing;
    }
    
    if (typeof auditThreshold === 'number' && auditThreshold >= 0 && auditThreshold <= 1) {
      updates.auditThreshold = auditThreshold;
    }
    
    if (typeof criticalThreshold === 'number' && criticalThreshold >= 0 && criticalThreshold <= 1) {
      updates.criticalThreshold = criticalThreshold;
    }
    
    if (typeof auditModel === 'string') {
      updates.auditModel = auditModel;
    }
    
    if (typeof auditVersion === 'string') {
      updates.auditVersion = auditVersion;
    }

    WatchdogService.updateConfig(updates);

    res.json({
      success: true,
      message: 'Watchdog configuration updated',
      config: WatchdogService.getConfig()
    });

  } catch (error) {
    console.error('Update watchdog config error:', error);
    res.status(500).json({
      error: 'Failed to update watchdog configuration',
      timestamp: new Date().toISOString()
    });
  }
});

export default router; 