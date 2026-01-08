
import { GoogleGenAI, Modality, GenerateContentResponse, Type, FunctionDeclaration } from "@google/genai";
import { CAMELOT_MAP } from "../constants";

// Helper to wait for a specific duration
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Robust calling utility with exponential backoff for 429 errors
async function callGeminiWithRetry<T>(fn: (ai: GoogleGenAI) => Promise<T>, retries = 3): Promise<T> {
  let delay = 1000;
  // Always create a fresh instance to use the latest injected API key
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  for (let i = 0; i < retries; i++) {
    try {
      return await fn(ai);
    } catch (error: any) {
      const isRateLimit = error.message?.includes('429') || error.status === 429;
      if (isRateLimit && i < retries - 1) {
        console.warn(`Gemini Rate Limit (429) hit. Retrying in ${delay}ms...`);
        await sleep(delay);
        delay *= 2; // Exponential backoff
        continue;
      }
      throw error;
    }
  }
  throw new Error("Maximum retries exceeded for Gemini API");
}

export const aiDJFunctionDeclarations: FunctionDeclaration[] = [
  {
    name: 'load_track',
    parameters: {
      type: Type.OBJECT,
      description: 'Search for and load a track into a specific deck.',
      properties: {
        deck: { type: Type.STRING, enum: ['A', 'B'] },
        query: { type: Type.STRING },
      },
      required: ['deck', 'query'],
    },
  },
  {
    name: 'smart_transition',
    parameters: {
      type: Type.OBJECT,
      description: 'Perform a professional crossfade transition.',
      properties: {
        targetDeck: { type: Type.STRING, enum: ['A', 'B'] },
        duration: { type: Type.NUMBER },
        swapOtherDeck: { type: Type.BOOLEAN }
      },
      required: ['targetDeck', 'duration'],
    },
  },
  {
    name: 'sync_master_levels',
    parameters: {
      type: Type.OBJECT,
      description: 'Adjust global sync, BPM, and key.',
      properties: {
        bpm: { type: Type.NUMBER },
        key: { type: Type.STRING },
      },
    },
  },
  {
    name: 'vibe_shift',
    parameters: {
      type: Type.OBJECT,
      description: 'Trigger a complete atmosphere change.',
      properties: {
        mood: { type: Type.STRING }
      },
      required: ['mood'],
    }
  },
  {
    name: 'set_auto_pilot',
    parameters: {
      type: Type.OBJECT,
      description: 'Enable or disable JD\'s autonomous mixing mode.',
      properties: {
        enabled: { type: Type.BOOLEAN }
      },
      required: ['enabled'],
    }
  }
];

export const interactWithAIDJ = async (message: string, history: any[], context: any) => {
  return callGeminiWithRetry(async (ai) => {
    const limitedHistory = history.slice(-8); // Slightly tighter history for stability
    const contents = [...limitedHistory, { role: 'user', parts: [{ text: message }] }];
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: contents,
      config: {
        systemInstruction: `You are 'JD', the ultimate late-night FM host and pro club DJ assistant. 
        Current Studio: ${JSON.stringify(context)}.
        Rules: Smooth FM host voice, audio nerd technicality, proactive control. Phase 1: Onboarding Q&A. Phase 2: Autonomous mixing. 
        Response: Text for TTS + Functions.`,
        tools: [{ functionDeclarations: aiDJFunctionDeclarations }],
      },
    });
    return response;
  });
};

export const generateJDVoice = async (text: string, voiceName: string): Promise<string | null> => {
  try {
    return await callGeminiWithRetry(async (ai) => {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Act as JD, the smooth FM host. Speak this naturally: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName || 'Charon' },
            },
          },
        },
      });
      return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    });
  } catch (error) {
    console.error("JD Voice Gen Error:", error);
    return null;
  }
};

export const generateDJIntro = async (trackA: string, trackB: string, voiceName: string): Promise<string | null> => {
  try {
    return await callGeminiWithRetry(async (ai) => {
      const textResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Unique, smooth DJ intro for "${trackA}" and "${trackB}". Max 15 words.`,
      });
      const introText = textResponse.text || "Synchronizing frequencies.";
      return await generateJDVoice(introText, voiceName);
    });
  } catch (error) {
    return null;
  }
};

export const getAssistantTip = async (context: any): Promise<string> => {
  try {
    return await callGeminiWithRetry(async (ai) => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `One-sentence technical audio tip for state: ${JSON.stringify(context)}. Max 12 words.`,
      });
      return response.text?.trim() || "Watch those harmonic overlaps.";
    });
  } catch (error) {
    return "Monitor your gain stages carefully.";
  }
};

export const generateMashupNames = async (trackA: string, trackB: string): Promise<string[]> => {
  try {
    return await callGeminiWithRetry(async (ai) => {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `3 unique mashup names for "${trackA}" and "${trackB}".`,
      });
      const text = response.text || "";
      return text.split(',').map(s => s.trim()).filter(s => s.length > 0).slice(0, 3);
    });
  } catch (error) {
    return [`${trackA} vs ${trackB}`, "Electric Mashup", "Midnight Mix"];
  }
};

export const generateMagicMatch = async (trackName: string, artistName: string, currentKey: string, currentBpm: number, targetDeck: string): Promise<string> => {
  try {
    return await callGeminiWithRetry(async (ai) => {
      const camelot = CAMELOT_MAP[currentKey] || '8B';
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Harmonic match for "${trackName}" (Key: ${camelot}, BPM: ${currentBpm}) on Deck ${targetDeck}. Artist - Title only.`,
      });
      return response.text?.trim() || "Daft Punk - One More Time";
    });
  } catch (error) {
    return "Daft Punk - One More Time";
  }
};
