import { server } from "@/core/api";

/**
 * MUS Stream Parser
 * Parses a proprietary delta-compressed PCM audio format.
 *
 * Binary layout:
 *   [0x00]  int16  channels
 *   [0x02]  int32  sample rate (Hz)
 *   [0x06]  int32  (skip)
 *   [0x0A]  int32  block count
 *   [0x0E]  8 B    (skip)
 *   [0x16]  512 B  lookup table – 256 × int16 (little-endian)
 *   [0x216] blocks …
 *
 * Each block:
 *   [+0]  int32  sample count (p)
 *   [+4]  int32  (skip)
 *   [+8]  p × uint8  indices into the lookup table
 *
 * Decoding:
 *   Two running accumulators (one per channel).
 *   val = accum[ch] + table[index]
 *   accum[ch] = val
 *   Special bug-compat: if index == 0, val -= 31767
 */

export interface MUSInfo {
  channels: number;
  sampleRate: number;
  blocks: number;
}

export interface MUSParseResult {
  info: MUSInfo;
  /** Interleaved int16 PCM samples for all channels */
  samples: Int16Array;
}

// ---------------------------------------------------------------------------
// Streaming / lazy interface (avoids decoding all blocks at once)
// ---------------------------------------------------------------------------

export class MUSStreamParser {
  private view: DataView;
  private byteOffset: number;

  readonly channels: number;
  readonly sampleRate: number;
  readonly totalBlocks: number;

  private table: Int16Array;          // 256-entry delta lookup
  private remainingBlocks: number;
  private accum: Int16Array;          // running accumulators per channel

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
    let pos = 0;

    const readInt16 = () => {
      const v = this.view.getInt16(pos, true); pos += 2; return v;
    };
    const readInt32 = () => {
      const v = this.view.getInt32(pos, true); pos += 4; return v;
    };

    this.channels   = readInt16();
    this.sampleRate = readInt32();
    pos += 4;                          // skip
    this.totalBlocks = readInt32();
    pos += 8;                          // skip

    // 512 bytes = 256 × int16 lookup table
    this.table = new Int16Array(buffer, pos, 256);
    pos += 512;

    this.byteOffset      = pos;
    this.remainingBlocks = this.totalBlocks;
    this.accum           = new Int16Array(this.channels);
  }

  get info(): MUSInfo {
    return {
      channels:   this.channels,
      sampleRate: this.sampleRate,
      blocks:     this.totalBlocks,
    };
  }

  /** Returns true when all blocks have been consumed. */
  get done(): boolean {
    return this.remainingBlocks <= 0;
  }

  /**
   * Decode and return the next block of PCM samples (Int16Array).
   * Returns null when there are no more blocks.
   */
  nextBlock(): Int16Array | null {
    if (this.done) return null;

    this.accum[0] = 0;
    this.accum[1] = 0;

    const view  = this.view;
    let   pos   = this.byteOffset;

    const p = view.getInt32(pos, true); pos += 4;
    pos += 4;                            // skip second int32

    const out = new Int16Array(p);
    let c = 0;

    for (let i = 0; i < p; i++) {
      const idx = view.getUint8(pos++);
      let val = (this.accum[c] + this.table[idx]) & 0xFFFF;
      // reinterpret as signed int16
      if (val >= 0x8000) val -= 0x10000;

      this.accum[c] = val as number;

      // Original C++ bug-compat: index 0 subtracts 31767 from the output
      // (accum is NOT adjusted – matches the C++ behaviour)
//      out[i] = (idx === 0 ? val - 31767 : val) as unknown as number;
      // Int16Array clamps on assignment, so write via a safe wrapper:
      out[i] = Math.max(-32768, Math.min(32767,
        idx === 0 ? val - 31767 : val
      ));

      c = (c + 1) % this.channels;
    }

    this.byteOffset      = pos;
    this.remainingBlocks--;

    return out;
  }

  /** Convenience: decode all blocks and return one concatenated Int16Array. */
  decodeAll(): Int16Array {
    const blocks: Int16Array[] = [];
    let totalSamples = 0;

    let block: Int16Array | null;
    while ((block = this.nextBlock()) !== null) {
      blocks.push(block);
      totalSamples += block.length;
    }

    const result = new Int16Array(totalSamples);
    let offset = 0;
    for (const b of blocks) {
      result.set(b, offset);
      offset += b.length;
    }
    return result;
  }
}

interface MusAudio 
    { source: AudioBufferSourceNode; stop: () => void; info: MUSInfo };


// ---------------------------------------------------------------------------
// Web Audio API player
// ---------------------------------------------------------------------------

