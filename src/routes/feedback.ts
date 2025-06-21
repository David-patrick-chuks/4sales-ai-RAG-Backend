import express, { NextFunction, Request, Response } from 'express';
import { FeedbackService } from '../services/feedback';
import { sanitizeAgentId, sanitizeQuestion } from '../utils/security';

const router = express.Router();

// Input validation middleware
const validateFeedbackRequest = (req: Request, res: Response, next: NextFunction) => {
  const { agentId, questionId, feedbackText } = req.body;

  // Sanitize and validate agentId
  const agentIdValidation = sanitizeAgentId(agentId);
  if (!agentIdValidation.isValid) {
    return res.status(400).json({
      error: agentIdValidation.error,
      field: 'agentId'
    });
  }

  // Validate questionId
  if (!questionId || typeof questionId !== 'string') {
    return res.status(400).json({
      error: 'questionId is required and must be a string',
      field: 'questionId'
    });
  }

  // Sanitize feedback text if provided
  if (feedbackText && typeof feedbackText === 'string') {
    const questionValidation = sanitizeQuestion(feedbackText);
    if (!questionValidation.isValid) {
      return res.status(400).json({
        error: questionValidation.error,
        field: 'feedbackText'
      });
    }
    req.body.feedbackText = questionValidation.sanitized;
  }

  // Replace with sanitized values
  req.body.agentId = agentIdValidation.sanitized;

  next();
};

/**
 * @swagger
 * /api/feedback:
 *   post:
 *     summary: Submit user feedback for an AI agent response
 *     description: Submit feedback about the quality and accuracy of an AI agent's response to help improve future responses
 *     tags: [Feedback]
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
 *                 example: "What are the benefits of your premium plan?"
 *               originalReply:
 *                 type: string
 *                 description: The AI agent's original response
 *                 example: "Our premium plan offers 24/7 support, advanced features..."
 *               confidence:
 *                 type: number
 *                 format: float
 *                 minimum: 0
 *                 maximum: 1
 *                 description: Confidence score of the original response
 *                 example: 0.85
 *               feedbackText:
 *                 type: string
 *                 description: User's feedback text (optional)
 *                 example: "The response was helpful but could be more detailed"
 *                 maxLength: 1000
 *               chunksUsed:
 *                 type: integer
 *                 description: Number of knowledge chunks used in the response
 *                 example: 3
 *               averageSimilarity:
 *                 type: number
 *                 format: float
 *                 description: Average similarity score of used chunks
 *                 example: 0.75
 *               sources:
 *                 type: array
 *                 items:
 *                   type: object
 *                 description: Sources used in the response
 *     responses:
 *       200:
 *         description: Feedback submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 feedback:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: Feedback ID
 *                     userSatisfaction:
 *                       type: string
 *                       enum: [explicit_positive, implicit_positive, neutral, implicit_negative, explicit_negative]
 *                       description: Detected user satisfaction level
 *                     suggestedTopics:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Suggested topics for improvement
 *                     suggestedSources:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Suggested sources for improvement
 *                 retrainingSuggestions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       description:
 *                         type: string
 *                       priority:
 *                         type: string
 *                         enum: [low, medium, high, critical]
 *                       suggestedTopics:
 *                         type: array
 *                         items:
 *                           type: string
 *                       suggestedSources:
 *                         type: array
 *                         items:
 *                           type: string
 *                 message:
 *                   type: string
 *                   description: User-friendly response message
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized - Invalid API token
 *       500:
 *         description: Internal server error
 */
