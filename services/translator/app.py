#!/usr/bin/env python3
"""
Translation Service using IndicTrans2 + NLLB or SeamlessM4T
Provides WebSocket endpoint for real-time translation
"""

import asyncio
import json
import logging
import os
from typing import Dict, Any, Optional
import uuid

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Translation Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TranslationService:
    def __init__(self):
        self.model = None
        self.device = "cpu"
        self.translation_mode = os.getenv("TRANSLATION_MODE", "pivot")  # pivot or direct
        
        # Language mappings
        self.language_codes = {
            "marathi": "mar_Deva",  # IndicTrans2 format
            "spanish": "spa_Latn",
            "english": "eng_Latn"
        }
        
    async def initialize(self):
        """Initialize translation model"""
        try:
            if self.translation_mode == "direct":
                # Try to load SeamlessM4T for direct translation
                try:
                    # This would require seamless_communication package
                    # from seamless_communication.models.inference import Translator
                    # self.model = Translator("seamlessM4T_large", "vocoder_36langs", self.device)
                    logger.info("SeamlessM4T not available, falling back to pivot mode")
                    self.translation_mode = "pivot"
                except ImportError:
                    logger.warning("SeamlessM4T not available, using pivot translation")
                    self.translation_mode = "pivot"
            
            if self.translation_mode == "pivot":
                # Use mock models for PoC
                # In production, would load IndicTrans2 + NLLB
                logger.info("Using pivot translation mode (Marathi->English->Spanish)")
                self.model = "mock_pivot"
            
        except Exception as e:
            logger.error(f"Failed to load translation model: {e}")
            self.model = "mock"
            logger.info("Using mock translation model")

    async def translate_text(self, text: str, source_lang: str, target_lang: str) -> Dict[str, Any]:
        """Translate text between languages"""
        try:
            if not text.strip():
                return {
                    "translated_text": "",
                    "confidence": 0.0,
                    "source_language": source_lang,
                    "target_language": target_lang
                }
            
            if self.model == "mock" or self.model == "mock_pivot":
                # Mock translation with realistic delay
                await asyncio.sleep(0.3)
                
                mock_translations = {
                    ("marathi", "spanish"): {
                        "नमस्कार, मला मदत हवी आहे": "Hola, necesito ayuda",
                        "धन्यवाद": "Gracias",
                        "माफ करा": "Perdón",
                        "मला समजत नाही": "No entiendo"
                    },
                    ("spanish", "marathi"): {
                        "Hola, necesito ayuda": "नमस्कार, मला मदत हवी आहे",
                        "Gracias": "धन्यवाद",
                        "Perdón": "माफ करा",
                        "No entiendo": "मला समजत नाही"
                    }
                }
                
                translation_map = mock_translations.get((source_lang, target_lang), {})
                translated_text = translation_map.get(text, f"[Mock translation: {text}]")
                
                return {
                    "translated_text": translated_text,
                    "confidence": 0.92,
                    "source_language": source_lang,
                    "target_language": target_lang,
                    "translation_mode": self.translation_mode
                }
            
            # Real translation logic would go here
            if self.translation_mode == "pivot":
                # Marathi -> English -> Spanish or vice versa
                if source_lang == "marathi" and target_lang == "spanish":
                    # Marathi -> English -> Spanish
                    english_text = await self._translate_to_english(text, source_lang)
                    final_text = await self._translate_from_english(english_text, target_lang)
                elif source_lang == "spanish" and target_lang == "marathi":
                    # Spanish -> English -> Marathi
                    english_text = await self._translate_to_english(text, source_lang)
                    final_text = await self._translate_from_english(english_text, target_lang)
                else:
                    final_text = text  # No translation needed
                    
                return {
                    "translated_text": final_text,
                    "confidence": 0.88,
                    "source_language": source_lang,
                    "target_language": target_lang,
                    "translation_mode": "pivot"
                }
            else:
                # Direct translation using SeamlessM4T
                return await self._direct_translate(text, source_lang, target_lang)
                
        except Exception as e:
            logger.error(f"Translation error: {e}")
            return {
                "translated_text": text,  # Return original text on error
                "confidence": 0.0,
                "source_language": source_lang,
                "target_language": target_lang,
                "error": str(e)
            }

    async def _translate_to_english(self, text: str, source_lang: str) -> str:
        """Translate from source language to English"""
        # Mock implementation
        await asyncio.sleep(0.1)
        return f"[EN: {text}]"
    
    async def _translate_from_english(self, text: str, target_lang: str) -> str:
        """Translate from English to target language"""
        # Mock implementation
        await asyncio.sleep(0.1)
        return f"[{target_lang.upper()}: {text}]"
    
    async def _direct_translate(self, text: str, source_lang: str, target_lang: str) -> Dict[str, Any]:
        """Direct translation using SeamlessM4T"""
        # Would implement SeamlessM4T translation here
        await asyncio.sleep(0.2)
        return {
            "translated_text": f"[Direct {source_lang}->{target_lang}: {text}]",
            "confidence": 0.94,
            "source_language": source_lang,
            "target_language": target_lang,
            "translation_mode": "direct"
        }

# Global translation service instance
translation_service = TranslationService()

@app.on_event("startup")
async def startup_event():
    await translation_service.initialize()

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "translator",
        "model_loaded": translation_service.model is not None,
        "translation_mode": translation_service.translation_mode,
        "supported_languages": list(translation_service.language_codes.keys())
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    session_id = str(uuid.uuid4())
    logger.info(f"New Translation WebSocket connection: {session_id}")
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if data.get("type") == "translate":
                text = data.get("text", "")
                source_lang = data.get("source_language", "en")
                target_lang = data.get("target_language", "en")
                
                if not text.strip():
                    await websocket.send_json({
                        "type": "error",
                        "message": "No text provided for translation"
                    })
                    continue
                
                # Perform translation
                result = await translation_service.translate_text(text, source_lang, target_lang)
                
                await websocket.send_json({
                    "type": "translation",
                    "session_id": session_id,
                    **result
                })
            
            elif data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
                
    except WebSocketDisconnect:
        logger.info(f"Translation WebSocket disconnected: {session_id}")
    except Exception as e:
        logger.error(f"Translation WebSocket error: {e}")
        await websocket.close()

if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8002,
        log_level="info"
    )