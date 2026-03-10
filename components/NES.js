'use strict';

import CONSTANTS from "../utils/Constants.js";

import ROM from "./ROM.js";
import CPU from "./CPU.js";
import PPU from "./PPU.js";
// import APU from "./APU.js";
import UI  from "../utils/UI.js";

class NES {
    constructor() {
        // When true, PPU draws the nametable and UI refreshes the debug panel
        this.debugViewActive = false;
        this.pauseExecution = true;

        this.ROM = null;

        // this.APU = new APU(this);
        this.PPU = new PPU(this);
        this.CPU = new CPU(this);
        this.UI  = new UI(this);

        // 2KB Internal RAM
        this.WRAM = new Uint8Array(0x800).fill(0x00);

        // 2KB Video RAM
        this.VRAM = new Uint8Array(0x800).fill(0x00);

        // 32-byte Palette RAM
        this.PALETTE_RAM = new Uint8Array(0x20).fill(0x00);
    }

    loadCartridge(romData) {
        this.ROM = new ROM(romData);
    }

    powerOn() {
        this.CPU.powerOn();

        // When pressing F on keyboard, do a frame step
        document.addEventListener('keydown', (event) => {
            if (event.key === 'f') {
                this.frame();
            }

            // When pressing S on keyboard, do a step
            if (event.key === 's') {
                this.step();
            }

            // When pressing R on keyboard, reset the NES
            if (event.key === 'r') {
                this.reset();
            }

            // When pressing SPACE on keyboard, pause or resume the execution
            if (event.key === ' ') {
                this.pauseExecution = !this.pauseExecution;
            }
        });

        const frameLoop = (time) => {
            if (!this.pauseExecution) {
                this.frame();
            }
            window.requestAnimationFrame(frameLoop);
        };

        window.requestAnimationFrame(frameLoop);
    }

    // reset() {}

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
            address = address % 0x800; // Mirroring
            return this.WRAM[address];

        } else if (0x2000 <= address && address <= 0x3FFF) {
            // PPU Registers
            address = address % 0x008; // Mirroring
            return this.PPU.readRegister(address);

        } else if (0x4000 <= address && address <= 0x4017) {
            // APU and I/0 registers
            if (address === 0x4016) {
                const b = window.button;
                window.button = 0;
                return b;
            }

        } else if (0x4018 <= address && address <= 0x401F) {
            // APU and I/O functionality that is normally disabled.

        } else if (0x4020 <= address && address <= 0xFFFF) {
            return this.ROM.MAPPER.readMemory(address);
        }
    }

    cpuWriteMemory(address, byte) {
        if (0x0000 <= address && address <= 0x1FFF) {
            // 2KB internal RAM
            address = address % 0x800; // Mirroring
            this.WRAM[address] = byte;

        } else if (0x2000 <= address && address <= 0x3FFF) {
            // PPU Registers
            address = address % 0x008; // Mirroring
            return this.PPU.writeRegister(address, byte);

        } else if (0x4000 <= address && address <= 0x4017) {
            // APU and I/0 registers
        } else if (0x4018 <= address && address <= 0x401F) {
            // APU and I/O functionality that is normally disabled.
        } else if (0x4020 <= address && address <= 0xFFFF) {
        }
    }

    ppuReadMemory(address) {
        if (0x0000 <= address && address <= 0x1FFF) {
            return this.ROM.MAPPER.readMemory(address);

        } else if (0x2000 <= address && address <= 0x3EFF) {
            address = address & 0x0FFF; // Mirroring
            
            if (this.ROM.MIRRORING_TYPE === CONSTANTS.V_MIRRORING) {
                // Vertical: NT0=VRAM[0], NT1=VRAM[1], NT2=mirror NT0, NT3=mirror NT1
                address = address & 0x07FF;

            } else if (this.ROM.MIRRORING_TYPE === CONSTANTS.H_MIRRORING) {
                // Horizontal: NT0=VRAM[0], NT1=mirror NT0, NT2=VRAM[1], NT3=mirror NT1
                if (address < 0x0800) {
                    address = address & 0x03FF; // NT0 and NT1
                } else {
                    address = 0x0400 + (address & 0x03FF); // NT2 and NT3
                }
            }
            
            return this.VRAM[address];

        } else if (0x3F00 <= address && address <= 0x3FFF) {
            address = address & 0x1F;
            
            // Mirror $3F10/$3F14/$3F18/$3F1C → $3F00/$3F04/$3F08/$3F0C
            if (address === 0x10 || address === 0x14 || 
                address === 0x18 || address === 0x1C) {
                address &= 0x0F;
            }
            
            return this.PALETTE_RAM[address];
        }
    }

    ppuWriteMemory(address, byte) {
        address = address & 0x3FFF; // Mirroring
    
        if (0x0000 <= address && address <= 0x1FFF) {
            this.ROM.MAPPER.writeMemory(address, byte);
    
        } else if (0x2000 <= address && address <= 0x3EFF) {
            address = address & 0x0FFF;
    
            if (this.ROM.MIRRORING_TYPE === CONSTANTS.V_MIRRORING) {
                address = address & 0x07FF;
            } else if (this.ROM.MIRRORING_TYPE === CONSTANTS.H_MIRRORING) {
                if (address < 0x0800) {
                    address = address & 0x03FF;
                } else {
                    address = 0x0400 + (address & 0x03FF);
                }
            }
    
            this.VRAM[address] = byte;
    
        } else if (0x3F00 <= address && address <= 0x3FFF) {
            address = address & 0x1F;

            if (address === 0x10 ||
                address === 0x14 ||
                address === 0x18 ||
                address === 0x1C) {
                // Transparency: 0x10, 0x14, 0x18, 0x1C → 0x00, 0x04, 0x08, 0x0C
                address = address - 0x10;
            }

            this.PALETTE_RAM[address] = byte;
        }
    }
}

export default NES;