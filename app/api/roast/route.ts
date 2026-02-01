import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { audio, challengeText } = await req.json();
    const apiKey = process.env.GROQ_API_KEY;

    if (!audio) return NextResponse.json({ error: "no audio. -10k aura." }, { status: 400 });
    if (!apiKey) return NextResponse.json({ error: "server config cooked." }, { status: 500 });

    const audioBuffer = Buffer.from(audio, 'base64');
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });
    formData.append("file", audioBlob, "recording.webm");
    formData.append("model", "whisper-large-v3");
    // We tell Whisper to be literal to catch accent artifacts
    formData.append("prompt", "Transcribe exactly as spoken, including stutters or phonetic variations.");

    const transcribeRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey.trim()}` },
      body: formData,
    });

    const transcribeData = await transcribeRes.json();
    const userSpeech = transcribeData.text || "...";

    // --- STEP 2: THE LINGUISTIC DETECTIVE ENGINE ---
    const chatRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.8, // Lowered slightly for more accurate detection logic
        presence_penalty: 0.8,
        frequency_penalty: 0.7,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `
              ## IDENTITY
              you are a master linguistic forensic scientist and a toxic digital critic. 
              you detect regional accents with surgical precision. lowercase only.

              ## THE ANALYSIS ENGINE (NO RANDOMIZING)
              analyze the "transcription" for these specific regional markers:
              1. PHONETIC ARTIFACTS: look for swapped consonants (v/w, t/d), vowel length (short vs long 'a'), and rhoticity (do they drop the 'r'?).
              2. SYNTAX MARKERS: did they add regional filler words or use specific phrasing (e.g., "innit," "na," "like," "actually")?
              3. RHYTHM: compare "${challengeText}" to "${userSpeech}". if they skipped words or merged them, it indicates a specific mother-tongue influence.

              ## HERITAGE CALCULATION
              - do not give 70/20/10 by default. 
              - if they sound purely local, give 95%. 
              - if they are a "try-hard" hybrid, split it (e.g., 60% India, 30% USA, 10% UK).

              ## ROAST PROTOCOL (NUCLEAR TOXICITY)
              - target the specific phonetic failure you detected.
              - use visceral comparisons (e.g., "your 'r' sounds like a dying lawnmower," "vowels flatter than a dropped pancake.")
              - use 2026 slang: "chopped," "aura deficit," "404 coded," "crashed out."
              - celebrity downfall: (e.g., "drake crying in a mcdonalds," "elon musk if he lost it all and lived in a sewer").

              ## JSON OUTPUT
              {
                "transcription": "${userSpeech}",
                "heritage": [
                  {"country": "CountryName", "percentage": 0},
                  {"country": "CountryName", "percentage": 0},
                  {"country": "CountryName", "percentage": 0}
                ],
                "roast": "WORD! [one sentence on the phonetic regional failure + one visceral insult.]",
                "badge": "2-word toxic title",
                "celebrity": "creative situational failure"
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
    return NextResponse.json({ error: "server cooked: " + error.message }, { status: 500 });
  }
}