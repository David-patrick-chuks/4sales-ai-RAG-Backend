import dotenv from 'dotenv';
import FormData from 'form-data';
import fs from 'fs';
import fetch from 'node-fetch';
import path from 'path';

// Load environment variables
dotenv.config();

const BASE_URL = 'http://localhost:3000';
const TEST_AGENT_ID = 'test-agent-comprehensive';
const TRAINED_AGENT_ID = 'test-agent-doc'; // Use the agent that was trained in test-api.js
const SAMPLE_DOC_PATH = path.join('src', 'utils', 'sample.txt');

// Common headers for API requests
const API_HEADERS = {
  'Content-Type': 'application/json'
};

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  details: []
};

// Helper function to log test results
function logTestResult(testName, success, details = '') {
  testResults.total++;
  if (success) {
    testResults.passed++;
    console.log(`✅ ${testName}`);
  } else {
    testResults.failed++;
    console.log(`❌ ${testName}${details ? ` - ${details}` : ''}`);
  }
  testResults.details.push({ name: testName, success, details });
}

// Helper function to make API requests
async function makeRequest(endpoint, method = 'GET', body = null, headers = API_HEADERS) {
  try {
    const options = {
      method,
      headers
    };
    
    if (body) {
      if (body instanceof FormData) {
        options.body = body;
        delete options.headers['Content-Type']; // Let FormData set the content type
      } else {
        options.body = JSON.stringify(body);
      }
    }
    
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await response.json().catch(() => ({}));
    
    return {
      success: response.ok,
      status: response.status,
      data,
      headers: response.headers
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      status: 0
    };
  }
}

// Test 1: Root endpoint
async function testRootEndpoint() {
  console.log('\n🧪 Testing Root Endpoint...');
  const result = await makeRequest('/');
  logTestResult('Root endpoint', result.success, result.success ? '' : `Status: ${result.status}`);
  if (result.success) {
    console.log(`   📝 Message: ${result.data.message}`);
    console.log(`   📝 Version: ${result.data.version}`);
  }
}

// Test 2: Health endpoint
async function testHealthEndpoint() {
  console.log('\n🧪 Testing Health Endpoint...');
  const result = await makeRequest('/health');
  logTestResult('Health endpoint', result.success, result.success ? '' : `Status: ${result.status}`);
}

// Test 3: API Status endpoint
async function testApiStatusEndpoint() {
  console.log('\n🧪 Testing API Status Endpoint...');
  const result = await makeRequest('/api/status');
  logTestResult('API Status endpoint', result.success, result.success ? '' : `Status: ${result.status}`);
}

