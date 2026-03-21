#!/bin/bash
set -e

# Function to print timestamped messages
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

log "Starting PirateFlow deployment"

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Change to PirateFlow directory
cd "$SCRIPT_DIR"
log "Working directory: $(pwd)"

# Set up Python venv for backend
log "Setting up Python virtual environment"
if [ ! -d "backend/venv" ]; then
    log "Creating virtual environment"
    python3 -m venv backend/venv
fi

log "Activating virtual environment and installing requirements"
source backend/venv/bin/activate
pip install -r backend/requirements.txt

# Build frontend
log "Building frontend"
cd frontend

if [ -f "package-lock.json" ]; then
    log "Running npm ci"
    npm ci
else
    log "Running npm install"
    npm install
fi

log "Building frontend"
npm run build

# Restart the systemd service
log "Restarting app service"
sudo systemctl restart app

log "PirateFlow deployment completed successfully"
