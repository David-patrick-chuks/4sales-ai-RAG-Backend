# Security Documentation

## Overview

This document outlines the comprehensive security measures implemented in the AI Agent API to protect against common web application vulnerabilities and ensure secure operation.

## Security Features

### 1. Input Sanitization

#### Agent ID Sanitization
- **Maximum length**: 100 characters
- **Allowed characters**: Alphanumeric, hyphens, underscores, dots
- **Blocked characters**: HTML/XML special characters (`<`, `>`, `"`, `'`, `&`)
- **Validation**: Required field, must be a string

#### Question Text Sanitization
- **Maximum length**: 1,000 characters
- **Removed content**: 
  - `<script>` tags and content
  - `<iframe>` tags and content
  - `javascript:` protocol
  - `data:` protocol
  - `vbscript:` protocol
  - Event handlers (`onclick`, `onload`, etc.)

#### URL Sanitization
- **Maximum length**: 500 characters
- **Allowed protocols**: `http:`, `https:`
- **Blocked domains**: `localhost`, `127.0.0.1`, `0.0.0.0`, `::1`
- **Blocked IP ranges**: Private/local IP addresses
- **Removed parameters**: `javascript`, `data`, `vbscript`, `file`

#### Text Content Sanitization
- **Maximum length**: 1,000,000 characters (1MB)
- **Removed content**: All HTML tags, script content, dangerous protocols
- **Validation**: Required field, must be a string

### 2. File Upload Security

#### File Size Limits
- **Maximum file size**: 20MB per file
- **Maximum files per request**: 10 files
- **Total request size limit**: 1MB

#### Allowed File Extensions (Whitelist)
**Documents**: `.pdf`, `.docx`, `.doc`, `.txt`, `.csv`, `.md`
**Audio**: `.mp3`, `.wav`, `.m4a`, `.aac`, `.ogg`, `.flac`
**Video**: `.mp4`, `.webm`, `.mov`, `.avi`, `.mkv`

#### Blocked File Extensions (Blacklist)
- **Executables**: `.exe`, `.bat`, `.cmd`, `.com`, `.pif`, `.scr`
- **Scripts**: `.vbs`, `.js`, `.jar`, `.php`, `.asp`, `.aspx`, `.jsp`, `.py`, `.pl`, `.sh`
- **System files**: `.dll`, `.so`, `.dylib`, `.bin`, `.msi`, `.app`, `.deb`, `.rpm`

#### MIME Type Validation
- Validates file MIME types against allowed list
- Prevents MIME type spoofing attacks
- Rejects files with unexpected MIME types

### 3. Authentication & Authorization

#### API Token Authentication
- **Required**: Bearer token for all `/api/*` endpoints
- **Header**: `Authorization: Bearer <token>`
- **Environment variable**: `AGENT_API_TOKEN`
- **Validation**: Exact token match required

#### CORS Configuration
- **Allowed origins**: Configurable via `ALLOWED_ORIGINS` environment variable
- **Default origins**: `localhost:3000`, `localhost:3001`, `localhost:5173`
- **Methods**: GET, POST, PUT, DELETE, OPTIONS
- **Headers**: Content-Type, Authorization, X-Requested-With
- **Credentials**: Enabled

### 4. Rate Limiting

#### General Rate Limiting
- **Window**: 15 minutes
- **Limit**: 100 requests per IP
- **Headers**: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset

#### Endpoint-Specific Limits
- **Training endpoint**: 10 requests per 15 minutes (resource intensive)
- **Ask endpoint**: 50 requests per 15 minutes (moderate usage)
- **Health/Status**: No limits (monitoring endpoints)

### 5. Security Headers

#### Helmet.js Configuration
- **Content Security Policy**: Strict CSP with allowed sources
- **HSTS**: HTTP Strict Transport Security enabled
- **XSS Protection**: XSS filter enabled
- **Frame Options**: Frame guard set to deny
- **Content Type Sniffing**: Disabled
- **Referrer Policy**: Strict origin when cross-origin

#### Additional Headers
- **X-Content-Type-Options**: nosniff
- **X-Frame-Options**: DENY
- **X-XSS-Protection**: 1; mode=block

