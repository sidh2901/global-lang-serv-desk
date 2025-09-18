import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("audio/") && !contentType.includes("octet-stream")) {
      return NextResponse.json({ error: "Send raw audio in the request body." }, { status: 400 });
    }

    const ab = await req.arrayBuffer();
    // Create a web-standard File for the SDK (supported in Node >=18 in Next.js routes)
    const file = new File([ab], "audio.webm", { type: "audio/webm" });

    const result = await openai.audio.transcriptions.create({
      model: "gpt-4o-mini-transcribe",
      file,
      // language: "auto", // optional: or set "mr" (Marathi), "es" (Spanish), etc. for a hint
    });

    return NextResponse.json({ text: result.text ?? "" });
  } catch (err: any) {
    console.error("STT error:", err?.message || err);
    return NextResponse.json({ error: "STT failed" }, { status: 500 });
  }
}
