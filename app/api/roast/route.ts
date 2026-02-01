import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { audio, challengeText } = await req.json();
    const apiKey = process.env.GROQ_API_KEY;

    // 1. Safety Checks
    if (!audio) return NextResponse.json({ error: "No audio data received." }, { status: 400 });
    if (!apiKey) return NextResponse.json({ error: "Server API key is missing." }, { status: 500 });

    // 2. Prepare Audio Data
    const audioBuffer = Buffer.from(audio, 'base64');
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });
    formData.append("file", audioBlob, "recording.webm");
    formData.append("model", "whisper-large-v3");

    // 3. Transcription Call (WHISPER)
    // Clean, hardcoded URL to prevent parsing errors
    const transcriptionURL = "https://api.groq.com/openai/v1/audio/transcriptions";
    
    const transcribeRes = await fetch(transcriptionURL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey.trim()}` },
      body: formData,
    });

    if (!transcribeRes.ok) {
      const err = await transcribeRes.json();
      console.error("Whisper Error:", err);
      return NextResponse.json({ error: "AI couldn't hear you clearly." }, { status: 500 });
    }

    const transcribeData = await transcribeRes.json();
    const userSpeech = transcribeData.text || "...";

    // 4. Roast Call (LLAMA 3.3)
    const chatURL = "https://api.groq.com/openai/v1/chat/completions";
    
    const chatRes = await fetch(chatURL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.8,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `you are a digital critic. roast the user's accent and content based on:
              challenge: "${challengeText}"
              actual: "${userSpeech}"
              
              rules:
              - exactly 2 sentences.
              - 3 real countries for heritage.
              - use slang like aura, based, mid.
              - return JSON only.
              
              {
                "transcription": "${userSpeech}",
                "heritage": [{"country": "India", "percentage": 70}, {"country": "USA", "percentage": 20}, {"country": "UK", "percentage": 10}],
                "roast": "WORD! your roast here.",
                "badge": "2-word title",
                "celebrity": "celebrity name"
              }`
          }
        ],
      }),
    });

    if (!chatRes.ok) {
      return NextResponse.json({ error: "AI is too busy to roast right now." }, { status: 500 });
    }

    const chatData = await chatRes.json();
    const finalResult = JSON.parse(chatData.choices[0].message.content);
    
    return NextResponse.json(finalResult);

  } catch (error: any) {
    console.error("Critical Error:", error);
    return NextResponse.json({ error: "Server Cooked: " + error.message }, { status: 500 });
  }
}