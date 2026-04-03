'use strict';

import { Register8Bit } from "../utils/BinaryStructures.js";

class APU {
    constructor(BUS) {
        this.BUS = BUS;

        this.sharedAudioBuffer = new SharedArrayBuffer(8192 * 4);
        this.audioBuffer = new Float32Array(this.sharedAudioBuffer);

        this.sharedWriteIndex = new SharedArrayBuffer(4);
        this.sharedReadIndex = new SharedArrayBuffer(4);
        this.writeIndex = new Int32Array(this.sharedWriteIndex).fill(0);
        this.readIndex = new Int32Array(this.sharedReadIndex).fill(0);

        this.CHANNEL_STATUS = new Register8Bit();

        this.PULSE1   = new PulseChannel();
        this.PULSE2   = new PulseChannel();
        this.TRIANGLE = new TriangleChannel();

        this.audioContext = null;
        this.audioWorkletNode = null;
        
        this.frameCounter = 0;
        this.samplePeriod = 1789773 / 44100
        this.sampleAccumulator = 0;

    
        this.apuToggle = false;
        this.#init();
    }

    async #init() {
        this.audioContext = new AudioContext({sampleRate: 44100});
        await this.audioContext.audioWorklet.addModule('utils/APUProcessor.js');

        this.audioWorkletNode = new AudioWorkletNode(
            this.audioContext,
            'APUProcessor',
            {
                processorOptions: {
                    readIndex: this.sharedReadIndex,
                    writeIndex: this.sharedWriteIndex,
                    audioBuffer: this.sharedAudioBuffer,
                }
            }
        );

        this.audioWorkletNode.connect(this.audioContext.destination);

        document.addEventListener('click', () => {
            this.audioContext.resume();
        }, { once: true });
    }

    step() {
        this.#incrementFrameCounter();
        this.#updateSampleAccumulator();

        this.TRIANGLE.step();

        if (this.apuToggle) {
            this.PULSE1.step();
            this.PULSE2.step();
        }

        this.apuToggle = !this.apuToggle;
    }

    #updateSampleAccumulator() {
        this.sampleAccumulator += 1;
        if (this.sampleAccumulator >= this.samplePeriod) {
            this.sampleAccumulator -= this.samplePeriod;
            this.#pushSample();
        }
    }

    #pushSample() {
        const mix = AudioMixer.mix(this.PULSE1, this.PULSE2, this.TRIANGLE);

        const sample = (mix * 2.0) - 1.0; // -1.0 - 1.0
        const currentWriteIndex = Atomics.load(this.writeIndex, 0);
        const nextWriteIndex = (currentWriteIndex + 1) % this.audioBuffer.length;

        // Buffer is full, do not push sample
        if (nextWriteIndex === Atomics.load(this.readIndex, 0)) return;

        this.audioBuffer[currentWriteIndex] = sample;
        Atomics.store(this.writeIndex, 0, nextWriteIndex);
    }

    #incrementFrameCounter() {
        switch (this.frameCounter) {
            case 7457:
                this.#quarterFrame();
                break;
            case 14913:
                this.#quarterFrame();
                this.#halfFrame();
                break;
            case 22371:
                this.#quarterFrame();
                break;
            case 29829:
                this.#quarterFrame();
                this.#halfFrame();
                // Resetting the frame counter
                this.frameCounter = 0;
                break;
            default:
                break;
        }

        this.frameCounter++;
    }

    #quarterFrame() {
        this.PULSE1.quarterFrame();
        this.PULSE2.quarterFrame();
        this.TRIANGLE.quarterFrame();
    }

    #halfFrame() {
        this.PULSE1.halfFrame();
        this.PULSE2.halfFrame();
        this.TRIANGLE.halfFrame();
    }

    writeRegister(address, byte) {
        switch (address) {
            case 0x4000:
                this.PULSE1.setControlRegister(byte);
                break;
            case 0x4001:
                this.PULSE1.setSweepRegister(byte);
                break;
            case 0x4002:
                this.PULSE1.setTimerLowRegister(byte);
                break;
            case 0x4003:
                this.PULSE1.setTimerHighRegister(byte);
                break;
            case 0x4004:
                this.PULSE2.setControlRegister(byte);
                break;
            case 0x4005:
                this.PULSE2.setSweepRegister(byte);
                break;
            case 0x4006:
                this.PULSE2.setTimerLowRegister(byte);
                break;
            case 0x4007:
                this.PULSE2.setTimerHighRegister(byte);
                break;
            case 0x4008:
                this.TRIANGLE.setControlRegister(byte);
                break;
            case 0x4009:
                break;
            case 0x400A:
                this.TRIANGLE.setTimerLowRegister(byte);
                break;
            case 0x400B:
                this.TRIANGLE.setTimerHighRegister(byte);
                break;
            case 0x4015:
                this.PULSE1.toggle(!!(byte & 0x01));
                this.PULSE2.toggle(!!(byte & 0x02));
                this.TRIANGLE.toggle(!!(byte & 0x04));
                break;
            default:
                break;
        }
    }
}

