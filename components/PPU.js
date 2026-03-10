'use strict';

import VGA from "./VGA.js";

import { Register8Bit, Register16Bit, PPU15BitRegister } from "../utils/BinaryStructures.js";
import { PPU_STATUS_FLAGS, PPU_CONTROL_FLAGS, PPU_MASK_FLAGS } from "../utils/Constants.js";

class PPU {
    constructor(BUS) {
        this.BUS = BUS

        // Zero indexed maximum coordinates
        this.X_MAX = 340;
        this.Y_MAX = 261;

        this.SCREEN_WIDTH = 256;
        this.SCREEN_HEIGHT = 240;

        // Graphics adapter
        this.VGA = new VGA(this.SCREEN_HEIGHT, this.SCREEN_WIDTH);

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

        // Registers
        this.REGISTER_PPUCTRL   = new Register8Bit();
        this.REGISTER_PPUMASK   = new Register8Bit();
        this.REGISTER_PPUSTATUS = new Register8Bit(0xA0); // VBlank and sprite overflow are set by default
        this.REGISTER_OAMADDR   = new Register8Bit();
        this.REGISTER_OAMDATA   = new Register8Bit();
        this.REGISTER_PPUDATA   = new Register8Bit();

        // Internal registers
        this.W = 0;
        this.X = 0;
        this.T = new PPU15BitRegister();
        this.V = new PPU15BitRegister();

        this.currentX = 21;
        this.currentY = 0;
        this.currentFetchStep = 0;

        this.isFrameOdd = false;
        this.isFrameReady = false;

        this.totalCycles = 0;
        this.lastFrameTime = Date.now();

        this.shiftPatternLow  = new Register16Bit();
        this.shiftPatternHigh = new Register16Bit();
        this.shiftAttrLow     = new Register16Bit();
        this.shiftAttrHigh    = new Register16Bit();

        this.bgPlanes = new Register16Bit();
        this.ptLowAddress = new Register16Bit();
        this.ptHighAddress = new Register16Bit();   
        this.currentTileIndex = new Register8Bit();
        this.attributeTableEntry = 0;
    }
  
    
    step() {
        const x = this.currentX;
        const y = this.currentY;

        if (y === 261 && this._isRenderingEnabled()) {
            if (x === 1) {
                // Clear vBlank
                this.REGISTER_PPUSTATUS.clearBit(PPU_STATUS_FLAGS.VBLANK);
            }

            if (x >= 280 && x <= 304) {
                this.V.verticalComponents = this.T.verticalComponents;
            }
        }

        if ((y < 240 || y === 261) && this._isRenderingEnabled()) {
            if (y === 0 && x === 0) {
                this.currentFetchStep = 0;
            }
            
            if (x >= 1 && x <= 256 || x >= 321 && x <= 336) {
                this._fetchStep();

                if (x % 8 === 0) {
                    this.V.incrementCoarseX();
                }
            }

            if (x === 256) {
                this.V.incrementFineY();
            }

            if (x === 257) {
                this.V.horizontalComponents = this.T.horizontalComponents;
            }
        }

        if (y < 240 && x >= 1 && x <= 256) {
            const outputPixel = this._computePixel();

            this.VGA.drawPixel(
                x,
                y,
                outputPixel.r,
                outputPixel.g,
                outputPixel.b,
                0xFF,
            );
        }

        // NMI 
        if (y === 241) {
            if (x === 1) {
                // Set vBlank
                this.REGISTER_PPUSTATUS.setBit(PPU_STATUS_FLAGS.VBLANK);
                
                // Check if NMI bit is enabled
                if (this.REGISTER_PPUCTRL.getBit(PPU_CONTROL_FLAGS.NMI)) {
                    this.BUS.CPU.setNmi();
                }
            }
        }

        this.currentX += 1;

        if (this.currentX >= this.X_MAX) {
            this.currentX = 0;
            this.currentY += 1;

            if (this.currentY > this.Y_MAX) {
                this.currentY = 0;
                this.isFrameReady = true;
            }
        }

        this.totalCycles += 1;
    }

    _isRenderingEnabled() {
        return this.REGISTER_PPUMASK.getBit(PPU_MASK_FLAGS.ENABLE_BACKGROUND) || this.REGISTER_PPUMASK.getBit(PPU_MASK_FLAGS.ENABLE_SPRITES);
    }

    _loadShiftRegisters() {
        this.shiftPatternLow.lowerByte = this.bgPlanes.lowerByte;
        this.shiftPatternHigh.lowerByte = this.bgPlanes.higherByte;
        this.shiftAttrLow.lowerByte = (this.attributeTableEntry & 0x01 ? 0xFF : 0x00);
        this.shiftAttrHigh.lowerByte = (this.attributeTableEntry & 0x02 ? 0xFF : 0x00);
    }

