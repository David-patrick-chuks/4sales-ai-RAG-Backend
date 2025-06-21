# 4SalesAI Agent API

**Full documentation is now in [`doc/README.md`](./doc/README.md).**

---

## Quickstart

- Install dependencies: `npm install`
- Copy `.env.example` to `.env` and set your MongoDB, Gemini API keys, and API token
- **All API requests require an Authorization token (see below)**
- Start dev server: `npm run dev`
- For full usage, API, and advanced features, see [doc/README.md](./doc/README.md)

---

A production-ready Node.js/TypeScript API for async, multi-source document, audio, video, website, and YouTube training, with advanced RAG, Gemini integration, MongoDB Atlas vector search, and comprehensive analytics dashboard.

## 🔑 API Token Authentication

**Why:**
To prevent unauthorized use, all `/api/*` endpoints require a secret token (like a password) sent in the `Authorization` header. This protects your AI agent API from unwanted or abusive access.

**How it works:**
- The server checks for a header: `Authorization: Bearer <token>` on every `/api/*` request.
- If the token is missing or incorrect, the API returns `401 Unauthorized` and does not process the request.
- The default token is `123456` (set in `.env.example` as `AGENT_API_TOKEN`).
- You should change this to a strong, secret value in production.

**How to set:**
- In your `.env` file:
  ```env
  AGENT_API_TOKEN=your_secret_token_here
  ```
- Restart the server after changing the token.

**How to use:**
- Add the header to every API request:
  ```http
  Authorization: Bearer 123456
  ```
- Example with curl:
  ```bash
  curl -H "Authorization: Bearer 123456" ...
  ```
- Example with JavaScript (fetch):
  ```js
  fetch('/api/ask', { headers: { Authorization: 'Bearer 123456' }, ... })
  ```

## 🚀 Features

- **Async, Multi-Source Training**: Train with documents (PDF, DOCX, DOC, CSV, TXT), audio (mp3, wav), video (mp4), websites (URL), and YouTube (URL)
- **Multi-File Support**: Upload multiple files per job for document, audio, and video
- **Advanced RAG**: Hybrid vector+keyword search, context deduplication, robust prompt engineering
- **🔒 Agent Isolation + Context Caching**: Redis-based caching with per-agent isolation, reducing vector calls and improving performance
- **📊 Comprehensive Analytics**: Track questions, sources, unanswered queries, similarity heatmaps, and business insights
- **🎯 Analytics Dashboard**: Beautiful web interface for visualizing agent performance and usage patterns
- **🔐 Session Management**: MongoDB-based persistent sessions with secure cookie handling
- **Production Ready**: CORS, rate limiting, security headers, compression, logging
- **Health Monitoring**: Built-in health checks and status endpoints
- **Error Handling**: Comprehensive error handling and job status reporting
- **TypeScript & ESM**: Modern, type-safe codebase
- **MongoDB Atlas**: Vector search integration for semantic similarity
- **Google Gemini**: State-of-the-art embeddings, generation, and file/video/audio processing

## 📊 Analytics Features

The AI Agent API includes a comprehensive analytics system that provides deep insights into your agents' performance and usage patterns.

### **Analytics Dashboard**
- **Web Interface**: Open `doc/analytics-dashboard.html` in your browser
- **Real-time Data**: View live analytics for any agent
- **Interactive Charts**: Visualize trends and patterns
- **Export Capabilities**: Download data in JSON or CSV format

### **Key Metrics Tracked**
- **Question Analytics**: Total questions, answered vs unanswered, confidence scores
- **Source Analytics**: Most used sources, source types, usage patterns
- **Performance Metrics**: Response times, token usage, similarity scores
- **Business Insights**: Daily trends, user sessions, unique users
- **Similarity Heatmaps**: Visual representation of question-chunk relationships

### **Analytics Endpoints**

#### Dashboard Overview
```http
GET /api/analytics/dashboard/:agentId?days=30
```
Returns comprehensive dashboard data including overview metrics, top questions, sources, and daily insights.

#### Top Questions
```http
GET /api/analytics/top-questions/:agentId?limit=20&days=30
```
Returns the most frequently asked questions with confidence scores and usage statistics.

#### Source Analytics
```http
GET /api/analytics/sources/:agentId?limit=20&days=30
```
Returns the most used sources with usage counts, confidence scores, and source types.

