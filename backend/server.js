const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// WebSocket server
const wss = new WebSocket.Server({ 
  server,
  path: '/ws'
});

// Add error handler for WebSocket server
wss.on('error', (error) => {
  console.error('WebSocket server error:', error);
});

// Service connections
const services = {
  asr: null,
  translator: null,
  tts: null,
  sfu: null
};

// Client connections by role
const clients = {
  caller: new Set(),
  agent: new Set()
};

// Health check endpoint
app.get('/health', (req, res) => {
  const healthStatus = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      websocket: wss.clients.size > 0,
      webrtc: services.sfu !== null,
      asr: services.asr !== null,
      translator: services.translator !== null,
      tts: services.tts !== null
    }
  };
  res.json(healthStatus);
});

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('New WebSocket connection');
  
  ws.id = uuidv4();
  ws.role = null;
  ws.isAlive = true;

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      await handleClientMessage(ws, data);
    } catch (error) {
      console.error('Error handling message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format'
      }));
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
    if (ws.role) {
      clients[ws.role].delete(ws);
    }
  });

  // Send initial health check
  setTimeout(() => {
    sendHealthCheck(ws);
  }, 1000);
});

async function handleClientMessage(ws, data) {
  switch (data.type) {
    case 'subscribe':
      ws.role = data.role;
      clients[data.role].add(ws);
      console.log(`Client subscribed as ${data.role}`);
      break;

    case 'start_recording':
      await handleStartRecording(ws, data);
      break;

    case 'stop_recording':
      await handleStopRecording(ws, data);
      break;

    case 'audio_chunk':
      await handleAudioChunk(ws, data);
      break;

    default:
      console.log('Unknown message type:', data.type);
  }
}

async function handleStartRecording(ws, data) {
  console.log(`Starting recording for ${data.role} in ${data.language}`);
  
  // Initialize ASR service connection
  if (!services.asr) {
    try {
      await connectToASRService();
    } catch (error) {
      console.error('Failed to connect to ASR service:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'ASR service unavailable'
      }));
      return;
    }
  }

  ws.send(JSON.stringify({
    type: 'recording_started',
    language: data.language
  }));
}

async function handleStopRecording(ws, data) {
  console.log('Stopping recording');
  
  ws.send(JSON.stringify({
    type: 'recording_stopped'
  }));
}

async function handleAudioChunk(ws, data) {
  // Forward audio to ASR service
  if (services.asr) {
    try {
      const asrResult = await processASR(data.audioData, data.language);
      
      if (asrResult.text) {
        // Send ASR result to client
        ws.send(JSON.stringify({
          type: 'asr_result',
          text: asrResult.text,
          confidence: asrResult.confidence
        }));

        // Process translation
        const translationResult = await processTranslation(
          asrResult.text,
          data.language,
          getTargetLanguage(data.language)
        );

        if (translationResult.translatedText) {
          // Send translation result to client
          ws.send(JSON.stringify({
            type: 'translation_result',
            sourceText: asrResult.text,
            translatedText: translationResult.translatedText,
            confidence: translationResult.confidence
          }));

          // Process TTS
          const ttsResult = await processTTS(
            translationResult.translatedText,
            getTargetLanguage(data.language)
          );

          if (ttsResult.audioUrl) {
            // Send to opposite role clients
            const targetRole = ws.role === 'caller' ? 'agent' : 'caller';
            const targetClients = clients[targetRole];
            
            targetClients.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                  type: 'tts_ready',
                  audioUrl: ttsResult.audioUrl,
                  text: translationResult.translatedText
                }));
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('Error processing audio chunk:', error);
    }
  }
}

function getTargetLanguage(sourceLanguage) {
  return sourceLanguage === 'marathi' ? 'spanish' : 'marathi';
}

async function connectToASRService() {
  // Mock ASR service connection
  // In real implementation, this would connect to the ASR microservice
  console.log('Connecting to ASR service...');
  services.asr = { connected: true };
  return Promise.resolve();
}

async function processASR(audioData, language) {
  // Mock ASR processing
  // In real implementation, this would call the ASR microservice
  console.log(`Processing ASR for ${language}`);
  
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        text: language === 'marathi' ? 'नमस्कार, मला मदत हवी आहे' : 'Hola, necesito ayuda',
        confidence: 0.95
      });
    }, 1000);
  });
}

async function processTranslation(text, sourceLanguage, targetLanguage) {
  // Mock translation processing
  console.log(`Translating from ${sourceLanguage} to ${targetLanguage}: ${text}`);
  
  return new Promise((resolve) => {
    setTimeout(() => {
      const translations = {
        'marathi-spanish': 'Hola, necesito ayuda',
        'spanish-marathi': 'नमस्कार, मला मदत हवी आहे'
      };
      
      resolve({
        translatedText: translations[`${sourceLanguage}-${targetLanguage}`] || 'Translation not available',
        confidence: 0.90
      });
    }, 500);
  });
}

async function processTTS(text, language) {
  // Mock TTS processing
  console.log(`Generating TTS for ${language}: ${text}`);
  
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        audioUrl: '/api/tts/audio/' + Date.now() + '.wav',
        duration: 2000
      });
    }, 800);
  });
}

function sendHealthCheck(ws) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'health_check',
      services: {
        websocket: true,
        webrtc: services.sfu !== null,
        asr: services.asr !== null,
        translator: services.translator !== null,
        tts: services.tts !== null
      }
    }));
  }
}

// Heartbeat to keep connections alive
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      return ws.terminate();
    }
    
    ws.isAlive = false;
    ws.ping();
    
    // Send periodic health checks
    sendHealthCheck(ws);
  });
}, 30000);

wss.on('close', () => {
  clearInterval(interval);
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Lingua Service Desk backend running on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
});