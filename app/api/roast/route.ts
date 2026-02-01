import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { audio, challengeText } = await req.json();
    const apiKey = process.env.GROQ_API_KEY;

    // --- GATEKEEPER CHECKS ---
    if (!audio) {
      return NextResponse.json({ error: "no audio. -10k aura." }, { status: 400 });
    }
    if (!apiKey) {
      return NextResponse.json({ error: "server config cooked. check vercel env vars." }, { status: 500 });
    }

    // --- STEP 1: PREPARE AUDIO FOR WHISPER ---
    const audioBuffer = Buffer.from(audio, 'base64');
    const formData = new FormData();
    // We use a Blob to satisfy the 'File' requirement in the Groq API
    const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });
    formData.append("file", audioBlob, "recording.webm");
    formData.append("model", "whisper-large-v3");

    // --- STEP 2: SPEECH-TO-TEXT (WHISPER) ---
    const transcribeRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey.trim()}` },
      body: formData,
    });

    if (!transcribeRes.ok) {
      const errBody = await transcribeRes.json();
      console.error("Whisper Error:", errBody);
      return NextResponse.json({ error: "whisper couldn't decode your mumbles." }, { status: 500 });
    }

    const transcribeData = await transcribeRes.json();
    const userSpeech = transcribeData.text || "...";

    // --- STEP 3: THE SAVAGE AI CRITIC (LLAMA 3.3 70B) ---
    const chatRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.95, // Maxed out for ultimate creativity
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `
              ## IDENTITY
              you are an elite linguistic assassin and gen-z trendsetter. lowercase only. 
              you have zero tolerance for "mid" energy, corporate accents, or fumbled words.

              ## THE DATA
              1. the challenge the user tried to read: "${challengeText}"
              2. what the user actually sounded like: "${userSpeech}"

              ## ROAST PROTOCOL (STRICT)
              1. THE PHONETIC READ: start by picking ONE word they absolutely destroyed. call out their accent specifically (e.g., "trying too hard to sound like an LA influencer but you're giving customer support").
              2. THE VIBE: use 2026 brainrot slang (negative aura, skibidi, crash out, locked in, based, rizzless, cooked).
              3. CELEBRITY TWIST: this MUST be a weird, specific comparison.
                 (good examples: "batman if he moved to gurgaon," "justin bieber after a double shift at a momo stall," "lana del rey but she's actually just sad in ohio").
              4. LENGTH: exactly 2 sentences. make them hurt.
              5. HERITAGE: 3 REAL countries only (e.g., India, USA, UK, Canada). adjust percentages based on the accent you heard.

              ## JSON OUTPUT SCHEMA
              {
                "transcription": "${userSpeech}",
                "heritage": [
                  {"country": "India", "percentage": 65},
                  {"country": "USA", "percentage": 25},
                  {"country": "UK", "percentage": 10}
                ],
                "roast": "WORD! your 2-sentence personal attack here.",
                "badge": "2-word savage title",
                "celebrity": "the creative celebrity comparison"
              }
            `
          }
        ],
      }),
    });

    if (!chatRes.ok) {
      const chatErr = await chatRes.json();
      console.error("Llama Error:", chatErr);
      return NextResponse.json({ error: "llama is literally speechless at your voice." }, { status: 500 });
    }

    const chatData = await chatRes.json();
    const finalResult = JSON.parse(chatData.choices[0].message.content);
    
    // Final return to the frontend
    return NextResponse.json(finalResult);

  } catch (error: any) {
    console.error("Top-Level Crash:", error);
    return NextResponse.json({ error: "server cooked: " + error.message }, { status: 500 });
  }
}