import * as Sentry from "@sentry/node";
import { expressIntegration } from "@sentry/node";
import compression from 'compression';
import MongoStore from 'connect-mongo';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { Application, NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import helmet from 'helmet';
import mongoose from 'mongoose';
import morgan from 'morgan';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import analyticsRoute from './routes/analytics.js';
import askRoute from './routes/ask.js';
import cacheRoute from './routes/cache.js';
import feedbackRoute from './routes/feedback.js';
import trainRoute from './routes/train.js';
import watchdogRoute from './routes/watchdog.js';
import { geminiService } from './services/gemini.js';
import { SECURITY_CONFIG } from './utils/security.js';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

const AGENT_API_TOKEN = process.env.AGENT_API_TOKEN || '123456';

Sentry.init({
  dsn: "https://2b1ba2fb76fd8de3206100b84c4eb071@o4509535090442240.ingest.us.sentry.io/4509535093194752",
  sendDefaultPii: true,
  integrations: [
    expressIntegration()
  ],
});

// Token auth middleware for /api/*
function requireApiToken(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = auth.split(' ')[1];
  if (token !== AGENT_API_TOKEN) {
    return res.status(401).json({ error: 'Invalid API token' });
  }
  next();
}

// Session configuration with MongoDB store
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: 'sessions',
    ttl: 24 * 60 * 60, // 24 hours in seconds
    autoRemove: 'native', // Use MongoDB's TTL index
    crypto: {
      secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production'
    }
  }),
  cookie: {
    secure: NODE_ENV === 'production', // Use secure cookies in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Enhanced security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
  frameguard: { action: 'deny' }
}));

// CORS configuration with enhanced security
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS ? 
    process.env.ALLOWED_ORIGINS.split(',') : 
    ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']
};
app.use(cors(corsOptions));

