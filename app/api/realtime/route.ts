// app/api/realtime/route.ts
import { NextResponse } from "next/server";
export const runtime = "nodejs";

export async function GET() {
  const key = process.env.OPENAI_API_KEY!;
  const model = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime";

  if (!key) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
  }

  try {
    const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  "OpenAI-Beta": "realtime=v1",     // <-- REQUIRED
},

      body: JSON.stringify({
        model,
        modalities: ["audio", "text"],
        voice: "alloy",
        output_audio_format: "pcm16",
        input_audio_transcription: { model: "gpt-4o-mini-transcribe" },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 350,
        },
        // We’ll overwrite instructions from the client as users switch languages/roles.
        instructions: "Translate only. No extra words.",
      }),
    });

    const text = await r.text();
    if (!r.ok) {
      console.error("Realtime session error:", text);
      return NextResponse.json({ error: text || "Failed to create session" }, { status: 500 });
    }

    // Return the session JSON as-is (contains client_secret.value & model)
    return new NextResponse(text, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Realtime session throw:", e);
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
