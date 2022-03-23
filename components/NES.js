'use strict';

import ROM from "./ROM.js";
import CPU from "./CPU.js";
import PPU from "./PPU.js";
import APU from "./APU.js";

class NES {
    constructor() {
        this.ROM = null;

        this.CPU = new CPU(this);
        this.PPU = new PPU(this);
        this.APU = new APU(this);

        // 2KB Internal RAM
        this.WRAM = new Uint8Array(0x800).fill(0x00);
        // 2KB Video RAM
        this.VRAM = new Uint8Array(0x800).fill(0x00);
    }

    loadCartridge(romData) {
        this.ROM = new ROM(romData);
    }

    powerOn() {
        this.CPU.powerOn();
    }

    reset() {}

    frame() {
        while(!this.PPU.isFrameReady) this.step();
        this.PPU.renderFrame();
    }

    step() {
        // 1 CPU Step
        this.CPU.step();
        // 3 PPU Steps
        this.PPU.step();
        this.PPU.step();
        this.PPU.step();
    }

    // Memory management methods
    cpuReadMemory(address) {
        if (0x0000 <= address && address <= 0x1FFF) {
            // 2KB internal RAM
            address = address % 0x800;
            return this.WRAM[address];

        } else if (0x2000 <= address && address <= 0x3FFF) {
            // PPU Registers
            address = address % 0x008;
            return this.PPU.readRegister(address);

        } else if (0x4000 <= address && address <= 0x4017) {
            // APU and I/0 registers

        } else if (0x4018 <= address && address <= 0x401F) {
            // APU and I/O functionality that is normally disabled.

        } else if (0x4020 <= address && address <= 0xFFFF) {
            return this.ROM.MAPPER.readMemory(address);
        }
    }

    cpuWriteMemory(address, byte) {
        if (0x0000 <= address && address <= 0x1FFF) {
            // 2KB internal RAM
            address = address % 0x800;
            this.WRAM[address] = byte;

        } else if (0x2000 <= address && address <= 0x3FFF) {
            // PPU Registers
            address = address % 0x008;
            return this.PPU.writeRegister(address);

        } else if (0x4000 <= address && address <= 0x4017) {
            // APU and I/0 registers

        } else if (0x4018 <= address && address <= 0x401F) {
            // APU and I/O functionality that is normally disabled.

        } else if (0x4020 <= address && address <= 0xFFFF) {
            // return this.ROM.MAPPER.readMemory(address);
        }
    }

    ppuReadMemory(address) {

    }

    ppuWriteMemory(address) {

    }
}

export default NES;