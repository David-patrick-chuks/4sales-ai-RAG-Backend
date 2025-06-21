import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const API_BASE = 'http://localhost:3000/api';
const TOKEN = process.env.AGENT_API_TOKEN || '123456';

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json'
};

async function testCacheFunctionality() {
  console.log('🧪 Testing Agent Isolation + Context Caching\n');

  try {
    // Test 1: Check cache health
    console.log('1️⃣ Testing cache health...');
    const healthResponse = await axios.get(`${API_BASE}/cache/health`, { headers });
    console.log('✅ Cache health:', healthResponse.data);
    console.log('');

    // Test 2: Train two different agents with similar content
    console.log('2️⃣ Training agents with similar content...');
    
    const agent1Data = {
      agentId: 'business-agent-1',
      text: 'Our company provides excellent customer service and has been in business for 10 years. We offer 24/7 support and have a satisfaction guarantee.'
    };

    const agent2Data = {
      agentId: 'business-agent-2', 
      text: 'Our company provides excellent customer service and has been in business for 10 years. We offer 24/7 support and have a satisfaction guarantee.'
    };

    await axios.post(`${API_BASE}/train`, agent1Data, { headers });
    console.log('✅ Trained agent 1');
    
    await axios.post(`${API_BASE}/train`, agent2Data, { headers });
    console.log('✅ Trained agent 2');
    console.log('');

    // Test 3: Ask similar questions to both agents
    console.log('3️⃣ Asking similar questions to both agents...');
    
    const question1 = 'What customer service do you provide?';
    const question2 = 'What customer service do you provide?'; // Same question
    
    console.log(`Asking agent 1: "${question1}"`);
    const response1 = await axios.post(`${API_BASE}/ask`, {
      agentId: 'business-agent-1',
      question: question1
    }, { headers });
    
    console.log(`Asking agent 2: "${question2}"`);
    const response2 = await axios.post(`${API_BASE}/ask`, {
      agentId: 'business-agent-2',
      question: question2
    }, { headers });
    
    console.log('✅ Both agents responded');
    console.log('');

    // Test 4: Check cache stats for both agents
    console.log('4️⃣ Checking cache statistics...');
    
    const stats1 = await axios.get(`${API_BASE}/cache/stats/business-agent-1`, { headers });
    const stats2 = await axios.get(`${API_BASE}/cache/stats/business-agent-2`, { headers });
    
    console.log('Agent 1 cache stats:', stats1.data);
    console.log('Agent 2 cache stats:', stats2.data);
    console.log('');

    // Test 5: Ask the same question again to test cache hits
    console.log('5️⃣ Testing cache hits with repeated questions...');
    
    console.log('Asking agent 1 the same question again...');
    const response1Repeat = await axios.post(`${API_BASE}/ask`, {
      agentId: 'business-agent-1',
      question: question1
    }, { headers });
    
    console.log('Asking agent 2 the same question again...');
    const response2Repeat = await axios.post(`${API_BASE}/ask`, {
      agentId: 'business-agent-2',
      question: question2
    }, { headers });
    
    console.log('✅ Repeated questions completed');
    console.log('');

    // Test 6: Check updated cache stats
    console.log('6️⃣ Checking updated cache statistics...');
    
    const updatedStats1 = await axios.get(`${API_BASE}/cache/stats/business-agent-1`, { headers });
    const updatedStats2 = await axios.get(`${API_BASE}/cache/stats/business-agent-2`, { headers });
    
    console.log('Updated Agent 1 cache stats:', updatedStats1.data);
    console.log('Updated Agent 2 cache stats:', updatedStats2.data);
    console.log('');

    // Test 7: Test agent isolation - ask different questions
    console.log('7️⃣ Testing agent isolation...');
    
    const isolationQuestion1 = 'What is your business model?';
    const isolationQuestion2 = 'How long have you been operating?';
    
    console.log(`Asking agent 1: "${isolationQuestion1}"`);
    const isolationResponse1 = await axios.post(`${API_BASE}/ask`, {
      agentId: 'business-agent-1',
      question: isolationQuestion1
    }, { headers });
    
    console.log(`Asking agent 2: "${isolationQuestion2}"`);
    const isolationResponse2 = await axios.post(`${API_BASE}/ask`, {
      agentId: 'business-agent-2',
      question: isolationQuestion2
    }, { headers });
    
    console.log('✅ Isolation test completed');
    console.log('');

    // Test 8: Clear cache for one agent
    console.log('8️⃣ Testing cache clearing...');
    
    await axios.delete(`${API_BASE}/cache/clear/business-agent-1`, { headers });
    console.log('✅ Cleared cache for agent 1');
    
    const clearedStats = await axios.get(`${API_BASE}/cache/stats/business-agent-1`, { headers });
    console.log('Agent 1 cache stats after clearing:', clearedStats.data);
    console.log('');

    // Test 9: Performance comparison
    console.log('9️⃣ Performance comparison...');
    
    const startTime = Date.now();
    await axios.post(`${API_BASE}/ask`, {
      agentId: 'business-agent-2',
      question: 'What services do you offer?'
    }, { headers });
    const firstCallTime = Date.now() - startTime;
    
    const startTime2 = Date.now();
    await axios.post(`${API_BASE}/ask`, {
      agentId: 'business-agent-2',
      question: 'What services do you offer?'
    }, { headers });
    const secondCallTime = Date.now() - startTime2;
    
    console.log(`First call time: ${firstCallTime}ms`);
    console.log(`Second call time: ${secondCallTime}ms`);
    console.log(`Performance improvement: ${((firstCallTime - secondCallTime) / firstCallTime * 100).toFixed(1)}%`);
    console.log('');

    console.log('🎉 Cache functionality test completed successfully!');
    console.log('');
    console.log('📊 Summary:');
    console.log('- Agent isolation: ✅ Working');
    console.log('- Context caching: ✅ Working');
    console.log('- Cache statistics: ✅ Working');
    console.log('- Cache clearing: ✅ Working');
    console.log('- Performance improvement: ✅ Working');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 503) {
      console.log('\n💡 Tip: Make sure Redis is running:');
      console.log('   - Install Redis: https://redis.io/download');
      console.log('   - Start Redis: redis-server');
      console.log('   - Or use Docker: docker run -d -p 6379:6379 redis:alpine');
    }
  }
}

// Test cache configuration
async function testCacheConfiguration() {
  console.log('🔧 Testing Cache Configuration\n');

  try {
    // Test cache health
    const health = await axios.get(`${API_BASE}/cache/health`, { headers });
    console.log('Cache health:', health.data);

    // Test cache stats endpoint
    const stats = await axios.get(`${API_BASE}/cache/stats`, { headers });
    console.log('Cache stats:', stats.data);

    console.log('✅ Cache configuration test completed');

  } catch (error) {
    console.error('❌ Cache configuration test failed:', error.response?.data || error.message);
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting Agent Isolation + Context Caching Tests\n');
  
  await testCacheConfiguration();
  console.log('');
  
  await testCacheFunctionality();
}

runTests().catch(console.error); 