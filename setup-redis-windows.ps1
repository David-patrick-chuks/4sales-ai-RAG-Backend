# Redis Setup Script for AI Agent API Production (Windows)
# This script helps set up Redis for production use on Windows

param(
    [string]$RedisPassword = ""
)

Write-Host "🚀 Setting up Redis for AI Agent API Production (Windows)" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green

# Generate Redis password if not provided
if (-not $RedisPassword) {
    $RedisPassword = -join ((48..57) + (97..122) | Get-Random -Count 16 | ForEach-Object {[char]$_})
    Write-Host "🔐 Generated Redis password: $RedisPassword" -ForegroundColor Yellow
}

Write-Host "📋 Redis Setup Options:" -ForegroundColor Cyan
Write-Host "1. Docker (Recommended - Easy setup)" -ForegroundColor White
Write-Host "2. WSL (Windows Subsystem for Linux)" -ForegroundColor White
Write-Host "3. Windows Redis (Manual installation)" -ForegroundColor White
Write-Host "4. Skip Redis setup (for cloud Redis)" -ForegroundColor White

$choice = Read-Host "`nSelect option (1-4)"

switch ($choice) {
    "1" {
        Write-Host "🐳 Setting up Redis with Docker..." -ForegroundColor Green
        
        # Check if Docker is installed
        try {
            docker --version | Out-Null
            Write-Host "✅ Docker is installed" -ForegroundColor Green
        } catch {
            Write-Host "❌ Docker is not installed. Please install Docker Desktop for Windows first." -ForegroundColor Red
            Write-Host "   Download from: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
            exit 1
        }
        
        # Stop and remove existing Redis container if it exists
        docker stop redis-production 2>$null
        docker rm redis-production 2>$null
        
        # Start Redis container
        Write-Host "🚀 Starting Redis container..." -ForegroundColor Green
        docker run -d --name redis-production -p 6379:6379 redis:7-alpine redis-server --requirepass $RedisPassword
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Redis container started successfully" -ForegroundColor Green
        } else {
            Write-Host "❌ Failed to start Redis container" -ForegroundColor Red
            exit 1
        }
        
        # Test Redis connection
        Write-Host "🧪 Testing Redis connection..." -ForegroundColor Green
        $testResult = docker exec redis-production redis-cli -a $RedisPassword ping
        if ($testResult -eq "PONG") {
            Write-Host "✅ Redis connection test successful" -ForegroundColor Green
        } else {
            Write-Host "❌ Redis connection test failed" -ForegroundColor Red
            exit 1
        }
    }
    
    "2" {
        Write-Host "🐧 Setting up Redis with WSL..." -ForegroundColor Green
        
        # Check if WSL is installed
        try {
            wsl --list | Out-Null
            Write-Host "✅ WSL is available" -ForegroundColor Green
        } catch {
            Write-Host "❌ WSL is not installed. Installing WSL..." -ForegroundColor Yellow
            wsl --install
            Write-Host "🔄 Please restart your computer and run this script again." -ForegroundColor Yellow
            exit 1
        }
        
        Write-Host "📦 Installing Redis in WSL..." -ForegroundColor Green
        wsl sudo apt update
        wsl sudo apt install -y redis-server
        
        # Configure Redis
        Write-Host "⚙️ Configuring Redis..." -ForegroundColor Green
        $redisConfig = @"
# Redis Configuration for AI Agent API Production

# Network
bind 127.0.0.1
port 6379
timeout 300
tcp-keepalive 60

# Security
requirepass $RedisPassword

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
"@
        
        wsl "echo '$redisConfig' | sudo tee /etc/redis/redis.conf"
        wsl sudo systemctl restart redis-server
        wsl sudo systemctl enable redis-server
        
        # Test Redis connection
        Write-Host "🧪 Testing Redis connection..." -ForegroundColor Green
        $testResult = wsl redis-cli -a $RedisPassword ping
        if ($testResult -eq "PONG") {
            Write-Host "✅ Redis connection test successful" -ForegroundColor Green
        } else {
            Write-Host "❌ Redis connection test failed" -ForegroundColor Red
            exit 1
        }
    }
    
    "3" {
        Write-Host "🪟 Manual Windows Redis setup..." -ForegroundColor Green
        Write-Host "📥 Please download Redis for Windows from:" -ForegroundColor Yellow
        Write-Host "   https://github.com/microsoftarchive/redis/releases" -ForegroundColor Cyan
        Write-Host "📋 After installation, configure Redis with password: $RedisPassword" -ForegroundColor Yellow
        Write-Host "🔧 Manual configuration required - please follow the documentation" -ForegroundColor Yellow
    }
    
    "4" {
        Write-Host "☁️ Skipping local Redis setup (for cloud Redis)" -ForegroundColor Green
        Write-Host "📝 Please update your .env file with cloud Redis credentials" -ForegroundColor Yellow
    }
    
    default {
        Write-Host "❌ Invalid option selected" -ForegroundColor Red
        exit 1
    }
}

