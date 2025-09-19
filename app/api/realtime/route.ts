// app/api/realtime/route.ts - Unified interface approach
import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
  }

  if (apiKey === "your_openai_api_key_here") {
    console.error("OPENAI_API_KEY is set to placeholder value");
    return NextResponse.json(
      { error: "Please set a valid OPENAI_API_KEY in your .env file" },
      { status: 500 }
    );
  }

  if (apiKey === "your_actual_openai_api_key_here") {
    console.error("OPENAI_API_KEY is still set to placeholder value");
    return NextResponse.json(
      { error: "Please replace the placeholder OPENAI_API_KEY with your actual OpenAI API key" },
      { status: 500 }
    );
  }

  try {
    // Get SDP from request body
    const sdp = await req.text();
    
    const sessionConfig = JSON.stringify({
      session: {
        type: "realtime",
        model: "gpt-4o-mini",
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
    });

    // Create FormData for multipart request
    const formData = new FormData();
    formData.set("sdp", sdp);
    formData.set("session", sessionConfig);

    const response = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Realtime session error:", errorText);
      return NextResponse.json({ error: errorText }, { status: response.status });
    }

    // Return the SDP response
    const answerSdp = await response.text();
    return new NextResponse(answerSdp, {
      status: 200,
      headers: { "Content-Type": "application/sdp" },
    });
  } catch (e: any) {
    console.error("Realtime session error:", e);
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}