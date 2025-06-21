# Test Files for AI Agent API

This folder contains sample files for testing each training source type supported by the API.

## Files
- `sample.txt` — Plain text document for document training
- `sample.mp3` — Audio file for audio training (must be a real mp3 or wav)
- `sample.mp4` — Video file for video training (must be a real mp4)
- `website.txt` — (Optional) Example scraped website content for reference
- `youtube.txt` — (Optional) Example YouTube transcript for reference

## Usage
- Use these files with the `/api/train` endpoint to test document, audio, and video training.
- For website and YouTube, use real URLs in your test script or API calls.

## Example
```bash
# Document
curl -F agentId=test-agent-doc -F source=document -F fileType=txt -F files=@test/sample.txt http://localhost:3000/api/train

# Audio
curl -F agentId=test-agent-audio -F source=audio -F fileType=mp3 -F files=@test/sample.mp3 http://localhost:3000/api/train

# Video
curl -F agentId=test-agent-video -F source=video -F fileType=mp4 -F files=@test/sample.mp4 http://localhost:3000/api/train
```

---
Place your own test files here as needed for development and CI. 