# Update .env file
Write-Host "📝 Updating .env file..." -ForegroundColor Green
$envPath = ".env"
if (Test-Path $envPath) {
    # Backup original .env
    $backupPath = ".env.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    Copy-Item $envPath $backupPath
    Write-Host "✅ .env backed up to $backupPath" -ForegroundColor Green
    
    # Read current .env content
    $envContent = Get-Content $envPath -Raw
    
    # Update Redis configuration
    $envContent = $envContent -replace 'REDIS_PASSWORD=.*', "REDIS_PASSWORD=$RedisPassword"
    $envContent = $envContent -replace 'REDIS_HOST=.*', "REDIS_HOST=localhost"
    $envContent = $envContent -replace 'REDIS_PORT=.*', "REDIS_PORT=6379"
    $envContent = $envContent -replace 'REDIS_DB=.*', "REDIS_DB=0"
    
    # Write updated content
    Set-Content $envPath $envContent
    Write-Host "✅ .env file updated with Redis configuration" -ForegroundColor Green
} else {
    Write-Host "⚠️ .env file not found. Please add these lines manually:" -ForegroundColor Yellow
    Write-Host "REDIS_HOST=localhost" -ForegroundColor White
    Write-Host "REDIS_PORT=6379" -ForegroundColor White
    Write-Host "REDIS_PASSWORD=$RedisPassword" -ForegroundColor White
    Write-Host "REDIS_DB=0" -ForegroundColor White
}

# Create Windows management scripts
Write-Host "🔧 Creating management scripts..." -ForegroundColor Green

# Redis monitoring script
$monitorScript = @"
# Redis Monitoring Script for Windows
param([string]`$RedisPassword = "")

if (-not `$RedisPassword) {
    `$RedisPassword = (Get-Content .env | Where-Object { `$_ -match "REDIS_PASSWORD=" }) -replace "REDIS_PASSWORD=", ""
}

Write-Host "=== Redis Status ===" -ForegroundColor Green
if (Get-Process redis-server -ErrorAction SilentlyContinue) {
    Write-Host "✅ Redis is running" -ForegroundColor Green
} else {
    Write-Host "❌ Redis is not running" -ForegroundColor Red
}

