#!/bin/bash

# Deployment script for Stage Preview COA
# Run this script on your VPS after initial setup

set -e  # Exit on error

echo "🚀 Starting deployment..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Are you in the project root?"
    exit 1
fi

# Pull latest changes from git (if using git)
if [ -d ".git" ]; then
    echo -e "${YELLOW}📥 Pulling latest changes from git...${NC}"
    git pull origin main || echo "⚠️  Git pull failed or not on a branch"
fi

# Install/update dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install --production=false

# Build frontend
echo -e "${YELLOW}🔨 Building frontend...${NC}"
npm run build

# Check if build was successful
if [ ! -d "dist" ]; then
    echo "❌ Error: Build failed - dist folder not found"
    exit 1
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Restart application with PM2
echo -e "${YELLOW}🔄 Restarting application with PM2...${NC}"
pm2 restart ecosystem.config.cjs || pm2 start ecosystem.config.cjs

# Save PM2 configuration
pm2 save

# Show status
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "Application status:"
pm2 status

echo ""
echo "📊 View logs with: pm2 logs stagepreview-coa"
echo "🔄 Restart with: pm2 restart stagepreview-coa"
echo "🛑 Stop with: pm2 stop stagepreview-coa"

