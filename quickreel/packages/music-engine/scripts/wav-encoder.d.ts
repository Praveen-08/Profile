declare module "wav-encoder" {
  export interface WavAudioData {
    sampleRate: number;
    channelData: Float32Array[];
  }
  export function encode(data: WavAudioData): Promise<ArrayBuffer>;
}
