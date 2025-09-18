// app/api/token/route.ts
import { NextResponse } from "next/server";
export const runtime = "nodejs";

export async function GET() {
  const apiKey = process.env.OPENAI_API_KEY;
  const model =
    process.env.OPENAI_REALTIME_MODEL || "gpt-realtime"; // per docs

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing OPENAI_API_KEY" },
      { status: 500 }
    );
  }

  try {
    // This matches the docs: request a client_secret (ephemeral token)
    const resp = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "OpenAI-Beta": "realtime=v1",
        },
        body: JSON.stringify({
          session: {
            type: "realtime",
            model,
            // Default voice; can be updated later via data channel session.update
            audio: { output: { voice: "alloy" } },
            // Keep the model focused on translation; we’ll overwrite at connect time as well
            instructions:
              "You are a simultaneous interpreter. Transcribe incoming speech and speak the translation. No extra words.",
          },
        }),
      }
    );

    const data = await resp.json();
    if (!resp.ok) {
      console.error("Token error:", data);
      return NextResponse.json(
        { error: data?.error || "Failed to create client secret" },
        { status: 500 }
      );
    }
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Token generation error:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 }
    );
  }
}
