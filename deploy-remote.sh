#!/bin/bash

# Bash script to deploy to DigitalOcean server
# This script connects via SSH, pulls latest changes, and runs deployment

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
    echo "See Guides/DEPLOYMENT.md for details."
    exit 1
fi

# Check if jq is installed (for JSON parsing)
if ! command -v jq &> /dev/null; then
    print_warning "⚠️  Warning: 'jq' is not installed. Using basic parsing."
    print_warning "   Install jq for better JSON handling: https://stedolan.github.io/jq/download/"
    
    # Basic parsing without jq (assumes simple JSON format)
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

print_info "🚀 Starting deployment to DigitalOcean server..."
echo ""
echo "Server: ${SERVER_USER}@${SERVER_HOST}"
echo "Path: ${SERVER_PATH}"
echo ""

# Build remote commands
REMOTE_COMMANDS="cd ${SERVER_PATH} && \
echo '📥 Pulling latest changes from git...' && \
(git pull origin main || git pull origin master || echo '⚠️  Git pull skipped') && \
echo '' && \
echo '🔄 Running deployment script...' && \
bash deploy.sh"

# Build SSH command
SERVER_ADDRESS="${SERVER_USER}@${SERVER_HOST}"
SSH_COMMAND="ssh -i \"${SSH_KEY}\" -o StrictHostKeyChecking=no ${SERVER_ADDRESS} \"${REMOTE_COMMANDS}\""

print_warning "Connecting to server and running deployment..."
echo ""

# Execute SSH command
eval $SSH_COMMAND
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    print_success "✅ Deployment completed successfully!"
    exit 0
else
    echo ""
    print_error "❌ Deployment failed with exit code: $EXIT_CODE"
    exit $EXIT_CODE
fi


