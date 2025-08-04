import { Router } from 'express';
import Memory from '../models/Memory.js';
import { analyticsService } from '../services/analytics.js';
import { sanitizeAgentId } from '../utils/security.js';

const router = Router();

/**
 * @swagger
 * /api/analytics/dashboard/{agentId}:
 *   get:
 *     summary: Get comprehensive dashboard data for an agent
 *     description: Retrieve analytics dashboard data including query statistics, performance metrics, and trends
 *     tags: [Analytics]
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
 *         description: Number of days to look back for analytics data
 *         example: 30
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalQueries:
 *                       type: integer
 *                       description: Total number of queries in the period
 *                     answeredQueries:
 *                       type: integer
 *                       description: Number of queries that received answers
 *                     unansweredQueries:
 *                       type: integer
 *                       description: Number of queries without answers
 *                     averageConfidence:
 *                       type: number
 *                       format: float
 *                       description: Average confidence score of responses
 *                     topSources:
 *                       type: array
 *                       items:
 *                         type: object
 *                       description: Most frequently used knowledge sources
 *                     dailyStats:
 *                       type: array
 *                       items:
 *                         type: object
 *                       description: Daily query statistics
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid agent ID or parameters
 *       401:
 *         description: Unauthorized - Invalid API token
 *       500:
 *         description: Internal server error
 */
router.get('/dashboard/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { days = 30 } = req.query;

    // Validate agent ID
    if (!sanitizeAgentId(agentId).isValid) {
      return res.status(400).json({ 
        error: 'Invalid agent ID format' 
      });
    }

    const daysNum = parseInt(days as string);
    if (isNaN(daysNum) || daysNum < 1 || daysNum > 365) {
      return res.status(400).json({ 
        error: 'Days parameter must be between 1 and 365' 
      });
    }

    const dashboardData = await analyticsService.getDashboardData(agentId, daysNum);
    
    res.json({
      success: true,
      data: dashboardData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error getting dashboard data:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve dashboard data' 
    });
  }
});

/**
 * @swagger
 * /api/analytics/top-questions/{agentId}:
 *   get:
 *     summary: Get top questions asked to an agent
 *     description: Retrieve the most frequently asked questions to an AI agent
 *     tags: [Analytics]
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
 *           default: 20
 *         description: Maximum number of questions to return
 *         example: 20
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 365
 *           default: 30
 *         description: Number of days to look back
 *         example: 30
 *     responses:
 *       200:
 *         description: Top questions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       question:
 *                         type: string
 *                         description: The question text
 *                       count:
 *                         type: integer
 *                         description: Number of times this question was asked
 *                       lastAsked:
 *                         type: string
 *                         format: date-time
 *                         description: When this question was last asked
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid agent ID or parameters
 *       401:
 *         description: Unauthorized - Invalid API token
 *       500:
 *         description: Internal server error
 */
router.get('/top-questions/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { limit = 20, days = 30 } = req.query;

    if (!sanitizeAgentId(agentId).isValid) {
      return res.status(400).json({ 
        error: 'Invalid agent ID format' 
      });
    }

    const limitNum = parseInt(limit as string);
    const daysNum = parseInt(days as string);
    
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({ 
        error: 'Limit must be between 1 and 100' 
      });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    const topQuestions = await analyticsService.getTopQuestions(agentId, limitNum, startDate);
    
    res.json({
      success: true,
      data: topQuestions,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error getting top questions:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve top questions' 
    });
  }
});

/**
 * GET /analytics/sources/:agentId
 * Get sources used in answers
 */
router.get('/sources/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { limit = 20, days = 30 } = req.query;

    if (!sanitizeAgentId(agentId).isValid) {
      return res.status(400).json({ 
        error: 'Invalid agent ID format' 
      });
    }

    const limitNum = parseInt(limit as string);
    const daysNum = parseInt(days as string);
    
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({ 
        error: 'Limit must be between 1 and 100' 
      });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    const sources = await analyticsService.getTopSources(agentId, limitNum, startDate);
    
    res.json({
      success: true,
      data: sources,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error getting sources:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve sources' 
    });
  }
});

/**
 * GET /analytics/unanswered/:agentId
 * Get unanswered queries
 */
router.get('/unanswered/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { limit = 50, days = 30, minConfidence = 0 } = req.query;

    if (!sanitizeAgentId(agentId).isValid) {
      return res.status(400).json({ 
        error: 'Invalid agent ID format' 
      });
    }

    const limitNum = parseInt(limit as string);
    const daysNum = parseInt(days as string);
    const minConfidenceNum = parseFloat(minConfidence as string);
    
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 200) {
      return res.status(400).json({ 
        error: 'Limit must be between 1 and 200' 
      });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    const unanswered = await analyticsService.getUnansweredQueries(
      agentId, 
      limitNum, 
      startDate, 
      minConfidenceNum
    );
    
    res.json({
      success: true,
      data: unanswered,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error getting unanswered queries:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve unanswered queries' 
    });
  }
});

/**
 * GET /analytics/similarity-heatmap/:agentId
 * Get similarity heatmap data
 */
