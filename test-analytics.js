const fs = require('fs');
require('dotenv').config();

const API_URL = process.env.API_URL || 'http://localhost:3000';
const API_TOKEN = process.env.AGENT_API_TOKEN || '123456';
const TEST_AGENT_ID = 'test-analytics-agent';

// Test data
const testQuestions = [
  "What is the main product of Chinedu's Smart Farm?",
  "How does the smart irrigation system work?",
  "What crops does Chinedu grow?",
  "How does the mobile app help farmers?",
  "What technology does Chinedu use?",
  "How does the weather monitoring work?",
  "What are the benefits of the smart farm?",
  "How does Chinedu help other farmers?",
  "What sensors are used in the farm?",
  "How does the automated system work?"
];

const testSources = [
  "smart-farm-documentation.pdf",
  "https://example.com/smart-farming-guide",
  "irrigation-system-manual.txt",
  "https://youtube.com/watch?v=smart-farming-demo",
  "weather-sensors-guide.pdf"
];

// Utility functions
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : '📊';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

async function makeRequest(endpoint, method = 'GET', body = null) {
  const url = `${API_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${data.error || response.statusText}`);
    }
    
    return data;
  } catch (error) {
    throw error;
  }
}

// Test functions
async function testDashboardEndpoint() {
  log('Testing dashboard endpoint...');
  
  try {
    const data = await makeRequest(`/api/analytics/dashboard/${TEST_AGENT_ID}?days=30`);
    
    if (data.success && data.data) {
      log('✅ Dashboard endpoint working correctly', 'success');
      log(`📊 Overview: ${JSON.stringify(data.data.overview, null, 2)}`);
      return true;
    } else {
      log('❌ Dashboard endpoint returned invalid data', 'error');
      return false;
    }
  } catch (error) {
    log(`❌ Dashboard endpoint failed: ${error.message}`, 'error');
    return false;
  }
}

async function testTopQuestionsEndpoint() {
  log('Testing top questions endpoint...');
  
  try {
    const data = await makeRequest(`/api/analytics/top-questions/${TEST_AGENT_ID}?limit=5&days=30`);
    
    if (data.success && Array.isArray(data.data)) {
      log('✅ Top questions endpoint working correctly', 'success');
      log(`📊 Found ${data.data.length} top questions`);
      return true;
    } else {
      log('❌ Top questions endpoint returned invalid data', 'error');
      return false;
    }
  } catch (error) {
    log(`❌ Top questions endpoint failed: ${error.message}`, 'error');
    return false;
  }
}

async function testSourcesEndpoint() {
  log('Testing sources endpoint...');
  
  try {
    const data = await makeRequest(`/api/analytics/sources/${TEST_AGENT_ID}?limit=5&days=30`);
    
    if (data.success && Array.isArray(data.data)) {
      log('✅ Sources endpoint working correctly', 'success');
      log(`📊 Found ${data.data.length} sources`);
      return true;
    } else {
      log('❌ Sources endpoint returned invalid data', 'error');
      return false;
    }
  } catch (error) {
    log(`❌ Sources endpoint failed: ${error.message}`, 'error');
    return false;
  }
}

async function testUnansweredEndpoint() {
  log('Testing unanswered queries endpoint...');
  
  try {
    const data = await makeRequest(`/api/analytics/unanswered/${TEST_AGENT_ID}?limit=5&days=30`);
    
    if (data.success && Array.isArray(data.data)) {
      log('✅ Unanswered queries endpoint working correctly', 'success');
      log(`📊 Found ${data.data.length} unanswered queries`);
      return true;
    } else {
      log('❌ Unanswered queries endpoint returned invalid data', 'error');
      return false;
    }
  } catch (error) {
    log(`❌ Unanswered queries endpoint failed: ${error.message}`, 'error');
    return false;
  }
}

async function testSimilarityHeatmapEndpoint() {
  log('Testing similarity heatmap endpoint...');
  
  try {
    const data = await makeRequest(`/api/analytics/similarity-heatmap/${TEST_AGENT_ID}?limit=10&days=7`);
    
    if (data.success && Array.isArray(data.data)) {
      log('✅ Similarity heatmap endpoint working correctly', 'success');
      log(`📊 Found ${data.data.length} heatmap entries`);
      return true;
    } else {
      log('❌ Similarity heatmap endpoint returned invalid data', 'error');
      return false;
    }
  } catch (error) {
    log(`❌ Similarity heatmap endpoint failed: ${error.message}`, 'error');
    return false;
  }
}

async function testBusinessInsightsEndpoint() {
  log('Testing business insights endpoint...');
  
  try {
    const data = await makeRequest(`/api/analytics/business-insights/${TEST_AGENT_ID}?days=30`);
    
    if (data.success && data.data) {
      log('✅ Business insights endpoint working correctly', 'success');
      log(`📊 Insights summary: ${JSON.stringify(data.data.summary, null, 2)}`);
      return true;
    } else {
      log('❌ Business insights endpoint returned invalid data', 'error');
      return false;
    }
  } catch (error) {
    log(`❌ Business insights endpoint failed: ${error.message}`, 'error');
    return false;
  }
}

async function testGenerateInsightsEndpoint() {
  log('Testing generate insights endpoint...');
  
  try {
    const data = await makeRequest(`/api/analytics/generate-insights/${TEST_AGENT_ID}`, 'POST', {
      date: new Date().toISOString()
    });
    
    if (data.success) {
      log('✅ Generate insights endpoint working correctly', 'success');
      return true;
    } else {
      log('❌ Generate insights endpoint returned invalid data', 'error');
      return false;
    }
  } catch (error) {
    log(`❌ Generate insights endpoint failed: ${error.message}`, 'error');
    return false;
  }
}

