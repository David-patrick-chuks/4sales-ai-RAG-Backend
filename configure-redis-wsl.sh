#!/bin/bash

# Redis Configuration Script for WSL Production
echo "🔧 Configuring Redis for production..."

# Redis password from .env
REDIS_PASSWORD="t72whGh9D0k9pzp8"

# Create Redis configuration
sudo tee /etc/redis/redis.conf > /dev/null << EOF
# Redis Configuration for AI Agent API Production

# Network
bind 127.0.0.1
port 6379
timeout 300
tcp-keepalive 60

# Security
requirepass $REDIS_PASSWORD

# Memory Management
maxmemory 256mb
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir /var/lib/redis

# Logging
loglevel notice
logfile /var/log/redis/redis-server.log
syslog-enabled no

# Performance
tcp-backlog 511
databases 16
hz 10

# Client Configuration
maxclients 10000

# Append Only File
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec
no-appendfsync-on-rewrite no
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb
EOF

# Restart Redis with new configuration
echo "🔄 Restarting Redis with new configuration..."
sudo systemctl restart redis-server

# Test Redis connection
echo "🧪 Testing Redis connection..."
if redis-cli -a "$REDIS_PASSWORD" ping | grep -q "PONG"; then
    echo "✅ Redis configured successfully!"
    echo "🔐 Redis is now protected with password: $REDIS_PASSWORD"
else
    echo "❌ Redis configuration failed!"
    exit 1
fi

# Show Redis info
echo "📊 Redis Information:"
redis-cli -a "$REDIS_PASSWORD" info server | head -10 