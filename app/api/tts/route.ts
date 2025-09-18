import { NextRequest } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: NextRequest) {
  try {
    const { text, voice = "coral", format = "mp3", instructions } = await req.json();

    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "Field 'text' is required." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const response = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice,                     // alloy | ash | ballad | coral | echo | fable | nova | onyx | sage | shimmer
      input: text,
      response_format: format,   // mp3 | wav | opus | flac | aac | pcm
      instructions,              // optional prosody guidance
    });

    const arrayBuffer = await response.arrayBuffer();

    // Pick correct content type header
    const ct =
      format === "wav" ? "audio/wav"
      : format === "opus" ? "audio/ogg"
      : format === "flac" ? "audio/flac"
      : format === "aac" ? "audio/aac"
      : format === "pcm" ? "audio/L16"
      : "audio/mpeg"; // mp3 default

    return new Response(Buffer.from(arrayBuffer), { headers: { "Content-Type": ct } });
  } catch (err: any) {
    console.error("TTS error:", err?.message || err);
    return new Response(JSON.stringify({ error: "TTS failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
