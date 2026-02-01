import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { audio, challengeText } = await req.json();
    const apiKey = process.env.GROQ_API_KEY;

    // --- SECURITY & VALIDATION ---
    if (!audio) return NextResponse.json({ error: "no audio. -10k aura." }, { status: 400 });
    if (!apiKey) return NextResponse.json({ error: "server config cooked. add your key." }, { status: 500 });

    const audioBuffer = Buffer.from(audio, 'base64');
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });
    formData.append("file", audioBlob, "recording.webm");
    formData.append("model", "whisper-large-v3");

    // --- STEP 1: TRANSCRIPTION (WHISPER V3) ---
    const transcribeRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey.trim()}` },
      body: formData,
    });

    if (!transcribeRes.ok) {
      return NextResponse.json({ error: "AI couldn't parse that mumble." }, { status: 500 });
    }

    const transcribeData = await transcribeRes.json();
    const userSpeech = transcribeData.text || "...";

    // --- STEP 2: THE REFINED ROAST (LLAMA 3.3 70B) ---
    const chatRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.92, // High enough for creativity, low enough for precision
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `
              ## IDENTITY
              you are a high-tier digital critic and a polyglot linguistic anthropologist. 
              you are sharp, observant, and unimpressed by "mid" attempts at charisma. 
              lowercase only. no yap. 

              ## MISSION
              analyze the contrast between the challenge: "${challengeText}" 
              and what the user actually said: "${userSpeech}".

              ## LINGUISTIC ANALYSIS PROTOCOL (STRICT)
              1. PHONETIC AUDIT: find exactly where their accent "crashed out." did they flatten their vowels? did they miss a glottal stop? did they sound like they're reading a teleprompter for the first time?
              2. 2026 SLANG DICTIONARY: 
                 - use "chopped" for bad delivery.
                 - use "404 coded" for people acting clueless.
                 - use "aura farming" for trying too hard to sound cool.
                 - use "beige flag" for sounding boring/generic.
                 - use "choppelganger" if they sound like a budget version of someone famous.
                 - use "zesty" if they are being overly dramatic.
                 - avoid overusing "skibidi" or "rizz" unless used ironically to mock them.

              ## ROAST PROTOCOL (Savage Mode)
              1. THE HIT: target their vocal frequency. if they sound like they're in a mumbai call center trying to be from brooklyn, call it out. 
              2. THE ATTACK: exactly 2 sentences. one for the accent/voice, one for the general "beige" energy they're giving off.
              3. CELEBRITY TWIST: this must be a "scenario-based" failure.
                 (examples: "morgan freeman if he was reading a menu at a local dhaba," "justin bieber after being rejected from a startup incubator," "donald trump if he was a yoga instructor in goa").
              4. HERITAGE: use 3 real countries. be brutally honest about the accent mix.

              ## JSON OUTPUT
              {
                "transcription": "${userSpeech}",
                "heritage": [
                  {"country": "India", "percentage": 65},
                  {"country": "USA", "percentage": 25},
                  {"country": "UK", "percentage": 10}
                ],
                "roast": "WORD! [Your two sentences of surgical linguistic destruction.]",
                "badge": "2-word savage title",
                "celebrity": "the situational celebrity comparison"
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
    console.error("Server Error:", error);
    return NextResponse.json({ error: "server cooked: " + error.message }, { status: 500 });
  }
}