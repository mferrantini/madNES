'use strict';

import VGA from "./VGA.js";

import { Byte, Register8Bit, Register16Bit, PPU15BitRegister } from "../utils/BinaryStructures.js";
import { PPU_STATUS_FLAGS, PPU_CONTROL_FLAGS, PPU_MASK_FLAGS, PPU_SPRITE_ATTR_FLAGS } from "../utils/Constants.js";

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
        this.REGISTER_PPUDATA   = new Register8Bit();

        // Internal registers
        this.W = 0;
        this.X = 0;
        this.T = new PPU15BitRegister();
        this.V = new PPU15BitRegister();

        // 256 bytes of primary OAM memory
        this.PRIMARY_OAM = new Uint8Array(0x100).fill(0x00);
        // 32 bytes of secondary OAM temporary memory
        this.SECONDARY_OAM = new Uint8Array(0x20).fill(0x00);
        // Index which will be used to scroll the secondary OAM memory
        this.secondaryOAMPointer = 0;

        // Background Fetching
        this.currentBgFetchStep = 0;
        this.currentBgTileIndex = new Register8Bit();
        
        this.bgLowAttributesShiftRegister  = new Register16Bit();
        this.bgHighAttributesShiftRegister = new Register16Bit();
        this.bgLowPatternShiftRegister     = new Register16Bit();
        this.bgHighPatternShiftRegister    = new Register16Bit();

        this.bgAttributeTableEntry = 0;
        this.bgLowPlane  = new Byte(0x00);
        this.bgHighPlane = new Byte(0x00);
        this.bgPatternTableAddress = new Register16Bit();

        // Sprite evaluation
        this.spriteEvaluationIndex = 0
        this.spriteEvaluationByteIndex = 0
        this.spriteEvaluationScanlineCount = 0;
        this.spriteEvaluationZeroHit = false;
        this.spriteEvaluationOamByte = new Byte(0xFF)
        this.spriteEvaluationPerScanlineCount = new Array(240).fill(0); // 240 scanlines in total
        this.spriteEvaluationZeroHitPerScanline = new Array(240).fill(false);

        // Sprite Fetching
        this.currentSpriteFetchStep = 0;
        this.currentFetchedSpriteIndex = 0;
        
        this.spriteFetchLatchY    = new Byte(0);
        this.spriteFetchLatchTile = new Byte(0);

        this.spritePatternTableAddress = new Register16Bit();
        this.spriteXOffsetRegister     = new Array(8).fill(0).map(() => new Byte(0xFF));
        this.spriteLowShiftRegister    = new Array(8).fill(0).map(() => new Register8Bit());
        this.spriteHighShiftRegister   = new Array(8).fill(0).map(() => new Register8Bit());
        this.spriteAttributesRegister  = new Array(8).fill(0).map(() => new Register8Bit());
        
        // Sprite rendering
        this.spriteRenderedPixels = new Uint8Array(8).fill(0); 

        // Current scanline and dot counters
        this.currentX = 21;
        this.currentY = 0;

        // Frame
        this.isFrameOdd = false;
        this.isFrameReady = false;

        this.lastFrameTime = Date.now();

        // Total PPU cycles from the start of the emulation
        this.totalCycles = 0;
        // Total frames from the start of the emulation
        this.totalFrames = 0;
    }
  
    step() {
        const x = this.currentX;
        const y = this.currentY;

        if (x === 0) {
            this.spriteRenderedPixels.fill(0);
        }

        if (this.#isScanlineVisible() && this.#isDotVisible()) {
            const outputPixel = this.#computePixel();

            this.VGA.drawPixel(
                x - 1,
                y,
                outputPixel.r,
                outputPixel.g,
                outputPixel.b,
                0xFF,
            );
        }

        if (this.#isPreRenderScanline() && this.#isRenderingEnabled()) {
            if (x === 1) {
                // Clear vBlank
                this.REGISTER_PPUSTATUS.clearBit(PPU_STATUS_FLAGS.VBLANK);
                this.REGISTER_PPUSTATUS.clearBit(PPU_STATUS_FLAGS.SPRITE_0_HIT);
                this.spriteZeroHit = false;
            }

            if (x >= 280 && x <= 304) {
                this.V.verticalComponents = this.T.verticalComponents;
            }
        }

        if (this.#isScanlineVisible() && this.#isRenderingEnabled()) {
            if (x >= 1 && x <= 64) {
                if (x % 2 === 0) {
                    // Clearing the secondary OAM memory
                    this.SECONDARY_OAM[Math.ceil(x / 2) - 1] = this.#readOAMDATA();
                }
            }

            if (x === 64) {
                this.secondaryOAMPointer = 0;
                this.spriteEvaluationIndex = 0;
                this.spriteEvaluationByteIndex = 0;
                this.evaluationSecondaryOAMPointer = 0;
                this.spriteEvaluationScanlineCount = 0;
                this.spriteEvaluationPerScanlineCount[y + 1] = 0;
            }

            if (x >= 65 && x <= 256) {
                this.#spriteEvaluationStep();
            }
        }

        if ((this.#isScanlineVisible() || this.#isPreRenderScanline()) && this.#isRenderingEnabled()) {
            if (y === 0 && x === 0) {
                this.currentBgFetchStep = 0;
            }
            
            if (this.#isDotVisible() || x >= 321 && x <= 336) {
                this.#executeBgFetchStep();

                if (x % 8 === 0) {
                    this.V.incrementCoarseX();
                }
            }

            if (x === 256) {
                this.V.incrementFineY();
            }

            if (x === 257) {
                this.V.horizontalComponents = this.T.horizontalComponents;

                // Resetting the sprite fetch latches
                this.currentSpriteFetchStep = 0;
                this.currentFetchedSpriteIndex = 0;
            }
            
            if (x >= 257 && x <= 320) {
                this.#spriteFetchStep();
                this.REGISTER_OAMADDR.clear();
            }
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

    // Rendering Utils -----------------------------------------------------------------
    #isRenderingEnabled() {
        return this.REGISTER_PPUMASK.getBit(PPU_MASK_FLAGS.ENABLE_BACKGROUND) || this.REGISTER_PPUMASK.getBit(PPU_MASK_FLAGS.ENABLE_SPRITES);
    }

    #getSpriteHeight() {
        return this.REGISTER_PPUCTRL.getBit(5) ? 16 : 8;
    }

    #isScanlineVisible() {
        return this.currentY < 240;
    }

    #isPreRenderScanline() {
        return this.currentY === 261;
    }

    #isDotVisible() {
        return this.currentX >= 1 && this.currentX <= 256;
    }
    
    // Background Fetch -----------------------------------------------------------------
    #loadBgRegisters() {
        this.bgLowPatternShiftRegister.lowerByte = this.bgLowPlane.value;
        this.bgHighPatternShiftRegister.lowerByte = this.bgHighPlane.value;
        // Based on the attribute table entry, set the whole register to 0xFF or 0x00
        this.bgLowAttributesShiftRegister.lowerByte = (this.bgAttributeTableEntry & 0x01 ? 0xFF : 0x00);
        this.bgHighAttributesShiftRegister.lowerByte = (this.bgAttributeTableEntry & 0x02 ? 0xFF : 0x00);
    }

    #shiftBgRegisters() {
        this.bgLowAttributesShiftRegister.shiftLeft();
        this.bgHighAttributesShiftRegister.shiftLeft();
        this.bgLowPatternShiftRegister.shiftLeft();
        this.bgHighPatternShiftRegister.shiftLeft();
    }

    #executeBgFetchStep() {
        this.currentBgFetchStep = this.currentBgFetchStep % 8;

        switch (this.currentBgFetchStep) {
            case 0:
                this.#loadBgRegisters();
                break;
                
            case 1:
                // Fetching the current tile index from the nametable starting
                // from the nametable base address (0x2000 + nametable address offset).
                this.currentBgTileIndex.value = this.BUS.ppuReadMemory(0x2000 + this.V.nametableAddressOffset);
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
                this.bgAttributeTableEntry = attributeTable & 0x03;
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

                // Composing low plane pattern table address with the structure described above.
                this.bgPatternTableAddress.value =
                    (this.REGISTER_PPUCTRL.getBit(PPU_CONTROL_FLAGS.BG_PT_ADDRESS) << 12) |
                    (this.currentBgTileIndex.value << 4) |
                    (this.V.fineY & 0x07);

                this.bgLowPlane.value = this.BUS.ppuReadMemory(this.bgPatternTableAddress.value);
                break;
                
            case 7:
                // Composing high plane pattern table address by adding 8 to the low plane address.
                let bgPatternTableHighAddress = this.bgPatternTableAddress.value | 0x08;
                this.bgHighPlane.value = this.BUS.ppuReadMemory(bgPatternTableHighAddress);
                break;

            default:
                break;
        }

        this.#shiftBgRegisters();
        this.currentBgFetchStep += 1;
    }

    // Sprite Evaluation -----------------------------------------------------------------
    #shiftSpriteRegistersAndGetPixels(whichSprite, isHFlipped) {
        let p0 = 0;
        let p1 = 0;

        if (isHFlipped) {
            p0 = this.spriteLowShiftRegister[whichSprite].getBit(0);
            p1 = this.spriteHighShiftRegister[whichSprite].getBit(0);
            this.spriteLowShiftRegister[whichSprite].shiftRight();
            this.spriteHighShiftRegister[whichSprite].shiftRight();
        } else {
            p0 = this.spriteLowShiftRegister[whichSprite].getBit(7);
            p1 = this.spriteHighShiftRegister[whichSprite].getBit(7);
            this.spriteLowShiftRegister[whichSprite].shiftLeft();
            this.spriteHighShiftRegister[whichSprite].shiftLeft();
        }

        return [p0, p1];
    }

    #spriteEvaluationStep() {       
        if (this.spriteEvaluationIndex >= 64) return;
 
        if (this.currentX % 2 === 1) {
            // Read the next byte from primary OAM.
            // Each sprite is 4 bytes long: Y, index, attributes, X.
            const oamByteIndex = (this.spriteEvaluationIndex * 4) + this.spriteEvaluationByteIndex;
            this.spriteEvaluationOamByte.value = this.PRIMARY_OAM[oamByteIndex];
        } else {
            if (this.spriteEvaluationScanlineCount < 8) {
                const spriteYPosition = this.spriteEvaluationOamByte.value;

                // Store the fetched byte in the secondary OAM memory
                this.SECONDARY_OAM[this.secondaryOAMPointer] = spriteYPosition;
                
                // Check if we are on the first byte of a sprite. If so, we are
                // on the Y coordinate byte.
                if (this.spriteEvaluationByteIndex === 0) {
                    // Check if the next scanline intersects with the sprite
                    if (spriteYPosition <= this.currentY && this.currentY < spriteYPosition + this.#getSpriteHeight()) {
                        // If so, we can copy the rest of the sprite, so the
                        // next 3 bytes, into the secondary OAM memory.
                        this.secondaryOAMPointer += 1;
                        this.spriteEvaluationByteIndex += 1;

                        // Trigger the sprite zero hit flag if the current sprite is the first one.
                        if (this.spriteEvaluationIndex === 0) {
                            this.spriteEvaluationZeroHitPerScanline[this.currentY + 1] = true;
                        }
                    } else {
                        this.spriteEvaluationIndex += 1;
                    }

                } else {
                    // If we are in this branch, we are scrolling the next 3 bytes of the sprite.
                    this.secondaryOAMPointer += 1;
                    this.spriteEvaluationByteIndex += 1;

                    // Until we have fetched all 4 bytes of the sprite
                    if (this.spriteEvaluationByteIndex === 4) {
                        this.spriteEvaluationIndex += 1;
                        this.spriteEvaluationByteIndex = 0;
                        this.spriteEvaluationScanlineCount += 1;
                        // Storing the number of sprites of the next scanline so we'll
                        // know in advance how many sprites we need to evaluate and render.
                        this.spriteEvaluationPerScanlineCount[this.currentY + 1] = this.spriteEvaluationScanlineCount;
                    }
                }
            } else {
                // Sprite overflow scenario
                const spriteYPosition = this.spriteEvaluationOamByte.value;

                // Check if an hypothetical additional sprite would be visible on the next scanline.
                if (spriteYPosition <= this.currentY && this.currentY < spriteYPosition + this.#getSpriteHeight()) {
                    // If so, we can trigger the sprite overflow flag. Since the evaluation
                    // could have been done on an invalid sprite Y position byte,
                    // this flag is not anymore reliable for game developers.
                    this.REGISTER_PPUSTATUS.setBit(PPU_STATUS_FLAGS.SPRITE_OVERFLOW);
                } else {
                    this.spriteEvaluationIndex += 1;
                }

                // The bug is to increment the sprite byte index in any case. This will
                // lead the next read to potentially fall on an invalid sprite Y position byte.
                this.spriteEvaluationByteIndex += 1;
                if (this.spriteEvaluationByteIndex === 4) {
                    this.spriteEvaluationByteIndex = 0;
                }
            }
        }
    }

    #spriteFetchStep() {
        if (this.currentSpriteFetchStep === 8) {    
            this.currentSpriteFetchStep = 0;
            // Increment the current fetched sprite index
            this.currentFetchedSpriteIndex += 1;
        }
        
        // Fetch only the sprites that will be rendered in the next scanline.
        if (this.currentFetchedSpriteIndex >= this.spriteEvaluationPerScanlineCount[this.currentY + 1]) return;

        const sIndex = this.currentFetchedSpriteIndex;

        switch (this.currentSpriteFetchStep) {
            case 0:
                // Reading the Y coordinate of the sprite
                this.spriteFetchLatchY.value = this.SECONDARY_OAM[sIndex * 4];
                break;
            case 1:
                break;
            case 2:
                // Reading the tile index of the sprite
                this.spriteFetchLatchTile.value = this.SECONDARY_OAM[sIndex * 4 + 1];
                break;
            case 3:
                break;
            case 4:
                // Reading the attributes of the sprite
                this.spriteAttributesRegister[sIndex].value = this.SECONDARY_OAM[sIndex * 4 + 2];
                break;
            case 5:
                break;
            case 6:
                const isVFlipped = this.spriteAttributesRegister[sIndex].getBit(PPU_SPRITE_ATTR_FLAGS.VERTICAL_FLIP);
                const spriteYOffset = this.currentY - this.spriteFetchLatchY.value;
                // Calculating the pixel row within the tile
                const tilePixelRow = isVFlipped ? 7 - spriteYOffset : spriteYOffset;

                // Composing the pattern table address
                this.spritePatternTableAddress.value = 
                    (this.REGISTER_PPUCTRL.getBit(PPU_CONTROL_FLAGS.SPRITE_PT_ADDRESS) << 12) |
                    (this.spriteFetchLatchTile.value << 4) |
                    tilePixelRow;

                // Reading the low plane of the pattern table
                this.spriteLowShiftRegister[sIndex].value = this.BUS.ppuReadMemory(this.spritePatternTableAddress.value);
                break;
            case 7:
                // Reading the high plane of the pattern table
                this.spriteHighShiftRegister[sIndex].value = this.BUS.ppuReadMemory(this.spritePatternTableAddress.value + 0x08);
                this.spriteXOffsetRegister[sIndex].value = this.SECONDARY_OAM[sIndex * 4 + 3];
                break;
        }

        this.currentSpriteFetchStep += 1;
    }

    #computePixel() {
        // Background rendering --------------------------------------------------------------------
        // Create a mask which will tell us which bit of the current shift pattern
        // register we are interested in. Shifting by X (fineX) will allow pixel
        // scrolling within the same tile.
        const bitMux = 0x8000 >> this.X;

        const bgP0 = (this.bgLowPatternShiftRegister.value  & bitMux) ? 1 : 0;
        const bgP1 = (this.bgHighPatternShiftRegister.value & bitMux) ? 1 : 0;
        let backgroundPixel = (bgP1 << 1) | bgP0;

        const bgA0 = (this.bgLowAttributesShiftRegister.value  & bitMux) ? 1 : 0;
        const bgA1 = (this.bgHighAttributesShiftRegister.value & bitMux) ? 1 : 0;
        const bgPaletteIndex = (bgA1 << 1) | bgA0;

        // Sprite rendering --------------------------------------------------------------------
        let spritePixel = 0x00;
        let spritePaletteIndex = 0x00;
        let spriteBackgroundPriority = true;

        const howManySpritesInThisScanline = this.spriteEvaluationPerScanlineCount[this.currentY];

        for (let i = 0; i < howManySpritesInThisScanline; i++) {
            // If the sprite has already rendered 8 pixels, we can skip it.
            if (this.spriteRenderedPixels[i] === 8) continue;

            // If the sprite is not yet visible, we can decrement the X position
            if (this.spriteXOffsetRegister[i].value > 0) {
                this.spriteXOffsetRegister[i].decrement();

            } else {
                // If an opaque pixel is not yet found, we can store the pixel and palette information.
                if (spritePixel === 0) {
                    // Getting the horizontal flip flag (bit 6)
                    const isHFlipped = this.spriteAttributesRegister[i].getBit(PPU_SPRITE_ATTR_FLAGS.HORIZONTAL_FLIP);

                    // Getting the pixel and shift the registers based on the horizontal flip flag.
                    const [p0, p1] = this.#shiftSpriteRegistersAndGetPixels(i, isHFlipped);

                    spritePixel = (p1 << 1) | p0;

                    // Getting the background priority flag (bit 5)
                    spriteBackgroundPriority = this.spriteAttributesRegister[i].getBit(PPU_SPRITE_ATTR_FLAGS.BG_PRIORITY);

                    // Getting the palette index (bits 0-1)
                    spritePaletteIndex = this.spriteAttributesRegister[i].value & 0x03;

                    // Checking if the sprite zero hit flag should be set
                    if (
                        // We are rendering the first sprite.
                        i === 0 && 
                        // The first sprite on the current scanline is the zero sprite.
                        this.spriteEvaluationZeroHitPerScanline[this.currentY] && 
                        // The sprite pixel is not transparent.
                        spritePixel > 0 && 
                        // The background pixel is not transparent.
                        backgroundPixel > 0
                    ) {
                        this.REGISTER_PPUSTATUS.setBit(PPU_STATUS_FLAGS.SPRITE_0_HIT);
                    }
                }

                this.spriteRenderedPixels[i] += 1;
            }
        }

        // Clipping area (dots 0-7 -> x 1-8) -------------------------------------------------------
        const clippingArea = this.currentX >= 1 && this.currentX <= 8;
        if (clippingArea) {
            if (!this.REGISTER_PPUMASK.getBit(PPU_MASK_FLAGS.SHOW_LEFT_BACKGROUND)) {
                backgroundPixel = 0;
            }
            if (!this.REGISTER_PPUMASK.getBit(PPU_MASK_FLAGS.SHOW_LEFT_SPRITES)) {
                spritePixel = 0;
            }
        }

        // Palette address computation -------------------------------------------------------------
        const bgPaletteAddr = (backgroundPixel === 0)
            ? 0x3F00 
            : 0x3F00 | (bgPaletteIndex << 2) | backgroundPixel;

        const spritePaletteAddr = (spritePixel === 0)
            ? 0x3F00
            : 0x3F10 | (spritePaletteIndex << 2) | spritePixel;

        // Checking pixel priority -----------------------------------------------------------------
        let finalPaletteAddr = bgPaletteAddr;

        if (spritePixel > 0) {
            if (backgroundPixel > 0 && spriteBackgroundPriority) {
                finalPaletteAddr = bgPaletteAddr;
            } else {
                finalPaletteAddr = spritePaletteAddr;
            }
        }

        const pixelColorIndex = this.BUS.ppuReadMemory(finalPaletteAddr) & 0x3F;
        const pixelColor = this.PALETTE[pixelColorIndex];

        // Color Emphasis --------------------------------------------------------------------------
        let r = pixelColor >> 16 & 0xFF;
        let g = pixelColor >> 8  & 0xFF;
        let b = pixelColor       & 0xFF;

        if (this.REGISTER_PPUMASK.getBit(PPU_MASK_FLAGS.EMPHASIZE_RED)) {
            g = (g * 0.75) | 0;
            b = (b * 0.75) | 0;
        }
        if (this.REGISTER_PPUMASK.getBit(PPU_MASK_FLAGS.EMPHASIZE_GREEN)) {
            r = (r * 0.75) | 0;
            b = (b * 0.75) | 0;
        }
        if (this.REGISTER_PPUMASK.getBit(PPU_MASK_FLAGS.EMPHASIZE_BLUE)) {
            r = (r * 0.75) | 0;
            g = (g * 0.75) | 0;
        }

        return {
            r,
            g,
            b,
        };
    }

    renderFrame() {
        this.VGA.renderFrame();
        this.BUS.UI.updateUI();

        if (this.BUS.debugViewActive) {
            const nametableEl = document.getElementById('debug-nametable');
            if (nametableEl) this.debugNametable(nametableEl);

            const spritesEl = document.getElementById('debug-sprites');
            if (spritesEl) this.debugSprites(spritesEl);
        }

        this.isFrameReady = false;
        this.isFrameOdd = !this.isFrameOdd;
        
        this.totalFrames += 1;
        this.lastFrameTime = Date.now();
    }

    // PPU Memory Read/Write -----------------------------------------------------------------
    readRegister(address) {
        switch (address) {
            case 0x00:
                // PPUCTRL is write only, so we return 0
                return 0x00;
            case 0x01:
                // PPUMASK is write only, so we return 0
                return 0x00; 
            case 0x02:
                return this.#readPPUSTATUS();
            case 0x03:
                // OAMADDR is write only, so we return 0
                return 0x00;
            case 0x04:
                return this.#readOAMDATA();
            case 0x05:
                // PPUSCROLL is write only, so we return 0
                return 0x00;
            case 0x06:
                // PPUADDR is write only, so we return 0
                return 0x00;
            case 0x07:
                return this.#readPPUDATA();
            default:
                throw new Error('Invalid PPU register selected for read');
        }
    }

    writeRegister(address, byte) {
        switch (address) {
            case 0x00:
                this.#writePPUCTRL(byte);
                break;
            case 0x01:
                this.#writePPUMASK(byte);
                break;
            case 0x02:
                // PPUSTATUS is read only
                break;
            case 0x03:
                this.#writeOAMADDR(byte);
                break;
            case 0x04:
                this.#writeOAMDATA(byte);
                break;
            case 0x05:
                this.#writePPUSCROLL(byte);
                break;
            case 0x06:
                this.#writePPUADDR(byte);
                break;
            case 0x07:
                this.#writePPUDATA(byte);
                break;
            default:
                throw new Error('Invalid PPU register selected for write');
        }
    }

    // PPU register read utils -----------------------------------------------------------------
    #readPPUSTATUS() {
        let previousStatus = this.REGISTER_PPUSTATUS.value;
        this.REGISTER_PPUSTATUS.clearBit(PPU_STATUS_FLAGS.VBLANK);
        this.W = 0;
        return previousStatus;
    }

    #readOAMDATA() {
        if (this.#isScanlineVisible() && this.#isRenderingEnabled()) {
            if (this.currentX >= 1 && this.currentX <= 64) {
                return 0xFF;
            }
        }
        return this.PRIMARY_OAM[this.REGISTER_OAMADDR.value];
    }

    #readPPUDATA() {
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
    }

    // PPU register write utils -----------------------------------------------------------------
    #writePPUCTRL(byte) {
        this.REGISTER_PPUCTRL.value = byte;
        this.T.nametable = byte;
    }

    #writePPUMASK(byte) {
        this.REGISTER_PPUMASK.value = byte;
    }

    #writeOAMADDR(byte) {
        this.REGISTER_OAMADDR.value = byte;
    }

    #writePPUSCROLL(byte) {
        if (!this.W) {
            this.T.coarseX = (byte & 0xF8) >> 3;
            this.X = byte & 0x07;
            this.W = 1;

        } else {
            this.T.coarseY = (byte & 0xF8) >> 3;
            this.T.fineY = byte & 0x07;
            this.W = 0;
        }
    }

    #writePPUADDR(byte) {
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
    }

    #writeOAMDATA(byte) {
        this.PRIMARY_OAM[this.REGISTER_OAMADDR.value] = byte;
        this.REGISTER_OAMADDR.increment();
    }

    #writePPUDATA(byte) {
        this.BUS.ppuWriteMemory(this.V.value, byte);
        this.V.value += this.REGISTER_PPUCTRL.getBit(PPU_CONTROL_FLAGS.VRAM_ADDRESS_INCREMENT) ? 32 : 1;
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

    debugSprites(canvas) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(canvas.width, canvas.height);
    
        // Palette hardcodata: 0=trasparente, 1=grigio scuro, 2=grigio chiaro, 3=bianco
        const colors = [
            null,           // 0: trasparente
            [80, 80, 80],   // 1: grigio scuro
            [180, 180, 180],// 2: grigio chiaro
            [255, 255, 255] // 3: bianco
        ];
    
        for (let n = 0; n < 64; n++) {
            const spriteY     = this.PRIMARY_OAM[n * 4 + 0];
            const tileIndex   = this.PRIMARY_OAM[n * 4 + 1];
            const attributes  = this.PRIMARY_OAM[n * 4 + 2];
            const spriteX     = this.PRIMARY_OAM[n * 4 + 3];
    
            const flipH = (attributes & 0x40) ? true : false;
            const flipV = (attributes & 0x80) ? true : false;
    
            for (let row = 0; row < 8; row++) {
                const tileRow = flipV ? 7 - row : row;
    
                const ptAddr =
                    (this.REGISTER_PPUCTRL.getBit(PPU_CONTROL_FLAGS.SPRITE_PT_ADDRESS) << 12) |
                    (tileIndex << 4) |
                    tileRow;
    
                const low  = this.BUS.ppuReadMemory(ptAddr);
                const high = this.BUS.ppuReadMemory(ptAddr | 0x08);
    
                for (let col = 0; col < 8; col++) {
                    const bit = flipH ? col : 7 - col;
                    const p0 = (low  >> bit) & 1;
                    const p1 = (high >> bit) & 1;
                    const pixel = (p1 << 1) | p0;
    
                    if (pixel === 0) continue; // trasparente
    
                    const px = spriteX + col;
                    const py = spriteY + row;
    
                    if (px >= canvas.width || py >= canvas.height) continue;
    
                    const idx = (py * canvas.width + px) * 4;
                    const [r, g, b] = colors[pixel];
                    imageData.data[idx]     = r;
                    imageData.data[idx + 1] = g;
                    imageData.data[idx + 2] = b;
                    imageData.data[idx + 3] = 255;
                }
            }
        }
    
        ctx.putImageData(imageData, 0, 0);
    }

}

export default PPU;
