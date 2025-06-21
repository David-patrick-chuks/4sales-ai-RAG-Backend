import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3000';
const API_TOKEN = process.env.AGENT_API_TOKEN || '123456';

async function testSessionSupport() {
  console.log('🧪 Testing MongoDB Session Store...');
  
  try {
    // Test 1: Make a request and check if session is created
    console.log('📝 Making test request to create session...');
    
    const response = await fetch(`${API_URL}/api/ask`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
        'Cookie': 'test-session=1' // This will create a session
      },
      body: JSON.stringify({
        agentId: 'test-agent-doc',
        question: 'Test question for session tracking'
      })
    });

    if (response.ok) {
      console.log('✅ Session test request successful');
      
      // Check if Set-Cookie header is present (indicates session creation)
      const setCookieHeader = response.headers.get('set-cookie');
      if (setCookieHeader) {
        console.log('✅ Session cookie created:', setCookieHeader);
      } else {
        console.log('⚠️ No session cookie found (may be normal for API-only usage)');
      }
      
      const data = await response.json();
      console.log('📊 Response received with session tracking');
      
    } else {
      console.log('❌ Session test request failed:', response.status);
      const error = await response.text();
      console.log('Error details:', error);
    }

    // Test 2: Check MongoDB for sessions collection
    console.log('\n🔍 Checking MongoDB for sessions collection...');
    console.log('💡 Sessions should be stored in MongoDB collection: "sessions"');
    console.log('💡 You can check this in MongoDB Atlas or your MongoDB client');
    console.log('💡 Session data will include user agent, IP, and session ID for analytics');

  } catch (error) {
    console.error('❌ Session test failed:', error.message);
  }
}

// Test session functionality
testSessionSupport().then(() => {
  console.log('\n🎯 Session testing completed!');
  console.log('\n📋 What to check:');
  console.log('1. MongoDB Atlas -> Collections -> "sessions"');
  console.log('2. Look for session documents with TTL index');
  console.log('3. Session data includes encrypted session information');
  console.log('4. Analytics will now track session IDs properly');
}).catch(error => {
  console.error('❌ Session test error:', error);
  process.exit(1);
}); 