Write-Host "`n=== Redis Connection Test ===" -ForegroundColor Green
try {
    `$result = redis-cli -a `$RedisPassword ping
    if (`$result -eq "PONG") {
        Write-Host "✅ Redis connection successful" -ForegroundColor Green
    } else {
        Write-Host "❌ Redis connection failed" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Redis CLI not found or connection failed" -ForegroundColor Red
}

Write-Host "`n=== Redis Info ===" -ForegroundColor Green
try {
    redis-cli -a `$RedisPassword info memory
    redis-cli -a `$RedisPassword info stats
    redis-cli -a `$RedisPassword dbsize
} catch {
    Write-Host "❌ Unable to get Redis info" -ForegroundColor Red
}
"@

Set-Content "redis-monitor.ps1" $monitorScript

# Cache management script
$cacheScript = @"
# Cache Management Script for AI Agent API (Windows)
param(
    [string]`$Action = "",
    [string]`$AgentId = ""
)

`$API_TOKEN = (Get-Content .env | Where-Object { `$_ -match "AGENT_API_TOKEN=" }) -replace "AGENT_API_TOKEN=", ""
`$API_URL = "http://localhost:3000/api"

switch (`$Action.ToLower()) {
    "health" {
        Write-Host "Checking cache health..." -ForegroundColor Green
        try {
            `$response = Invoke-RestMethod -Uri "`$API_URL/cache/health" -Headers @{Authorization = "Bearer `$API_TOKEN"}
            `$response | ConvertTo-Json -Depth 10
        } catch {
            Write-Host "❌ Failed to check cache health: `$(`$_.Exception.Message)" -ForegroundColor Red
        }
    }
    "stats" {
        if (-not `$AgentId) {
            Write-Host "Usage: .\cache-manager.ps1 stats <agent-id>" -ForegroundColor Yellow
            exit 1
        }
        Write-Host "Getting cache stats for agent: `$AgentId" -ForegroundColor Green
        try {
            `$response = Invoke-RestMethod -Uri "`$API_URL/cache/stats/`$AgentId" -Headers @{Authorization = "Bearer `$API_TOKEN"}
            `$response | ConvertTo-Json -Depth 10
        } catch {
            Write-Host "❌ Failed to get cache stats: `$(`$_.Exception.Message)" -ForegroundColor Red
        }
    }
    "clear" {
        if (-not `$AgentId) {
            Write-Host "Usage: .\cache-manager.ps1 clear <agent-id>" -ForegroundColor Yellow
            exit 1
        }
        Write-Host "Clearing cache for agent: `$AgentId" -ForegroundColor Green
        try {
            `$response = Invoke-RestMethod -Uri "`$API_URL/cache/clear/`$AgentId" -Method DELETE -Headers @{Authorization = "Bearer `$API_TOKEN"}
            `$response | ConvertTo-Json -Depth 10
        } catch {
            Write-Host "❌ Failed to clear cache: `$(`$_.Exception.Message)" -ForegroundColor Red
        }
    }
    default {
        Write-Host "Usage: .\cache-manager.ps1 {health|stats|clear}" -ForegroundColor Yellow
        Write-Host "  health - Check cache health" -ForegroundColor White
        Write-Host "  stats <agent-id> - Get cache stats for agent" -ForegroundColor White
        Write-Host "  clear <agent-id> - Clear cache for agent" -ForegroundColor White
    }
}
"@

Set-Content "cache-manager.ps1" $cacheScript

Write-Host ""
Write-Host "🎉 Redis setup completed successfully!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Configuration Summary:" -ForegroundColor Cyan
Write-Host "  - Redis Password: $RedisPassword" -ForegroundColor White
Write-Host "  - Redis Host: localhost" -ForegroundColor White
Write-Host "  - Redis Port: 6379" -ForegroundColor White
Write-Host "  - Redis DB: 0" -ForegroundColor White
Write-Host ""
Write-Host "🔧 Management Commands:" -ForegroundColor Cyan
Write-Host "  - Monitor Redis: .\redis-monitor.ps1" -ForegroundColor White
Write-Host "  - Cache health: .\cache-manager.ps1 health" -ForegroundColor White
Write-Host "  - Cache stats: .\cache-manager.ps1 stats <agent-id>" -ForegroundColor White
Write-Host "  - Clear cache: .\cache-manager.ps1 clear <agent-id>" -ForegroundColor White
Write-Host ""
Write-Host "🔒 Security Notes:" -ForegroundColor Cyan
Write-Host "  - Redis is bound to localhost only" -ForegroundColor White
Write-Host "  - Strong password authentication enabled" -ForegroundColor White
Write-Host "  - External access is blocked" -ForegroundColor White
Write-Host ""
Write-Host "📊 Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Restart your AI Agent API application" -ForegroundColor White
Write-Host "  2. Test cache functionality: node test-cache.js" -ForegroundColor White
Write-Host "  3. Monitor Redis performance: .\redis-monitor.ps1" -ForegroundColor White
Write-Host ""
Write-Host "⚠️ IMPORTANT: Save the Redis password securely!" -ForegroundColor Red
Write-Host "   Password: $RedisPassword" -ForegroundColor Yellow 