#### Unanswered Queries
```http
GET /api/analytics/unanswered/:agentId?limit=50&days=30&minConfidence=0
```
Returns queries that couldn't be answered, helping identify knowledge gaps.

#### Similarity Heatmap
```http
GET /api/analytics/similarity-heatmap/:agentId?limit=100&days=7&minSimilarity=0.5
```
Returns similarity data for visualizing question-chunk relationships.

#### Business Insights
```http
GET /api/analytics/business-insights/:agentId?days=30
```
Returns business intelligence including trends, summaries, and performance metrics.

#### Generate Daily Insights
```http
POST /api/analytics/generate-insights/:agentId
Body: { "date": "2024-01-01T00:00:00.000Z" }
```
Manually generate daily insights for a specific date.

#### Export Analytics Data
```http
GET /api/analytics/export/:agentId?format=json&days=30
```
Export analytics data in JSON or CSV format for external analysis.

### **Analytics Data Models**
- **QuestionAnalytics**: Tracks each question with confidence, response time, tokens used
- **SourceAnalytics**: Tracks source usage patterns and performance
- **UnansweredQuery**: Tracks failed queries for improvement
- **SimilarityHeatmap**: Tracks question-chunk similarity relationships
- **BusinessInsights**: Daily aggregated insights and trends

### **Testing Analytics**
Run the analytics test suite:
```bash
node test-analytics.js
```

This will:
1. Generate test data by training an agent
2. Ask sample questions to create analytics data
3. Test all analytics endpoints
4. Verify data accuracy and functionality

## 📋 Prerequisites

- Node.js 18+ 
- MongoDB Atlas account with vector search enabled
- Google Gemini API key(s)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ai-agent-api
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your configuration (see doc/README.md for details).

4. **MongoDB Atlas Setup**
   - Create a MongoDB Atlas cluster
   - Enable vector search
   - Create a vector index on the `embedding` field with dimension 768

5. **Build the project**
   ```bash
   npm run build
   ```

## 🏃‍♂️ Running the Application

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### Build
```bash
npm run build
```

## 📚 API Overview

### Base URL
```
http://localhost:3000
```

### Endpoints

#### Health Check
`GET /health` — Returns server health status

#### API Status
`GET /api/status` — Returns API operational status

#### Train Agent (Async, Multi-Source)
`POST /api/train`
- Accepts: `agentId`, `text` or `files[]`, `source`, `sourceUrl`, `fileType`, `sourceMetadata`
- Sources: `document`, `audio`, `video`, `website`, `youtube`
- Multi-file upload supported for document, audio, and video
- Website/YouTube: provide `sourceUrl`
- Returns: `{ jobId, status }` (poll for completion)
- **Requires Authorization header**

**Sample request (JSON):**
```json
{
  "agentId": "my-agent-1",
  "text": "Training data...",
  "source": "document"
}
```
**Sample response:**
```json
{
  "jobId": "b1e2c3d4-5678-90ab-cdef-1234567890ab",
  "status": "queued",
  "message": "Training started. Poll /api/train/status/:jobId for progress."
}
```

#### Poll Training Job Status
`GET /api/train/status/:jobId`
- Returns: job status, progress, errors, and results
- **Requires Authorization header**

**Sample response:**
```json
{
  "jobId": "b1e2c3d4-5678-90ab-cdef-1234567890ab",
  "status": "completed",
  "progress": 100,
  "result": {
    "agentId": "my-agent-1",
    "chunksStored": 12,
    "totalChunks": 12,
    "successCount": 12,
    "errorCount": 0,
    "fileNames": ["sample.txt"],
    "usedFiles": true,
    "source": "document",
    "sourceUrl": null,
    "sourceMetadata": {}
  },
  "createdAt": "2024-06-01T12:00:00.000Z",
  "chunksProcessed": 12,
  "totalChunks": 12,
  "successCount": 12,
  "errorCount": 0
}
```

#### Ask Question (RAG)
`POST /api/ask`
- Accepts: `agentId`, `question`
- Returns: answer, sources, and metadata
- **Requires Authorization header**

