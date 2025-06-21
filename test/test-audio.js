import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import fetch from 'node-fetch';
import path from 'path';

const BASE_URL = 'http://localhost:3000';
const AGENT_ID = 'test-agent-audio';
const FILE_PATH = path.join('test', 'sample', 'sample.mp3');
const QUESTION = 'Who is calling my phone?';
const TOKEN = '123456';

// Debug: Check if file exists and print info
if (!fs.existsSync(FILE_PATH)) {
  console.error('❌ Audio file does not exist:', FILE_PATH);
  process.exit(1);
} else {
  const stats = fs.statSync(FILE_PATH);
  if (!stats.isFile()) {
    console.error('❌ Path is not a file:', FILE_PATH);
    process.exit(1);
  }
  if (stats.size === 0) {
    console.error('❌ Audio file is empty:', FILE_PATH);
    process.exit(1);
  }
  console.log(`✅ Audio file found: ${FILE_PATH} (${stats.size} bytes)`);
}

async function pollTrainJob(jobId) {
  let status, result, error;
  let attempts = 0;
  do {
    await new Promise(r => setTimeout(r, 1000));
    const statusRes = await fetch(`${BASE_URL}/api/train/status/${jobId}`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    const statusJson = await statusRes.json();
    status = statusJson.status;
    result = statusJson.result;
    error = statusJson.error;
    attempts++;
    if (status === 'processing') {
      process.stdout.write(`   ...training progress: ${statusJson.progress}% (${statusJson.chunksProcessed || 0}/${statusJson.totalChunks || 0})\r`);
    }
    if (attempts > 120) break;
  } while (status !== 'completed' && status !== 'failed');
  if (status === 'completed') {
    console.log(`\n✅ Training job completed!`);
    return { result };
  } else {
    console.log(`\n❌ Training job failed:`, error?.error);
    return { error };
  }
}

async function trainAndAsk() {
  console.log(`\n🧪 Testing Audio training...`);
  let jobId;
  try {
    const form = new FormData();
    form.append('agentId', AGENT_ID);
    form.append('source', 'audio');
    form.append('fileType', 'mp3');
    form.append('files', fs.createReadStream(FILE_PATH));
    console.log('Uploading audio file...');
    const response = await axios.post(`${BASE_URL}/api/train`, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${TOKEN}`,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    const trainRes = response.data;
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
    console.log(`   Chunks stored: ${result.chunksStored}`);
    // Ask a question
    await askQuestion(AGENT_ID, QUESTION);
    return true;
  } catch (error) {
    if (error.response) {
      console.log('❌ Error during training/asking:', error.response.data);
    } else {
      console.log('❌ Error during training/asking:', error.message);
    }
    return false;
  }
}

async function askQuestion(agentId, question) {
  console.log(`\n🤔 Asking: "${question}"`);
  try {
    const response = await fetch(`${BASE_URL}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ agentId, question }),
    });
    const result = await response.json();
    if (response.ok) {
      console.log('✅ Question answered successfully!');
      console.log(`   Reply: ${result.reply}`);
      if (result.sources && result.sources.length > 0) {
        console.log(`   📚 Sources (${result.sources.length}):`);
        result.sources.forEach((source, index) => {
          console.log(`      ${index + 1}. ${source.source}${source.sourceUrl ? ` - ${source.sourceUrl}` : ''}`);
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

trainAndAsk().catch(console.error); 