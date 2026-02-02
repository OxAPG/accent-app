"use client";
import React, { useState, useRef, useEffect } from 'react';
import { toPng, toBlob } from 'html-to-image';

// --- TYPES & INTERFACES ---
interface Heritage {
  country: string;
  percentage: number;
}

interface RoastResult {
  transcription: string;
  heritage: Heritage[];
  roast: string;
  badge: string;
  celebrity: string;
}

// --- FULL DATA ARRAYS ---
const CHALLENGES = [
  "Can I please get a large iced latte with oat milk and zero attitude?",
  "I'm literally just a girl, please don't ask me to explain my credit card statement.",
  "Bhai, if the momos aren't spicy enough to make me see God, I don't want them.",
  "Trust me, I've been to Bandra once, I basically own a startup now.",
  "No cap, your fit is mid and your aura is practically in the negatives right now.",
  "Actually, I'm a digital nomad, so I work from wherever the Wi-Fi doesn't lag.",
  "Can we skip the small talk and just discuss why 2014 Tumblr aesthetic is back?",
  "I'm not saying I'm the main character, but the lighting today says otherwise.",
  "It's giving very much 'unpaid intern on their fifth cup of espresso' vibes.",
  "I requested the window seat specifically so I could romanticize my life in peace."
];

const welcomes = [
  "oh look, another low-aura npc trying to beat the allegations. press the button, loser.",
  "you actually think you have a chance? cute. click record so i can laugh at your life.",
  "same mid energy, different day. go ahead, pollute my microphone with your accent.",
  "i’ve seen bots with more charisma than you. press record before i get bored.",
  "don’t choke on your own ego. or do. i actually don’t care. hit the button.",
  "wow, the audacity to stand there with that fit and try to speak. record it, i dare you.",
  "are you lost? this isn't the 'mid-accent anonymous' meeting. hurry up and record."
];

// --- REUSABLE METER COMPONENT ---
const Meter = ({ label, percent, color }: { label: string; percent: number; color: string }) => (
  <div className="mb-4 w-full">
    <div className="flex justify-between font-black uppercase text-[10px] mb-1">
      <span>{label}</span>
      <span>{percent}%</span>
    </div>
    <div className="h-6 bg-white border-4 border-black shadow-[3px_3px_0px_#000] overflow-hidden">
      <div 
        className={`h-full border-r-4 border-black transition-all duration-1000 ${color}`} 
        style={{ width: `${percent}%` }} 
      />
    </div>
  </div>
);

