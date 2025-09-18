// app/api/token/route.ts - Ephemeral token approach (alternative)
import { NextResponse } from "next/server";
export const runtime = "nodejs";

export async function GET() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error("OPENAI_API_KEY environment variable is not set");
    return NextResponse.json(
      { error: "Missing OPENAI_API_KEY environment variable" },
      { status: 500 }
    );
  }

  if (apiKey === "your_openai_api_key_here") {
    console.error("OPENAI_API_KEY is set to placeholder value");
    return NextResponse.json(
      { error: "Please set a valid OPENAI_API_KEY in your .env file" },
      { status: 500 }
    );
  }

  const sessionConfig = {
    session: {
      type: "realtime",
      model: "gpt-realtime",
      audio: {
        output: {
          voice: "coral",
        },
      },
      modalities: ["audio", "text"],
      input_audio_transcription: { 
        model: "whisper-1" 
      },
      turn_detection: {
        type: "server_vad",
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 350,
      },
      instructions: "You are a professional interpreter. Translate the user's speech and respond in the target language.",
    },
  };

  try {
    const response = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sessionConfig),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      console.error("Token error:", data);
      return NextResponse.json(
        { error: data?.error?.message || data?.error || "Failed to create client secret" },
        { status: 500 }
      );
    }
    
    if (!data?.client_secret?.value) {
      console.error("No client_secret in response:", data);
      return NextResponse.json(
        { error: "Invalid response from OpenAI API - no client secret" },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Token generation error:", err);
    return NextResponse.json(
      { error: `Token generation failed: ${String(err?.message || err)}` },
      { status: 500 }
    );
  }
}