**Sample request:**
```json
{
  "agentId": "my-agent-1",
  "question": "What is the flagship product?"
}
```
**Sample response:**
```json
{
  "agent_id": "my-agent-1",
  "query": "What is the flagship product?",
  "reply": "The flagship product is the Smart Irrigation System...",
  "confidence": 0.85,
  "fallback_used": false,
  "meta": {
    "tokens_used": 150,
    "retrieval_time_ms": 245,
    "model": "gemini-1.5",
    "retrieval_strategy": "hybrid",
    "chunks_used": 3,
    "chunks_searched": 8,
    "chunks_filtered": 5,
    "context_length": 1200,
    "sources_count": 2,
    "average_similarity": 0.78,
    "retrieval_config": {
      "vector_k": 8,
      "keyword_k": 3,
      "similarity_threshold": 0.3,
      "confidence_threshold": 0.4,
      "max_chunks": 5
    },
    "sources": [
      {
        "source": "product-documentation.pdf",
        "source_url": "https://example.com/docs",
        "chunk_index": 5,
        "confidence": 0.85,
        "similarity": 0.78
      }
    ]
  }
}
```

#### Analytics Dashboard
`GET /api/analytics/dashboard/:agentId?days=30`
- Returns comprehensive analytics data
- **Requires Authorization header**