// --- AUDIO VISUALIZER ---
const LiveVisualizer = ({ stream }: { stream: MediaStream | null }) => {
  const [bars, setBars] = useState(new Array(15).fill(20));
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    if (!stream) return;
    try {
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      
      audioContextRef.current = new AudioContextClass();
      const source = audioContextRef.current!.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current!.createAnalyser();
      analyserRef.current.fftSize = 64; 
      source.connect(analyserRef.current);
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      const [isIAB, setIsIAB] = useState(false);
      const update = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const newBars = Array.from(dataArray.slice(0, 15)).map(v => Math.max(10, (v / 255) * 100));
        setBars(newBars);
        requestAnimationFrame(update);
      };
      update();
    } catch (e) { console.error("Visualizer Error", e); }
    return () => { audioContextRef.current?.close(); };
  }, [stream]);

  return (
    <div className="flex items-end justify-center gap-1 h-12 w-full my-6">
      {bars.map((h, i) => (
        <div key={i} className="w-3 bg-black border-t-2 border-black transition-all duration-75" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
};

export default function AccentRoaster() {
  // --- STATE MANAGEMENT ---
  const [isMuted, setIsMuted] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [isFooterOpen, setIsFooterOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<'landing' | 'recording' | 'analyzing' | 'results'>('landing');
  const [challenge, setChallenge] = useState("");
  const [timer, setTimer] = useState(10); 
  const [result, setResult] = useState<RoastResult | null>(null);
  const [card, setCard] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isIAB, setIsIAB] = useState(false);

  // --- REFS ---
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const shareRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(0);

  // --- SPEECH ENGINE ---
  const speakSavage = (text: string, onFinish?: () => void) => {
    if (isMuted || typeof window === 'undefined' || !window.speechSynthesis) {
      if (onFinish) onFinish();
      return;
    }
    
    try {
      window.speechSynthesis.cancel(); 
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.15;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const targetVoice = 
        voices.find(v => v.lang.startsWith('en-GB') || v.name.includes('Google')) || 
        voices.find(v => v.lang.startsWith('en')) || 
        voices[0];

      if (targetVoice) utterance.voice = targetVoice;

      let safetyTriggered = false;
      const forceFinishTimeout = onFinish && step === 'landing' ? setTimeout(() => {
        if (!safetyTriggered) {
          safetyTriggered = true;
          window.speechSynthesis.cancel();
          setIsAiSpeaking(false);
          onFinish();
        }
      }, 5000) : null;

      utterance.onstart = () => {
        setIsAiSpeaking(true);
        if (navigator.vibrate) navigator.vibrate(50);
      };

      utterance.onend = () => {
        if (forceFinishTimeout) clearTimeout(forceFinishTimeout);
        if (!safetyTriggered) {
          safetyTriggered = true;
          setIsAiSpeaking(false);
          if (onFinish) onFinish();
        }
      };

      utterance.onerror = () => {
        if (forceFinishTimeout) clearTimeout(forceFinishTimeout);
        setIsAiSpeaking(false);
        if (onFinish) onFinish();
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      if (onFinish) onFinish();
    }
  };

  useEffect(() => {
    const primeVoices = () => window.speechSynthesis.getVoices();
    primeVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = primeVoices;
    }
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || navigator.vendor : '';
    const isInstagram = /Instagram|FBAN|FBAV/i.test(ua);
    setIsIAB(isInstagram);
    setMounted(true);
    setChallenge(CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)]);
  }, []);

  // --- TIMER ENGINE ---
  useEffect(() => {
    if (step === 'recording' && timer > 0) {
      intervalRef.current = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (timer === 0 && step === 'recording') {
      stopRecording();
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [step, timer]);

  useEffect(() => {
    if (step === 'results' && card === 1 && result?.roast) {
      speakSavage(result.roast);
    }
  }, [step, card, result]);

  // --- GAME LOGIC ---
  const resetGame = () => {
    setChallenge(CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)]);
    setResult(null);
    setCard(0);
    setError(null);
    setTimer(10);
    setStep('landing');
  };

  const startRecording = async () => {
    try {
      setError(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Mic blocked. Check settings.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setActiveStream(stream);

      const randomText = welcomes[Math.floor(Math.random() * welcomes.length)];
      
      speakSavage(randomText, () => {
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];
        mediaRecorder.ondataavailable = (e) => { 
          if (e.data.size > 0) chunksRef.current.push(e.data); 
        };
        mediaRecorder.onstop = handleRecordingStop;
        
        startTimeRef.current = Date.now();
        mediaRecorder.start();
        setStep('recording');
        setTimer(10);
      });
    } catch (err) {
      setError("Mic access denied.");
      setStep('landing');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      activeStream?.getTracks().forEach(track => track.stop());
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  };

  const handleRecordingStop = async () => {
    const duration = (Date.now() - startTimeRef.current) / 1000;

    // --- ABSOLUTE GATEKEEPER ---
    // 1. Duration Check
    if (chunksRef.current.length === 0 || duration < 2) {
      setError("Do you want me to roast the accent of the air? Speak something!");
      setStep('landing');
      return; // STOP EXECUTION
    }

    const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });

    // 2. Silence/Size Check (Raised to 30KB to ignore mic static)
    if (audioBlob.size < 30000) {
      setError("Are you mute? Speak up or go home, NPC.");
      setStep('landing');
      return; // STOP EXECUTION
    }

    // --- ONLY PROCEED IF GUARDS ARE PASSED ---
    setStep('analyzing');
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = async () => {
      const base64Audio = (reader.result as string).split(',')[1];
      sendToApi(base64Audio);
    };
  };

  const sendToApi = async (base64Audio: string) => {
    try {
      const res = await fetch('/api/roast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64Audio, challengeText: challenge })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Server failed.");
      setResult(data);
      setStep('results');
    } catch (err: any) {
      setError(err.message || "AI Error. The roast was too hot.");
      setStep('landing');
    }
  };

  // --- SOCIAL HELPERS ---
  const downloadCard = async () => {
    if (!shareRef.current) return;
    const dataUrl = await toPng(shareRef.current, { cacheBust: true });
    const link = document.createElement('a');
    link.download = 'roast.png';
    link.href = dataUrl;
    link.click();
  };

  const shareCard = async () => {
    if (!shareRef.current) return;
    try {
      const blob = await toBlob(shareRef.current, { cacheBust: true });
      if (!blob) return;
      const file = new File([blob], 'roast.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Accent Roast',
          text: `The AI says I sound like ${result?.celebrity}. 💀 #AccentRoaster`,
        });
      }
    } catch (err) { console.error("Sharing failed", err); }
  };

  if (!mounted) return <div className="min-h-screen bg-[#FFFF00]" />;

  return (
    <div className="min-h-screen bg-[#FFFF00] font-mono p-4 flex flex-col items-center justify-center text-black overflow-hidden select-none">
      {isIAB && step === 'landing' && (
  <div className="fixed top-0 left-0 right-0 bg-black text-[#00FF00] p-4 z-[3000] font-black text-center text-[10px] uppercase border-b-4 border-[#00FF00] animate-pulse">
    ⚠️ INSTAGRAM BLOCKS MIC/VOICE. TAP (...) AND "OPEN IN SYSTEM BROWSER" TO PLAY.
  </div>
)}
      {/* ERROR OVERLAY */}
      {error && (
        <div className="fixed top-0 left-0 right-0 bg-red-600 text-white p-4 z-[1000] font-black text-center text-xs uppercase border-b-4 border-black animate-bounce">
          ⚠️ {error} <button onClick={() => setError(null)} className="ml-4 underline">[DISMISS]</button>
        </div>
      )}

      {/* MUTE BUTTON */}
      <button 
        onClick={() => {
          setIsMuted(!isMuted);
          if (!isMuted) window.speechSynthesis.cancel();
        }}
        className="fixed top-6 right-6 z-50 bg-black text-white border-2 border-black px-4 py-2 font-black text-[10px] uppercase shadow-[4px_4px_0px_#FF00FF] active:shadow-none transition-all"
      >
        {isMuted ? "🔇 SOUND OFF" : "🔊 SOUND ON"}
      </button>

      {/* AI STATUS */}
      {isAiSpeaking && (
        <div className="fixed top-20 right-6 animate-pulse z-50">
          <div className="bg-[#00FF00] text-black border-2 border-black px-3 py-1 font-black text-[8px] uppercase shadow-[3px_3px_0px_#000]">
            AI IS YAPPING...
          </div>
        </div>
      )}

      {/* --- 1. LANDING SCREEN --- */}
      {step === 'landing' && (
        <div className="text-center w-full max-w-sm">
          <h1 className={`text-5xl font-black mb-8 uppercase italic -rotate-2 drop-shadow-[4px_4px_0px_#FF00FF] transition-all duration-300 ${isAiSpeaking ? 'text-red-600 scale-105' : ''}`}>
            {isAiSpeaking ? "LISTEN." : "Accent Roaster"}
          </h1>
          
          <div className="bg-white border-4 border-black p-6 mb-8 shadow-[8px_8px_0px_#000] text-left">
            <p className="text-[10px] font-black uppercase opacity-40 mb-2">The Mission:</p>
            <p className="text-xl font-bold italic leading-tight">
              {isAiSpeaking ? "Shhh. The AI has thoughts..." : `"${challenge}"`}
            </p>
          </div>

          <button 
            onClick={startRecording}
            disabled={isAiSpeaking}
            className={`w-full border-4 border-black py-6 text-4xl font-black shadow-[10px_10px_0px_#000] transition-all
              ${isAiSpeaking ? 'bg-zinc-400 opacity-50 cursor-not-allowed' : 'bg-[#FF00FF] active:translate-x-1 active:translate-y-1 active:shadow-none hover:bg-[#00FF00]'}
            `}
          >
            {isAiSpeaking ? "YAPPING..." : "RECORD"}
          </button>
        </div>
      )}

      {/* --- 2. RECORDING SCREEN --- */}
      {step === 'recording' && (
        <div className="text-center w-full max-w-sm animate-in zoom-in-95 duration-300">
          <div className="bg-white border-4 border-black p-6 mb-4 shadow-[12px_12px_0px_#000] relative">
            <p className="text-[10px] font-black uppercase opacity-40 mb-4 text-left">Recording Session:</p>
            <p className="text-2xl font-black italic leading-tight underline decoration-4 underline-offset-4">"{challenge}"</p>
            <LiveVisualizer stream={activeStream} />
            <div className="absolute -bottom-5 right-6 bg-[#FF00FF] text-black border-4 border-black px-4 py-2 font-black text-2xl shadow-[4px_4px_0px_#000]">
              {timer}s
            </div>
          </div>
          
          <button 
            onClick={stopRecording}
            className="w-full mt-10 bg-[#00FF00] border-4 border-black py-4 text-3xl font-black uppercase shadow-[6px_6px_0px_#000] active:translate-y-1 active:shadow-none transition-all hover:bg-red-500 hover:text-white"
          >
            DONE ⏹️
          </button>

          <p className="text-[10px] font-black mt-8 uppercase tracking-[0.2em] animate-pulse text-center">SPEAK UP! I CAN'T HEAR COWARDS.</p>
        </div>
      )}

      {/* --- 3. ANALYZING SCREEN --- */}
      {step === 'analyzing' && (
        <div className="text-center">
          <div className="w-20 h-20 border-8 border-black border-t-[#FF00FF] rounded-full animate-spin mx-auto mb-8"></div>
          <h2 className="text-4xl font-black uppercase italic animate-pulse">Consulting the Council...</h2>
          <p className="mt-4 font-bold opacity-60 italic text-sm text-center uppercase">Calculating your aura deficit...</p>
        </div>
      )}

      {/* --- 4. RESULTS --- */}
      {step === 'results' && result && (
        <div className="w-full max-w-sm flex flex-col items-center animate-in slide-in-from-bottom-12 duration-500">
          <div className="bg-white border-4 border-black p-6 w-full shadow-[12px_12px_0px_#000] mb-8 min-h-[460px] flex flex-col">
            
            {card === 0 && (
              <div className="animate-in fade-in slide-in-from-bottom-4 flex-1">
                <h2 className="text-3xl font-black mb-8 italic underline uppercase decoration-4 text-center">Accent DNA</h2>
                {result.heritage.map((h, i) => (
                  <Meter key={i} label={h.country} percent={h.percentage} color={i===0?'bg-[#00FF00]':i===1?'bg-[#FF00FF]':'bg-[#00FFFF]'} />
                ))}
              </div>
            )}

            {card === 1 && (
              <div className="animate-in fade-in slide-in-from-right-8 h-full flex flex-col justify-center flex-1">
                <p className="text-[25px] font-black uppercase opacity-30 mb-4">Transcription: "{result.transcription}"</p>
                <p className="text-3xl font-black italic text-[#FF00FF] uppercase leading-tight underline decoration-black underline-offset-4">
                  {result.roast}
                </p>
              </div>
            )}

            {card === 2 && (
              <div className="flex flex-col h-full animate-in zoom-in-95 duration-300">
                <div ref={shareRef} className="bg-[#FF00FF] border-4 border-black p-6 flex flex-col justify-between text-white h-[400px] shadow-[8px_8px_0px_#000]">
                  <h1 className="text-5xl font-black italic uppercase">ROASTED.</h1>
                  <div className="bg-white text-black p-4 border-4 border-black rotate-2 text-center shadow-[4px_4px_0px_#000]">
                    <p className="text-[10px] font-black uppercase opacity-40">Primary Origin:</p>
                    <p className="text-3xl font-black uppercase leading-none">{result.heritage[0].country}</p>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-black text-[#00FF00] p-3 font-bold italic border-2 border-white">
                      "{result.celebrity}"
                    </div>
                    <div className="bg-[#FFFF00] text-black p-2 text-center font-black text-xs border-2 border-black uppercase italic shadow-[3px_3px_0px_#000]">
                      Status: {result.badge}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-6">
                  <button onClick={downloadCard} className="bg-[#00FFFF] border-2 border-black p-3 font-black text-xs uppercase shadow-[4px_4px_0px_#000] active:shadow-none active:translate-y-1 transition-all">SAVE 💾</button>
                  <button onClick={shareCard} className="bg-[#00FF00] border-2 border-black p-3 font-black text-xs uppercase shadow-[4px_4px_0px_#000] active:shadow-none active:translate-y-1 transition-all">SHARE 🚀</button>
                </div>
              </div>
            )}
          </div>
          
          <button 
            onClick={() => card < 2 ? setCard(c => c + 1) : resetGame()} 
            className="w-full bg-black text-white py-5 text-2xl font-black uppercase border-4 border-black shadow-[6px_6px_0px_#FF00FF] active:translate-y-1 transition-all"
          >
            {card < 2 ? "NEXT CARD →" : "TRY AGAIN"}
          </button>
        </div>
      )}

      {/* LEGAL DRAWER */}
      <button 
        onClick={() => setIsFooterOpen(true)}
        className="fixed bottom-4 right-4 text-[8px] font-black uppercase opacity-20 hover:opacity-100 underline z-40"
      >
        [ Legal & Privacy ]
      </button>

      {isFooterOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setIsFooterOpen(false)} />
          <div className="relative w-full max-w-lg bg-[#000000] text-white border-t-8 border-[#FF00FF] p-8 animate-in slide-in-from-bottom-full duration-500">
            <button onClick={() => setIsFooterOpen(false)} className="absolute top-4 right-4 bg-[#FF00FF] text-black font-black px-2 py-1 text-[10px] border-2 border-black">CLOSE [X]</button>
            <h3 className="text-2xl font-black italic uppercase mb-6 underline decoration-[#FF00FF] underline-offset-8">The Legal Shield</h3>
            <div className="text-[10px] font-bold uppercase space-y-4 opacity-80">
              <p>01 // AI LIABILITY: No liability for insults. The AI is unhinged.</p>
              <p>02 // NO GUARANTEE: This is satire. Don't take it to heart.</p>
              <p>03 // NO HARM: We take no guarantee in case of harm to any human.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}