router.post('/', validateFeedbackRequest, async (req: Request, res: Response) => {
  try {
    const { 
      agentId, 
      questionId, 
      question, 
      originalReply, 
      confidence, 
      feedbackText,
      chunksUsed = 0,
      averageSimilarity = 0,
      sources = []
    } = req.body;

    console.log(`📝 Processing feedback for agent ${agentId}, question: ${questionId}`);

    // Store the feedback
    const feedback = await FeedbackService.storeFeedback(
      agentId,
      questionId,
      question,
      originalReply,
      confidence,
      'neutral', // Will be determined by the service
      feedbackText,
      req.session?.id,
      req.ip,
      req.get('User-Agent'),
      chunksUsed,
      averageSimilarity,
      sources
    );

    // Get retraining suggestions
    const suggestions = await FeedbackService.getRetrainingSuggestions(agentId, 3);

    res.json({
      success: true,
      feedback: {
        id: feedback._id,
        userSatisfaction: feedback.userSatisfaction,
        suggestedTopics: feedback.suggestedTopics,
        suggestedSources: feedback.suggestedSources
      },
      retrainingSuggestions: suggestions.map(s => ({
        id: s._id,
        title: s.title,
        description: s.description,
        priority: s.priority,
        suggestedTopics: s.suggestedTopics,
        suggestedSources: s.suggestedSources
      })),
      message: feedback.userSatisfaction === 'explicit_negative' 
        ? 'Thank you for your feedback. We\'ll work on improving our responses for this topic.'
        : 'Thank you for your feedback!'
    });

  } catch (error) {
    console.error('Feedback route error:', error);
    res.status(500).json({
      error: 'Failed to process feedback',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /api/feedback/suggestions/{agentId}:
 *   get:
 *     summary: Get retraining suggestions for an agent
 *     description: Retrieve AI-generated suggestions for improving an agent's knowledge based on user feedback
 *     tags: [Feedback]
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
 *         description: Maximum number of suggestions to return
 *         example: 10
 *     responses:
 *       200:
 *         description: Retraining suggestions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 suggestions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: Suggestion ID
 *                       type:
 *                         type: string
 *                         description: Type of suggestion
 *                       priority:
 *                         type: string
 *                         enum: [low, medium, high, critical]
 *                         description: Priority level of the suggestion
 *                       title:
 *                         type: string
 *                         description: Suggestion title
 *                       description:
 *                         type: string
 *                         description: Detailed description of the suggestion
 *                       suggestedTopics:
 *                         type: array
 *                         items:
 *                           type: string
 *                         description: Topics to add to agent knowledge
 *                       suggestedSources:
 *                         type: array
 *                         items:
 *                           type: string
 *                         description: Sources to add to agent knowledge
 *                       confidence:
 *                         type: number
 *                         format: float
 *                         description: Confidence score of the suggestion
 *                       affectedQuestions:
 *                         type: integer
 *                         description: Number of questions affected by this suggestion
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         description: When the suggestion was created
 *                       status:
 *                         type: string
 *                         enum: [pending, in_progress, implemented, rejected]
 *                         description: Current status of the suggestion
 *                 total:
 *                   type: integer
 *                   description: Total number of suggestions
 *       400:
 *         description: Invalid agent ID
 *       401:
 *         description: Unauthorized - Invalid API token
 *       500:
 *         description: Internal server error
 */
router.get('/suggestions/:agentId', async (req: Request, res: Response) => {
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

    const suggestions = await FeedbackService.getRetrainingSuggestions(agentIdValidation.sanitized!, limit);

    res.json({
      success: true,
      suggestions: suggestions.map(s => ({
        id: s._id,
        type: s.suggestionType,
        priority: s.priority,
        title: s.title,
        description: s.description,
        suggestedTopics: s.suggestedTopics,
        suggestedSources: s.suggestedSources,
        confidence: s.confidence,
        affectedQuestions: s.affectedQuestions.length,
        createdAt: s.createdAt,
        status: s.status
      })),
      total: suggestions.length
    });

  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({
      error: 'Failed to get retraining suggestions',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /api/feedback/summary/{agentId}:
 *   get:
 *     summary: Get feedback summary for an agent
 *     description: Retrieve a comprehensive summary of user feedback and performance metrics for an AI agent
 *     tags: [Feedback]
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
 *         description: Number of days to include in the summary
 *         example: 30
 *     responses:
 *       200:
 *         description: Feedback summary retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 summary:
 *                   type: object
 *                   properties:
 *                     totalFeedback:
 *                       type: integer
 *                       description: Total number of feedback submissions
 *                     satisfactionDistribution:
 *                       type: object
 *                       properties:
 *                         explicit_positive:
 *                           type: integer
 *                           description: Number of explicitly positive feedback
 *                         implicit_positive:
 *                           type: integer
 *                           description: Number of implicitly positive feedback
 *                         neutral:
 *                           type: integer
 *                           description: Number of neutral feedback
 *                         implicit_negative:
 *                           type: integer
 *                           description: Number of implicitly negative feedback
 *                         explicit_negative:
 *                           type: integer
 *                           description: Number of explicitly negative feedback
 *                     averageSatisfaction:
 *                       type: number
 *                       format: float
 *                       description: Average satisfaction score (0-1)
 *                     needsRetraining:
 *                       type: boolean
 *                       description: Whether the agent needs retraining
 *                     topIssues:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Most common issues reported
 *                     suggestedImprovements:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Suggested improvements based on feedback
 *                     period:
 *                       type: string
 *                       description: Time period covered by summary
 *                     recommendation:
 *                       type: string
 *                       description: AI-generated recommendation for the agent
 *       400:
 *         description: Invalid agent ID
 *       401:
 *         description: Unauthorized - Invalid API token
 *       500:
 *         description: Internal server error
 */
router.get('/summary/:agentId', async (req: Request, res: Response) => {
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

    const summary = await FeedbackService.getFeedbackSummary(agentIdValidation.sanitized!, days);

    res.json({
      success: true,
      summary: {
        ...summary,
        period: `${days} days`,
        recommendation: summary.needsRetraining 
          ? 'Consider retraining with additional data to improve response quality.'
          : 'Agent is performing well based on user feedback.'
      }
    });

  } catch (error) {
    console.error('Get feedback summary error:', error);
    res.status(500).json({
      error: 'Failed to get feedback summary',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /api/feedback/suggestions/{id}/implement:
 *   post:
 *     summary: Mark a retraining suggestion as implemented
 *     description: Update the status of a retraining suggestion to indicate it has been implemented
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique identifier for the retraining suggestion
 *         example: "64f8a1b2c3d4e5f6a7b8c9d0"
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               implementationNotes:
 *                 type: string
 *                 description: Notes about how the suggestion was implemented
 *                 example: "Added new pricing information to knowledge base and updated training data"
 *                 maxLength: 1000
 *     responses:
 *       200:
 *         description: Suggestion marked as implemented successfully
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
 *                   example: "Retraining suggestion marked as implemented"
 *                 suggestion:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: Suggestion ID
 *                     title:
 *                       type: string
 *                       description: Suggestion title
 *                     status:
 *                       type: string
 *                       enum: [pending, in_progress, implemented, rejected]
 *                       description: Updated status
 *                     implementedAt:
 *                       type: string
 *                       format: date-time
 *                       description: When the suggestion was marked as implemented
 *       404:
 *         description: Retraining suggestion not found
 *       401:
 *         description: Unauthorized - Invalid API token
 *       500:
 *         description: Internal server error
 */
// POST /api/feedback/suggestions/:id/implement - Mark suggestion as implemented
router.post('/suggestions/:id/implement', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { implementationNotes } = req.body;

    // This would typically require admin privileges
    // For now, we'll just update the status
    const suggestion = await FeedbackService.getRetrainingSuggestions('', 1000);
    const targetSuggestion = suggestion.find(s => s._id.toString() === id);

    if (!targetSuggestion) {
      return res.status(404).json({
        error: 'Retraining suggestion not found'
      });
    }

    targetSuggestion.status = 'implemented';
    targetSuggestion.implementedAt = new Date();
    targetSuggestion.implementationNotes = implementationNotes;
    await targetSuggestion.save();

    res.json({
      success: true,
      message: 'Retraining suggestion marked as implemented',
      suggestion: {
        id: targetSuggestion._id,
        title: targetSuggestion.title,
        status: targetSuggestion.status,
        implementedAt: targetSuggestion.implementedAt
      }
    });

  } catch (error) {
    console.error('Implement suggestion error:', error);
    res.status(500).json({
      error: 'Failed to mark suggestion as implemented',
      timestamp: new Date().toISOString()
    });
  }
});

export default router; 