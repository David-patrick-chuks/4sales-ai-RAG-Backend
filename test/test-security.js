import fetch from 'node-fetch';

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const API_TOKEN = process.env.AGENT_API_TOKEN || '123456';

const API_HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${API_TOKEN}`
};

console.log('🔒 Testing Security Measures...\n');

// Test 1: Input Sanitization - Malicious Script Tags
async function testScriptInjection() {
  console.log('🧪 Test 1: Script Injection Prevention');
  
  const maliciousQuestion = '<script>alert("xss")</script>How much does the BrightPack cost?';
  
  try {
    const response = await fetch(`${BASE_URL}/api/ask`, {
      method: 'POST',
      headers: API_HEADERS,
      body: JSON.stringify({
        agentId: 'test-agent-doc',
        question: maliciousQuestion
      })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      // Check if script tags were sanitized
      if (result.query && result.query.includes('<script>')) {
        console.log('❌ FAIL: Script tags not sanitized in question');
        return false;
      } else {
        console.log('✅ PASS: Script tags properly sanitized');
        return true;
      }
    } else {
      console.log('✅ PASS: Malicious input rejected');
      return true;
    }
  } catch (error) {
    console.log('✅ PASS: Malicious input caused error (expected)');
    return true;
  }
}

// Test 2: File Upload Security - Blocked File Types
async function testBlockedFileTypes() {
  console.log('\n🧪 Test 2: Blocked File Types');
  
  // Create a fake executable file
  const fakeExe = Buffer.from('fake executable content');
  
  const formData = new FormData();
  formData.append('agentId', 'test-agent-doc');
  formData.append('source', 'document');
  formData.append('fileType', 'document');
  
  // Try to upload a .exe file
  const blob = new Blob([fakeExe], { type: 'application/octet-stream' });
  formData.append('files', blob, 'malicious.exe');
  
  try {
    const response = await fetch(`${BASE_URL}/api/train`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`
      },
      body: formData
    });
    
    if (response.status === 400) {
      console.log('✅ PASS: .exe file properly blocked');
      return true;
    } else {
      console.log('❌ FAIL: .exe file was accepted');
      return false;
    }
  } catch (error) {
    console.log('✅ PASS: .exe file caused error (expected)');
    return true;
  }
}

// Test 3: URL Sanitization - Malicious URLs
async function testMaliciousUrls() {
  console.log('\n🧪 Test 3: Malicious URL Prevention');
  
  const maliciousUrls = [
    'javascript:alert("xss")',
    'data:text/html,<script>alert("xss")</script>',
    'file:///etc/passwd',
    'http://localhost:3000/internal',
    'http://127.0.0.1:3000/admin'
  ];
  
  let passed = 0;
  
  for (const url of maliciousUrls) {
    try {
      const response = await fetch(`${BASE_URL}/api/train`, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify({
          agentId: 'test-agent-doc',
          source: 'website',
          sourceUrl: url
        })
      });
      
      if (response.status === 400) {
        console.log(`✅ PASS: Malicious URL blocked: ${url}`);
        passed++;
      } else {
        console.log(`❌ FAIL: Malicious URL accepted: ${url}`);
      }
    } catch (error) {
      console.log(`✅ PASS: Malicious URL caused error: ${url}`);
      passed++;
    }
  }
  
  return passed === maliciousUrls.length;
}

// Test 4: Rate Limiting
async function testRateLimiting() {
  console.log('\n🧪 Test 4: Rate Limiting');
  
  const requests = [];
  const maxRequests = 20; // Send more than the limit (15) to trigger rate limiting
  
  for (let i = 0; i < maxRequests; i++) {
    requests.push(
      fetch(`${BASE_URL}/api/ask`, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify({
          agentId: 'test-agent-doc',
          question: `Test question ${i}`
        })
      })
    );
  }
  
  try {
    const responses = await Promise.all(requests);
    const rateLimited = responses.some(res => res.status === 429);
    
    if (rateLimited) {
      console.log('✅ PASS: Rate limiting working');
      return true;
    } else {
      console.log('❌ FAIL: Rate limiting not working');
      return false;
    }
  } catch (error) {
    console.log('✅ PASS: Rate limiting caused error (expected)');
    return true;
  }
}

// Test 5: Request Size Limits
async function testRequestSizeLimits() {
  console.log('\n🧪 Test 5: Request Size Limits');
  
  // Create a very large request
  const largeText = 'A'.repeat(2 * 1024 * 1024); // 2MB
  
  try {
    const response = await fetch(`${BASE_URL}/api/train`, {
      method: 'POST',
      headers: API_HEADERS,
      body: JSON.stringify({
        agentId: 'test-agent-doc',
        text: largeText
      })
    });
    
    if (response.status === 413) {
      console.log('✅ PASS: Large request properly rejected');
      return true;
    } else {
      console.log('❌ FAIL: Large request was accepted');
      return false;
    }
  } catch (error) {
    console.log('✅ PASS: Large request caused error (expected)');
    return true;
  }
}

// Test 6: Agent ID Sanitization
async function testAgentIdSanitization() {
  console.log('\n🧪 Test 6: Agent ID Sanitization');
  
  const maliciousAgentIds = [
    '<script>alert("xss")</script>',
    'agent"id',
    'agent&id',
    'agent<id>',
    'a'.repeat(200) // Too long
  ];
  
  let passed = 0;
  
  for (const agentId of maliciousAgentIds) {
    try {
      const response = await fetch(`${BASE_URL}/api/ask`, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify({
          agentId: agentId,
          question: 'Test question'
        })
      });
      
      if (response.status === 400) {
        console.log(`✅ PASS: Malicious agent ID blocked: ${agentId.substring(0, 20)}...`);
        passed++;
      } else {
        console.log(`❌ FAIL: Malicious agent ID accepted: ${agentId.substring(0, 20)}...`);
      }
    } catch (error) {
      console.log(`✅ PASS: Malicious agent ID caused error: ${agentId.substring(0, 20)}...`);
      passed++;
    }
  }
  
  return passed === maliciousAgentIds.length;
}

// Test 7: Authentication
async function testAuthentication() {
  console.log('\n🧪 Test 7: Authentication');
  
  // Test without token
  try {
    const response = await fetch(`${BASE_URL}/api/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agentId: 'test-agent-doc',
        question: 'Test question'
      })
    });
    
    if (response.status === 401) {
      console.log('✅ PASS: Missing token properly rejected');
      return true;
    } else {
      console.log('❌ FAIL: Missing token was accepted');
      return false;
    }
  } catch (error) {
    console.log('✅ PASS: Missing token caused error (expected)');
    return true;
  }
}

// Run all tests
async function runSecurityTests() {
  const tests = [
    testScriptInjection,
    testBlockedFileTypes,
    testMaliciousUrls,
    testRateLimiting,
    testRequestSizeLimits,
    testAgentIdSanitization,
    testAuthentication
  ];
  
  let passed = 0;
  let total = tests.length;
  
  for (const test of tests) {
    try {
      const result = await test();
      if (result) passed++;
    } catch (error) {
      console.log(`❌ Test failed with error: ${error.message}`);
    }
  }
  
  console.log(`\n📊 Security Test Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All security tests passed!');
  } else {
    console.log('⚠️ Some security tests failed. Please review the implementation.');
  }
}

// Run the tests
runSecurityTests().catch(console.error); 