router.get('/similarity-heatmap/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { limit = 100, days = 7, minSimilarity = 0.5 } = req.query;

    if (!sanitizeAgentId(agentId).isValid) {
      return res.status(400).json({ 
        error: 'Invalid agent ID format' 
      });
    }

    const limitNum = parseInt(limit as string);
    const daysNum = parseInt(days as string);
    const minSimilarityNum = parseFloat(minSimilarity as string);
    
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 500) {
      return res.status(400).json({ 
        error: 'Limit must be between 1 and 500' 
      });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    const heatmapData = await analyticsService.getSimilarityHeatmap(
      agentId, 
      limitNum, 
      startDate, 
      minSimilarityNum
    );
    
    res.json({
      success: true,
      data: heatmapData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error getting similarity heatmap:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve similarity heatmap data' 
    });
  }
});

/**
 * GET /analytics/business-insights/:agentId
 * Get business insights and trends
 */
router.get('/business-insights/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { days = 30 } = req.query;

    if (!sanitizeAgentId(agentId).isValid) {
      return res.status(400).json({ 
        error: 'Invalid agent ID format' 
      });
    }

    const daysNum = parseInt(days as string);
    if (isNaN(daysNum) || daysNum < 1 || daysNum > 365) {
      return res.status(400).json({ 
        error: 'Days parameter must be between 1 and 365' 
      });
    }

    const insights = await analyticsService.getBusinessInsights(agentId, daysNum);
    
    res.json({
      success: true,
      data: insights,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error getting business insights:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve business insights' 
    });
  }
});

/**
 * POST /analytics/generate-insights/:agentId
 * Manually generate daily insights for an agent
 */
router.post('/generate-insights/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { date } = req.body;

        if (!sanitizeAgentId(agentId).isValid) {
      return res.status(400).json({ 
        error: 'Invalid agent ID format' 
      });
    }

    const targetDate = date ? new Date(date) : new Date();
    
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ 
        error: 'Invalid date format' 
      });
    }

    await analyticsService.generateDailyInsights(agentId, targetDate);
    
    res.json({
      success: true,
      message: 'Daily insights generated successfully',
      date: targetDate.toISOString(),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error generating insights:', error);
    res.status(500).json({ 
      error: 'Failed to generate insights' 
    });
  }
});

/**
 * GET /analytics/export/:agentId
 * Export analytics data for an agent
 */
router.get('/export/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { format = 'json', days = 30 } = req.query;

    if (!sanitizeAgentId(agentId).isValid) {
      return res.status(400).json({ 
        error: 'Invalid agent ID format' 
      });
    }

    const daysNum = parseInt(days as string);
    if (isNaN(daysNum) || daysNum < 1 || daysNum > 365) {
      return res.status(400).json({ 
        error: 'Days parameter must be between 1 and 365' 
      });
    }

    const exportData = await analyticsService.exportAnalytics(agentId, daysNum, format as string);
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="analytics-${agentId}-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(exportData);
    } else {
      res.json({
        success: true,
        data: exportData,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('❌ Error exporting analytics:', error);
    res.status(500).json({ 
      error: 'Failed to export analytics data' 
    });
  }
});

/**
 * GET /analytics/memory-agents
 * Check what agents exist in the Memory collection
 */
router.get('/memory-agents', async (req, res) => {
  try {
    // Get all unique agent IDs from the Memory collection
    const agents = await Memory.aggregate([
      {
        $group: {
          _id: '$agentId',
          count: { $sum: 1 },
          lastUpdated: { $max: '$createdAt' }
        }
      },
      {
        $sort: { lastUpdated: -1 }
      }
    ]);

    console.log('📊 Found agents in Memory collection:', agents);

    res.json({
      success: true,
      data: {
        agents: agents.map(agent => ({
          agentId: agent._id,
          chunkCount: agent.count,
          lastUpdated: agent.lastUpdated
        })),
        totalAgents: agents.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error checking Memory collection:', error);
    res.status(500).json({ 
      error: 'Failed to check Memory collection' 
    });
  }
});

/**
 * DELETE /analytics/memory-clear
 * Delete all data from the Memory collection
 */
router.delete('/memory-clear', async (req, res) => {
  try {
    console.log('🗑️ Clearing all data from Memory collection...');
    
    // Get count before deletion
    const countBefore = await Memory.countDocuments();
    console.log(`📊 Found ${countBefore} documents in Memory collection`);
    
    // Delete all documents
    const result = await Memory.deleteMany({});
    
    console.log(`🗑️ Deleted ${result.deletedCount} documents from Memory collection`);
    
    res.json({
      success: true,
      message: `Successfully cleared Memory collection`,
      data: {
        deletedCount: result.deletedCount,
        countBefore,
        countAfter: 0
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error clearing Memory collection:', error);
    res.status(500).json({ 
      error: 'Failed to clear Memory collection' 
    });
  }
});

/**
 * DELETE /analytics/memory-agent/:agentId
 * Delete all data for a specific agent from the Memory collection
 */
router.delete('/memory-agent/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    
    console.log(`🗑️ Clearing data for agent ${agentId} from Memory collection...`);
    
    // Get count before deletion
    const countBefore = await Memory.countDocuments({ agentId });
    console.log(`📊 Found ${countBefore} documents for agent ${agentId}`);
    
    // Delete documents for this agent
    const result = await Memory.deleteMany({ agentId });
    
    console.log(`🗑️ Deleted ${result.deletedCount} documents for agent ${agentId}`);
    
    res.json({
      success: true,
      message: `Successfully cleared data for agent ${agentId}`,
      data: {
        agentId,
        deletedCount: result.deletedCount,
        countBefore,
        countAfter: 0
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error clearing agent data from Memory collection:', error);
    res.status(500).json({ 
      error: 'Failed to clear agent data from Memory collection' 
    });
  }
});

export default router; 