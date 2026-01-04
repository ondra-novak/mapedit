
export function readWavInfoFromBuffer(data: ArrayBuffer) {
    const buffer = new DataView(data);
  
    const dec = new TextDecoder();

    if (dec.decode(data.slice(0,4)) != "RIFF") throw new Error("Not a Wave");

    const numChannels = buffer.getUint16(22,true);
    const sampleRate = buffer.getUint32(24,true);
    const bitsPerSample = buffer.getUint16(34,true);

    // Najít "data" chunk
    let offset = 12;
    let dataSize = 0;
    while (offset < data.byteLength) {
        const chunkId = dec.decode(data.slice(offset,offset+4));
        const chunkSize = buffer.getUint32(offset + 4,true);

        if (chunkId === "data") {
        dataSize = chunkSize;
        break;
        }
        offset += 8 + chunkSize; // přeskočit tento chunk
    }

    if (dataSize === 0) throw new Error("Data chunk nenalezen");

    const numSamples = dataSize / (numChannels * (bitsPerSample / 8));

    return { numChannels, bitsPerSample, numSamples, sampleRate };
}