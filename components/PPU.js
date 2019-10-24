// Loading utils
import Byte from '../utils/Byte.js';
import { CONSTANTS, MIRRORING } from '../utils/Constants.js';


// 341 Cycles per scanline
const CYCLE_FIRST = 0;
const CYCLE_LAST = 340;
// 262 total scanlines
const SCANLINE_FIRST = -1;
const SCANLINE_LAST = 260;
// Visible screen area
const SCREEN_HEIGHT = 240;
const SCREEN_WIDTH = 256;
// Startup values 
const CYCLE_START = 30;
const SCANLINE_START = 0;

const NES_PALETTE = [
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

class PPU {
    constructor(memoryController) {
        // Initial state
        this.cycle    = CYCLE_START;
        this.scanline = SCANLINE_START;

        // Flags
        this.DMA_OCCURRED = false;
        this.NMI_OCCURRED = false;
        this.NMI_OUTPUT   = false;

        // Registers
        // $2000
        this.REG_PPUCTRL_0 = false;
        this.REG_PPUCTRL_1 = false;
        this.REG_PPUCTRL_2 = false;
        this.REG_PPUCTRL_3 = false;
        this.REG_PPUCTRL_4 = false;
        this.REG_PPUCTRL_5 = false;
        this.REG_PPUCTRL_6 = false;
        this.REG_PPUCTRL_7 = false;
        // $2001
        this.REG_PPUMASK_0 = false;
        this.REG_PPUMASK_1 = false;
        this.REG_PPUMASK_2 = false;
        this.REG_PPUMASK_3 = false;
        this.REG_PPUMASK_4 = false;
        this.REG_PPUMASK_5 = false;
        this.REG_PPUMASK_6 = false;
        this.REG_PPUMASK_7 = false;
        // $2002
        this.REG_PPUSTATUS_0 = false;
        this.REG_PPUSTATUS_1 = false;
        this.REG_PPUSTATUS_2 = false;
        this.REG_PPUSTATUS_3 = false;
        this.REG_PPUSTATUS_4 = false;
        this.REG_PPUSTATUS_5 = false;
        this.REG_PPUSTATUS_6 = false;
        this.REG_PPUSTATUS_7 = false;
        // $2005
        this.REG_PPUSCROLL         = 0x00;
        this.FIRST_PPUSCROLL_WRITE = false;
        // $2006
        this.REG_PPUADDR         = 0x0000;
        this.FIRST_PPUADDR_WRITE = false;
        // $2007
        this.REG_PPUDATA = 0x00;

        this.REG_OAMADDR = 0x00; // $2003
        this.REG_OAMDATA = 0x00; // $2004
        this.REG_OAMDMA  = 0x00; // $4014
        this.PPU_OAM = (new Array(0x100)).fill(0x00);
        
        this.screenCanvas = $('#screenCanvas')[0].getContext('2d', {alpha: true});
        this.screenImage = this.screenCanvas.getImageData(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

        ({
            writeMemory: this.writeMemory,
            readMemory: this.readMemory,
            getDMAMemoryPage: this.getDMAMemoryPage
        } = memoryController.registerComponent('PPU', this));

        this.isFrameReady = false;
        this.isFrameOdd = false;
        this.totalCycles = 0;
    }

    step() {
        this.totalCycles++;

        if (this.cycle === 1 && this.scanline === 241) {
            // Set vBlank flag
            this.REG_PPUSTATUS_7 = true;

            if (this.REG_PPUCTRL_7) {
                this.NMI_OCCURRED = true;
            }
        }

        if (this.cycle === 0 && this.scanline === 260) {
            // Clear vBlank
            this.REG_PPUSTATUS_7 = false;
            this.NMI_OCCURRED = false;
        }

        let isAVisiblePixel = 
            (0 <= this.cycle    && this.cycle    < SCREEN_WIDTH) &&
            (0 <= this.scanline && this.scanline < SCREEN_HEIGHT);

        if (isAVisiblePixel) {
            // Calculate to which 16x16 block of the attributes 
            // table the tile belongs
            let blockCol = Math.floor(this.cycle    / 16);
            let blockRow = Math.floor(this.scanline / 16) * 16;
            let blockPosition = blockCol + blockRow;

            let attrByte = this.readMemory(0x23C0 + blockPosition);

            // Calculate to which tile "cell" of the 16x16 
            // block the tile belongs
            let pixelAttrCol = Math.floor((this.cycle    % 16) / 8);
            let pixelAttrRow = Math.floor((this.scanline % 16) / 8) * 2;
            let tileAttrBitsPosition = pixelAttrCol + pixelAttrRow;
            // Get the correct pair of bits which
            // identifies the palette to use for this tile
            let paletteId = (attrByte >> (tileAttrBitsPosition * 2)) & 0x03;

            // Get the palette to use from memory
            let paletteOffset = paletteId * 4;
            let palette = [
                this.readMemory(0x3F00 + paletteOffset),
                this.readMemory(0x3F01 + paletteOffset),
                this.readMemory(0x3F02 + paletteOffset),
                this.readMemory(0x3F03 + paletteOffset)
            ]; 

            // Calculate to which tile cell this pixel belongs
            let tileCol = Math.floor(this.cycle    / 8);
            let tileRow = Math.floor(this.scanline / 8) * 0x20;
            let tilePosition = tileCol + tileRow;
            // Get the tile number relative to the grid cell
            let nameTableEntry = this.readMemory(0x2000 + tilePosition);

            // Calculate the pixel position inside the 8x8 tile
            let pixelX = this.cycle    % 8;
            let pixelY = this.scanline % 8;

            // Get the two bytes of the corresponding  
            // tile where the target pixel is located
            let tileLowByte  = this.readMemory(0x1000 + (nameTableEntry << 4) + pixelY);
            let tileHighByte = this.readMemory(0x1000 + (nameTableEntry << 4) + pixelY + 8);

            // Calculate the two bits value of the pixel
            let pixelValue = 
                ((tileLowByte  >> (7 - pixelX)) & 0x01) | 
                ((tileHighByte >> (7 - pixelX)) & 0x01) << 1;

            let color = NES_PALETTE[palette[pixelValue]];

            this.drawPixel(color);
        }

        this.cycle++;

        // Counter increments
        if (this.cycle > CYCLE_LAST) {
            this.cycle = CYCLE_FIRST;
            this.scanline++;
        }

        if (this.scanline > SCANLINE_LAST) {
            this.scanline = SCANLINE_FIRST;
        }

        // Frame is ready
        if (this.cycle    === CYCLE_FIRST && 
            this.scanline === SCANLINE_FIRST) {

            this.isFrameReady = true;
            this.isFrameOdd = !this.isFrameOdd;
        }
    }

    reset() {
        return;
    }

    drawPixel(hexColor) {
        let index = (4 * this.scanline * SCREEN_WIDTH) + (4 * this.cycle);
        this.screenImage.data[index + 0] = (hexColor >> 16) & 0xFF; // Red
        this.screenImage.data[index + 1] = (hexColor >> 8)  & 0xFF; // Green
        this.screenImage.data[index + 2] = (hexColor >> 0)  & 0xFF; // Blue
        this.screenImage.data[index + 3] = 0xFF; // Alpha 
    }

    drawFrame() {
        this.screenCanvas.putImageData(this.screenImage, 0, 0);
        this.isFrameReady = false;
    }

    dispatchDMA() {
        let memoryPage = this.getDMAMemoryPage(this.REG_OAMDMA);

        for (let i = this.REG_OAMADDR; i < 0x100; i++) {
            this.PPU_OAM[i] = memoryPage[i];
        }
    }

    write2000(byte) {
        this.REG_PPUCTRL_0 = Byte.isBitSetAtPosition(byte, 0);
        this.REG_PPUCTRL_1 = Byte.isBitSetAtPosition(byte, 1);
        this.REG_PPUCTRL_2 = Byte.isBitSetAtPosition(byte, 2);
        this.REG_PPUCTRL_3 = Byte.isBitSetAtPosition(byte, 3);
        this.REG_PPUCTRL_4 = Byte.isBitSetAtPosition(byte, 4);
        this.REG_PPUCTRL_5 = Byte.isBitSetAtPosition(byte, 5);
        this.REG_PPUCTRL_6 = Byte.isBitSetAtPosition(byte, 6);
        this.REG_PPUCTRL_7 = Byte.isBitSetAtPosition(byte, 7);

        this.NMI_OUTPUT = Byte.isBitSetAtPosition(byte, 7);
        console.log("WRITE 2000 to " + this.NMI_OUTPUT);
        this.update2002(byte);
    }

    write2001(byte) {
        this.REG_PPUMASK_0 = Byte.isBitSetAtPosition(byte, 0);
        this.REG_PPUMASK_1 = Byte.isBitSetAtPosition(byte, 1);
        this.REG_PPUMASK_2 = Byte.isBitSetAtPosition(byte, 2);
        this.REG_PPUMASK_3 = Byte.isBitSetAtPosition(byte, 3);
        this.REG_PPUMASK_4 = Byte.isBitSetAtPosition(byte, 4);
        this.REG_PPUMASK_5 = Byte.isBitSetAtPosition(byte, 5);
        this.REG_PPUMASK_6 = Byte.isBitSetAtPosition(byte, 6);
        this.REG_PPUMASK_7 = Byte.isBitSetAtPosition(byte, 7);
        this.update2002(byte);
    }

    read2002() {
        let currentRegister = 
            ((this.REG_PPUSTATUS_0 ? 1 : 0 ) << 0) |
            ((this.REG_PPUSTATUS_1 ? 1 : 0 ) << 1) |
            ((this.REG_PPUSTATUS_2 ? 1 : 0 ) << 2) |
            ((this.REG_PPUSTATUS_3 ? 1 : 0 ) << 3) |
            ((this.REG_PPUSTATUS_4 ? 1 : 0 ) << 4) |
            ((this.REG_PPUSTATUS_5 ? 1 : 0 ) << 5) |
            ((this.REG_PPUSTATUS_6 ? 1 : 0 ) << 6) |
            ((this.REG_PPUSTATUS_7 ? 1 : 0 ) << 7);

        // Reset vBlank flag
        this.REG_PPUSTATUS_7 = false;
        this.NMI_OCCURRED  = false;

        // Clear address latch
        this.REG_PPUADDR = 0x0000;

        return currentRegister;
    }

    write2003(byte) {
        this.REG_OAMADDR = byte;
        this.update2002(byte);
    }

    read2004() {
        return this.REG_OAMDATA;
    }

    write2004(byte) {
        this.REG_OAMDATA = byte;
        this.update2002(byte);
    }

    write2005(byte) {
        // This register is written twice, upper byte first
        this.REG_PPUSCROLL |= byte << (this.FIRST_PPUSCROLL_WRITE ? 0 : 8);

        if (this.FIRST_PPUSCROLL_WRITE) {
            console.log(`Scroll 2005 updated: ${this.REG_PPUSCROLL.toString(16)}`);
        }

        this.FIRST_PPUSCROLL_WRITE = !this.FIRST_PPUSCROLL_WRITE;
        this.update2002(byte);
    }

    write2006(byte) {
        // This register is written twice, upper byte first
        this.REG_PPUADDR |= byte << (this.FIRST_PPUADDR_WRITE ? 0 : 8);

        this.FIRST_PPUADDR_WRITE = !this.FIRST_PPUADDR_WRITE;
        this.update2002(byte);
    }

    read2007() {
        return this.REG_PPUDATA;
    }

    write2007(byte) {
        this.REG_PPUDATA = byte;
        this.writeMemory(this.REG_PPUDATA, this.REG_PPUADDR);

        this.REG_PPUADDR += this.REG_PPUCTRL_3 ? 32 : 1;
        this.update2002(byte);
    }

    write4014(byte) {
        this.REG_OAMDMA = byte;
        this.DMA_OCCURRED = true;
    }

    update2002(byte) {
        this.REG_PPUSTATUS_0 = Byte.isBitSetAtPosition(byte, 0);
        this.REG_PPUSTATUS_1 = Byte.isBitSetAtPosition(byte, 1);
        this.REG_PPUSTATUS_2 = Byte.isBitSetAtPosition(byte, 2);
        this.REG_PPUSTATUS_3 = Byte.isBitSetAtPosition(byte, 3);
        this.REG_PPUSTATUS_4 = Byte.isBitSetAtPosition(byte, 4);
    }




    // getPPURegisterByte(registerLabel) {
    //     let byte = 0x00;

    //     for (let i = 0; i < 8; i++) {
    //         if (typeof this[`REG_${registerLabel}_${i}`] === 'undefined') {
    //             throw new Error(`Invalid PPU register: ${registerLabel}`);
    //         } else {
    //             byte += (this[`REG_${registerLabel}_${i}`] ? 1 : 0) << i;
    //         }
    //     }

    //     return byte;
    // }

    // setPPURegister(registerLabel, byte) {
    //     byte &= 0xFF;

    //     for (let i = 0; i < 8; i++) {
    //         if (typeof this[`REG_${registerLabel}_${i}`] === 'undefined') {
    //             throw new Error(`Invalid PPU register: ${registerLabel}`);
    //         } else {
    //             this[`REG_${registerLabel}_${i}`] = Byte.isBitSetAtPosition(byte, i);
    //         }
    //     }
    // }
}

export default PPU;