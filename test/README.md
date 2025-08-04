# API Test Suite

This directory contains a comprehensive test for the AI Agent API that covers all endpoints and functionality.

## Test File

### `test-all-apis.js` - Comprehensive API Test Suite
**Purpose**: Tests all API endpoints and training types in the system
**Coverage**: 
- Root and health endpoints
- All training types (document, website, youtube)
- All `/api/ask` endpoints  
- All `/api/analytics` endpoints
- All `/api/feedback` endpoints
- All `/api/watchdog` endpoints
- All `/api/cache` endpoints
- Error handling and edge cases
- Rate limiting

**Usage**:
```bash
npm test
# or
node test/test-all-apis.js
```

## Running Tests

### Prerequisites
1. Make sure the server is running: `npm run dev`
2. Ensure MongoDB and Redis are running
3. Check that environment variables are properly set

### Quick Start
```bash
# Run comprehensive test suite
npm test
```

### Test Configuration
The tests use the following configuration:
- **Base URL**: `http://localhost:3000`
- **Training Types**: Document, Website, YouTube
- **Sample Document**: `src/utils/sample.txt`

## Test Results

The comprehensive test suite provides:
- ✅/❌ Pass/fail indicators for each test
- Detailed error messages for failed tests
- Summary statistics (passed/failed/total)
- Success rate percentage
- List of failed tests with details

## Training Types Tested

### 📄 Document Training
- Uploads sample.txt file
- Tests file processing and chunking
- Verifies training completion

### 🌐 Website Training  
- Scrapes safesage-main.vercel.app
- Tests website content extraction
- Verifies content processing

### 📺 YouTube Training
- Extracts transcript from YouTube video
- Tests video transcript processing
- Verifies transcript chunking

## API Endpoints Tested

### System Endpoints
- `/` - Root endpoint
- `/health` - Health check
- `/api/status` - API status

### Training Endpoints
- `/api/train` - POST training jobs
- `/api/train/status/:jobId` - GET training status

### Ask Endpoints
- `/api/ask` - POST questions
- `/api/ask/config` - GET/POST configuration

### Analytics Endpoints
- `/api/analytics/dashboard/:agentId` - Dashboard data
- `/api/analytics/top-questions/:agentId` - Top questions
- `/api/analytics/sources/:agentId` - Source analysis
- `/api/analytics/unanswered/:agentId` - Unanswered queries
- `/api/analytics/similarity-heatmap/:agentId` - Similarity analysis
- `/api/analytics/business-insights/:agentId` - Business insights
- `/api/analytics/export/:agentId` - Data export
- `/api/analytics/generate-insights/:agentId` - Generate insights

### Feedback Endpoints
- `/api/feedback` - POST feedback
- `/api/feedback/suggestions/:agentId` - GET suggestions
- `/api/feedback/summary/:agentId` - GET summary
- `/api/feedback/suggestions/:id/implement` - POST implement

### Watchdog Endpoints
- `/api/watchdog/audit` - POST audit
- `/api/watchdog/stats/:agentId` - GET stats
- `/api/watchdog/high-risk/:agentId` - GET high risk
- `/api/watchdog/config` - GET/POST config
- `/api/watchdog/review/:id` - POST review

### Cache Endpoints
- `/api/cache/stats/:agentId` - Agent cache stats
- `/api/cache/health` - Cache health
- `/api/cache/stats` - Global cache stats
- `/api/cache/clear/:agentId` - Clear cache

### Error Handling
- Missing fields validation
- 404 error handling
- Rate limiting tests

## Troubleshooting

### Common Issues

1. **Server not running**: Start with `npm run dev`
2. **Database connection**: Check MongoDB and Redis connections
3. **Environment variables**: Ensure `.env` file is properly configured
4. **File permissions**: Make sure test files are executable

### Debug Mode
To run tests with more verbose output:
```bash
DEBUG=* node test/test-all-apis.js
```

## Continuous Integration

This test can be integrated into CI/CD pipelines:
```yaml
# Example GitHub Actions step
- name: Run API Tests
  run: npm test
``` 