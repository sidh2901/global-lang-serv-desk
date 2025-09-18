#!/bin/bash

# Setup script for downloading and configuring required models
# Run this script to prepare the system for first use

set -e

echo "🚀 Setting up Lingua Service Desk models..."

# Create directories
mkdir -p models/asr
mkdir -p models/translator
mkdir -p models/tts

echo "📥 Downloading ASR models (Whisper)..."
# Whisper models are downloaded automatically on first use
# Pre-download base model for faster startup
python3 -c "import whisper; whisper.load_model('base')" || echo "Whisper model download will happen on first use"

echo "📥 Setting up translation models..."
# In a real deployment, this would download IndicTrans2 and NLLB models
# For now, we'll use mock models
echo "Translation models will be loaded on demand (using mock for PoC)"

echo "📥 Setting up TTS models..."
# XTTS-v2 models are downloaded automatically on first use
# This can take several GB of space
echo "TTS models will be downloaded on first use"

echo "⚙️  Setting up configuration..."
# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env file from template"
fi

echo "🐳 Building Docker containers..."
# Build all containers
docker-compose build

echo "✅ Setup complete!"
echo ""
echo "To start the system:"
echo "1. Run: docker-compose up -d"
echo "2. Open: http://localhost:3000"
echo ""
echo "To check service health:"
echo "- Backend: http://localhost:8080/health"
echo "- ASR: http://localhost:8001/health"
echo "- Translator: http://localhost:8002/health"
echo "- TTS: http://localhost:8003/health"
echo ""
echo "Note: First run will download models automatically (may take time)"