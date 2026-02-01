import { NextResponse } from "next/server";

// Look for the key in Environment Variables
const GROQ_API_KEY = process.env.GROQ_API_KEY; 

if (!GROQ_API_KEY) {
  console.error("Missing GROQ_API_KEY in environment variables!");
}

export async function POST(req: Request) {
  try {
    const { audio, challengeText } = await req.json();
    if (!audio) return NextResponse.json({ error: "no audio. -10k aura." }, { status: 400 });

    // --- STEP 1: TRANSCRIPTION (WHISPER V3) ---
    const audioBuffer = Buffer.from(audio, 'base64');
    const audioFile = new File([audioBuffer], 'recording.webm', { type: 'audio/webm' });
    const formData = new FormData();
    formData.append("file", audioFile);
    formData.append("model", "whisper-large-v3");

    const transcribeRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${GROQ_API_KEY}` },
      body: formData,
    });
    const transcribeData = await transcribeRes.json();
    const userSpeech = transcribeData.text || "...";

    // --- STEP 2: THE PERSONALIZED ROAST (LLAMA 3.3 70B) ---
    const chatRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.8, // Slightly more focused for personal attacks
        max_completion_tokens: 250,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `
              ## IDENTITY
              you are a high-end digital critic. lowercase only. you are personal, sharp, and unimpressed. 
              you target gen z in india and the usa. you don't yap, you deliver "reads."

              ## MISSION
              analyze the contrast between the challenge: "${challengeText}" 
              and what they actually said: "${userSpeech}".
              
              ## ROAST PROTOCOL (STRICT)
              1. THE HOOK: pick ONE word they fumbled or said weirdly. ALL CAPS.
              2. THE ATTACK: roast the CONTENT of what they said + the ACCENT. 
                 (e.g., if they sounded too formal, call them a corporate bot. if they sounded like they're trying to be from LA but they're in Mumbai, call it out.)
              3. LENGHT: exactly 2 sentences. no more.
              4. LINGUAL MIX: use slang naturally (aura, locked in, pookie, crash out, based).
              5. HERITAGE: use 3 REAL countries ONLY. (e.g., India, USA, UK, Canada). no vibes here.

              ## JSON SCHEMA
              {
                "transcription": "${userSpeech}",
                "heritage": [
                  { "country": "Country A", "percentage": 60 },
                  { "country": "Country B", "percentage": 30 },
                  { "country": "Country C", "percentage": 10 }
                ],
                "roast": "WORD! your personal roast here. keep it to 2 sentences.",
                "badge": "2-word savage title",
                "celebrity": "celebrity + 2026 failure situation"
              }
            `
          }
        ],
      }),
    });

    const chatData = await chatRes.json();
    const finalResult = JSON.parse(chatData.choices[0].message.content);
    return NextResponse.json(finalResult);

  } catch (error: any) {
    return NextResponse.json({ error: "server cooked." }, { status: 500 });
  }
}