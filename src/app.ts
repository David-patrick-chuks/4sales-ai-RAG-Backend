import compression from 'compression';
import MongoStore from 'connect-mongo';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { Application, NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

import { initializeSentry } from './config/sentry.js';
import { globalErrorHandler } from './middleware/errorHandler.js';
import { requireApiToken } from './middleware/requireApiToken.js';
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
const NODE_ENV = process.env.NODE_ENV || 'development';
const PROD_DOMAIN = process.env.PROD_DOMAIN || 'localhost:3000';

// Sentry
initializeSentry();

// Session configuration with MongoDB store
if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is not set in the environment variables.');
}
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: 'sessions',
    ttl: 24 * 60 * 60, // 24 hours in seconds
    autoRemove: 'native',
    crypto: {
      secret: process.env.SESSION_SECRET
    }
  }),
  cookie: {
    secure: NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Security middleware
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

// CORS
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

// Rate limiting
const trainLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many training requests, please try again later.', retryAfter: '15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});
const askLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Too many questions, please try again later.', retryAfter: '15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});
const analyticsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many analytics requests, please try again later.', retryAfter: '15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});
const feedbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many feedback submissions, please try again later.', retryAfter: '15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});
const watchdogLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'Too many audit requests, please try again later.', retryAfter: '15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Compression
app.use(compression());

// Logging
if (NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

// Request size validation
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

// Body parsing
app.use(express.json({ 
  limit: `${SECURITY_CONFIG.MAX_TEXT_LENGTH / 1024}kb`,
  verify: (req: any, res, buf) => { req.rawBody = buf; }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: `${SECURITY_CONFIG.MAX_TEXT_LENGTH / 1024}kb`,
  parameterLimit: 100
}));

// Health check
app.get('/health', (req: Request, res: Response) => {
  const healthCheck = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    memory: process.memoryUsage(),
    database: 'connected', // Database connection is handled by connectDB function
    gemini: geminiService.getStatus()
  };
  const statusCode = 200; // Always return 200 since connection is managed by connectDB
  res.status(statusCode).json(healthCheck);
});

// API status
app.get('/api/status', (req: Request, res: Response) => {
  res.json({
    status: 'operational',
    service: 'AI Agent API',
    version: process.env.npm_package_version || '1.0.0',
    environment: NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
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
    documentation: '/docs'
  });
});

// Swagger
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
      { url: 'http://localhost:3000', description: 'Development server' },
      { url: `https://${PROD_DOMAIN}`, description: 'Production server' }
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
    security: [{ bearerAuth: [] }]
  },
  apis: ['./src/routes/*.ts', './src/config/*.ts', './src/server.ts']
};
const specs = swaggerJsdoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(specs));

// Token middleware for /api/*
app.use('/api', requireApiToken);

// API routes
app.use('/api/train', trainLimiter, trainRoute);
app.use('/api/ask', askLimiter, askRoute);
app.use('/api/analytics', analyticsLimiter, analyticsRoute);
app.use('/api/feedback', feedbackLimiter, feedbackRoute);
app.use('/api/watchdog', watchdogLimiter, watchdogRoute);
app.use('/api/cache', cacheRoute);

// Debug Sentry endpoint
app.get('/debug-sentry', function mainHandler(req, res) {
  throw new Error('My first Sentry error!');
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
app.use(globalErrorHandler);

export default app; 