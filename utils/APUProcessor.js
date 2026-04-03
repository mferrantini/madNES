'use strict';

class APUProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();

        const { audioBuffer, writeIndex, readIndex } = options.processorOptions;

        this.audioBuffer = new Float32Array(audioBuffer);
        this.writeIndex = new Int32Array(writeIndex);
        this.readIndex = new Int32Array(readIndex);
        this.bufferSize = this.audioBuffer.length;
    }

    process(inputs, outputs, parameters) {
        const out = outputs[0][0]; // mono, 128 campioni per chiamata

        for (let i = 0; i < out.length; i++) {
            const wPos = Atomics.load(this.writeIndex, 0);
            const rPos = Atomics.load(this.readIndex,  0);

            if (rPos !== wPos) {
                // ci sono campioni disponibili
                out[i] = this.audioBuffer[rPos];
                Atomics.store(this.readIndex, 0, (rPos + 1) % this.bufferSize);
            } else {
                out[i] = i > 0 ? out[i - 1] : 0;
            }
        }

        return true; 
    }
}

registerProcessor('APUProcessor', APUProcessor);
