# Production Deployment Guide

## 🚀 Production-Ready AI Agent API

This guide covers deploying your AI Agent API to production with Redis caching, security hardening, and performance optimization.

## 📋 Prerequisites

- Node.js 18+ 
- MongoDB Atlas cluster with vector search
- Redis server (local or cloud)
- Google Gemini API keys
- Production domain and SSL certificate

## 🔧 Environment Configuration

### 1. Update `.env` for Production

Your `.env` file has been updated with production settings:

```env
# Server Configuration
PORT=3000
NODE_ENV=production
DEBUG_SCRAPING=false

# MongoDB Configuration
MONGO_URI=your-production-mongodb-uri

# Google Gemini Configuration
GEMINI_API_KEY=your-primary-gemini-key
GEMINI_API_KEY_1=your-backup-key-1
# ... additional backup keys

# CORS Configuration (Update with your domains)
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com,https://api.yourdomain.com

# Security (CHANGE THESE IMMEDIATELY)
AGENT_API_TOKEN=your-super-secure-production-api-token
SESSION_SECRET=your-super-secret-production-session-key

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-strong-redis-password
REDIS_DB=0
```

### 2. Critical Security Updates

**⚠️ IMMEDIATE ACTIONS REQUIRED:**

1. **Change API Token:**
   ```bash
   # Generate a secure token
   openssl rand -hex 32
   # Update AGENT_API_TOKEN in .env
   ```

2. **Change Session Secret:**
   ```bash
   # Generate a secure secret
   openssl rand -hex 32
   # Update SESSION_SECRET in .env
   ```

3. **Change Redis Password:**
   ```bash
   # Generate a secure password
   openssl rand -hex 16
   # Update REDIS_PASSWORD in .env
   ```

## 🏗️ Redis Setup

### Option 1: Local Redis (Recommended for small deployments)

```bash
# Install Redis
sudo apt-get update
sudo apt-get install redis-server

# Configure Redis for production
sudo nano /etc/redis/redis.conf
```

Add these production settings to `redis.conf`:
```conf
# Security
requirepass your-strong-redis-password
bind 127.0.0.1

# Performance
maxmemory 256mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000

# Logging
loglevel notice
logfile /var/log/redis/redis-server.log
```

```bash
# Restart Redis
sudo systemctl restart redis-server
sudo systemctl enable redis-server

# Test connection
redis-cli -a your-strong-redis-password ping
```

### Option 2: Cloud Redis (Recommended for large deployments)

**Redis Cloud (Redis Labs):**
```bash
# Get connection details from Redis Cloud dashboard
REDIS_HOST=your-redis-cloud-host
REDIS_PORT=your-redis-cloud-port
REDIS_PASSWORD=your-redis-cloud-password
```

**AWS ElastiCache:**
```bash
# Use AWS ElastiCache Redis cluster
REDIS_HOST=your-elasticache-endpoint
REDIS_PORT=6379
REDIS_PASSWORD=your-elasticache-auth-token
```

## 🐳 Docker Deployment

### 1. Create Docker Compose for Production

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    depends_on:
      - redis
      - mongodb
    restart: unless-stopped
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped
    networks:
      - app-network

  mongodb:
    image: mongo:6
    environment:
      - MONGO_INITDB_ROOT_USERNAME=${MONGO_USER}
      - MONGO_INITDB_ROOT_PASSWORD=${MONGO_PASSWORD}
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db
    restart: unless-stopped
    networks:
      - app-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped
    networks:
      - app-network

volumes:
  redis-data:
  mongo-data:

networks:
  app-network:
    driver: bridge
