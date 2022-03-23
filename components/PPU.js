'use strict';

import VGA from "./VGA.js";
import { Register8Bit } from "./Register.js";
import { PPU_STATUS_FLAGS } from "./Constants.js";

class PPU {
    constructor(BUS) {
        this.BUS = BUS

        this.X_MAX = 340;
        this.Y_MAX = 261;

        // Visible area
        this.VISIBLE_Y = 240;
        this.VISIBLE_X = 256;

        // Graphics adapter
        this.VGA = new VGA(this.VISIBLE_Y, this.VISIBLE_X);

        // Registers
        this.REGISTER_PPUCTRL   = new Register8Bit();
        this.REGISTER_PPUMASK   = new Register8Bit();
        this.REGISTER_PPUSTATUS = new Register8Bit();
        this.REGISTER_OAMADDR   = new Register8Bit();
        this.REGISTER_OAMDATA   = new Register8Bit();
        this.REGISTER_PPUSCROLL = new Register8Bit();
        this.REGISTER_PPUADDR   = new Register8Bit();
        this.REGISTER_PPUDATA   = new Register8Bit();

        // NES color palette
        this.PALETTE = [
            0x757575,
            0x271B8F,
            0x0000AB,
            0x47009F,
            0x8F0077,
            0xAB0013,
            0xA70000,
            0x7F0B00,
            0x432F00,
            0x004700,
            0x005100,
            0x003F17,
            0x1B3F5F,
            0x000000,
            0x000000,
            0x000000,
            0xBCBCBC,
            0x0073EF,
            0x233BEF,
            0x8300F3,
            0xBF00BF,
            0xE7005B,
            0xDB2B00,
            0xCB4F0F,
            0x8B7300,
            0x009700,
            0x00AB00,
            0x00933B,
            0x00838B,
            0x000000,
            0x000000,
            0x000000,
            0xFFFFFF,
            0x3FBFFF,
            0x5F97FF,
            0xA78BFD,
            0xF77BFF,
            0xFF77B7,
            0xFF7763,
            0xFF9B3B,
            0xF3BF3F,
            0x83D313,
            0x4FDF4B,
            0x58F898,
            0x00EBDB,
            0x000000,
            0x000000,
            0x000000,
            0xFFFFFF,
            0xABE7FF,
            0xC7D7FF,
            0xD7CBFF,
            0xFFC7FF,
            0xFFC7DB,
            0xFFBFB3,
            0xFFDBAB,
            0xFFE7A3,
            0xE3FFA3,
            0xABF3BF,
            0xB3FFCF,
            0x9FFFF3,
            0x000000,
            0x000000,
            0x000000
        ];

        this.currentX = 0;
        this.currentY = 0;

        this.isFrameOdd = false;
        this.isFrameReady = false;

        this.currentCycle = 0;
    }

    step() {

        let isPixelVisible =
            (0 <= this.currentX && this.currentX <= this.VISIBLE_X) &&
            (0 <= this.currentY && this.currentY <= this.VISIBLE_Y);

        if (isPixelVisible) {
            let randomColor = this.PALETTE[parseInt(Math.random() * this.PALETTE.length)];

            this.VGA.drawPixel(
                this.currentX,
                this.currentY,
                randomColor >> 16 & 0xFF,
                randomColor >> 8  & 0xFF,
                randomColor >> 0  & 0xFF,
                0xFF
            );
        }

        this.currentX += 1;

        if (this.currentX === this.X_MAX) {
            this.currentX = 0;
            this.currentY += 1;
        }

        if (this.currentY === this.Y_MAX) {
            this.currentY = 0;
            this.isFrameReady = true;
        }

        if (this.currentX === 1) {
            if (this.currentY === 241) {
                // Set vBlank
                this.REGISTER_PPUSTATUS.setBit(PPU_STATUS_FLAGS.VBLANK);
            }
        }

        // Pre-render line
        if (this.currentY === 261) {
            if (this.currentX === 1) {
                // Set vBlank
                this.REGISTER_PPUSTATUS.clearBit(PPU_STATUS_FLAGS.VBLANK);
            }
        }

        this.currentCycle += 1;
    }

    renderFrame() {
        this.VGA.renderFrame();
        this.isFrameReady = false;

        console.log(`FRAME ${this.isFrameOdd ? 'ODD' : 'EVEN'}`);
        this.isFrameOdd = !this.isFrameOdd;
    }

    readRegister(address) {
        switch (address) {
            case 0x00:
                return this.REGISTER_PPUCTRL.value();
            case 0x01:
                return this.REGISTER_PPUMASK.value();
            case 0x02:
                let previousStatus = this.REGISTER_PPUSTATUS.value();
                this.REGISTER_PPUSTATUS.clearBit(PPU_STATUS_FLAGS.VBLANK);
                return previousStatus;
            case 0x03:
                return this.REGISTER_OAMADDR.value();
            case 0x04:
                return this.REGISTER_OAMDATA.value();
            case 0x05:
                return this.REGISTER_PPUSCROLL.value();
            case 0x06:
                return this.REGISTER_PPUADDR.value();
            case 0x07:
                return this.REGISTER_PPUDATA.value();
            default:
                throw new Error('Invalid PPU register selected for read');
        }
    }

    writeRegister(address, byte) {
        switch (address) {
            case 0x00:
                this.REGISTER_PPUCTRL.set(byte);
                break;
            case 0x01:
                this.REGISTER_PPUMASK.set(byte);
                break;
            case 0x02:
                this.REGISTER_PPUSTATUS.set(byte);
                break;
            case 0x03:
                this.REGISTER_OAMADDR.set(byte);
                break;
            case 0x04:
                this.REGISTER_OAMDATA.set(byte);
                break;
            case 0x05:
                this.REGISTER_PPUSCROLL.set(byte);
                break;
            case 0x06:
                this.REGISTER_PPUADDR.set(byte);
                break;
            case 0x07:
                this.REGISTER_PPUDATA.set(byte);
                break;
            default:
                throw new Error('Invalid PPU register selected for write');
        }
    }
}

export default PPU;