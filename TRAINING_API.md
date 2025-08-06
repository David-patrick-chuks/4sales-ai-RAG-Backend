# 🤖 AI Agent Training API

This API allows you to train AI agents with various types of content including documents, audio, video, websites, and YouTube videos.

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Training Methods](#training-methods)
- [File Upload Guidelines](#file-upload-guidelines)
- [API Endpoints](#api-endpoints)
- [Response Formats](#response-formats)
- [Error Handling](#error-handling)
- [Examples](#examples)
- [Best Practices](#best-practices)

## 🚀 Quick Start

### 1. Train with Text
```javascript
const formData = new FormData();
formData.append('agentId', 'my-agent-123');
formData.append('source', 'document');
formData.append('text', 'Your training content here...');

const response = await fetch('/api/train', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log('Job ID:', result.jobId);
```

### 2. Check Training Status
```javascript
const status = await fetch(`/api/train/status/${result.jobId}`);
const statusData = await status.json();
console.log('Progress:', statusData.progress + '%');
```

## 📚 Training Methods

### 1. Text Training (`source: 'document'`)
Train your agent with plain text content.

**Request:**
```javascript
const formData = new FormData();
formData.append('agentId', 'agent-123');
formData.append('source', 'document');
formData.append('text', 'Your training content...');
```

**Use Cases:**
- FAQ content
- Product descriptions
- Company policies
- Manuals and guides

### 2. File Upload Training (`source: 'document'`)
Upload documents for training.

**Supported Formats:**
- 📄 **PDF** (`.pdf`)
- 📝 **Word** (`.docx`, `.doc`)
- 📄 **Text** (`.txt`)
- 📊 **CSV** (`.csv`)
- 📝 **Markdown** (`.md`)

**Request:**
```javascript
const formData = new FormData();
formData.append('agentId', 'agent-123');
formData.append('source', 'document');
formData.append('fileType', 'pdf');

// Add files
formData.append('files', file1, 'document1.pdf');
formData.append('files', file2, 'document2.docx');
```

### 3. Audio Training (`source: 'audio'`)
Train your agent with audio files.

**Supported Formats:**
- 🎵 **MP3** (`.mp3`)
- 🎵 **WAV** (`.wav`)
- 🎵 **M4A** (`.m4a`)
- 🎵 **AAC** (`.aac`)
- 🎵 **OGG** (`.ogg`)
- 🎵 **FLAC** (`.flac`)

**Request:**
```javascript
const formData = new FormData();
formData.append('agentId', 'agent-123');
formData.append('source', 'audio');
formData.append('fileType', 'mp3');
formData.append('files', audioFile, 'recording.mp3');
```

### 4. Video Training (`source: 'video'`)
Train your agent with video files.

**Supported Formats:**
- 🎬 **MP4** (`.mp4`)
- 🎬 **WebM** (`.webm`)
- 🎬 **MOV** (`.mov`)
- 🎬 **AVI** (`.avi`)
- 🎬 **MKV** (`.mkv`)

**Request:**
```javascript
const formData = new FormData();
formData.append('agentId', 'agent-123');
formData.append('source', 'video');
formData.append('fileType', 'mp4');
formData.append('files', videoFile, 'presentation.mp4');
```

### 5. Website Training (`source: 'website'`)
Train your agent by scraping website content.

**Request:**
```javascript
const formData = new FormData();
formData.append('agentId', 'agent-123');
formData.append('source', 'website');
formData.append('sourceUrl', 'https://example.com');
```

### 6. YouTube Training (`source: 'youtube'`)
Train your agent with YouTube video content.

**Request:**
```javascript
const formData = new FormData();
formData.append('agentId', 'agent-123');
formData.append('source', 'youtube');
formData.append('sourceUrl', 'https://youtube.com/watch?v=VIDEO_ID');
```

## 📁 File Upload Guidelines

### File Size Limits
- **Individual File**: 50MB maximum
- **Total Request**: 50MB maximum
- **Text Content**: 10MB maximum
- **Multiple Files**: Up to 10 files per request

### Required Fields by Source Type

| Source | Required Fields | Optional Fields |
|--------|----------------|-----------------|
| `document` | `agentId` + (`text` OR `files`) | `fileType`, `sourceMetadata` |
| `audio` | `agentId`, `files`, `fileType` | `sourceMetadata` |
| `video` | `agentId`, `files`, `fileType` | `sourceMetadata` |
| `website` | `agentId`, `sourceUrl` | `sourceMetadata` |
| `youtube` | `agentId`, `sourceUrl` | `sourceMetadata` |

### File Type Mapping
When uploading files, specify the correct `fileType`:

```javascript
// For PDF files
formData.append('fileType', 'pdf');

// For multiple file types
formData.append('fileType', 'pdf,docx,txt');

// For audio/video
formData.append('fileType', 'mp3'); // or 'mp4', 'wav', etc.
```

## 🔌 API Endpoints

### POST `/api/train`
Start a training job.

**Response:**
```json
{
  "jobId": "train-job-abc123",
  "status": "queued",
  "message": "Training started. Poll /api/train/status/:jobId for progress."
}
```

### GET `/api/train/status/:jobId`
Check training job status.

**Response:**
```json
{
  "jobId": "train-job-abc123",
  "status": "processing",
  "progress": 45,
  "chunksProcessed": 23,
  "totalChunks": 50,
  "successCount": 22,
  "errorCount": 1,
  "skippedCount": 0,
  "fileNames": ["document.pdf"],
  "usedFiles": true,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

## 📊 Response Formats

### Job Status Values
- `queued` - Job is waiting to start
- `processing` - Job is currently running
- `completed` - Job finished successfully
- `failed` - Job failed with error

### Progress Tracking
- `progress`: 0-100 percentage
- `chunksProcessed`: Number of chunks processed
- `totalChunks`: Total chunks to process
- `successCount`: Successfully processed chunks
- `errorCount`: Failed chunks
- `skippedCount`: Duplicate chunks skipped

## ⚠️ Error Handling

### Common Error Codes
- `400` - Invalid request parameters
- `413` - Request too large
- `500` - Internal server error

### Error Response Format
```json
{
  "error": "Error message",
  "field": "field_name",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 💡 Examples

### Complete Training Workflow
```javascript
async function trainAgent(agentId, content) {
  try {
    // 1. Start training
    const formData = new FormData();
    formData.append('agentId', agentId);
    formData.append('source', 'document');
    formData.append('text', content);
    
    const response = await fetch('/api/train', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    console.log('Training started:', result.jobId);
    
    // 2. Poll for completion
    while (true) {
      const statusResponse = await fetch(`/api/train/status/${result.jobId}`);
      const status = await statusResponse.json();
      
      console.log(`Progress: ${status.progress}%`);
      
      if (status.status === 'completed') {
        console.log('Training completed!');
        break;
      } else if (status.status === 'failed') {
        throw new Error(`Training failed: ${status.error}`);
      }
      
      // Wait 3 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  } catch (error) {
    console.error('Training error:', error);
  }
}
```

### File Upload Example
```javascript
async function uploadFiles(agentId, files) {
  const formData = new FormData();
  formData.append('agentId', agentId);
  formData.append('source', 'document');
  formData.append('fileType', 'pdf');
  
  // Add multiple files
  files.forEach(file => {
    formData.append('files', file);
  });
  
  const response = await fetch('/api/train', {
    method: 'POST',
    body: formData
  });
  
  return await response.json();
}
```

### YouTube Training Example
```javascript
async function trainWithYouTube(agentId, videoUrl) {
  const formData = new FormData();
  formData.append('agentId', agentId);
  formData.append('source', 'youtube');
  formData.append('sourceUrl', videoUrl);
  
  const response = await fetch('/api/train', {
    method: 'POST',
    body: formData
  });
  
  return await response.json();
}
```

## 🎯 Best Practices

### 1. Content Quality
- ✅ Use clear, well-structured content
- ✅ Include relevant examples and scenarios
- ✅ Break large documents into logical sections
- ✅ Use consistent terminology

### 2. File Management
- ✅ Keep files under 50MB
- ✅ Use supported file formats
- ✅ Provide descriptive filenames
- ✅ Include proper file extensions

### 3. Training Strategy
- ✅ Train with diverse content types
- ✅ Include both Q&A and narrative content
- ✅ Update training data regularly
- ✅ Monitor training job status

### 4. Error Handling
- ✅ Always check job status
- ✅ Handle network timeouts
- ✅ Implement retry logic
- ✅ Log errors for debugging

### 5. Performance
- ✅ Use appropriate chunk sizes
- ✅ Monitor memory usage
- ✅ Implement progress indicators
- ✅ Handle large file uploads

## 🔧 Troubleshooting

### Common Issues

**"Unexpected field" Error**
- ❌ Don't send both `files` and `files[]`
- ✅ Only use `files` field name

**413 Request Too Large**
- ❌ File size exceeds 50MB limit
- ✅ Compress or split large files

**Training Timeout**
- ❌ Very large content takes too long
- ✅ Break content into smaller chunks

**No Results Found**
- ❌ Training data doesn't match questions
- ✅ Ensure training content is relevant

### Debug Tips
1. Check job status regularly
2. Monitor progress percentage
3. Review error messages
4. Verify file formats
5. Test with smaller content first

## 📞 Support

For issues or questions:
- Check the error messages in job status
- Verify file formats and sizes
- Ensure all required fields are provided
- Test with simple content first

---

**Happy Training! 🚀** 