class AudioChannel {
    constructor() {
        this.LENGTH_TABLE = [
            10, 254, 20, 2, 40, 4, 80, 6, 160, 8, 60, 10, 14, 12, 26, 14,
            12, 16, 24, 18, 48, 20, 96, 22, 192, 24, 72, 26, 16, 28, 32, 30,
        ];
    }

    toggle(enable) {
        this.enabled = enable;
    }
}

class TriangleChannel extends AudioChannel {
    constructor() {
        super();

        this.TRIANGLE_SEQUENCE = [
            15,14,13,12,11,10,9,8,7,6,5,4,3,2,1,0,
            0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15
        ];

        this.CONTROL_REGISTER = new Register8Bit();
        this.TIMER_LOW_REGISTER = new Register8Bit();
        this.TIMER_HIGH_REGISTER = new Register8Bit();        

        this.timerValue = 0;
        this.sequenceStep = 0;
        this.lengthCounter = 0;

        this.linearCounter = 0;
        this.linearCounterReload = false;
    }

    step() {
        if (this.timerValue > 0) {
            this.timerValue--;
        } else {
            this.timerValue = this.#getTimerPeriod();
            this.sequenceStep = (this.sequenceStep + 1) % 32;
        }
    }

    quarterFrame() {
        if (this.linearCounterReload) {
            this.linearCounter = this.#getLinearCounterReloadValue();
        } else {
            if (this.linearCounter > 0) {
                this.linearCounter--;
            }
        }

        if (!this.#getControlFlag()) {
            this.linearCounterReload = false;
        }
    }

    halfFrame() {
        if (!this.#getControlFlag()) {
            if (this.lengthCounter > 0) {
                this.lengthCounter--;
            }
        }
    }

    setControlRegister(byte) {
        this.CONTROL_REGISTER.value = byte;
    }

    setTimerLowRegister(byte) {
        this.TIMER_LOW_REGISTER.value = byte;
    }

    setTimerHighRegister(byte) {
        // Getting the first 3 bits to complete the 11 bits of timer value
        this.TIMER_HIGH_REGISTER.value = byte & 0x07;

        // Getting the last 5 bits to use as index for the length counter table
        const lengthCounterIndex = byte >> 3;
        this.lengthCounter = this.LENGTH_TABLE[lengthCounterIndex];

        this.#reset();
    }

    #reset() {
        // Reloading the timer value
        this.timerValue = this.#getTimerPeriod();

        // Resetting the linear counter reload flag
        this.linearCounterReload = true;
    }

    #getControlFlag() {
        // Control flag is bit 7 of the control register
        return this.CONTROL_REGISTER.getBit(7);
    }

    #getLinearCounterReloadValue() {
        // Getting the first 7 bits of the control register
        return this.CONTROL_REGISTER.value & 0x7F;
    }

    #getTimerPeriod() {
        // Composing the timer period from the timer low and high registers
        const timerLow = this.TIMER_LOW_REGISTER.value;
        const timerHigh = this.TIMER_HIGH_REGISTER.value;
        return ((timerHigh << 8) | timerLow);
    }

    output() {
        if (!this.enabled) return 0;
        if (this.lengthCounter === 0) return 0;
        if (this.linearCounter === 0) return 0;
        if (this.#getTimerPeriod() < 2) return 0;

        return this.TRIANGLE_SEQUENCE[this.sequenceStep];
    }
}

class PulseChannel extends AudioChannel {
    constructor() {
        super();

        this.DUTY_SEQUENCER_TABLE = [
            [0,1,0,0,0,0,0,0], // 12.5%
            [0,1,1,0,0,0,0,0], // 25%
            [0,1,1,1,1,0,0,0], // 50%
            [1,0,0,1,1,1,1,1], // 75%
        ];

        this.CONTROL_REGISTER    = new Register8Bit();
        this.SWEEP_REGISTER      = new Register8Bit();
        this.TIMER_LOW_REGISTER  = new Register8Bit();
        this.TIMER_HIGH_REGISTER = new Register8Bit();

        // Envelope
        this.envelopeStart  = false;
        this.envelopeDecay  = 0;
        this.envelopeDivider = 0;

        this.timerValue = 0;
        this.lengthCounter = 0;

        this.dutyStep = 0;
        this.dutySequence = [];
    }

