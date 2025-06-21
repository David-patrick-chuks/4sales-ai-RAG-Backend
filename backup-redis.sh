#!/bin/bash

# Redis Backup Script for AI Agent API
# Run this script daily via cron job

REDIS_PASSWORD="t72whGh9D0k9pzp8"
BACKUP_DIR="/home/davidtsx/redis-backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="redis_backup_$DATE.rdb"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "Starting Redis backup at $(date)"

# Create Redis backup
if redis-cli -a "$REDIS_PASSWORD" BGSAVE; then
    echo "Redis BGSAVE initiated successfully"
    
    # Wait for backup to complete
    sleep 10
    
    # Copy the dump file to backup directory
    if cp /var/lib/redis/dump.rdb "$BACKUP_DIR/$BACKUP_FILE"; then
        echo "Backup created: $BACKUP_DIR/$BACKUP_FILE"
        
        # Compress the backup
        gzip "$BACKUP_DIR/$BACKUP_FILE"
        echo "Backup compressed: $BACKUP_DIR/$BACKUP_FILE.gz"
        
        # Keep only last 7 days of backups
        find "$BACKUP_DIR" -name "redis_backup_*.rdb.gz" -mtime +7 -delete
        echo "Old backups cleaned up"
        
    else
        echo "Failed to copy backup file"
        exit 1
    fi
else
    echo "Failed to initiate Redis backup"
    exit 1
fi

echo "Redis backup completed at $(date)" 