**Sample response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalQuestions": 150,
      "answeredQuestions": 135,
      "unansweredQueries": 15,
      "averageConfidence": 0.82,
      "answerRate": 90.0
    },
    "topSources": [
      {
        "sourceUrl": "https://example.com/docs",
        "fileName": "product-documentation.pdf",
        "sourceType": "document",
        "usageCount": 45,
        "averageConfidence": 0.85
      }
    ],
    "topQuestions": [
      {
        "question": "What is the flagship product?",
        "count": 12,
        "avgConfidence": 0.88,
        "lastAsked": "2024-01-15T10:30:00.000Z"
      }
    ],
    "unansweredQuestions": [
      {
        "question": "How does the new feature work?",
        "confidence": 0.25,
        "chunksSearched": 8,
        "timestamp": "2024-01-15T09:15:00.000Z"
      }
    ],
    "dailyInsights": [
      {
        "date": "2024-01-15T00:00:00.000Z",
        "totalQuestions": 25,
        "answeredQuestions": 23,
        "averageConfidence": 0.84,
        "totalTokensUsed": 3750
      }
    ]
  },
  "timestamp": "2024-01-15T12:00:00.000Z"
}
```

#### Top Questions Analytics
`GET /api/analytics/top-questions/:agentId?limit=20&days=30`
- Returns most frequently asked questions
- **Requires Authorization header**

#### Source Analytics
`GET /api/analytics/sources/:agentId?limit=20&days=30`
- Returns most used sources with usage statistics
- **Requires Authorization header**

#### Unanswered Queries
`GET /api/analytics/unanswered/:agentId?limit=50&days=30&minConfidence=0`
- Returns queries that couldn't be answered
- **Requires Authorization header**

#### Similarity Heatmap
`GET /api/analytics/similarity-heatmap/:agentId?limit=100&days=7&minSimilarity=0.5`
- Returns similarity data for question-chunk relationships
- **Requires Authorization header**

#### Business Insights
`GET /api/analytics/business-insights/:agentId?days=30`
- Returns business intelligence and trends
- **Requires Authorization header**

#### Generate Daily Insights
`POST /api/analytics/generate-insights/:agentId`
- Manually generate daily insights for a specific date
- **Requires Authorization header**

**Sample request:**
```json
{
  "date": "2024-01-15T00:00:00.000Z"
}
```

#### Export Analytics Data
`GET /api/analytics/export/:agentId?format=json&days=30`
- Export analytics data in JSON or CSV format
- **Requires Authorization header**

## 📊 Analytics Dashboard

### Web Interface
Open `doc/analytics-dashboard.html` in your browser to access the interactive analytics dashboard.

### Features
- **Real-time Data**: View live analytics for any agent
- **Interactive Charts**: Visualize trends and patterns with Chart.js
- **Overview Cards**: Key metrics at a glance
- **Data Tables**: Detailed breakdowns of questions, sources, and queries
- **Export Capabilities**: Download data for external analysis
- **Responsive Design**: Works on desktop and mobile devices

### Usage
1. Enter your API token and agent ID
2. Select time period (7, 30, 90, or 365 days)
3. Click "Load Dashboard" to view analytics
4. Explore different sections and export data as needed

### Key Metrics
- **Total Questions**: All questions asked to the agent
- **Answered Questions**: Successfully answered queries
- **Unanswered Queries**: Failed queries requiring attention
- **Average Confidence**: Overall response quality
- **Answer Rate**: Percentage of successful responses
- **Top Sources**: Most frequently used knowledge sources
- **Top Questions**: Most commonly asked questions
- **Daily Trends**: Usage patterns over time

## 🔄 Feedback Loop & Self-Healing AI

The AI Agent API includes a sophisticated feedback system that enables **self-healing AI** - automatically detecting when responses need improvement and suggesting retraining opportunities.

### **🔥 Key Features**
- **Automatic Feedback Detection**: Analyzes user responses like "That didn't help" to identify dissatisfaction
- **Confidence-Based Suggestions**: Suggests retraining when confidence is low
- **Topic Extraction**: Automatically identifies topics from questions for targeted retraining
- **Priority Ranking**: Prioritizes retraining suggestions based on user impact
- **Feedback Analytics**: Tracks satisfaction rates and trends over time

### **📊 How It Works**

#### **1. Question Response with Feedback Prompt**
Every `/api/ask` response now includes:
```json
{
  "agent_id": "my-agent",
  "query": "What are your invoice policies?",
  "reply": "Based on our documentation...",
  "confidence": 0.45,
  "question_id": "q_1703123456789_abc123",
  "feedback_prompt": "Was this answer helpful? Reply with feedback to help us improve.",
  "retraining_suggested": true
}
```

#### **2. User Feedback Submission**
```bash
POST /api/feedback
{
  "agentId": "my-agent",
  "questionId": "q_1703123456789_abc123",
  "question": "What are your invoice policies?",
  "originalReply": "Based on our documentation...",
  "confidence": 0.45,
  "feedbackText": "That didn't help at all. I need better information about invoices."
}
```

#### **3. Automatic Analysis & Suggestions**
The system automatically:
- **Detects dissatisfaction** from feedback text
- **Extracts topics** (e.g., "invoicing", "policies")
- **Generates retraining suggestions** with priority levels
- **Tracks patterns** across multiple feedback instances

### **🎯 API Endpoints**

#### **Submit Feedback**
`POST /api/feedback`
- Submit user feedback for any question
- Automatically analyzes satisfaction and generates suggestions
- **Requires Authorization header**

**Sample request:**
```json
{
  "agentId": "my-agent",
  "questionId": "q_1703123456789_abc123",
  "question": "What are your invoice policies?",
  "originalReply": "Based on our documentation...",
  "confidence": 0.45,
  "feedbackText": "That didn't help at all. I need better information about invoices.",
  "chunksUsed": 2,
  "averageSimilarity": 0.35,
  "sources": ["invoice-policy.pdf"]
}
```

**Sample response:**
```json
{
  "success": true,
  "feedback": {
    "id": "feedback_id",
    "userSatisfaction": "explicit_negative",
    "suggestedTopics": ["invoicing", "policies"],
    "suggestedSources": ["invoice-policy.pdf"]
  },
  "retrainingSuggestions": [
    {
      "id": "suggestion_id",
      "title": "Improve invoicing, policies knowledge for my-agent",
      "description": "The AI struggled with questions about invoicing, policies. Consider uploading more documentation related to these topics to improve response quality.",
      "priority": "high",
      "suggestedTopics": ["invoicing", "policies"],
      "suggestedSources": ["invoice-policy.pdf"]
    }
  ],
  "message": "Thank you for your feedback. We'll work on improving our responses for this topic."
}
```

#### **Get Retraining Suggestions**
`GET /api/feedback/suggestions/:agentId?limit=10`
- Get prioritized retraining suggestions for an agent
- **Requires Authorization header**

**Sample response:**
```json
{
  "success": true,
  "suggestions": [
    {
      "id": "suggestion_id",
      "type": "user_feedback",
      "priority": "high",
      "title": "Improve invoicing knowledge for my-agent",
      "description": "The AI struggled with questions about invoicing...",
      "suggestedTopics": ["invoicing"],
      "suggestedSources": ["invoice-policy.pdf"],
      "confidence": 0.45,
      "affectedQuestions": 3,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "status": "pending"
    }
  ],
  "total": 1
}
```

#### **Get Feedback Summary**
`GET /api/feedback/summary/:agentId?days=30`
- Get feedback analytics and recommendations
- **Requires Authorization header**

**Sample response:**
```json
{
  "success": true,
  "summary": {
    "totalFeedback": 25,
    "positiveFeedback": 18,
    "negativeFeedback": 7,
    "satisfactionRate": 72.0,
    "averageConfidence": 0.68,
    "needsRetraining": false,
    "period": "30 days",
    "recommendation": "Agent is performing well based on user feedback."
  }
}
```

### **🧠 Smart Features**

#### **Automatic Topic Extraction**
The system automatically identifies topics from questions:
- **Invoicing**: invoice, billing, payment
- **Customer Service**: customer, client, support
- **Products/Services**: product, service, offering
- **Pricing**: price, cost, pricing
- **Policies**: policy, procedure, rule
- **Technical Support**: technical, support, help
- **Account Management**: account, login, profile
- **Orders**: order, purchase, buy
- **Refunds/Returns**: refund, return, exchange
- **Shipping**: shipping, delivery, transport

#### **User Satisfaction Detection**
Automatically detects satisfaction from feedback text:
- **Explicit Negative**: "didn't help", "not helpful", "wrong", "incorrect"
- **Positive**: "helpful", "good", "correct", "thanks", "perfect"
- **Neutral**: "ok", "fine", "alright"
- **Inferred**: Based on confidence scores when no explicit feedback

#### **Priority-Based Suggestions**
- **High Priority**: Explicit negative feedback or confidence < 0.3
- **Medium Priority**: Negative feedback or confidence < 0.5
- **Low Priority**: Other cases requiring improvement

### **📈 Business Value**

#### **Self-Improving AI**
- **Automatic Detection**: No manual review needed to identify issues
- **Targeted Improvements**: Focus retraining on specific topics
- **Proactive Suggestions**: Get ahead of user complaints
- **Data-Driven Decisions**: Make retraining decisions based on actual usage

#### **User Experience**
- **Immediate Feedback**: Users can provide feedback right after responses
- **Clear Communication**: Users know their feedback is being used
- **Continuous Improvement**: AI gets better over time
- **Reduced Support Load**: Better AI responses mean fewer support tickets

#### **Operational Efficiency**
- **Automated Analysis**: No need to manually review every interaction
- **Prioritized Actions**: Focus on high-impact improvements first
- **Trend Analysis**: Identify patterns across multiple feedback instances
- **ROI Tracking**: Measure improvement in satisfaction rates

### **🧪 Testing**
```bash
# Test the complete feedback loop
node test-feedback.js
```

This tests:
1. Question asking with feedback prompts
2. Positive feedback submission
3. Negative feedback submission
4. Retraining suggestions retrieval
5. Feedback summary and recommendations

## 🔐 Session Management

The AI Agent API includes robust session management using MongoDB for persistent, scalable session storage.

### **Session Features**
- **Persistent Storage**: Sessions stored in MongoDB with automatic TTL cleanup
- **Secure Cookies**: HttpOnly cookies with secure flags in production
- **Session Analytics**: Track user sessions for better insights
- **Automatic Cleanup**: Sessions expire after 24 hours with MongoDB TTL index
- **Encrypted Storage**: Session data encrypted with your session secret

### **Session Configuration**
```env
# Session Configuration
SESSION_SECRET=your-super-secret-session-key-change-this-in-production
```

### **Session Storage**
- **Collection**: `sessions` in your MongoDB database
- **TTL**: 24 hours automatic expiration
- **Encryption**: Session data encrypted with your secret
- **Auto-cleanup**: MongoDB TTL index handles expired sessions

### **Testing Sessions**
```bash
# Test session functionality
node test-session.js
```

### **Session Benefits**
- **User Tracking**: Track individual user sessions in analytics
- **Rate Limiting**: Session-based rate limiting (future feature)
- **User State**: Store user preferences and state (future feature)
- **Security**: Secure session handling with proper cookie settings

## 🧪 Testing

### Run All Tests
```bash
# Test basic API functionality
node test-api.js

# Test security features
node test-security.js

# Test analytics functionality
node test-analytics.js

# Test session management
node test-session.js
```