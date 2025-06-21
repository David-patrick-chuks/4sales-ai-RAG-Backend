import FormData from 'form-data';
import fs from 'fs';
import fetch from 'node-fetch';
import path from 'path';

const BASE_URL = 'http://localhost:3000';
const AGENT_ID = 'test-agent-video';
const FILE_PATH = path.join('test', 'sample', 'sample.mp4');
const QUESTION = 'What is the main topic of the video?';
const TOKEN = '123456';

console.log('DEBUG: BASE_URL:', BASE_URL);
console.log('DEBUG: AGENT_ID:', AGENT_ID);
console.log('DEBUG: FILE_PATH:', FILE_PATH);
console.log('DEBUG: TOKEN:', TOKEN);

async function pollTrainJob(jobId) {
  let status, result, error;
  let attempts = 0;
  do {
    await new Promise(r => setTimeout(r, 1000));
    const statusRes = await fetch(`${BASE_URL}/api/train/status/${jobId}`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    const statusJson = await statusRes.json();
    console.log('DEBUG: Train job status response:', statusJson);
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
  console.log(`\n🧪 Testing Video training...`);
  let jobId;
  try {
    const form = new FormData();
    form.append('agentId', AGENT_ID);
    form.append('source', 'video');
    form.append('fileType', 'mp4');
    form.append('files', fs.createReadStream(FILE_PATH), { contentType: 'video/mp4', filename: path.basename(FILE_PATH) });
    console.log('DEBUG: Appended file:', FILE_PATH, 'Exists:', fs.existsSync(FILE_PATH));
    console.log('DEBUG: Form fields:', form.getHeaders());
    const response = await fetch(`${BASE_URL}/api/train`, {
      method: 'POST',
      body: form,
      headers: { ...form.getHeaders(), Authorization: `Bearer ${TOKEN}` },
    });
    const trainRes = await response.json();
    console.log('DEBUG: /api/train response:', trainRes);
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
    console.log('❌ Error during training/asking:', error);
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
    console.log('DEBUG: /api/ask response:', result);
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