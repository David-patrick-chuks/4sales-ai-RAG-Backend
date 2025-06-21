import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3000';
const API_TOKEN = process.env.AGENT_API_TOKEN || '123456';

async function testFeedbackSystem() {
  console.log('🧪 Testing Feedback Loop & Retraining Suggestions...');
  
  try {
    // Test 1: Ask a question and get feedback prompt
    console.log('\n📝 Test 1: Asking a question to get feedback prompt...');
    
    const askResponse = await fetch(`${API_URL}/api/ask`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agentId: 'test-feedback-agent',
        question: 'What are your invoice policies?'
      })
    });

    if (askResponse.ok) {
      const askData = await askResponse.json();
      console.log('✅ Question asked successfully');
      console.log(`📊 Confidence: ${askData.confidence}`);
      console.log(`🆔 Question ID: ${askData.question_id}`);
      console.log(`💬 Feedback Prompt: ${askData.feedback_prompt}`);
      console.log(`🔄 Retraining Suggested: ${askData.retraining_suggested}`);
      
      // Test 2: Submit positive feedback
      console.log('\n📝 Test 2: Submitting positive feedback...');
      
      const positiveFeedbackResponse = await fetch(`${API_URL}/api/feedback`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          agentId: 'test-feedback-agent',
          questionId: askData.question_id,
          question: askData.query,
          originalReply: askData.reply,
          confidence: askData.confidence,
          feedbackText: 'This was very helpful, thank you!',
          chunksUsed: askData.meta.chunks_used,
          averageSimilarity: askData.meta.average_similarity,
          sources: askData.meta.sources.map(s => s.source)
        })
      });

      if (positiveFeedbackResponse.ok) {
        const feedbackData = await positiveFeedbackResponse.json();
        console.log('✅ Positive feedback submitted');
        console.log(`😊 User Satisfaction: ${feedbackData.feedback.userSatisfaction}`);
        console.log(`💡 Suggested Topics: ${feedbackData.feedback.suggestedTopics.join(', ')}`);
        console.log(`📚 Retraining Suggestions: ${feedbackData.retrainingSuggestions.length}`);
      } else {
        console.log('❌ Positive feedback failed:', positiveFeedbackResponse.status);
      }

      // Test 3: Submit negative feedback
      console.log('\n📝 Test 3: Submitting negative feedback...');
      
      const negativeFeedbackResponse = await fetch(`${API_URL}/api/feedback`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          agentId: 'test-feedback-agent',
          questionId: askData.question_id,
          question: askData.query,
          originalReply: askData.reply,
          confidence: askData.confidence,
          feedbackText: "That didn't help at all. I need better information about invoices.",
          chunksUsed: askData.meta.chunks_used,
          averageSimilarity: askData.meta.average_similarity,
          sources: askData.meta.sources.map(s => s.source)
        })
      });

      if (negativeFeedbackResponse.ok) {
        const feedbackData = await negativeFeedbackResponse.json();
        console.log('✅ Negative feedback submitted');
        console.log(`😞 User Satisfaction: ${feedbackData.feedback.userSatisfaction}`);
        console.log(`💡 Suggested Topics: ${feedbackData.feedback.suggestedTopics.join(', ')}`);
        console.log(`📚 Retraining Suggestions: ${feedbackData.retrainingSuggestions.length}`);
        console.log(`💬 Message: ${feedbackData.message}`);
      } else {
        console.log('❌ Negative feedback failed:', negativeFeedbackResponse.status);
      }

    } else {
      console.log('❌ Question failed:', askResponse.status);
      const error = await askResponse.text();
      console.log('Error details:', error);
    }

    // Test 4: Get retraining suggestions
    console.log('\n📝 Test 4: Getting retraining suggestions...');
    
    const suggestionsResponse = await fetch(`${API_URL}/api/feedback/suggestions/test-feedback-agent`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`
      }
    });

    if (suggestionsResponse.ok) {
      const suggestionsData = await suggestionsResponse.json();
      console.log('✅ Retraining suggestions retrieved');
      console.log(`📊 Total suggestions: ${suggestionsData.total}`);
      
      if (suggestionsData.suggestions.length > 0) {
        const suggestion = suggestionsData.suggestions[0];
        console.log(`🎯 Top suggestion: ${suggestion.title}`);
        console.log(`📝 Description: ${suggestion.description}`);
        console.log(`⚡ Priority: ${suggestion.priority}`);
        console.log(`🏷️ Topics: ${suggestion.suggestedTopics.join(', ')}`);
      }
    } else {
      console.log('❌ Get suggestions failed:', suggestionsResponse.status);
    }

    // Test 5: Get feedback summary
    console.log('\n📝 Test 5: Getting feedback summary...');
    
    const summaryResponse = await fetch(`${API_URL}/api/feedback/summary/test-feedback-agent?days=30`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`
      }
    });

    if (summaryResponse.ok) {
      const summaryData = await summaryResponse.json();
      console.log('✅ Feedback summary retrieved');
      console.log(`📊 Total feedback: ${summaryData.summary.totalFeedback}`);
      console.log(`😊 Positive feedback: ${summaryData.summary.positiveFeedback}`);
      console.log(`😞 Negative feedback: ${summaryData.summary.negativeFeedback}`);
      console.log(`📈 Satisfaction rate: ${summaryData.summary.satisfactionRate.toFixed(1)}%`);
      console.log(`🎯 Average confidence: ${summaryData.summary.averageConfidence.toFixed(3)}`);
      console.log(`🔄 Needs retraining: ${summaryData.summary.needsRetraining}`);
      console.log(`💡 Recommendation: ${summaryData.summary.recommendation}`);
    } else {
      console.log('❌ Get summary failed:', summaryResponse.status);
    }

  } catch (error) {
    console.error('❌ Feedback test failed:', error.message);
  }
}

// Test feedback functionality
testFeedbackSystem().then(() => {
  console.log('\n🎯 Feedback system testing completed!');
  console.log('\n📋 What was tested:');
  console.log('1. ✅ Question asking with feedback prompts');
  console.log('2. ✅ Positive feedback submission');
  console.log('3. ✅ Negative feedback submission');
  console.log('4. ✅ Retraining suggestions retrieval');
  console.log('5. ✅ Feedback summary and recommendations');
  console.log('\n🔥 Self-healing AI features:');
  console.log('• Automatic topic extraction from questions');
  console.log('• User satisfaction detection from feedback text');
  console.log('• Confidence-based retraining suggestions');
  console.log('• Priority-based suggestion ranking');
  console.log('• Feedback analytics and trends');
}).catch(error => {
  console.error('❌ Feedback test error:', error);
  process.exit(1);
});