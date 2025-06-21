#!/bin/bash

# Setup Redis Backup Cron Job
echo "Setting up Redis backup cron job..."

# Make backup script executable
chmod +x backup-redis.sh

# Add cron job to run daily at 2 AM
(crontab -l 2>/dev/null; echo "0 2 * * * /home/davidtsx/ai-agent-api/backup-redis.sh >> /home/davidtsx/redis-backup.log 2>&1") | crontab -

echo "✅ Redis backup cron job set up successfully!"
echo "📅 Backup will run daily at 2:00 AM"
echo "📁 Backups will be stored in /home/davidtsx/redis-backups/"
echo "📝 Logs will be written to /home/davidtsx/redis-backup.log"

# Test the backup script
echo "🧪 Testing backup script..."
./backup-redis.sh

echo "✅ Setup complete!" 