async function testExportEndpoint() {
  log('Testing export endpoint...');
  
  try {
    const data = await makeRequest(`/api/analytics/export/${TEST_AGENT_ID}?format=json&days=30`);
    
    if (data.success && data.data) {
      log('✅ Export endpoint working correctly', 'success');
      log(`📊 Exported data for agent: ${data.data.agentId}`);
      return true;
    } else {
      log('❌ Export endpoint returned invalid data', 'error');
      return false;
    }
  } catch (error) {
    log(`❌ Export endpoint failed: ${error.message}`, 'error');
    return false;
  }
}

async function generateTestData() {
  log('Generating test data for analytics...');
  
  // First, train some data
  const testContent = `
Chinedu's Smart Farm is a revolutionary agricultural technology company based in Nigeria. 
Founded by Chinedu Okafor, a former software engineer turned farmer, the company combines 
traditional farming wisdom with cutting-edge technology to create sustainable, efficient, 
and profitable farming solutions.

The Smart Farm uses IoT sensors to monitor soil moisture, temperature, humidity, and 
weather conditions in real-time. These sensors are connected to a central control system 
that automatically adjusts irrigation, fertilization, and other farming parameters based 
on the collected data.

The company's flagship product is the Smart Irrigation System, which uses AI algorithms 
to optimize water usage and crop yield. The system can predict weather patterns and adjust 
irrigation schedules accordingly, reducing water waste by up to 40% while increasing crop 
yields by 25%.

Chinedu's mobile app allows farmers to monitor their farms remotely, receive alerts about 
potential issues, and access farming best practices. The app also provides market prices 
for crops and connects farmers with buyers directly.

The Smart Farm has helped over 500 farmers across Nigeria increase their productivity and 
income. The company's technology has been particularly effective for crops like tomatoes, 
peppers, and leafy greens, which are sensitive to water and temperature conditions.

Chinedu's vision is to make smart farming accessible to small-scale farmers across Africa, 
helping them overcome climate challenges and improve food security for the continent.
  `;

  try {
    // Train the agent with test content
    const trainResponse = await makeRequest('/api/train', 'POST', {
      agentId: TEST_AGENT_ID,
      text: testContent,
      source: 'smart-farm-documentation.pdf',
      sourceUrl: 'https://example.com/smart-farming-guide',
      sourceMetadata: {
        author: 'Chinedu Okafor',
        date: new Date().toISOString(),
        category: 'agriculture'
      }
    });

    if (trainResponse.success) {
      log('✅ Test data training successful', 'success');
    } else {
      log('❌ Test data training failed', 'error');
      return false;
    }

    // Ask some questions to generate analytics data
    log('Asking test questions to generate analytics data...');
    
    for (let i = 0; i < Math.min(5, testQuestions.length); i++) {
      try {
        const question = testQuestions[i];
        log(`Asking: "${question}"`);
        
        const askResponse = await makeRequest('/api/ask', 'POST', {
          agentId: TEST_AGENT_ID,
          question: question
        });

        if (askResponse.success) {
          log(`✅ Question answered with confidence: ${askResponse.confidence}`, 'success');
        } else {
          log(`❌ Question failed: ${askResponse.error}`, 'error');
        }

        // Small delay between questions
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        log(`❌ Error asking question: ${error.message}`, 'error');
      }
    }

    return true;
  } catch (error) {
    log(`❌ Error generating test data: ${error.message}`, 'error');
    return false;
  }
}

async function runAllTests() {
  log('🚀 Starting Analytics API Tests', 'success');
  log(`📍 API URL: ${API_URL}`);
  log(`🔑 Agent ID: ${TEST_AGENT_ID}`);
  
  const results = {
    testDataGeneration: false,
    dashboard: false,
    topQuestions: false,
    sources: false,
    unanswered: false,
    similarityHeatmap: false,
    businessInsights: false,
    generateInsights: false,
    export: false
  };

  try {
    // Generate test data first
    results.testDataGeneration = await generateTestData();
    
    if (!results.testDataGeneration) {
      log('❌ Test data generation failed, skipping analytics tests', 'error');
      return results;
    }

    // Wait a moment for data to be processed
    log('⏳ Waiting for data processing...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test all endpoints
    results.dashboard = await testDashboardEndpoint();
    results.topQuestions = await testTopQuestionsEndpoint();
    results.sources = await testSourcesEndpoint();
    results.unanswered = await testUnansweredEndpoint();
    results.similarityHeatmap = await testSimilarityHeatmapEndpoint();
    results.businessInsights = await testBusinessInsightsEndpoint();
    results.generateInsights = await testGenerateInsightsEndpoint();
    results.export = await testExportEndpoint();

  } catch (error) {
    log(`❌ Test execution failed: ${error.message}`, 'error');
  }

  // Print summary
  log('\n📋 Test Results Summary:', 'success');
  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    log(`${status} ${test}`);
  });

  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  log(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed`, passedTests === totalTests ? 'success' : 'error');
  
  return results;
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().then(results => {
    process.exit(Object.values(results).every(Boolean) ? 0 : 1);
  }).catch(error => {
    log(`❌ Test execution failed: ${error.message}`, 'error');
    process.exit(1);
  });
}

module.exports = {
  runAllTests,
  testDashboardEndpoint,
  testTopQuestionsEndpoint,
  testSourcesEndpoint,
  testUnansweredEndpoint,
  testSimilarityHeatmapEndpoint,
  testBusinessInsightsEndpoint,
  testGenerateInsightsEndpoint,
  testExportEndpoint,
  generateTestData
}; 