### 6. Request Validation

#### Request Size Limits
- **JSON body**: 1MB limit
- **URL-encoded**: 1MB limit
- **Parameters**: Maximum 100 parameters
- **Content-Length**: Validated before processing

#### Request Logging
- **IP address logging**: All requests logged with IP
- **User agent logging**: Browser/client identification
- **Size monitoring**: Large requests flagged
- **Suspicious activity**: cURL requests logged

### 7. Error Handling

#### Production vs Development
- **Production**: Generic error messages (no sensitive data)
- **Development**: Detailed error messages for debugging
- **Environment detection**: Automatic based on `NODE_ENV`

#### Error Response Format
```json
{
  "error": "Error message",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/endpoint",
  "method": "POST"
}
```

## Security Testing

### Running Security Tests
```bash
node test-security.js
```

### Test Coverage
1. **Script Injection Prevention**: Tests XSS protection
2. **File Upload Security**: Tests blocked file types
3. **URL Sanitization**: Tests malicious URL blocking
4. **Rate Limiting**: Tests request rate enforcement
5. **Request Size Limits**: Tests large request rejection
6. **Agent ID Sanitization**: Tests input validation
7. **Authentication**: Tests token requirement

## Configuration

### Environment Variables
```bash
# Security Configuration
AGENT_API_TOKEN=your-secure-token-here
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
NODE_ENV=production

# Database Security
MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/db?retryWrites=true&w=majority

# API Configuration
PORT=3000
```

### Security Configuration Object
```typescript
const SECURITY_CONFIG = {
  MAX_FILE_SIZE: 20 * 1024 * 1024, // 20MB
  MAX_FILES_PER_REQUEST: 10,
  MAX_TEXT_LENGTH: 1000000, // 1MB
  MAX_AGENT_ID_LENGTH: 100,
  MAX_QUESTION_LENGTH: 1000,
  MAX_SOURCE_URL_LENGTH: 500,
  MAX_METADATA_SIZE: 10000, // 10KB
  // ... more configuration
};
```

## Best Practices

### For Developers
1. **Never log sensitive data**: Tokens, passwords, personal information
2. **Validate all inputs**: Use the provided sanitization functions
3. **Handle errors gracefully**: Don't expose internal errors to clients
4. **Use HTTPS in production**: Always use TLS/SSL
5. **Keep dependencies updated**: Regularly update npm packages

### For Deployment
1. **Use strong API tokens**: Generate cryptographically secure tokens
2. **Configure CORS properly**: Only allow necessary origins
3. **Set up monitoring**: Monitor for suspicious activity
4. **Use environment variables**: Never hardcode secrets
5. **Enable logging**: Monitor security events

### For API Consumers
1. **Store tokens securely**: Don't expose tokens in client-side code
2. **Validate responses**: Always check response status codes
3. **Handle rate limits**: Implement exponential backoff
4. **Sanitize inputs**: Clean data before sending to API
5. **Use HTTPS**: Always use secure connections

## Incident Response

### Security Breach Response
1. **Immediate actions**:
   - Revoke compromised tokens
   - Block suspicious IP addresses
   - Review logs for unauthorized access
2. **Investigation**:
   - Analyze request logs
   - Check for data exfiltration
   - Identify attack vectors
3. **Recovery**:
   - Update security measures
   - Notify affected users
   - Document lessons learned

### Contact Information
For security issues, please contact the development team with:
- Description of the issue
- Steps to reproduce
- Potential impact assessment
- Suggested fixes (if any)

## Compliance

### Data Protection
- **Input validation**: All user inputs are validated and sanitized
- **Data encryption**: Sensitive data encrypted in transit and at rest
- **Access control**: Token-based authentication required
- **Audit logging**: All API requests logged with security context

### Privacy
- **No personal data storage**: API doesn't store personal information
- **Minimal logging**: Only necessary request metadata logged
- **Data retention**: Logs retained for security monitoring only

## Updates

This security documentation is updated regularly as new security measures are implemented. Last updated: January 2024.

For questions or suggestions about security, please open an issue in the project repository. 