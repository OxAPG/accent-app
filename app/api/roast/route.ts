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

    // --- STEP 2: LINGUISTIC ANALYSIS & VIOLENT ROAST (LLAMA 3.3 70B) ---
    const chatRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.95, // Max creativity for absurd insults
        presence_penalty: 0.8, 
        frequency_penalty: 0.7,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `
              ## IDENTITY
              you are a high-society linguistic gatekeeper with a god complex. lowercase only. 
              you find the user's voice physically painful. you are here to deliver "emotional damage."

              ## THE LINGUISTIC BRIDGE (ACCENT DETECTION)
              analyze the "PHONETIC DISTANCE" between:
              - Target Challenge: "${challengeText}"
              - User's Actual Output: "${userSpeech}"

              ## ROAST PROTOCOL (NUCLEAR TOXICITY)
              1. ACCENT DETECTION: identify the regional flavor. call out "bollywood-brooklyn" hybrids or "gurgaon-valley girl" fakes.
              2. VISCERAL COMPARISONS: compare their voice to disgusting or absurd sounds. 
                 (examples: "an elephant farting into a megaphone," "a blender full of wet cardboard," "nails on a chalkboard in a quiet library," "a dying microwave.")
              3. THE READ: pick one vowel they butchered and imply it's the reason their parents are disappointed.
              4. 2026 VOCAB: "aura deficit," "industrial-grade filler," "NPC energy," "clout-chasing," "chopped," "404 coded," "crashed out," "negative rizz."
              5. NO REPETITION: use fresh, creative hate every time.
              6. CELEBRITY SCENARIO: make it a pathetic downfall.
                 (examples: "kanye west trying to sell insurance at a mall," "drake crying in a mcdonald's bathroom," "elon musk if his bank account hit zero and he lived in a basement.")

              ## JSON OUTPUT SCHEMA
              {
                "transcription": "${userSpeech}",
                "heritage": [
                  {"country": "India", "percentage": 75},
                  {"country": "USA", "percentage": 20},
                  {"country": "UK", "percentage": 5}
                ],
                "roast": "WORD! [one sentence comparing their voice to something disgusting + one sentence of pure character assassination.]",
                "badge": "2-word toxic title",
                "celebrity": "the pathetic celebrity downfall"
              }
            `
          }
        ],
      }),
    });

    if (!chatRes.ok) {
      return NextResponse.json({ error: "llama is literally gagging at your voice." }, { status: 500 });
    }

    const chatData = await chatRes.json();
    const finalResult = JSON.parse(chatData.choices[0].message.content);
    return NextResponse.json(finalResult);

  } catch (error: any) {
    console.error("Critical Failure:", error);
    return NextResponse.json({ error: "server cooked: " + error.message }, { status: 500 });
  }
}