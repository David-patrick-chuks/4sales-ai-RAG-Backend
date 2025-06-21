// Test the agent ID validation logic directly
console.log('🔍 Testing Agent ID Validation Logic...\n');

const SECURITY_CONFIG = {
  MAX_AGENT_ID_LENGTH: 100
};

function sanitizeAgentId(agentId) {
  if (!agentId || typeof agentId !== 'string') {
    return { isValid: false, error: 'Agent ID is required and must be a string' };
  }
  
  // Check length
  if (agentId.length > SECURITY_CONFIG.MAX_AGENT_ID_LENGTH) {
    return { isValid: false, error: `Agent ID too long (max ${SECURITY_CONFIG.MAX_AGENT_ID_LENGTH} characters)` };
  }
  
  // Check for dangerous patterns first (reject instead of sanitize)
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /data:/i,
    /vbscript:/i,
    /on\w+\s*=/i,
    /["'&<>]/,
    /[^\w\-_.]/
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(agentId)) {
      return { isValid: false, error: 'Agent ID contains invalid or dangerous characters' };
    }
  }
  
  // If we get here, the agent ID is clean
  const sanitized = agentId.trim();
  
  if (sanitized.length === 0) {
    return { isValid: false, error: 'Agent ID cannot be empty' };
  }
  
  return { isValid: true, sanitized };
}

const testCases = [
  '<script>alert("xss")</script>',
  'agent"id',
  'agent&id',
  'agent<id>',
  'a'.repeat(200), // Too long
  'valid-agent-id',
  'test_agent_123'
];

testCases.forEach(agentId => {
  console.log(`Testing: "${agentId}"`);
  const result = sanitizeAgentId(agentId);
  console.log(`Result: ${result.isValid ? '✅ Valid' : '❌ Invalid'}`);
  if (!result.isValid) {
    console.log(`Error: ${result.error}`);
  } else {
    console.log(`Sanitized: "${result.sanitized}"`);
  }
  console.log('---');
}); 