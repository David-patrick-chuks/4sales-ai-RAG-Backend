import express, { Request, Response } from 'express';
import { CacheService } from '../services/cache';

const router = express.Router();

/**
 * @swagger
 * /api/cache/stats/{agentId}:
 *   get:
 *     summary: Get cache statistics for a specific agent
 *     description: Retrieve detailed cache performance and usage statistics for an AI agent
 *     tags: [Cache]
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
 *     responses:
 *       200:
 *         description: Cache statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 agentId:
 *                   type: string
 *                   description: The agent ID
 *                 cache_stats:
 *                   type: object
 *                   properties:
 *                     total_queries:
 *                       type: integer
 *                       description: Total number of queries processed
 *                     cache_hits:
 *                       type: integer
 *                       description: Number of cache hits
 *                     cache_misses:
 *                       type: integer
 *                       description: Number of cache misses
 *                     hit_rate:
 *                       type: number
 *                       format: float
 *                       description: Cache hit rate percentage
 *                     average_response_time:
 *                       type: number
 *                       description: Average response time in milliseconds
 *                     memory_usage:
 *                       type: object
 *                       properties:
 *                         used:
 *                           type: number
 *                           description: Memory used in bytes
 *                         peak:
 *                           type: number
 *                           description: Peak memory usage in bytes
 *                 cache_health:
 *                   type: string
 *                   enum: [healthy, unhealthy]
 *                   description: Cache service health status
 *       503:
 *         description: Cache service unavailable
 *       500:
 *         description: Internal server error
 */
router.get('/stats/:agentId', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    
    // Check Redis health first
    const isHealthy = await CacheService.healthCheck();
    if (!isHealthy) {
      return res.status(503).json({
        error: 'Cache service unavailable',
        agentId
      });
    }
    
    const stats = await CacheService.getCacheStats(agentId);
    
    res.json({
      success: true,
      agentId,
      cache_stats: stats,
      cache_health: 'healthy'
    });
    
  } catch (error) {
    console.error('Cache stats error:', error);
    res.status(500).json({
      error: 'Failed to get cache statistics',
      agentId: req.params.agentId
    });
  }
});

/**
 * @swagger
 * /api/cache/clear/{agentId}:
 *   delete:
 *     summary: Clear cache for a specific agent
 *     description: Clear all cached data for an AI agent to free up memory and force fresh responses
 *     tags: [Cache]
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
 *     responses:
 *       200:
 *         description: Cache cleared successfully
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
 *                   example: "Cache cleared for agent: sales-agent-001"
 *                 agentId:
 *                   type: string
 *                   description: The agent ID that was cleared
 *       500:
 *         description: Internal server error
 */
router.delete('/clear/:agentId', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    
    await CacheService.clearAgentCache(agentId);
    
    res.json({
      success: true,
      message: `Cache cleared for agent: ${agentId}`,
      agentId
    });
    
  } catch (error) {
    console.error('Cache clear error:', error);
    res.status(500).json({
      error: 'Failed to clear cache',
      agentId: req.params.agentId
    });
  }
});

/**
 * @swagger
 * /api/cache/health:
 *   get:
 *     summary: Check cache service health
 *     description: Verify the health and availability of the Redis cache service
 *     tags: [Cache]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cache health check successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 cache_health:
 *                   type: string
 *                   enum: [healthy, unhealthy]
 *                   description: Cache service health status
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   description: When the health check was performed
 *       503:
 *         description: Cache service unavailable
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Cache service unavailable"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const isHealthy = await CacheService.healthCheck();
    
    res.json({
      success: true,
      cache_health: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Cache health check error:', error);
    res.status(503).json({
      error: 'Cache service unavailable',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /api/cache/stats:
 *   get:
 *     summary: Get overall cache statistics
 *     description: Retrieve general cache service statistics and health information
 *     tags: [Cache]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Overall cache statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 cache_health:
 *                   type: string
 *                   enum: [healthy, unhealthy]
 *                   description: Overall cache service health status
 *                 message:
 *                   type: string
 *                   description: Informational message about usage
 *                   example: "Use /api/cache/stats/:agentId for per-agent statistics"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   description: When the statistics were retrieved
 *       500:
 *         description: Internal server error
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    // This would require additional implementation to get overall stats
    // For now, return basic health info
    const isHealthy = await CacheService.healthCheck();
    
    res.json({
      success: true,
      cache_health: isHealthy ? 'healthy' : 'unhealthy',
      message: 'Use /api/cache/stats/:agentId for per-agent statistics',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Cache stats error:', error);
    res.status(500).json({
      error: 'Failed to get cache statistics'
    });
  }
});

export default router; 