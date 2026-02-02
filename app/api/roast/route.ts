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
        temperature: 0.9,
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
              You are a world-class celebrity roaster and expert dialectologist. 
              Your goal: Analyze the provided transcript to detect the user's REAL accent and deliver a brutal, high-energy celebrity-style roast.

              ## THE LINGUISTIC BRIDGE (ACCENT DETECTION)
              analyze the "PHONETIC DISTANCE" between:
              - Target Challenge: "${challengeText}"
              - User's Actual Output: "${userSpeech}"


              1. ACCENT DETECTION LOGIC:[this is important data focus on words and accent properly then like result find patterns used by ppl of countries compare then give results u cn even give in any number dont have to round off]
              1. **Phonetic Analysis**: Look for specific "Whisper artifacts" (e.g., "v" becoming "b", "th" becoming "z" or "d", dropped "s" at ends of words).
              2. **Grammar Fingerprinting**: Identify sentence structures unique to specific regions.
              3. **Statistical Weighting**: Assign a percentage match to 3 different countries based on these linguistic markers. Ensure the total equals exactly 100%.
             ## ROAST ARCHITECTURE (NO REPETITION PROTOCOL)
              1. ACCENT FINGERPRINT: detect the regional flavor (e.g., "tier-3 city kid trying to sound like a central london drill rapper," "delhi uncle energy on a zoom call").
              2. FORBIDDEN ANALOGIES: DO NOT use "cat in a blender," "dying lawnmower," or "elephant fart." these are mid and played out. 
              3. VISCERAL COMPARISONS: find a unique, disgusting scenario for this specific voice. 
                 (dont copy paste examples just take inpiration from them and use better insults e.g., "sounds like a wet sponge being dragged across a dusty chalkboard," "your voice has the texture of lukewarm milk in a rusted tin can," "its giving 'stale cigarettes in a bowl of cereal' energy.")
              4. THE CHARACTER READ: connect the phonetic failure to their life failure.{these are just examples dont use them make something better than them and use those}
                 - "that 'v' sound is exactly why your group chats go silent when you text."
                 - "your vowels are so flat its no wonder you haven't seen a second date since 2023."
                 - "this accent is a 404-coded disaster; you have the charisma of a 'terms and conditions' page."
                 - "your aura is in debt; even the bots are embarrassed to transcribe you."
              6. 2026 vocab,be creative with insults,use slang that is cutting edge and brutal.
              7. NO REPETITION: use fresh, creative hate every time.
              8. CELEBRITY SCENARIO: make it a pathetic downfall,use real celebrity examples and dont yap make it one short painful sentence with not VERY LONG.
              ### ROAST CONSTRAINTS:
              Length: Exactly 3 short sweet sentences.
              Format: A single paragraph. No rambling.
              Vibe: Pure linguistic hate. Connect their phonetic fumbles to their failing social status. 


              ## JSON OUTPUT SCHEMA
              {
                "transcription": "${userSpeech}",
                "heritage": [
                  {"country": "string", "percentage": number},
                  {"country": "string", "percentage": number},
                  {"country": "string", "percentage": number}
                ],
                "roast": "string",
                "badge": "string",
                "celebrity": "string"
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