```

### 2. Nginx Configuration

```nginx
# nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream app {
        server app:3000;
    }

    server {
        listen 80;
        server_name yourdomain.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name yourdomain.com;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
        ssl_prefer_server_ciphers off;

        location / {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
```

### 3. Deploy with Docker

```bash
# Build and deploy
docker-compose -f docker-compose.prod.yml up -d

# Check logs
docker-compose -f docker-compose.prod.yml logs -f

# Scale if needed
docker-compose -f docker-compose.prod.yml up -d --scale app=3
```

## ☁️ Cloud Deployment

### AWS Deployment

**EC2 with Docker:**
```bash
# Launch EC2 instance
aws ec2 run-instances \
  --image-id ami-0c02fb55956c7d316 \
  --instance-type t3.medium \
  --key-name your-key-pair \
  --security-group-ids sg-xxxxxxxxx

# Install Docker and deploy
sudo yum update -y
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker

# Deploy application
git clone your-repo
cd ai-agent-api
docker-compose -f docker-compose.prod.yml up -d
```

**AWS ECS:**
```bash
# Create ECS cluster
aws ecs create-cluster --cluster-name ai-agent-cluster

# Create task definition
aws ecs register-task-definition --cli-input-json file://task-definition.json

# Create service
aws ecs create-service \
  --cluster ai-agent-cluster \
  --service-name ai-agent-service \
  --task-definition ai-agent:1 \
  --desired-count 2
```

### Google Cloud Deployment

**Cloud Run:**
```bash
# Build and deploy
gcloud builds submit --tag gcr.io/your-project/ai-agent-api
gcloud run deploy ai-agent-api \
  --image gcr.io/your-project/ai-agent-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

## 🔒 Security Hardening

### 1. Firewall Configuration

```bash
# UFW (Ubuntu)
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 6379/tcp  # Redis - internal only
sudo ufw enable

# iptables (CentOS/RHEL)
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 6379 -j DROP
```

### 2. SSL/TLS Configuration

```bash
# Let's Encrypt
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### 3. Security Headers

The application already includes security headers via Helmet.js:
- Content Security Policy
- HSTS
- XSS Protection
- Frame Options
- Content Type Sniffing Protection

## 📊 Monitoring & Logging

### 1. Application Monitoring

```bash
# PM2 for process management
npm install -g pm2
pm2 start dist/server.js --name "ai-agent-api"
pm2 startup
pm2 save

# Monitor
pm2 monit
pm2 logs ai-agent-api
```

### 2. Health Checks

```bash
# Application health
curl https://yourdomain.com/health

# Cache health
curl -H "Authorization: Bearer your-token" \
  https://yourdomain.com/api/cache/health
```

### 3. Log Management

```bash
# Centralized logging with rsyslog
sudo nano /etc/rsyslog.conf

# Add to rsyslog.conf
local0.* /var/log/ai-agent-api.log

# Restart rsyslog
sudo systemctl restart rsyslog
```

## 🔄 CI/CD Pipeline

### GitHub Actions Example

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build application
        run: npm run build
        
      - name: Deploy to server
        uses: appleboy/ssh-action@v0.1.5
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.KEY }}
          script: |
            cd /opt/ai-agent-api
            git pull origin main
            npm ci
            npm run build
            pm2 restart ai-agent-api
```

## 🧪 Testing Production

### 1. Cache Functionality Test

```bash
# Test cache endpoints
curl -H "Authorization: Bearer your-token" \
  https://yourdomain.com/api/cache/health

# Test agent isolation
node test-cache.js
```

### 2. Performance Test

```bash
# Load testing with Artillery
npm install -g artillery
artillery quick --count 100 --num 10 https://yourdomain.com/api/status
```

### 3. Security Test

```bash
# Run security tests
node test-security.js
```

## 📈 Performance Optimization

### 1. Redis Optimization

```bash
# Monitor Redis performance
redis-cli -a your-password info memory
redis-cli -a your-password info stats

# Optimize memory usage
redis-cli -a your-password config set maxmemory-policy allkeys-lru
```

### 2. Application Optimization

- **Connection Pooling**: MongoDB connection pool configured
- **Rate Limiting**: Production-optimized limits
- **Compression**: Gzip compression enabled
- **Caching**: Redis-based agent isolation and context caching

### 3. Monitoring Metrics

Key metrics to monitor:
- Response times (target: <500ms)
- Cache hit rates (target: >60%)
- Error rates (target: <1%)
- Memory usage
- CPU usage

## 🚨 Troubleshooting

### Common Issues

1. **Redis Connection Failed**
   ```bash
   # Check Redis status
   sudo systemctl status redis-server
   redis-cli -a your-password ping
   ```

2. **MongoDB Connection Issues**
   ```bash
   # Check MongoDB connection
   curl https://yourdomain.com/health
   ```

3. **High Memory Usage**
   ```bash
   # Check memory usage
   free -h
   pm2 monit
   ```

### Emergency Procedures

1. **Rollback Deployment**
   ```bash
   git checkout HEAD~1
   npm run build
   pm2 restart ai-agent-api
   ```

2. **Clear Cache**
   ```bash
   curl -X DELETE -H "Authorization: Bearer your-token" \
     https://yourdomain.com/api/cache/clear/all
   ```

3. **Restart Services**
   ```bash
   sudo systemctl restart redis-server
   pm2 restart all
   ```

## 📞 Support

For production support:
- Monitor application logs: `pm2 logs ai-agent-api`
- Check Redis logs: `sudo tail -f /var/log/redis/redis-server.log`
- Monitor system resources: `htop`
- Check health endpoints: `/health` and `/api/cache/health`

## 🎯 Production Checklist

- [ ] Environment variables updated for production
- [ ] Security tokens changed from defaults
- [ ] Redis installed and configured
- [ ] SSL certificate installed
- [ ] Firewall configured
- [ ] Monitoring set up
- [ ] Backup strategy implemented
- [ ] CI/CD pipeline configured
- [ ] Performance testing completed
- [ ] Security testing passed
- [ ] Documentation updated
- [ ] Team trained on deployment procedures 