    _shiftRegisters() {
        this.shiftAttrLow.shiftLeft();
        this.shiftAttrHigh.shiftLeft();
        this.shiftPatternLow.shiftLeft();
        this.shiftPatternHigh.shiftLeft();
    }

    _fetchStep() {
        this.currentFetchStep = this.currentFetchStep % 8;

        switch (this.currentFetchStep) {
            case 0:
                this._loadShiftRegisters();
                break;
                
            case 1:
                // Fetching the current tile index from the nametable starting
                // from the nametable base address.
                this.currentTileIndex.value = this.BUS.ppuReadMemory(0x2000 + this.V.nametableAddressOffset);
                break;
                
            case 3:
                const attributeTableAddress = 0x23C0 + this.V.attributeTableAddressOffset;
                // Getting the attribute table which is a byte that contains palette information
                // for a 4x4 block of tiles.
                let attributeTable = this.BUS.ppuReadMemory(attributeTableAddress);
                
                // Using coarseX and coarseY we can datermine which 2x2 block of
                // the attribute table we are interested in.
                if (this.V.coarseX & 0x02) {
                    attributeTable >>= 2;
                }
                if (this.V.coarseY & 0x02) {
                    attributeTable >>= 4;
                }
                
                // Cleaning the shifted attribute table to get only the lowest 2 bits
                // that corresponds to the palette index for the current tile.
                this.attributeTableEntry = attributeTable & 0x03;
                break;
                
            case 5:
                // DCBA98 76543210
                // ---------------
                // 0HNNNN NNNNPyyy
                // |||||| |||||+++- T: Fine Y offset, the row number within a tile
                // |||||| ||||+---- P: Bit plane (0: less significant bit; 1: more significant bit)
                // ||++++-++++----- N: Tile number from name table
                // |+-------------- H: Half of pattern table (0: "left"; 1: "right")
                // +--------------- 0: Pattern table is at $0000-$1FFF

                // Composing low plane pattern table address.
                this.ptLowAddress.value =
                    (this.REGISTER_PPUCTRL.getBit(PPU_CONTROL_FLAGS.BG_PT_ADDRESS) << 12) |
                    (this.currentTileIndex.value << 4) |
                    (this.V.fineY & 0x07);

                this.bgPlanes.lowerByte = this.BUS.ppuReadMemory(this.ptLowAddress.value);
                break;
                
            case 7:
                // Composing high plane pattern table address by adding 8 to the low plane address.
                this.ptHighAddress.value = this.ptLowAddress.value | 0x08;
                this.bgPlanes.higherByte = this.BUS.ppuReadMemory(this.ptHighAddress.value);
                break;

            default:
                break;
        }

        this._shiftRegisters();
        this.currentFetchStep += 1;
    }

    _computePixel() {
        // Create a mask which will tell us which bit of the current shift pattern
        // register we are interested in. Shifting by X (fineX) will allow pixel
        // scrolling within the same tile.
        const bitMux = 0x8000 >> this.X;

        const p0 = (this.shiftPatternLow.value  & bitMux) ? 1 : 0;
        const p1 = (this.shiftPatternHigh.value & bitMux) ? 1 : 0;
        const pixel = (p1 << 1) | p0;
 
        const a0 = (this.shiftAttrLow.value  & bitMux) ? 1 : 0;
        const a1 = (this.shiftAttrHigh.value & bitMux) ? 1 : 0;
        const palette = (a1 << 1) | a0;
        
        const paletteAddr = (pixel === 0)
            ? 0x3F00 // Default palette transparent color
            : 0x3F00 | (palette << 2) | pixel;

        const colorIndex = this.BUS.ppuReadMemory(paletteAddr) & 0x3F;
        const paletteColor = this.PALETTE[colorIndex];

        return {
            r: paletteColor >> 16 & 0xFF, // Red
            g: paletteColor >> 8  & 0xFF, // Green
            b: paletteColor       & 0xFF, // Blue
        };
    }

    renderFrame() {
        this.BUS.updateUI();

        this.VGA.renderFrame();
        this.debugNametable(document.getElementById('debug-nametable'));

        this.isFrameOdd = !this.isFrameOdd;
        this.isFrameReady = false;
        
        this.lastFrameTime = Date.now();
    }

