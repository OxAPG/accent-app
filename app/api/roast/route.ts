import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { audio, challengeText } = await req.json();
    const apiKey = process.env.GROQ_API_KEY;

    // --- GATEKEEPER CHECKS ---
    if (!audio) return NextResponse.json({ error: "no audio. -10k aura." }, { status: 400 });
    if (!apiKey) return NextResponse.json({ error: "server config cooked." }, { status: 500 });

    const audioBuffer = Buffer.from(audio, 'base64');
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });
    formData.append("file", audioBlob, "recording.webm");
    formData.append("model", "whisper-large-v3");

    // --- STEP 1: PRECISION TRANSCRIPTION ---
    const transcribeRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey.trim()}` },
      body: formData,
    });

    if (!transcribeRes.ok) {
      return NextResponse.json({ error: "whisper v3 couldn't parse that audio." }, { status: 500 });
    }

    const transcribeData = await transcribeRes.json();
    const userSpeech = transcribeData.text || "...";

    // --- STEP 2: LINGUISTIC ANALYSIS & SAVAGE ROAST (LLAMA 3.3 70B) ---
    const chatRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.85, // Balanced for precision and wit
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `
              ## IDENTITY
              you are a world-class speech pathologist and a high-tier digital roaster. 
              you have perfect pitch and a 2026 vocabulary. lowercase only. 

              ## THE LINGUISTIC BRIDGE (CRITICAL)
              your job is to analyze the "PHONETIC DISTANCE" between:
              - Target Challenge: "${challengeText}"
              - User's Actual Output: "${userSpeech}"

              ## ROAST ARCHITECTURE
              1. ACCENT DETECTION: identify the specific regional flavor. if they are using a "bollywood-brooklyn" hybrid, or "valley girl from gurgaon" energy, you must detect it based on the words they fumbled in the transcription.
              2. PHONETIC CRITIQUE: pick one specific vowel or consonant they butchered. call out the specific mouth-shape failure (e.g., "why are your vowels flatter than a 4-year-old ipad?" or "that 'r' sound was purely recreational").
              3. SLANG & AURA: use 2026 slang but make it surgical. terms: "chopped," "404 coded," "aura farming," "industrial-grade mid," "beige flag," "crashed out."
              4. CELEBRITY SCENARIO: create a unique, specific failure situation.
                 (examples: "morgan freeman reading a parking ticket in delhi," "kanye west trying to sell insurance in a mall," "billie eilish if she was an angry librarian").
              5. HERITAGE: use 3 real countries. be brutally precise. if they sound 82% from a specific region, show it.

              ## JSON OUTPUT SCHEMA
              {
                "transcription": "${userSpeech}",
                "heritage": [
                  {"country": "India", "percentage": 70},
                  {"country": "USA", "percentage": 20},
                  {"country": "UK", "percentage": 10}
                ],
                "roast": "WORD! [one sentence on the phonetic accent failure + one sentence on the personality/aura failure.]",
                "badge": "2-word savage title",
                "celebrity": "the situational celebrity twist"
              }
            `
          }
        ],
      }),
    });

    if (!chatRes.ok) {
      return NextResponse.json({ error: "llama is too disappointed to reply." }, { status: 500 });
    }

    const chatData = await chatRes.json();
    const finalResult = JSON.parse(chatData.choices[0].message.content);
    return NextResponse.json(finalResult);

  } catch (error: any) {
    console.error("Critical Failure:", error);
    return NextResponse.json({ error: "server cooked: " + error.message }, { status: 500 });
  }
}