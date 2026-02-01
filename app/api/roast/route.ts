import { NextResponse } from "next/server";

const GROQ_API_KEY = process.env.GROQ_API_KEY;

export async function POST(req: Request) {
  try {
    const { audio, challengeText } = await req.json();
    
    if (!audio) {
      return NextResponse.json({ error: "no audio. -10k aura." }, { status: 400 });
    }

    if (!GROQ_API_KEY) {
      console.error("CRITICAL: GROQ_API_KEY is missing from environment variables.");
      return NextResponse.json({ error: "server config cooked." }, { status: 500 });
    }

    // --- STEP 1: TRANSCRIPTION (WHISPER V3) ---
    // Convert base64 to buffer and then to a Blob for compatibility
    const audioBuffer = Buffer.from(audio, 'base64');
    const formData = new FormData();
    
    // We create a blob and append it as a file named 'file.webm'
    const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });
    formData.append("file", audioBlob, "recording.webm");
    formData.append("model", "whisper-large-v3");

    const transcribeRes = await fetch("[https://api.groq.com/openai/v1/audio/transcriptions](https://api.groq.com/openai/v1/audio/transcriptions)", {
      method: "POST",
      headers: { "Authorization": `Bearer ${GROQ_API_KEY}` },
      body: formData,
    });

    if (!transcribeRes.ok) {
      const errorData = await transcribeRes.json();
      console.error("Whisper Error:", errorData);
      return NextResponse.json({ error: "whisper failed to hear you." }, { status: 500 });
    }

    const transcribeData = await transcribeRes.json();
    const userSpeech = transcribeData.text || "...";

    // --- STEP 2: THE PERSONALIZED ROAST (LLAMA 3.3 70B) ---
    const chatRes = await fetch("[https://api.groq.com/openai/v1/chat/completions](https://api.groq.com/openai/v1/chat/completions)", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.8,
        max_completion_tokens: 400,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `
              ## IDENTITY
              you are a high-end digital critic. lowercase only. sharp, personal, and unimpressed. 
              you target gen z in india and the usa. you don't yap, you deliver "reads."

              ## MISSION
              analyze the contrast between the challenge: "${challengeText}" 
              and what they actually said: "${userSpeech}".
              
              ## ROAST PROTOCOL (STRICT)
              1. THE HOOK: pick ONE word they fumbled or said weirdly. ALL CAPS.
              2. THE ATTACK: roast the CONTENT of what they said + the ACCENT. 
              3. LENGTH: exactly 2 punchy sentences.
              4. LINGUAL MIX: use slang (aura, locked in, pookie, crash out, based).
              5. HERITAGE: 3 REAL countries ONLY (e.g., India, USA, UK).

              ## JSON SCHEMA
              {
                "transcription": "${userSpeech}",
                "heritage": [
                  { "country": "India", "percentage": 60 },
                  { "country": "USA", "percentage": 30 },
                  { "country": "UK", "percentage": 10 }
                ],
                "roast": "WORD! your personal roast here.",
                "badge": "2-word savage title",
                "celebrity": "celebrity + 2026 failure situation"
              }
            `
          }
        ],
      }),
    });

    if (!chatRes.ok) {
      const errorData = await chatRes.json();
      console.error("Llama Error:", errorData);
      return NextResponse.json({ error: "llama is refusing to roast." }, { status: 500 });
    }

    const chatData = await chatRes.json();
    const content = chatData.choices[0].message.content;

    try {
      const finalResult = JSON.parse(content);
      return NextResponse.json(finalResult);
    } catch (parseError) {
      console.error("JSON Parse Error:", content);
      return NextResponse.json({ error: "AI output format cooked." }, { status: 500 });
    }

  } catch (error: any) {
    console.error("Final Catch-all Error:", error);
    return NextResponse.json({ error: "server cooked: " + error.message }, { status: 500 });
  }
}