import FormData from 'form-data';
import fs from 'fs';
import fetch from 'node-fetch';
import path from 'path';
import process from 'process';

const BASE_URL = 'http://localhost:3000';
const TEST_AGENT_ID = 'okafor-user-1';
const SAMPLE_DOC_PATH = path.join('src', 'utils', 'sample.txt');
const API_TOKEN = '123456'; // From .env AGENT_API_TOKEN

// Common headers for API requests
const API_HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${API_TOKEN}`
};

const testCases = [
  {
    label: 'Document',
    agentId: 'test-agent-doc',
    source: 'document',
    filePath: SAMPLE_DOC_PATH,
    fileType: 'txt',
    question: 'How much does the BrightPack cost?',
  }
];

async function pollTrainJob(jobId) {
  let status, result, error;
  let attempts = 0;
  do {
    await new Promise(r => setTimeout(r, 1000));
    const statusRes = await fetch(`${BASE_URL}/api/train/status/${jobId}`, {
      headers: API_HEADERS
    });
    const statusJson = await statusRes.json();
    status = statusJson.status;
    result = statusJson.result;
    error = statusJson.error;
    attempts++;
    if (status === 'processing') {
      process.stdout.write(`   ...training progress: ${statusJson.progress}% (${statusJson.chunksProcessed || 0}/${statusJson.totalChunks || 0})\r`);
    }
    if (attempts > 120) break; // 2 minutes max
  } while (status !== 'completed' && status !== 'failed');
  if (status === 'completed') {
    console.log(`\n✅ Training job completed!`);
    // Check if it was a duplicate case
    if (result && result.message && result.message.includes('already trained')) {
      console.log(`   ℹ️  ${result.message}`);
      console.log(`   📊 Total chunks: ${result.totalChunks}, Skipped: ${result.skippedCount}`);
    } else {
      console.log(`   📊 Chunks stored: ${result?.chunksStored || 0}`);
    }
    return { result };
  } else {
    console.log(`\n❌ Training job failed:`, error?.error);
    return { error };
  }
}

async function trainAndAsk(testCase) {
  console.log(`\n🧪 Testing ${testCase.label} training...`);
  let jobId;
  try {
    let response, trainRes;
    if (testCase.filePath) {
      // File upload (document, audio, video)
      const form = new FormData();
      form.append('agentId', testCase.agentId);
      form.append('source', testCase.source);
      form.append('fileType', testCase.fileType);
      form.append('files', fs.createReadStream(testCase.filePath));
      
      // Add Authorization header to form headers
      const formHeaders = form.getHeaders();
      formHeaders['Authorization'] = `Bearer ${API_TOKEN}`;
      
      response = await fetch(`${BASE_URL}/api/train`, {
        method: 'POST',
        body: form,
        headers: formHeaders,
      });
      trainRes = await response.json();
    } else if (testCase.source === 'website' || testCase.source === 'youtube') {
      // Website or YouTube
      response = await fetch(`${BASE_URL}/api/train`, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify({
          agentId: testCase.agentId,
          source: testCase.source,
          sourceUrl: testCase.sourceUrl,
        }),
      });
      trainRes = await response.json();
    }
    if (!trainRes.jobId) {
      console.log('❌ Training failed to start:', trainRes.error);
      return false;
    }
    jobId = trainRes.jobId;
    // Poll for job completion
    const { result, error } = await pollTrainJob(jobId);
    if (!result) {
      console.log('❌ Training failed:', error?.error);
      return false;
    }
    // Ask a question
    await askQuestion(testCase.agentId, testCase.question);
    return true;
  } catch (error) {
    console.log('❌ Error during training/asking:', error.message);
    return false;
  }
}

async function askQuestion(agentId, question) {
  console.log(`\n🤔 Asking: "${question}"`);
  try {
    const response = await fetch(`${BASE_URL}/api/ask`, {
      method: 'POST',
      headers: API_HEADERS,
      body: JSON.stringify({ agentId, question }),
    });
    const result = await response.json();
    console.log('📝 Response:', result);
    if (response.ok) {
      console.log('✅ Question answered successfully!');
      console.log(`   Reply: ${result.reply}`);
      if (result.meta.sources && result.meta.sources.length > 0) {
        console.log(`   📚 Sources (${result.meta.sources.length}):`);
        result.meta.sources.forEach((source, index) => {
          console.log(`      ${index + 1}. ${source.source}${source.source_url ? ` - ${source.source_url}` : ''}`);
        });
      } else {
        console.log('   📚 Sources: None specified');
      }
    } else {
      console.log('❌ Question failed:', result.error);
    }
  } catch (error) {
    console.log('❌ Error asking question:', error.message);
  }
}

async function runAllTests() {
  console.log('🚀 Starting Full End-to-End AI Agent API Test...\n');
  for (const testCase of testCases) {
    await trainAndAsk(testCase);
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Test similarity scoring and thresholding
  await testSimilarityScoring();
  
  console.log('\n🎉 All tests completed!');
}

// Test cosine similarity and thresholding
async function testSimilarityScoring() {
  console.log('\n🧪 Testing Similarity Scoring & Thresholding...');
  
  try {
    // Test with a question that should have high similarity
    const response = await fetch(`${BASE_URL}/api/ask`, {
      method: 'POST',
      headers: API_HEADERS,
      body: JSON.stringify({
        agentId: 'test-agent-doc',
        question: 'How much does the BrightPack cost?'
      })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Similarity scoring test successful');
      console.log(`📊 Chunks searched: ${result.meta.chunks_searched}`);
      console.log(`📊 Chunks filtered out: ${result.meta.chunks_filtered}`);
      console.log(`📊 Chunks used: ${result.meta.chunks_used}`);
      console.log(`📊 Average similarity: ${result.meta.average_similarity}`);
      console.log(`📊 Average confidence: ${result.confidence}`);
      console.log(`📊 Similarity threshold: ${result.meta.retrieval_config.similarity_threshold}`);
      
      if (result.meta.sources && result.meta.sources.length > 0) {
        console.log('📚 Sources with similarity scores:');
        result.meta.sources.forEach((source, index) => {
          console.log(`  ${index + 1}. ${source.source} - Similarity: ${source.similarity?.toFixed(3)}, Confidence: ${source.confidence?.toFixed(3)}`);
        });
      }
    } else {
      console.log('❌ Similarity scoring test failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Similarity scoring test error:', error);
  }
}

runAllTests().catch(console.error);