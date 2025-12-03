#!/bin/bash

# Quick Deploy Script - Connect, Pull Git, Restart App
# Simple script to quickly update and restart the app on DigitalOcean

# Default config file
CONFIG_FILE="${1:-deploy.config.json}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_error() {
    echo -e "${RED}$1${NC}"
}

print_success() {
    echo -e "${GREEN}$1${NC}"
}

print_warning() {
    echo -e "${YELLOW}$1${NC}"
}

print_info() {
    echo -e "${CYAN}$1${NC}"
}

# Check if config file exists
if [ ! -f "$CONFIG_FILE" ]; then
    print_error "❌ Error: Configuration file '$CONFIG_FILE' not found!"
    echo "Please create '$CONFIG_FILE' from 'deploy.config.example.json'"
    exit 1
fi

# Check if jq is installed (for JSON parsing)
if ! command -v jq &> /dev/null; then
    print_warning "⚠️  Warning: 'jq' is not installed. Using basic parsing."
    
    # Basic parsing without jq
    SSH_KEY=$(grep -o '"sshKey"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" | sed 's/.*"sshKey"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
    SERVER_USER=$(grep -o '"serverUser"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" | sed 's/.*"serverUser"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
    SERVER_HOST=$(grep -o '"serverHost"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" | sed 's/.*"serverHost"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
    SERVER_PATH=$(grep -o '"serverPath"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" | sed 's/.*"serverPath"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
else
    # Use jq for proper JSON parsing
    SSH_KEY=$(jq -r '.sshKey' "$CONFIG_FILE")
    SERVER_USER=$(jq -r '.serverUser' "$CONFIG_FILE")
    SERVER_HOST=$(jq -r '.serverHost' "$CONFIG_FILE")
    SERVER_PATH=$(jq -r '.serverPath' "$CONFIG_FILE")
fi

# Expand ~ in SSH key path
SSH_KEY="${SSH_KEY/#\~/$HOME}"

# Validate required configuration
if [ -z "$SSH_KEY" ] || [ -z "$SERVER_USER" ] || [ -z "$SERVER_HOST" ] || [ -z "$SERVER_PATH" ]; then
    print_error "❌ Error: Missing required configuration fields!"
    echo "Required: sshKey, serverUser, serverHost, serverPath"
    exit 1
fi

# Check if SSH key exists
if [ ! -f "$SSH_KEY" ]; then
    print_error "❌ Error: SSH key not found at: $SSH_KEY"
    exit 1
fi

print_info "🚀 Quick Deploy - Connecting to server..."
echo ""
echo "Server: ${SERVER_USER}@${SERVER_HOST}"
echo "Path: ${SERVER_PATH}"
echo ""

# Build remote commands
REMOTE_COMMANDS="cd ${SERVER_PATH} && \
echo '📥 Pulling latest changes from git...' && \
(git pull origin main 2>&1 || git pull origin master 2>&1) && \
echo '' && \
echo '🔄 Restarting application with PM2...' && \
(pm2 restart stagepreview-coa 2>&1 || pm2 restart ecosystem.config.cjs 2>&1) && \
echo '' && \
echo '✅ Deployment complete!' && \
pm2 status"

# Build SSH command
SERVER_ADDRESS="${SERVER_USER}@${SERVER_HOST}"
SSH_COMMAND="ssh -i \"${SSH_KEY}\" -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${SERVER_ADDRESS} \"${REMOTE_COMMANDS}\""

print_warning "Executing commands on server..."
echo ""

# Execute SSH command
eval $SSH_COMMAND
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    print_success "✅ Quick deploy completed successfully!"
    exit 0
else
    echo ""
    print_error "❌ Deployment failed with exit code: $EXIT_CODE"
    echo ""
    echo "Troubleshooting tips:"
    echo "1. Check if server is running: ping ${SERVER_HOST}"
    echo "2. Verify SSH key permissions"
    echo "3. Check server logs: ssh -i \"${SSH_KEY}\" ${SERVER_ADDRESS} 'pm2 logs stagepreview-coa --lines 50'"
    exit $EXIT_CODE
fi