// Enhanced rate limiting with different limits for different endpoints
// Production values: generous limits for client inquiries
const trainLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Increased for production
  message: {
    error: 'Too many training requests, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const askLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Increased for production
  message: {
    error: 'Too many questions, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const analyticsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Increased for production
  message: {
    error: 'Too many analytics requests, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const feedbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Feedback submissions
  message: {
    error: 'Too many feedback submissions, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const watchdogLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Audit requests
  message: {
    error: 'Too many audit requests, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Compression middleware
app.use(compression());

// Logging middleware
if (NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

// Request size validation middleware (BEFORE body parsing)
app.use((req: Request, res: Response, next: NextFunction) => {
  const contentLength = parseInt(req.headers['content-length'] || '0');
  
  if (contentLength > SECURITY_CONFIG.MAX_TEXT_LENGTH) {
    return res.status(413).json({
      error: 'Request too large',
      maxSize: `${SECURITY_CONFIG.MAX_TEXT_LENGTH / 1024}kb`
    });
  }
  
  next();
});

// Enhanced body parsing middleware with security limits
app.use(express.json({ 
  limit: `${SECURITY_CONFIG.MAX_TEXT_LENGTH / 1024}kb`,
  verify: (req: any, res, buf) => {
    // Store raw body for potential validation
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: `${SECURITY_CONFIG.MAX_TEXT_LENGTH / 1024}kb`,
  parameterLimit: 100 // Limit number of parameters
}));

// Enhanced request logging middleware with security info
app.use((req: Request, res: Response, next: NextFunction) => {
  const securityInfo = {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    contentType: req.headers['content-type'],
    contentLength: req.headers['content-length'],
    method: req.method,
    path: req.path
  };
  
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip} - Size: ${req.headers['content-length'] || 'unknown'}`);
  
  // Log suspicious requests
  if (req.headers['content-length'] && parseInt(req.headers['content-length']) > 1024 * 1024) {
    console.warn('⚠️ Large request detected:', securityInfo);
  }
  
  if (req.headers['user-agent'] && req.headers['user-agent'].includes('curl')) {
    console.log('📝 cURL request detected:', securityInfo);
  }
  
  next();
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Check the health status of the API server and its dependencies
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "OK"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: Server uptime in seconds
 *                 environment:
 *                   type: string
 *                   example: "development"
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 memory:
 *                   type: object
 *                   properties:
 *                     rss:
 *                       type: number
 *                       description: Resident Set Size in bytes
 *                     heapTotal:
 *                       type: number
 *                       description: Total heap size in bytes
 *                     heapUsed:
 *                       type: number
 *                       description: Used heap size in bytes
 *                 database:
 *                   type: string
 *                   enum: [connected, disconnected]
 *                   description: MongoDB connection status
 *                 gemini:
 *                   type: object
 *                   description: Gemini service status
 *       503:
 *         description: Server is unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "ERROR"
 *                 database:
 *                   type: string
 *                   example: "disconnected"
 */
app.get('/health', (req: Request, res: Response) => {
  const healthCheck = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    memory: process.memoryUsage(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    gemini: geminiService.getStatus()
  };
  
  const statusCode = healthCheck.database === 'connected' ? 200 : 503;
  res.status(statusCode).json(healthCheck);
});

/**
 * @swagger
 * /api/status:
 *   get:
 *     summary: API status endpoint
 *     description: Get the current status and information about the AI Agent API
 *     tags: [System]
 *     responses:
 *       200:
 *         description: API status information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "operational"
 *                 service:
 *                   type: string
 *                   example: "AI Agent API"
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 environment:
 *                   type: string
 *                   example: "development"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
app.get('/api/status', (req: Request, res: Response) => {
  res.json({
    status: 'operational',
    service: 'AI Agent API',
    version: process.env.npm_package_version || '1.0.0',
    environment: NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// Apply token middleware to all /api/* routes
app.use('/api', requireApiToken);

// API routes with specific rate limiting
app.use('/api/train', trainLimiter, trainRoute);
app.use('/api/ask', askLimiter, askRoute);
app.use('/api/analytics', analyticsLimiter, analyticsRoute);
app.use('/api/feedback', feedbackLimiter, feedbackRoute);
app.use('/api/watchdog', watchdogLimiter, watchdogRoute);
app.use('/api/cache', cacheRoute);

/**
 * @swagger
 * /:
 *   get:
 *     summary: API root endpoint
 *     description: Get information about the AI Agent API and available endpoints
 *     tags: [System]
 *     responses:
 *       200:
 *         description: API information and available endpoints
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "AI Agent API"
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 endpoints:
 *                   type: object
 *                   properties:
 *                     health:
 *                       type: string
 *                       example: "/health"
 *                     status:
 *                       type: string
 *                       example: "/api/status"
 *                     train:
 *                       type: string
 *                       example: "/api/train"
 *                     ask:
 *                       type: string
 *                       example: "/api/ask"
 *                     analytics:
 *                       type: string
 *                       example: "/api/analytics"
 *                     feedback:
 *                       type: string
 *                       example: "/api/feedback"
 *                 documentation:
 *                   type: string
 *                   example: "API documentation coming soon"
 */
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'AI Agent API',
    version: process.env.npm_package_version || '1.0.0',
    endpoints: {
      health: '/health',
      status: '/api/status',
      train: '/api/train',
      ask: '/api/ask',
      analytics: '/api/analytics',
      feedback: '/api/feedback'
    },
    documentation: 'API documentation coming soon'
  });
});

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AI Agent API',
      version: '1.0.0',
      description: 'API for AI Agent with Gemini integration, caching, and analytics',
      contact: {
        name: 'API Support',
        url: 'https://www.4salesai.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      },
      {
        url: 'https://www.4salesai.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [{
      bearerAuth: []
    }]
  },
  apis: ['./src/routes/*.ts', './src/server.ts']
};

const specs = swaggerJsdoc(swaggerOptions);

// API Documentation
app.use('/docs', swaggerUi.serve, swaggerUi.setup(specs));

// Debug Sentry endpoint
app.get("/debug-sentry", function mainHandler(req, res) {
  throw new Error("My first Sentry error!");
});

// 404 handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: ['/health', '/api/status', '/api/train', '/api/ask', '/api/analytics', '/api/feedback']
  });
});

// Global error handler
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Global error handler:', error);
  
  // Don't leak error details in production
  const errorMessage = NODE_ENV === 'production' 
    ? 'Internal server error' 
    : error.message;
  
  res.status(500).json({
    error: errorMessage,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  mongoose.connection.close().then(() => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  mongoose.connection.close().then(() => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});

// Database connection with retry logic
const connectDB = async (retries = 5): Promise<void> => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI environment variable is required');
    }

    await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    
    if (retries > 0) {
      console.log(`Retrying connection... (${retries} attempts left)`);
      setTimeout(() => connectDB(retries - 1), 5000);
    } else {
      console.error('Failed to connect to MongoDB after multiple attempts');
      process.exit(1);
    }
  }
};

// Start server
const startServer = async (): Promise<void> => {
  try {
    await connectDB();
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running in ${NODE_ENV} mode`);
      console.log(`📍 Server URL: http://localhost:${PORT}`);
      console.log(`🏥 Health check: http://localhost:${PORT}/health`);
      console.log(`📊 API status: http://localhost:${PORT}/api/status`);
      console.log(`📚 API documentation: http://localhost:${PORT}/docs`);
      console.log(`🔒 Sentry: https://sentry.io/organizations/chuteh/issues/`);
      console.log(`⏰ Started at: ${new Date().toISOString()}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer(); 