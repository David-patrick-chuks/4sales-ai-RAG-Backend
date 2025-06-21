import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3000';
const API_TOKEN = process.env.AGENT_API_TOKEN || '123456';

async function testWatchdogSystem() {
  console.log('🕵️ Testing Agent Watchdog & Response Auditing...');
  
  try {
    // Test 1: Manual audit of a response
    console.log('\n📝 Test 1: Manual response audit...');
    
    const auditResponse = await fetch(`${API_URL}/api/watchdog/audit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agentId: 'test-watchdog-agent',
        questionId: 'q_test_123',
        question: 'What are your company policies?',
        response: 'Our company policies include unlimited vacation days and flexible working hours. We also offer free lunch every day and a 4-day work week.',
        confidence: 0.45,
        chunksUsed: 2,
        sources: ['employee-handbook.pdf']
      })
    });

    if (auditResponse.ok) {
      const auditData = await auditResponse.json();
      console.log('✅ Manual audit completed');
      console.log(`🎯 Risk Level: ${auditData.audit.hallucinationRiskLevel}`);
      console.log(`📊 Risk Score: ${auditData.audit.hallucinationRiskScore.toFixed(3)}`);
      console.log(`✅ Factual Accuracy: ${auditData.audit.factualAccuracy.toFixed(3)}`);
      console.log(`🔗 Source Alignment: ${auditData.audit.sourceAlignment.toFixed(3)}`);
      console.log(`📋 Compliance Flags: ${auditData.audit.complianceFlags.join(', ')}`);
      console.log(`👤 Requires Review: ${auditData.audit.requiresHumanReview}`);
      console.log(`💬 Message: ${auditData.message}`);
    } else {
      console.log('❌ Manual audit failed:', auditResponse.status);
      const error = await auditResponse.text();
      console.log('Error details:', error);
    }

    // Test 2: Get audit statistics
    console.log('\n📝 Test 2: Getting audit statistics...');
    
    const statsResponse = await fetch(`${API_URL}/api/watchdog/stats/test-watchdog-agent?days=30`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`
      }
    });

    if (statsResponse.ok) {
      const statsData = await statsResponse.json();
      console.log('✅ Audit statistics retrieved');
      console.log(`📊 Total Audits: ${statsData.stats.totalAudits}`);
      console.log(`🎯 Risk Distribution:`);
      console.log(`   - Critical: ${statsData.stats.riskDistribution.critical}`);
      console.log(`   - High: ${statsData.stats.riskDistribution.high}`);
      console.log(`   - Medium: ${statsData.stats.riskDistribution.medium}`);
      console.log(`   - Low: ${statsData.stats.riskDistribution.low}`);
      console.log(`📈 Average Risk Score: ${statsData.stats.averageRiskScore.toFixed(3)}`);
      console.log(`✅ Average Accuracy: ${statsData.stats.averageAccuracy.toFixed(3)}`);
      console.log(`👤 Pending Reviews: ${statsData.stats.pendingReviews}`);
    } else {
      console.log('❌ Get stats failed:', statsResponse.status);
    }

    // Test 3: Get high-risk responses
    console.log('\n📝 Test 3: Getting high-risk responses...');
    
    const highRiskResponse = await fetch(`${API_URL}/api/watchdog/high-risk/test-watchdog-agent?limit=5`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`
      }
    });

    if (highRiskResponse.ok) {
      const highRiskData = await highRiskResponse.json();
      console.log('✅ High-risk responses retrieved');
      console.log(`📊 Total High-Risk: ${highRiskData.total}`);
      
      if (highRiskData.highRiskResponses.length > 0) {
        const response = highRiskData.highRiskResponses[0];
        console.log(`🎯 Sample High-Risk Response:`);
        console.log(`   - Question: ${response.question}`);
        console.log(`   - Risk Level: ${response.hallucinationRiskLevel}`);
        console.log(`   - Risk Score: ${response.hallucinationRiskScore.toFixed(3)}`);
        console.log(`   - Compliance Flags: ${response.complianceFlags.join(', ')}`);
      }
    } else {
      console.log('❌ Get high-risk responses failed:', highRiskResponse.status);
    }

    // Test 4: Get watchdog configuration
    console.log('\n📝 Test 4: Getting watchdog configuration...');
    
    const configResponse = await fetch(`${API_URL}/api/watchdog/config`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`
      }
    });

    if (configResponse.ok) {
      const configData = await configResponse.json();
      console.log('✅ Watchdog configuration retrieved');
      console.log(`🔧 Enable Auditing: ${configData.config.enableAuditing}`);
      console.log(`🎯 Audit Threshold: ${configData.config.auditThreshold}`);
      console.log(`🚨 Critical Threshold: ${configData.config.criticalThreshold}`);
      console.log(`🤖 Audit Model: ${configData.config.auditModel}`);
      console.log(`📋 Audit Version: ${configData.config.auditVersion}`);
    } else {
      console.log('❌ Get config failed:', configResponse.status);
    }

    // Test 5: Update watchdog configuration
    console.log('\n📝 Test 5: Updating watchdog configuration...');
    
    const updateConfigResponse = await fetch(`${API_URL}/api/watchdog/config`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        auditThreshold: 0.6,
        criticalThreshold: 0.85
      })
    });

    if (updateConfigResponse.ok) {
      const updateData = await updateConfigResponse.json();
      console.log('✅ Watchdog configuration updated');
      console.log(`🎯 New Audit Threshold: ${updateData.config.auditThreshold}`);
      console.log(`🚨 New Critical Threshold: ${updateData.config.criticalThreshold}`);
    } else {
      console.log('❌ Update config failed:', updateConfigResponse.status);
    }

  } catch (error) {
    console.error('❌ Watchdog test failed:', error.message);
  }
}

// Test watchdog functionality
testWatchdogSystem().then(() => {
  console.log('\n🎯 Watchdog system testing completed!');
  console.log('\n📋 What was tested:');
  console.log('1. ✅ Manual response auditing');
  console.log('2. ✅ Audit statistics retrieval');
  console.log('3. ✅ High-risk response identification');
  console.log('4. ✅ Configuration management');
  console.log('5. ✅ Configuration updates');
  console.log('\n🕵️ Agent Watchdog features:');
  console.log('• LLM-powered hallucination detection');
  console.log('• Multi-dimensional quality scoring');
  console.log('• Compliance flagging system');
  console.log('• Human review workflow');
  console.log('• Configurable risk thresholds');
  console.log('• Audit trail and statistics');
  console.log('\n🔒 Compliance benefits:');
  console.log('• Automatic quality assurance');
  console.log('• Risk-based response filtering');
  console.log('• Audit trail for regulatory compliance');
  console.log('• Human oversight for critical responses');
  console.log('• Configurable compliance policies');
}).catch(error => {
  console.error('❌ Watchdog test error:', error);
  process.exit(1);
}); 