    readRegister(address) {
        switch (address) {
            case 0x00:
                return this.REGISTER_PPUCTRL.value;
            case 0x01:
                return this.REGISTER_PPUMASK.value;
            case 0x02:
                let previousStatus = this.REGISTER_PPUSTATUS.value;
                this.REGISTER_PPUSTATUS.clearBit(PPU_STATUS_FLAGS.VBLANK);
                this.W = 0;
                return previousStatus;
            case 0x03:
                return this.REGISTER_OAMADDR.value;
            case 0x04:
                return this.REGISTER_OAMDATA.value;
            case 0x05:
                // Should be read only
                return 0x00;
            case 0x06:
                // Should be read only
                return 0x00;
            case 0x07:
                let buffered = this.REGISTER_PPUDATA.value;
                const newData = this.BUS.ppuReadMemory(this.V.value);
                
                if (this.V.value >= 0x3F00) {
                    buffered = newData;
                    this.REGISTER_PPUDATA.value = this.BUS.ppuReadMemory(this.V.value & 0x2FFF);
                } else {
                    this.REGISTER_PPUDATA.value = newData;
                }
                
                this.V.value += (this.REGISTER_PPUCTRL.getBit(PPU_CONTROL_FLAGS.VRAM_ADDRESS_INCREMENT) ? 32 : 1);
                return buffered;
            default:
                throw new Error('Invalid PPU register selected for read');
        }
    }

    writeRegister(address, byte) {
        switch (address) {
            case 0x00:
                this.REGISTER_PPUCTRL.value = byte;
                this.T.nametable = byte & 0x03;
                break;
            case 0x01:
                this.REGISTER_PPUMASK.value = byte;
                break;
            case 0x02:
                // this.REGISTER_PPUSTATUS.value = byte;
                break;
            case 0x03:
                this.REGISTER_OAMADDR.value = byte;
                break;
            case 0x04:
                this.REGISTER_OAMDATA.value = byte;
                break;
            case 0x05:
                if (!this.W) {
                    this.T.coarseX = (byte & 0xF8) >> 3;
                    this.X = byte & 0x07;
                    this.W = 1;

                } else {
                    this.T.coarseY = (byte & 0xF8) >> 3;
                    this.T.fineY = byte & 0x07;
                    this.W = 0;
                }
                break;
            case 0x06:
                if (!this.W) {
                    this.T.higherByte = byte & 0x3F;
                    this.W = 1;
                } else {
                    this.T.lowerByte = byte;
                    // In theory we should wait 1/1.5 cycles to copy the value
                    // from T to V but for now we just copy it immediately.
                    this.V.value = this.T.value;
                    this.W = 0;
                }
                break;
            case 0x07:
                this.BUS.ppuWriteMemory(this.V.value, byte);
                this.V.value += (this.REGISTER_PPUCTRL.getBit(PPU_CONTROL_FLAGS.VRAM_ADDRESS_INCREMENT) ? 32 : 1);
                break;
            default:
                throw new Error('Invalid PPU register selected for write');
        }
    }

    // Debugging method to draw the nametable on a canvas
    debugNametable(canvas) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(256, 240);
    
        for (let tileY = 0; tileY < 30; tileY++) {
            for (let tileX = 0; tileX < 32; tileX++) {
                
                // Leggi tile dalla nametable
                const ntAddr = 0x2000 + (tileY * 32) + tileX;
                const tileIndex = this.BUS.ppuReadMemory(ntAddr);
                
                for (let row = 0; row < 8; row++) {
                    const ptAddr = (this.REGISTER_PPUCTRL.getBit(4) << 12) |
                                   (tileIndex << 4) | row;
                    const low  = this.BUS.ppuReadMemory(ptAddr);
                    const high = this.BUS.ppuReadMemory(ptAddr | 0x08);
                    
                    for (let col = 0; col < 8; col++) {
                        const bit = 7 - col;
                        const p0 = (low  >> bit) & 1;
                        const p1 = (high >> bit) & 1;
                        const pixel = (p1 << 1) | p0;
    
                        const px = tileX * 8 + col;
                        const py = tileY * 8 + row;
                        const idx = (py * 256 + px) * 4;
    
                        // Colori semplici: 0=nero, 1=grigio, 2=bianco, 3=rosso
                        const colors = [
                            [0,0,0], [128,128,128], [255,255,255], [255,0,0]
                        ];
                        
                        // const color = (ptAddr /0x1FF * 255) | 0;

                        const [r, g, b] = colors[pixel];
                        imageData.data[idx]     = r;
                        imageData.data[idx + 1] = g;
                        imageData.data[idx + 2] = b;
                        imageData.data[idx + 3] = 255;
                    }
                }
            }
        }
    
        ctx.putImageData(imageData, 0, 0);
    } 
}

export default PPU;