#!/bin/bash

# Redis Setup Script for AI Agent API Production
# This script installs and configures Redis for production use

set -e

echo "🚀 Setting up Redis for AI Agent API Production"
echo "================================================"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run this script as root (use sudo)"
    exit 1
fi

# Detect OS
if [ -f /etc/debian_version ]; then
    OS="debian"
elif [ -f /etc/redhat-release ]; then
    OS="redhat"
elif [ -f /etc/centos-release ]; then
    OS="centos"
else
    echo "❌ Unsupported operating system"
    exit 1
fi

echo "📋 Detected OS: $OS"

# Generate secure Redis password
REDIS_PASSWORD=$(openssl rand -hex 16)
echo "🔐 Generated Redis password: $REDIS_PASSWORD"

# Install Redis based on OS
echo "📦 Installing Redis..."

if [ "$OS" = "debian" ]; then
    # Ubuntu/Debian
    apt-get update
    apt-get install -y redis-server
elif [ "$OS" = "redhat" ] || [ "$OS" = "centos" ]; then
    # RHEL/CentOS
    yum update -y
    yum install -y redis
fi

# Create Redis configuration
echo "⚙️ Configuring Redis..."

cat > /etc/redis/redis.conf << EOF
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

# Create log directory
mkdir -p /var/log/redis
chown redis:redis /var/log/redis

# Set proper permissions
chown redis:redis /etc/redis/redis.conf
chmod 640 /etc/redis/redis.conf

# Start and enable Redis
echo "🔄 Starting Redis service..."
systemctl daemon-reload
systemctl enable redis-server
systemctl start redis-server

# Test Redis connection
echo "🧪 Testing Redis connection..."
if redis-cli -a "$REDIS_PASSWORD" ping | grep -q "PONG"; then
    echo "✅ Redis is running successfully"
else
    echo "❌ Redis connection test failed"
    exit 1
fi

# Update .env file
echo "📝 Updating .env file..."
if [ -f .env ]; then
    # Backup original .env
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    
    # Update Redis configuration in .env
    sed -i "s/REDIS_PASSWORD=.*/REDIS_PASSWORD=$REDIS_PASSWORD/" .env
    sed -i "s/REDIS_HOST=.*/REDIS_HOST=localhost/" .env
    sed -i "s/REDIS_PORT=.*/REDIS_PORT=6379/" .env
    sed -i "s/REDIS_DB=.*/REDIS_DB=0/" .env
    
    echo "✅ .env file updated with Redis configuration"
else
    echo "⚠️ .env file not found. Please add these lines manually:"
    echo "REDIS_HOST=localhost"
    echo "REDIS_PORT=6379"
    echo "REDIS_PASSWORD=$REDIS_PASSWORD"
    echo "REDIS_DB=0"
fi

# Firewall configuration
echo "🔥 Configuring firewall..."
if command -v ufw &> /dev/null; then
    # UFW (Ubuntu)
    ufw deny 6379/tcp
    echo "✅ UFW configured to deny external Redis access"
elif command -v firewall-cmd &> /dev/null; then
    # firewalld (RHEL/CentOS)
    firewall-cmd --permanent --add-rich-rule='rule family="ipv4" port port="6379" protocol="tcp" reject'
    firewall-cmd --reload
    echo "✅ firewalld configured to deny external Redis access"
else
    echo "⚠️ No firewall detected. Please manually block port 6379"
fi

# Create monitoring script
cat > /usr/local/bin/redis-monitor.sh << 'EOF'
#!/bin/bash

# Redis Monitoring Script
REDIS_PASSWORD=$(grep REDIS_PASSWORD .env | cut -d'=' -f2)

echo "=== Redis Status ==="
systemctl status redis-server --no-pager -l

echo -e "\n=== Redis Memory Info ==="
redis-cli -a "$REDIS_PASSWORD" info memory

echo -e "\n=== Redis Stats ==="
redis-cli -a "$REDIS_PASSWORD" info stats

echo -e "\n=== Redis Keys ==="
redis-cli -a "$REDIS_PASSWORD" dbsize

echo -e "\n=== Redis Logs (last 10 lines) ==="
tail -10 /var/log/redis/redis-server.log
EOF

chmod +x /usr/local/bin/redis-monitor.sh

# Create cache management script
cat > /usr/local/bin/cache-manager.sh << 'EOF'
#!/bin/bash

# Cache Management Script for AI Agent API
API_TOKEN=$(grep AGENT_API_TOKEN .env | cut -d'=' -f2)
API_URL="http://localhost:3000/api"

case "$1" in
    "health")
        curl -H "Authorization: Bearer $API_TOKEN" "$API_URL/cache/health"
        ;;
    "stats")
        if [ -z "$2" ]; then
            echo "Usage: $0 stats <agent-id>"
            exit 1
        fi
        curl -H "Authorization: Bearer $API_TOKEN" "$API_URL/cache/stats/$2"
        ;;
    "clear")
        if [ -z "$2" ]; then
            echo "Usage: $0 clear <agent-id>"
            exit 1
        fi
        curl -X DELETE -H "Authorization: Bearer $API_TOKEN" "$API_URL/cache/clear/$2"
        ;;
    *)
        echo "Usage: $0 {health|stats|clear}"
        echo "  health - Check cache health"
        echo "  stats <agent-id> - Get cache stats for agent"
        echo "  clear <agent-id> - Clear cache for agent"
        exit 1
        ;;
esac
EOF

chmod +x /usr/local/bin/cache-manager.sh

echo ""
echo "🎉 Redis setup completed successfully!"
echo "======================================"
echo ""
echo "📋 Configuration Summary:"
echo "  - Redis Password: $REDIS_PASSWORD"
echo "  - Redis Host: localhost"
echo "  - Redis Port: 6379"
echo "  - Redis DB: 0"
echo ""
echo "🔧 Management Commands:"
echo "  - Monitor Redis: /usr/local/bin/redis-monitor.sh"
echo "  - Cache health: ./cache-manager.sh health"
echo "  - Cache stats: ./cache-manager.sh stats <agent-id>"
echo "  - Clear cache: ./cache-manager.sh clear <agent-id>"
echo ""
echo "🔒 Security Notes:"
echo "  - Redis is bound to localhost only"
echo "  - External access to port 6379 is blocked"
echo "  - Strong password authentication enabled"
echo ""
echo "📊 Next Steps:"
echo "  1. Restart your AI Agent API application"
echo "  2. Test cache functionality: node test-cache.js"
echo "  3. Monitor Redis performance: /usr/local/bin/redis-monitor.sh"
echo ""
echo "⚠️ IMPORTANT: Save the Redis password securely!"
echo "   Password: $REDIS_PASSWORD" 