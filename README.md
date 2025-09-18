# ASJ Call Center - Real-time Translation

A professional call center application with real-time speech translation using OpenAI's Realtime API and WebRTC.

## Features

- **Real-time Speech Translation**: Live translation between multiple languages
- **Professional Call Interface**: Caller and agent views with call controls
- **WebRTC Audio**: High-quality real-time audio communication
- **Live Transcription**: Real-time display of speech and translations
- **Call Management**: Hold, mute, and call duration tracking
- **Transcript Download**: Complete conversation logs

## Quick Start

1. **Clone and install**:
   ```bash
   git clone <repository-url>
   cd asj-call-center
   npm install
   ```

2. **Set up environment**:
   ```bash
   cp .env.example .env
   # Add your OpenAI API key to .env
   ```

3. **Run the application**:
   ```bash
   npm run dev
   ```

4. **Open the application**:
   - Navigate to http://localhost:3000
   - Select caller or agent view
   - Choose languages and start a call

## Environment Variables

Create a `.env.local` file with:

```
OPENAI_API_KEY=your_openai_api_key_here
```

## Supported Languages

- Marathi (मराठी)
- Spanish (Español)
- English
- Hindi (हिन्दी)
- French (Français)
- German (Deutsch)

## Technology Stack

- **Frontend**: Next.js 13+ with TypeScript
- **UI**: Tailwind CSS + shadcn/ui components
- **Real-time API**: OpenAI Realtime API with WebRTC
- **Audio**: Web Audio API for call controls

## Usage

### For Callers
1. Select "Caller View"
2. Choose your language (e.g., Marathi)
3. Click the green call button
4. Start speaking - see live translation

### For Agents
1. Select "Agent View" 
2. Choose your language (e.g., Spanish)
3. Answer incoming calls
4. Respond to translated customer queries

## Features

- **Live Translation**: Real-time speech-to-speech translation
- **Call Controls**: Mute, hold, volume control
- **Transcript**: Download complete conversation logs
- **Professional UI**: Clean, modern call center interface
- **Multi-language**: Support for 6+ languages
- **Voice Selection**: Multiple voice options

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## License

MIT License - see LICENSE file for details.