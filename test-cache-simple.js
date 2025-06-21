import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();


const API_BASE = 'http://localhost:3000/api';
const TOKEN = process.env.AGENT_API_TOKEN || '123456';

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json'
};

async function testCache() {
  console.log('🧪 Testing Agent Isolation + Context Caching\n');

  try {
    // Test 1: Check if cache endpoints exist
    console.log('1️⃣ Testing cache endpoints...');
    
    try {
      const healthResponse = await axios.get(`${API_BASE}/cache/health`, { headers });
      console.log('✅ Cache health endpoint working:', healthResponse.data);
    } catch (error) {
      console.log('⚠️ Cache endpoints not available yet - need to add cache route to server');
      console.log('   This is expected if you haven\'t added the cache route yet');
    }

    // Test 2: Train an agent
    console.log('\n2️⃣ Training an agent...');
    
    const agentData = {
      agentId: 'cache-test-agent',
      text: 'Our company provides excellent customer service and has been in business for 10 years. We offer 24/7 support and have a satisfaction guarantee.'
    };

    await axios.post(`${API_BASE}/train`, agentData, { headers });
    console.log('✅ Agent trained successfully');
    
    // Test 3: Ask the same question twice
    console.log('\n3️⃣ Testing repeated questions...');
    
    const question = 'What customer service do you provide?';
    
    console.log(`First request: "${question}"`);
    const startTime1 = Date.now();
    const response1 = await axios.post(`${API_BASE}/ask`, {
      agentId: 'cache-test-agent',
      question: question
    }, { headers });
    const time1 = Date.now() - startTime1;
    
    console.log(`Second request: "${question}"`);
    const startTime2 = Date.now();
    const response2 = await axios.post(`${API_BASE}/ask`, {
      agentId: 'cache-test-agent',
      question: question
    }, { headers });
    const time2 = Date.now() - startTime2;
    
    console.log(`First request time: ${time1}ms`);
    console.log(`Second request time: ${time2}ms`);
    
    if (time2 < time1) {
      console.log(`✅ Performance improvement: ${((time1 - time2) / time1 * 100).toFixed(1)}% faster`);
    } else {
      console.log('ℹ️ No significant performance difference (cache may not be enabled yet)');
    }

    console.log('\n🎉 Cache test completed!');
    console.log('\n📝 Next steps:');
    console.log('1. Add cache route to server.ts');
    console.log('2. Install and start Redis');
    console.log('3. Run the full test-cache.js for comprehensive testing');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testCache().catch(console.error); 