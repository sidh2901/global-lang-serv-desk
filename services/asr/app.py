#!/usr/bin/env python3
"""
ASR Service using Whisper/faster-whisper
Provides WebSocket endpoint for streaming speech-to-text
"""

import asyncio
import json
import logging
import os
import tempfile
from typing import Dict, Any
import uuid
import wave

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="ASR Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ASRService:
    def __init__(self):
        self.model = None
        self.device = "cpu"  # Use CPU for PoC
        self.supported_languages = {"marathi": "mr", "spanish": "es"}
        
    async def initialize(self):
        """Initialize Whisper model"""
        try:
            # Try to import faster_whisper, fallback to whisper
            try:
                from faster_whisper import WhisperModel
                self.model = WhisperModel("base", device=self.device)
                logger.info("Loaded faster-whisper model")
            except ImportError:
                logger.warning("faster-whisper not available, using openai-whisper")
                import whisper
                self.model = whisper.load_model("base")
                logger.info("Loaded openai-whisper model")
                
        except Exception as e:
            logger.error(f"Failed to load ASR model: {e}")
            # Use mock model for development
            self.model = "mock"
            logger.info("Using mock ASR model")

    async def transcribe_audio(self, audio_data: bytes, language: str = None) -> Dict[str, Any]:
        """Transcribe audio data to text"""
        try:
            if self.model == "mock":
                # Mock transcription for development
                await asyncio.sleep(0.5)  # Simulate processing time
                mock_texts = {
                    "marathi": "नमस्कार, मला मदत हवी आहे",
                    "spanish": "Hola, necesito ayuda"
                }
                return {
                    "text": mock_texts.get(language, "Hello, I need help"),
                    "confidence": 0.95,
                    "language": language
                }
            
            # Save audio data to temporary file
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
                temp_file.write(audio_data)
                temp_file_path = temp_file.name

            try:
                if hasattr(self.model, 'transcribe'):
                    # Using faster-whisper
                    segments, info = self.model.transcribe(
                        temp_file_path,
                        language=self.supported_languages.get(language),
                        beam_size=5
                    )
                    
                    text = " ".join([segment.text for segment in segments])
                    confidence = sum([segment.avg_logprob for segment in segments]) / len(list(segments))
                else:
                    # Using openai-whisper
                    result = self.model.transcribe(
                        temp_file_path,
                        language=self.supported_languages.get(language)
                    )
                    text = result["text"]
                    confidence = 0.9  # Approximate confidence
                
                return {
                    "text": text.strip(),
                    "confidence": abs(confidence) if confidence else 0.9,
                    "language": language
                }
                
            finally:
                # Clean up temporary file
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
                    
        except Exception as e:
            logger.error(f"ASR transcription error: {e}")
            return {
                "text": "",
                "confidence": 0.0,
                "language": language,
                "error": str(e)
            }

# Global ASR service instance
asr_service = ASRService()

@app.on_event("startup")
async def startup_event():
    await asr_service.initialize()

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "asr",
        "model_loaded": asr_service.model is not None,
        "supported_languages": list(asr_service.supported_languages.keys())
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    session_id = str(uuid.uuid4())
    logger.info(f"New ASR WebSocket connection: {session_id}")
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if data.get("type") == "transcribe":
                # Handle audio transcription request
                audio_data = data.get("audio_data")  # Base64 encoded audio
                language = data.get("language", "en")
                
                if not audio_data:
                    await websocket.send_json({
                        "type": "error",
                        "message": "No audio data provided"
                    })
                    continue
                
                # Decode base64 audio data
                import base64
                try:
                    decoded_audio = base64.b64decode(audio_data)
                except Exception as e:
                    await websocket.send_json({
                        "type": "error",
                        "message": f"Invalid audio data: {e}"
                    })
                    continue
                
                # Transcribe audio
                result = await asr_service.transcribe_audio(decoded_audio, language)
                
                await websocket.send_json({
                    "type": "transcription",
                    "session_id": session_id,
                    **result
                })
            
            elif data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
                
    except WebSocketDisconnect:
        logger.info(f"ASR WebSocket disconnected: {session_id}")
    except Exception as e:
        logger.error(f"ASR WebSocket error: {e}")
        await websocket.close()

if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8001,
        log_level="info"
    )