/**
 * Decode a MUS ArrayBuffer and play it in the browser via the Web Audio API.
 *
 * @param buffer   Raw MUS file bytes
 * @param context  Optional existing AudioContext (creates one if not supplied)
 * @returns        An object with the AudioBufferSourceNode so you can call .stop()
 *
 * @example
 * const { stop } = await playMUS(arrayBuffer);
 * // later:
 * stop();
 */
export async function playMUS(
  buffer: ArrayBuffer,
  context?: AudioContext,
): Promise<MusAudio> {
  const parser  = new MUSStreamParser(buffer);
  const info    = parser.info;
  const samples = parser.decodeAll();

  const ctx        = context ?? new AudioContext();
  const frameCount = samples.length / info.channels;
  const audioBuffer = ctx.createBuffer(info.channels, frameCount, info.sampleRate);

  // De-interleave int16 → float32 for each channel
  const int16Max = 32768;
  for (let ch = 0; ch < info.channels; ch++) {
    const channelData = audioBuffer.getChannelData(ch);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = samples[i * info.channels + ch] / int16Max;
    }
  }

  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(ctx.destination);
  source.start();

  return {
    source,
    stop: () => source.stop(),
    info,
  };
}

// ---------------------------------------------------------------------------
// Chunked / streaming decode for large files
// ---------------------------------------------------------------------------

/**
 * Like playMUS but feeds audio to Web Audio API in chunks so the browser
 * doesn't need to hold the entire decoded PCM in memory at once.
 *
 * Uses AudioWorklet / ScriptProcessor fallback for real-time streaming
 * of very large files (hundreds of MB).
 *
 * Simpler approach: schedules pre-decoded AudioBuffers back-to-back.
 *
 * @param buffer        Raw MUS file bytes
 * @param blocksPerChunk  How many MUS blocks to schedule at a time (default 64)
 */
export async function playMUSStreaming(
  buffer: ArrayBuffer,
  blocksPerChunk = 64,
  context?: AudioContext,
): Promise<{ stop: () => void; info: MUSInfo }> {
  const parser = new MUSStreamParser(buffer);
  const info   = parser.info;
  const ctx    = context ?? new AudioContext();

  let stopped   = false;
  let nextStart = ctx.currentTime + 0.1; // small initial latency

  const int16Max = 32768;

  function scheduleChunk() {
    if (stopped || parser.done) return;

    const blocks: Int16Array[] = [];
    let totalSamples = 0;

    for (let i = 0; i < blocksPerChunk && !parser.done; i++) {
      const b = parser.nextBlock()!;
      blocks.push(b);
      totalSamples += b.length;
    }

    const frameCount  = totalSamples / info.channels;
    const audioBuffer = ctx.createBuffer(info.channels, frameCount, info.sampleRate);

    // flatten blocks → per-channel float32
    let sampleIdx = 0;
    for (const b of blocks) {
      for (let s = 0; s < b.length; s += info.channels) {
        for (let ch = 0; ch < info.channels; ch++) {
          audioBuffer.getChannelData(ch)[sampleIdx] = b[s + ch] / int16Max;
        }
        sampleIdx++;
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.start(nextStart);

    const chunkDuration = frameCount / info.sampleRate;
    nextStart += chunkDuration;

    // schedule the next chunk ~200 ms before this one ends
    const scheduleIn = Math.max(0, (nextStart - ctx.currentTime - 0.2) * 1000);
    if (!parser.done && !stopped) {
      setTimeout(scheduleChunk, scheduleIn);
    }
  }

  scheduleChunk();

  return {
    stop: () => { stopped = true; },
    info,
  };
}

class SoundControl {

static #audio : HTMLAudioElement|MusAudio|null = null;
static #urlobj : string;


static async stop() {
    if (SoundControl.#urlobj) URL.revokeObjectURL(SoundControl.#urlobj);
    if (SoundControl.#audio) {
        if ("stop" in SoundControl.#audio ) {
            SoundControl.#audio.stop();
            SoundControl.#audio = null;
        } else {
            SoundControl.#audio.pause();
            SoundControl.#audio.src = "";
            SoundControl.#audio.load();
            SoundControl.#audio = null;
        }
    }
}

static async play(name: string) {
    await SoundControl.stop();

    try {
        const data = await server.getDDLFile(name);
        const up =  name.toLocaleUpperCase();
        if (up.endsWith(".MUS")) {
            SoundControl.#audio = await playMUS(data);
        } else {
            const type = name.toLocaleUpperCase().endsWith(".MP3")?"mpeg":"wav";
            const blob = new Blob([data], { type: "#audio/"+type });
            SoundControl.#urlobj = URL.createObjectURL(blob);
            SoundControl.#audio = new Audio(SoundControl.#urlobj);
            SoundControl.#audio.play();
        }
    } catch (e) {
        console.error(e);
    }
}

}



export default SoundControl;