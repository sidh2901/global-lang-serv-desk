# Lingua Service Desk

A real-time speech translation system for multilingual customer service, enabling seamless communication between Marathi speakers (callers) and Spanish-speaking agents through live speech-to-text, translation, and text-to-speech.

## Features

- **Real-time Speech Translation**: Live translation between Marathi and Spanish
- **Dual Role Interface**: Separate optimized interfaces for callers and agents
- **WebRTC Audio Rooms**: High-quality real-time audio communication
- **Live Captions**: Real-time display of both source and translated text
- **Transcript Download**: Complete conversation transcripts in both languages
- **Microservices Architecture**: Modular, scalable service design
- **Local Deployment**: Runs entirely on local infrastructure without external APIs

## Architecture

The system consists of multiple interconnected services:

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Frontend  │────│   Backend   │────│     SFU     │
│  (Next.js)  │    │(Orchestrator)│    │ (LiveKit)  │
└─────────────┘    └─────────────┘    └─────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌─────────┐       ┌─────────────┐    ┌─────────┐
   │   ASR   │       │ Translator  │    │   TTS   │
   │(Whisper)│       │(IndicTrans2)│    │(XTTS-v2)│
   └─────────┘       └─────────────┘    └─────────┘
```

## Services

- **Frontend**: Next.js TypeScript application with real-time UI
- **Backend**: Node.js WebSocket server for service orchestration
- **ASR**: Speech-to-text using Whisper/faster-whisper
- **Translator**: Text translation using IndicTrans2 + NLLB (pivot mode) or SeamlessM4T (direct)
- **TTS**: Text-to-speech using Coqui XTTS-v2
- **SFU**: WebRTC server using self-hosted LiveKit

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Python 3.9+
- Node.js 18+
- At least 8GB RAM (for AI models)
- GPU recommended (optional for PoC)

### Setup

1. **Clone and setup**:
   ```bash
   git clone <repository-url>
   cd lingua-service-desk
   chmod +x scripts/*.sh
   ./scripts/setup-models.sh
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env as needed
   ```

3. **Start services**:
   ```bash
   docker-compose up -d
   ```

4. **Verify health**:
   ```bash
   ./scripts/health-check.sh
   ```

5. **Access the application**:
   - Open http://localhost:3000
   - Select your role (Caller/Agent)
   - Start speaking!

## Configuration

### Environment Variables

- `TRANSLATION_MODE`: `pivot` (Marathi→English→Spanish) or `direct` (SeamlessM4T)
- `DEVICE`: `cpu` or `cuda` for AI model inference
- `ASR_MODEL_SIZE`: Whisper model size (`tiny`, `base`, `small`, `medium`, `large`)

### Translation Modes

1. **Pivot Mode** (Default):
   - Marathi ↔ English ↔ Spanish
   - Uses IndicTrans2 + NLLB
   - More accurate for Indian languages

2. **Direct Mode**:
   - Marathi ↔ Spanish directly
   - Uses SeamlessM4T
   - Requires additional setup

## Development

### Running Individual Services

```bash
# Frontend
npm run dev

# Backend
cd backend && npm run dev

# ASR Service
cd services/asr && python app.py

# Translator Service
cd services/translator && python app.py

# TTS Service
cd services/tts && python app.py
```

### API Endpoints

- **Backend**: `ws://localhost:8080/ws` (WebSocket)
- **ASR**: `ws://localhost:8001/ws`
- **Translator**: `ws://localhost:8002/ws`
- **TTS**: `ws://localhost:8003/ws`
- **LiveKit**: `ws://localhost:7880`

### Health Checks

All services provide `/health` endpoints for monitoring:
- Backend: http://localhost:8080/health
- ASR: http://localhost:8001/health
- Translator: http://localhost:8002/health
- TTS: http://localhost:8003/health

## Usage

### For Callers (Marathi Speakers)

1. Select "Caller (Marathi)" role
2. Click the microphone to start recording
3. Speak in Marathi
4. See live captions in both Marathi and Spanish
5. Hear responses in Marathi through translated audio

### For Agents (Spanish Speakers)

1. Select "Agent (Spanish)" role
2. Click the microphone to start recording
3. Speak in Spanish
4. See live captions in both Spanish and Marathi
5. Hear caller's questions in Spanish through translated audio

### Features

- **Live Captions**: Real-time transcription and translation display
- **Audio Output**: Automatic playback of translated speech
- **Transcript Download**: Save complete conversation logs
- **Connection Monitoring**: Real-time service health indicators
- **Role Switching**: Easy switching between caller and agent modes

## Models and Dependencies

### AI Models Used

- **ASR**: OpenAI Whisper (base model, ~140MB)
- **Translation**: IndicTrans2 + NLLB (pivot) or SeamlessM4T (direct)
- **TTS**: Coqui XTTS-v2 (~2GB)

### Model Downloads

Models are downloaded automatically on first use. For production deployment:

1. Pre-download models using setup scripts
2. Mount model directories as Docker volumes
3. Use model caching for faster startups

## Production Considerations

### Scaling

- Deploy services on separate containers/VMs
- Use load balancers for frontend and backend
- Implement model serving with GPU acceleration
- Add monitoring and logging (Prometheus, Grafana)

### Security

- Enable authentication and authorization
- Use HTTPS/WSS in production
- Implement rate limiting
- Add input validation and sanitization

### Performance

- Use GPU acceleration for AI models
- Implement model caching and batching
- Add CDN for static assets
- Monitor resource usage and auto-scaling

## Troubleshooting

### Common Issues

1. **Models not downloading**: Check internet connection and disk space
2. **High CPU usage**: Consider GPU acceleration or smaller models
3. **Audio not working**: Check browser permissions and WebRTC support
4. **Translation quality**: Adjust model parameters or try different translation mode

### Debug Commands

```bash
# Check service logs
docker-compose logs [service-name]

# Check container status
docker-compose ps

# Restart specific service
docker-compose restart [service-name]

# Check system resources
docker stats
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Check the troubleshooting section
- Review service logs
- Open an issue with detailed information

---

**Note**: This is a PoC implementation. For production use, consider professional model hosting, security hardening, and performance optimization.