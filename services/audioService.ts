
import * as Tone from 'tone';

class AudioEngine {
  private static instance: AudioEngine;
  public masterLimiter: Tone.Limiter;
  public masterCompressor: Tone.Compressor;
  public masterAnalyser: Tone.Analyser;
  public masterRecorder: Tone.Recorder;
  public crossFade: Tone.CrossFade;
  
  public deckAInput: Tone.Gain;
  public deckBInput: Tone.Gain;
  public musicDuckingNode: Tone.Gain;

  private constructor() {
    this.masterLimiter = new Tone.Limiter(-1).toDestination();
    this.masterCompressor = new Tone.Compressor({ ratio: 3, threshold: -24, release: 0.25, attack: 0.003 });
    this.masterAnalyser = new Tone.Analyser("fft", 256);
    this.masterRecorder = new Tone.Recorder();
    
    this.crossFade = new Tone.CrossFade(0.5);
    this.deckAInput = new Tone.Gain(1);
    this.deckBInput = new Tone.Gain(1);
    this.musicDuckingNode = new Tone.Gain(1);

    // Chain: Decks -> CrossFade -> Ducking -> Compressor -> Limiter -> Output
    this.deckAInput.connect(this.crossFade.a);
    this.deckBInput.connect(this.crossFade.b);
    
    this.crossFade.connect(this.musicDuckingNode);
    this.musicDuckingNode.connect(this.masterCompressor);
    
    this.masterCompressor.connect(this.masterLimiter);
    this.masterLimiter.connect(this.masterAnalyser);
    this.masterLimiter.connect(this.masterRecorder);
  }

  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  public async start() {
    await Tone.start();
  }

  public duckMusic(duck: boolean, duration: number = 0.5) {
    const target = duck ? 0.2 : 1.0;
    this.musicDuckingNode.gain.rampTo(target, duration);
  }

  public decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  public async decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
  ): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  }
}

export const audioEngine = AudioEngine.getInstance();