    step() {
        this.timerValue--;

        if (this.timerValue === 0) {
            // Resetting the timer value to the timer period
            this.timerValue = this.#getTimerPeriod();

            // Incrementing the duty sequence
            this.dutyStep = (this.dutyStep + 1) % 8;
        }
    }

    quarterFrame() {
        if (this.envelopeStart) {
            this.envelopeStart = false
            this.envelopeDecay = 15;
            this.envelopeDivider = this.#getVolume();

        } else {
            if (this.envelopeDivider === 0) {
                this.envelopeDecay -= 1;
                this.envelopeDivider = this.#getVolume();

                if (this.envelopeDecay === 0) {
                    if (this.#getEnvelopeLoop()) {
                        this.envelopeDecay = 15;
                    }
                }
            } else {
                this.envelopeDivider--;
            }
        }
    }

    halfFrame() {
        if (!this.#getEnvelopeLoop()) {
            if (this.lengthCounter > 0) {
                this.lengthCounter--;
            }
        }
    }

    setControlRegister(byte) {
        this.CONTROL_REGISTER.value = byte;
    }

    setSweepRegister(byte) {
        this.SWEEP_REGISTER.value = byte;
    }

    setTimerLowRegister(byte) {
        this.TIMER_LOW_REGISTER.value = byte;
    }

    setTimerHighRegister(byte) {
        // Getting the first 3 bits to complete the 11 bits of timer value
        this.TIMER_HIGH_REGISTER.value = byte & 0x07;

        // Getting the last 5 bits to use as index for the length counter table
        const lengthCounterIndex = byte >> 3;
        this.lengthCounter = this.LENGTH_TABLE[lengthCounterIndex];

        this.#reset();
    }

    #reset() {
        // Resetting the duty sequence index
        this.dutyStep = 0;

        // Reloading the timer value
        this.timerValue = this.#getTimerPeriod();

        // Starting the envelope
        this.envelopeStart = true;
    }

    #getEnvelopeConstantVolume() {
        // Constant volume flag is bit 4 of the control register
        return this.CONTROL_REGISTER.getBit(4);
    }

    #getEnvelopeLoop() {
        // Loop / Halt is bit 5 of the control register
        return this.CONTROL_REGISTER.getBit(5);
    }

    #getVolume() {
        // V is the first 4 bits of the control register
        return this.CONTROL_REGISTER.value & 0x0F;
    }

    #getTimerPeriod() {
        // Composing the timer period from the timer low and high registers
        const timerLow = this.TIMER_LOW_REGISTER.value;
        const timerHigh = this.TIMER_HIGH_REGISTER.value;
        return ((timerHigh << 8) | timerLow);
    }

    #getDutyMode() {
        // Duty mode is the first 2 bits of the control register
        return (this.CONTROL_REGISTER.value >> 6) & 0x03;
    }

    #envelopeOutput() {
        // If the constant volume flag is set, return the V value from the control register
        if (this.#getEnvelopeConstantVolume()) {
            return this.#getVolume()
        }

        // If the constant volume flag is not set, return the envelope decay (0-15)
        return this.envelopeDecay;
    }

    output() {
        if (!this.enabled) return 0;
        if (this.lengthCounter === 0) return 0;
        if (this.#getTimerPeriod() < 8) return 0;
        if (this.DUTY_SEQUENCER_TABLE[this.#getDutyMode()][this.dutyStep] === 0) return 0;

        return this.#envelopeOutput();
    }
}

class AudioMixer {
    static PULSE_TABLE = new Float32Array(31).fill(0).map((_, i) => i > 0 ? 95.52 / (8128.0 / i + 100) : 0);
    static TND_TABLE = new Float32Array(203).fill(0).map((_, i) => i > 0 ? 163.67 / (24329.0 / i + 100) : 0);

    static mix(pulse1, pulse2, triangle) {
        const pulse1Output = pulse1.output();
        const pulse2Output = pulse2.output();
        const triangleOutput = triangle.output();

        const noiseOutput = 0;
        const dmcOutput = 0;

        const pulseMix = this.PULSE_TABLE[pulse1Output + pulse2Output];
        const tndMix = this.TND_TABLE[3 * triangleOutput + 2 * noiseOutput + dmcOutput];

        return pulseMix + tndMix;
    }
}
export default APU;
