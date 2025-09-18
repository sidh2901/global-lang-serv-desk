import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: NextRequest) {
  try {
    const { text, targetLang } = await req.json();

    if (!text || !targetLang) {
      return NextResponse.json(
        { error: "Both 'text' and 'targetLang' are required." },
        { status: 400 }
      );
    }

    const chat = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `You are a professional interpreter. Translate the user's message to ${targetLang}. 
Return only the translation with natural tone and correct punctuation.`,
        },
        { role: "user", content: text },
      ],
    });

    const translated = chat.choices?.[0]?.message?.content?.trim() ?? "";
    return NextResponse.json({ translated });
  } catch (err: any) {
    console.error("Translate error:", err?.message || err);
    return NextResponse.json({ error: "Translate failed" }, { status: 500 });
  }
}