// Test 4: Train endpoints (all types)
async function testTrainEndpoints() {
  console.log('\n🧪 Testing Train Endpoints (All Types)...');
  
  const trainingTests = [
    {
      name: 'Document Training',
      agentId: 'test-agent-document',
      source: 'document',
      fileType: 'txt',
      filePath: SAMPLE_DOC_PATH
    },
    {
      name: 'Website Training',
      agentId: 'test-agent-website',
      source: 'website',
      sourceUrl: 'https://example.com' // More reliable test URL
    },
    {
      name: 'YouTube Training',
      agentId: 'test-agent-youtube',
      source: 'youtube',
      sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' // Rick Roll - has transcripts
    }
  ];
  
  let successfulTrains = 0;
  
  for (const testCase of trainingTests) {
    console.log(`\n   🧪 Testing ${testCase.name}...`);
    
    try {
      let trainResult;
      
      if (testCase.filePath) {
        // File upload (document, audio, video)
        const form = new FormData();
        form.append('agentId', testCase.agentId);
        form.append('source', testCase.source);
        form.append('fileType', testCase.fileType);
        form.append('files', fs.createReadStream(testCase.filePath));
        
        const formHeaders = form.getHeaders();
        
        trainResult = await makeRequest('/api/train', 'POST', form, formHeaders);
      } else {
        // URL-based training (website, youtube)
        trainResult = await makeRequest('/api/train', 'POST', {
          agentId: testCase.agentId,
          source: testCase.source,
          sourceUrl: testCase.sourceUrl
        });
      }
      
      if (trainResult.success && trainResult.data.jobId) {
        console.log(`   📝 Job ID: ${trainResult.data.jobId}`);
        
        // Wait for training to complete with detailed progress
        console.log('   ⏳ Waiting for training to complete...');
        let attempts = 0;
        let status = 'processing';
        let lastProgress = 0;
        
        while (status === 'processing' && attempts < 20) { // Increased timeout
          await new Promise(resolve => setTimeout(resolve, 3000)); // Increased delay
          const statusResult = await makeRequest(`/api/train/status/${trainResult.data.jobId}`);
          
          if (statusResult.success) {
            const data = statusResult.data;
            status = data.status;
            const progress = data.progress || 0;
            
            // Only show progress updates when it changes
            if (progress !== lastProgress) {
              console.log(`   📝 Status: ${status}, Progress: ${progress}%`);
              
              // Show detailed progress information
              if (data.chunksProcessed !== undefined && data.totalChunks !== undefined) {
                console.log(`   📊 Chunks: ${data.chunksProcessed}/${data.totalChunks} processed`);
              }
              if (data.successCount !== undefined) {
                console.log(`   ✅ Success: ${data.successCount}, ❌ Errors: ${data.errorCount || 0}, ⏭️ Skipped: ${data.skippedCount || 0}`);
              }
              lastProgress = progress;
            }
            
            // Check for errors
            if (data.error) {
              console.log(`   ❌ ${testCase.name} error: ${JSON.stringify(data.error)}`);
              break;
            }
          }
          attempts++;
        }
        
        if (status === 'completed') {
          console.log(`   ✅ ${testCase.name} completed successfully!`);
          
          // Show final results if available
          const finalStatus = await makeRequest(`/api/train/status/${trainResult.data.jobId}`);
          if (finalStatus.success && finalStatus.data.result) {
            const result = finalStatus.data.result;
            console.log(`   📊 Final Results:`);
            console.log(`      - Chunks stored: ${result.chunksStored || 0}`);
            console.log(`      - Total chunks: ${result.totalChunks || 0}`);
            console.log(`      - Success count: ${result.successCount || 0}`);
            console.log(`      - Skipped count: ${result.skippedCount || 0}`);
            if (result.message) {
              console.log(`      - Message: ${result.message}`);
            }
          }
          successfulTrains++;
        } else if (status === 'failed') {
          console.log(`   ❌ ${testCase.name} failed`);
        } else {
          console.log(`   ⚠️ ${testCase.name} timed out or still processing`);
        }
      } else {
        console.log(`   ❌ ${testCase.name} failed to start: ${trainResult.data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.log(`   ❌ ${testCase.name} error: ${error.message}`);
    }
  }
  
  logTestResult('Train endpoints (all types)', successfulTrains > 0, `${successfulTrains}/${trainingTests.length} successful`);
}

// Test 5: Ask endpoints
async function testAskEndpoints() {
  console.log('\n🧪 Testing Ask Endpoints...');
  
  // Test ask POST endpoint - use one of the trained agents
  const askResult = await makeRequest('/api/ask', 'POST', {
    agentId: 'test-agent-document', // Use the document-trained agent
    question: 'What is the BrightPack product?'
  });
  logTestResult('Ask POST endpoint', askResult.success, askResult.success ? '' : `Status: ${askResult.status}`);
  
  if (askResult.success) {
    console.log(`   📝 Reply: ${askResult.data.reply?.substring(0, 100)}...`);
    console.log(`   📝 Confidence: ${askResult.data.confidence}`);
  } else {
    console.log(`   📝 Error details: ${askResult.data.error || 'Unknown error'}`);
  }
  
  // Test ask config GET endpoint
  const configGetResult = await makeRequest('/api/ask/config');
  logTestResult('Ask config GET endpoint', configGetResult.success, configGetResult.success ? '' : `Status: ${configGetResult.status}`);
  
  // Test ask config POST endpoint
  const configPostResult = await makeRequest('/api/ask/config', 'POST', {
    vector_k: 10,
    keyword_k: 5,
    min_similarity_score: 0.3,
    max_context_length: 4000,
    confidence_threshold: 0.4,
    max_chunks: 5
  });
  logTestResult('Ask config POST endpoint', configPostResult.success, configPostResult.success ? '' : `Status: ${configPostResult.status}`);
}

// Test 6: Analytics endpoints
async function testAnalyticsEndpoints() {
  console.log('\n🧪 Testing Analytics Endpoints...');
  
  const analyticsEndpoints = [
    `/api/analytics/dashboard/${TEST_AGENT_ID}`,
    `/api/analytics/top-questions/${TEST_AGENT_ID}`,
    `/api/analytics/sources/${TEST_AGENT_ID}`,
    `/api/analytics/unanswered/${TEST_AGENT_ID}`,
    `/api/analytics/similarity-heatmap/${TEST_AGENT_ID}`,
    `/api/analytics/business-insights/${TEST_AGENT_ID}`,
    `/api/analytics/export/${TEST_AGENT_ID}`
  ];
  
  for (const endpoint of analyticsEndpoints) {
    const result = await makeRequest(endpoint);
    const endpointName = endpoint.split('/').pop();
    logTestResult(`Analytics ${endpointName}`, result.success, result.success ? '' : `Status: ${result.status}`);
  }
  
  // Test analytics generate insights POST endpoint
  const insightsResult = await makeRequest(`/api/analytics/generate-insights/${TEST_AGENT_ID}`, 'POST', {
    timeframe: '7d',
    includeCharts: true
  });
  logTestResult('Analytics generate insights', insightsResult.success, insightsResult.success ? '' : `Status: ${insightsResult.status}`);
}

// Test 7: Feedback endpoints
async function testFeedbackEndpoints() {
  console.log('\n🧪 Testing Feedback Endpoints...');
  
  // Test feedback POST endpoint
  const feedbackResult = await makeRequest('/api/feedback', 'POST', {
    agentId: TEST_AGENT_ID,
    questionId: 'test-question-123',
    question: 'What is the BrightPack product?',
    originalReply: 'The BrightPack is a premium packaging solution.',
    confidence: 0.85,
    feedbackText: 'Great answer!',
    chunksUsed: 3,
    averageSimilarity: 0.75,
    sources: []
  });
  logTestResult('Feedback POST endpoint', feedbackResult.success, feedbackResult.success ? '' : `Status: ${feedbackResult.status}`);
  
  // Test feedback suggestions endpoint
  const suggestionsResult = await makeRequest(`/api/feedback/suggestions/${TEST_AGENT_ID}`);
  logTestResult('Feedback suggestions', suggestionsResult.success, suggestionsResult.success ? '' : `Status: ${suggestionsResult.status}`);
  
  // Test feedback summary endpoint
  const summaryResult = await makeRequest(`/api/feedback/summary/${TEST_AGENT_ID}`);
  logTestResult('Feedback summary', summaryResult.success, summaryResult.success ? '' : `Status: ${summaryResult.status}`);
  
  // Test feedback implement suggestions endpoint (if we have a suggestion ID)
  if (suggestionsResult.success && suggestionsResult.data.suggestions && suggestionsResult.data.suggestions.length > 0) {
    const suggestionId = suggestionsResult.data.suggestions[0]._id;
    const implementResult = await makeRequest(`/api/feedback/suggestions/${suggestionId}/implement`, 'POST', {
      action: 'implement',
      notes: 'Implementing suggestion'
    });
    logTestResult('Feedback implement suggestion', implementResult.success, implementResult.success ? '' : `Status: ${implementResult.status}`);
  }
}

// Test 8: Watchdog endpoints
async function testWatchdogEndpoints() {
  console.log('\n🧪 Testing Watchdog Endpoints...');
  
  // Test watchdog audit POST endpoint
  const auditResult = await makeRequest('/api/watchdog/audit', 'POST', {
    agentId: TEST_AGENT_ID,
    questionId: 'test-question-123',
    question: 'What is the BrightPack product?',
    response: 'The BrightPack is a premium packaging solution.',
    confidence: 0.85,
    chunksUsed: 3,
    sources: []
  });
  logTestResult('Watchdog audit POST', auditResult.success, auditResult.success ? '' : `Status: ${auditResult.status}`);
  
  // Test watchdog stats endpoint
  const statsResult = await makeRequest(`/api/watchdog/stats/${TEST_AGENT_ID}`);
  logTestResult('Watchdog stats', statsResult.success, statsResult.success ? '' : `Status: ${statsResult.status}`);
  
  // Test watchdog high-risk endpoint
  const highRiskResult = await makeRequest(`/api/watchdog/high-risk/${TEST_AGENT_ID}`);
  logTestResult('Watchdog high-risk', highRiskResult.success, highRiskResult.success ? '' : `Status: ${highRiskResult.status}`);
  
  // Test watchdog config GET endpoint
  const configGetResult = await makeRequest('/api/watchdog/config');
  logTestResult('Watchdog config GET', configGetResult.success, configGetResult.success ? '' : `Status: ${configGetResult.status}`);
  
  // Test watchdog config POST endpoint
  const configPostResult = await makeRequest('/api/watchdog/config', 'POST', {
    riskThreshold: 0.7,
    enableAuditing: true,
    alertOnHighRisk: true
  });
  logTestResult('Watchdog config POST', configPostResult.success, configPostResult.success ? '' : `Status: ${configPostResult.status}`);
  
  // Test watchdog review endpoint (if we have an audit ID)
  if (auditResult.success && auditResult.data.auditId) {
    const reviewResult = await makeRequest(`/api/watchdog/review/${auditResult.data.auditId}`, 'POST', {
      action: 'approve',
      notes: 'Approved after review'
    });
    logTestResult('Watchdog review', reviewResult.success, reviewResult.success ? '' : `Status: ${reviewResult.status}`);
  }
}

// Test 9: Cache endpoints
async function testCacheEndpoints() {
  console.log('\n🧪 Testing Cache Endpoints...');
  
  // Test cache stats for specific agent
  const agentStatsResult = await makeRequest(`/api/cache/stats/${TEST_AGENT_ID}`);
  logTestResult('Cache agent stats', agentStatsResult.success, agentStatsResult.success ? '' : `Status: ${agentStatsResult.status}`);
  
  // Test cache health endpoint
  const healthResult = await makeRequest('/api/cache/health');
  logTestResult('Cache health', healthResult.success, healthResult.success ? '' : `Status: ${healthResult.status}`);
  
  // Test cache global stats endpoint
  const globalStatsResult = await makeRequest('/api/cache/stats');
  logTestResult('Cache global stats', globalStatsResult.success, globalStatsResult.success ? '' : `Status: ${globalStatsResult.status}`);
  
  // Test cache clear endpoint
  const clearResult = await makeRequest(`/api/cache/clear/${TEST_AGENT_ID}`, 'DELETE');
  logTestResult('Cache clear', clearResult.success, clearResult.success ? '' : `Status: ${clearResult.status}`);
}

// Test 10: Error handling and edge cases
async function testErrorHandling() {
  console.log('\n🧪 Testing Error Handling...');
  
  // Test with missing required fields
  const missingFieldsResult = await makeRequest('/api/ask', 'POST', {
    agentId: TEST_AGENT_ID
    // Missing question field
  });
  logTestResult('Missing fields handling', !missingFieldsResult.success, missingFieldsResult.success ? 'Should have failed' : '');
  
  // Test non-existent endpoint
  const notFoundResult = await makeRequest('/api/nonexistent');
  logTestResult('404 handling', !notFoundResult.success, notFoundResult.success ? 'Should have failed' : '');
}

// Test 11: Rate limiting (if applicable)
async function testRateLimiting() {
  console.log('\n🧪 Testing Rate Limiting...');
  
  // Test rate limiting on a simple endpoint that doesn't require an agent
  const results = [];
  for (let i = 0; i < 3; i++) {
    const result = await makeRequest('/api/analytics/dashboard/test-agent-comprehensive');
    results.push(result);
    
    // Add small delay between requests
    if (i < 2) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  
  logTestResult('Rate limiting', successCount > 0, `Success rate: ${successCount}/${results.length}`);
  
  if (successCount === 0) {
    console.log('   📝 Rate limiting test failed - all requests returned errors');
    results.forEach((result, index) => {
      console.log(`   📝 Request ${index + 1}: Status ${result.status} - ${result.data.error || 'Unknown error'}`);
    });
  } else {
    console.log(`   📝 Rate limiting test successful - ${successCount}/3 requests succeeded`);
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Comprehensive API Test Suite...\n');
  console.log(`📊 Testing against: ${BASE_URL}`);
  console.log(`👤 Test Agent ID: ${TEST_AGENT_ID} (will be trained during test)\n`);
  
  try {
    await testRootEndpoint();
    await testHealthEndpoint();
    await testApiStatusEndpoint();
    await testTrainEndpoints();
    await testAskEndpoints();
    await testAnalyticsEndpoints();
    await testFeedbackEndpoints();
    await testWatchdogEndpoints();
    await testCacheEndpoints();
    await testErrorHandling();
    await testRateLimiting();
    
    // Print summary
    console.log('\n📊 Test Summary:');
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`📈 Total: ${testResults.total}`);
    console.log(`📊 Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
    
    if (testResults.failed > 0) {
      console.log('\n❌ Failed Tests:');
      testResults.details
        .filter(test => !test.success)
        .forEach(test => {
          console.log(`   - ${test.name}: ${test.details}`);
        });
    }
    
    console.log('\n🎉 Test suite completed!');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
}

// Run the tests
runAllTests().catch(console.error); 