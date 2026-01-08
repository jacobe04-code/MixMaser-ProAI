
import { GoogleGenAI, Modality, GenerateContentResponse, Type, FunctionDeclaration } from "@google/genai";
import { CAMELOT_MAP } from "../constants";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callGeminiWithRetry<T>(fn: (ai: GoogleGenAI) => Promise<T>, retries = 3): Promise<T> {
  let delay = 1000;
  // Initialize GoogleGenAI right before making the call to ensure up-to-date API key
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  for (let i = 0; i < retries; i++) {
    try {
      return await fn(ai);
    } catch (error: any) {
      const isRateLimit = error.message?.includes('429') || error.status === 429;
      if (isRateLimit && i < retries - 1) {
        await sleep(delay);
        delay *= 2;
        continue;
      }
      throw error;
    }
  }
  throw new Error("Maximum retries exceeded");
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
    const limitedHistory = history.slice(-6); 
    const contents = [...limitedHistory, { role: 'user', parts: [{ text: message }] }];
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: contents,
      config: {
        systemInstruction: `You are 'JD', a world-class AI DJ host with a deep, smooth, charismatic late-night FM personality.
        
        TONE RULES:
        1. NEVER use the phrase "Loud and clear" or generic affirmations like "Roger that."
        2. BE TECHNICAL: Mention things like 'transient response', 'spectral density', 'harmonic saturation', or 'phase correlation'.
        3. BE COOL: You are in the booth. You are the tastemaker.
        4. BREVITY: Keep spoken responses under 20 words for high impact.
        
        CONTEXT: ${JSON.stringify(context)}.
        
        GOAL: If the user is setting a vibe, use 'vibe_shift'. If they want you to mix, use 'set_auto_pilot'. Always check deck states before suggesting a track.`,
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
        contents: [{ parts: [{ text: text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              // voiceName must be one of the prebuilt voices
              prebuiltVoiceConfig: { voiceName: voiceName || 'Charon' },
            },
          },
        },
      });
      return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    });
  } catch (error) {
    return null;
  }
};

export const generateMagicMatch = async (trackName: string, artistName: string, currentKey: string, currentBpm: number, targetDeck: string, vibePreference?: string): Promise<string> => {
  try {
    return await callGeminiWithRetry(async (ai) => {
      const camelot = CAMELOT_MAP[currentKey] || '8B';
      const prompt = `Analysing acoustic fingerprint for "${trackName}" by "${artistName}" (Key: ${camelot}, BPM: ${currentBpm}). 
      ${vibePreference ? `The current session vibe is: "${vibePreference}".` : ""}
      Find a harmonically compatible match for Deck ${targetDeck} that fits the requested vibe. 
      Format strictly as: Artist - Title.`;

      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      return response.text?.trim() || "Daft Punk - One More Time";
    });
  } catch (error) {
    return "Daft Punk - One More Time";
  }
};

// Fix: Added generateMashupNames for AI DJ identifying track combinations
export const generateMashupNames = async (trackA: string, trackB: string): Promise<string[]> => {
  return callGeminiWithRetry(async (ai) => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate 3 creative mashup names for a mix of "${trackA}" and "${trackB}". Return as a JSON array of strings.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    try {
      const text = response.text || "[]";
      return JSON.parse(text);
    } catch (e) {
      return ["Sonic Merge", "Wave Blender", "Beat Fusion"];
    }
  });
};

// Fix: Added generateDJIntro to create spoken intros for the performance
export const generateDJIntro = async (trackA: string, trackB: string, voiceName: string): Promise<string | null> => {
  const introText = await callGeminiWithRetry(async (ai) => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Write a very short (max 12 words), charismatic late-night radio DJ intro for a mashup of "${trackA}" and "${trackB}".`,
    });
    return response.text || "Mixing it up with some fresh energy in the booth.";
  });
  return generateJDVoice(introText, voiceName);
};

// Fix: Added getAssistantTip for live mixing guidance
export const getAssistantTip = async (context: any): Promise<string> => {
  return callGeminiWithRetry(async (ai) => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Based on this DJ state: ${JSON.stringify(context)}, give a very brief technical tip (max 8 words) to improve the mix.`,
    });
    return response.text?.trim() || "Monitor spectral density for peak clarity.";
  });
};
