'use strict';

import Byte from "./Byte.js";
import CONSTANTS from "./Constants.js";

class ROM {
    constructor(bytes) {
        this.bytes = bytes;

        this.PRG_ROM = [];
        this.CHR_ROM = [];

        // 0-3: Constant $4E $45 $53 $1A ("NES" followed by MS-DOS end-of-file)
        this.FORMAT = null;

        // 4: Size of PRG ROM in 16 KB units
        this.PRG_ROM_BANKS = 0;
        this.PRG_ROM_SIZE = 0;

        // 5: Size of CHR ROM in 8 KB units (Value 0 means the board uses CHR RAM)
        this.CHR_ROM_BANKS = 0;
        this.CHR_ROM_SIZE = 0;

        // 6: Flags 6 - Mapper, mirroring, battery, trainer
        this.MIRRORING_TYPE = CONSTANTS.V_MIRRORING;
        this.BATTERY_MEMORY = false;
        this.TRAINER = false;

        // 7: Flags 7 - Mapper, VS/Playchoice, NES 2.0
        this.MAPPER_ID = null;

        // 8: Flags 8 - PRG-RAM size (rarely used extension)
        this.PRG_RAM_SIZE = 0;

        // 9: Flags 9 - TV system (rarely used extension)
        this.TV_SYSTEM = CONSTANTS.PAL_SYSTEM;

        
        // 10: Flags 10 - TV system, PRG-RAM presence (unofficial, rarely used extension)
        // Not implemented
        
        // 11-15: Unused padding (should be filled with zero, but some rippers put their name across bytes 7-15)
        
        // Initialize an empty array and fill it with header bytes
        this.headerBytes = new Array(CONSTANTS.ROM_HEADER_SIZE_IN_BYTES).fill(0);
        this.headerBytes = this.headerBytes.map((v, idx) => new Byte(this.bytes[idx]));

        // 0-3rd byte
        if (this.headerBytes[0].isEqualTo(0x4E) && // 0x4E -> N
            this.headerBytes[1].isEqualTo(0x45) && // 0x45 -> E
            this.headerBytes[2].isEqualTo(0x53) && // 0x53 -> S
            this.headerBytes[3].isEqualTo(0x1A)) { // 0x1A -> MS-DOS end-of-file

            this.FORMAT = CONSTANTS.INES_FORMAT;
        } else {
            throw new Error('ROM format not yet supported');
        }

        // 4th Byte
        this.PRG_ROM_BANKS = this.headerBytes[4].value;
        this.PRG_ROM_SIZE  = this.PRG_ROM_BANKS * CONSTANTS.PRG_BANK_SIZE_IN_KB * CONSTANTS.KB_IN_BYTES;

        // 5th Byte
        this.CHR_ROM_BANKS = this.headerBytes[5].value;
        this.CHR_ROM_SIZE = this.CHR_ROM_BANKS * CONSTANTS.CHR_BANK_SIZE_IN_KB * CONSTANTS.KB_IN_BYTES;

        /**
        Flags 6th Byte
        --------
        76543210
        ||||||||
        |||||||+- Mirroring: 0: horizontal (vertical arrangement) (CIRAM A10 = PPU A11)
        |||||||              1: vertical (horizontal arrangement) (CIRAM A10 = PPU A10)
        ||||||+-- 1: Cartridge contains battery-backed PRG RAM ($6000-7FFF) or other persistent memory
        |||||+--- 1: 512-byte trainer at $7000-$71FF (stored before PRG data)
        ||||+---- 1: Ignore mirroring control or above mirroring bit; instead provide four-screen VRAM
        ++++----- Lower nybble of mapper number
        **/
        this.MIRRORING_TYPE = this.headerBytes[6].isBitSet(0) ? CONSTANTS.V_MIRRORING : CONSTANTS.H_MIRRORING;
        this.BATTERY_MEMORY = this.headerBytes[6].isBitSet(1);
        this.TRAINER        = this.headerBytes[6].isBitSet(2);

        /**
        Flags 7th Byte
        --------
        76543210
        ||||||||
        |||||||+- VS Unisystem
        ||||||+-- PlayChoice-10 (8KB of Hint Screen data stored after CHR data)
        ||||++--- If equal to 2, flags 8-15 are in NES 2.0 format
        ++++----- Upper nybble of mapper number
        **/
        this.MAPPER_ID = this.headerBytes[7].upperNibble() + this.headerBytes[6].upperNibble();

        if (this.FORMAT === CONSTANTS.INES_FORMAT &&
            !this.headerBytes[7].isBitSet(2) && this.headerBytes[7].isBitSet(3)) {

                this.FORMAT = CONSTANTS.NES2_FORMAT;
                throw new Error('NES2.0 Header is not yet supported!');
        }

        /**
        Flags 8 Byte
        --------
        76543210
        ||||||||
        ++++++++- PRG RAM size
        If zero, 8 KB is intended
        **/

        if (this.headerBytes[8].isEqualTo(0x00)) {
            this.PRG_RAM_SIZE = 8 * CONSTANTS.KB_IN_BYTES;
        } else {
            this.PRG_RAM_SIZE = 8 * CONSTANTS.KB_IN_BYTES * this.headerBytes[8].value;
        }

        /**
        Flags 9 Byte
        --------
        76543210
        ||||||||
        |||||||+- TV system (0: NTSC; 1: PAL)
        +++++++-- Reserved, set to zero
        **/
        this.TV_SYSTEM = this.headerBytes[9].isBitSet(0) ? CONSTANTS.PAL_SYSTEM : CONSTANTS.NTSC_SYSTEM;

        /**
        Flags 10 Byte
        --------
        76543210
        ||  ||
        ||  ++- TV system (0: NTSC; 2: PAL; 1/3: dual compatible)
        |+----- PRG RAM ($6000-$7FFF) (0: present; 1: not present)
        +------ 0: Board has no bus conflicts; 1: Board has bus conflicts
        **/

        //
        // Byte 10 is unused and not implemented
        //

        let offset = CONSTANTS.ROM_HEADER_SIZE_IN_BYTES;
        if (this.TRAINER) {
            offset += CONSTANTS.TRAINER_SIZE_IN_BYTES;
        }

        // Load memory banks
        this.PRG_ROM = new Array(this.PRG_ROM_BANKS);
        let prgBankSizeInBytes = CONSTANTS.PRG_BANK_SIZE_IN_KB * CONSTANTS.KB_IN_BYTES;

        for (let bank = 0; bank < this.PRG_ROM_BANKS; bank++) {
            this.PRG_ROM[bank] = this.bytes.slice(offset, offset + prgBankSizeInBytes);
            offset += prgBankSizeInBytes;
        }

        this.CHR_ROM = new Array(this.CHR_ROM_SIZE);
        let chrBankSizeInBytes = CONSTANTS.CHR_BANK_SIZE_IN_KB * CONSTANTS.KB_IN_BYTES;

        for (let bank = 0; bank < this.CHR_ROM_BANKS; bank++) {
            this.CHR_ROM[bank] = this.bytes.slice(offset, offset + chrBankSizeInBytes);
        }

        let SUPPORTED_MAPPERS = [
            NROM,
            // MMC1,
            // MMC2,
            // MMC3
        ];

        if (!SUPPORTED_MAPPERS[this.MAPPER_ID]) {
            throw new Error('ROM Mapper not supported');
        }

        this.MAPPER = new (SUPPORTED_MAPPERS[this.MAPPER_ID])(this);
    }

    // Utils
    getPRGBank(bankNumber) {
        if (!this.PRG_ROM[bankNumber]) {
            throw new Error('unable to load PRG ROM bank');
        }

        return this.PRG_ROM[bankNumber];
    }
}

// Mappers
class Mapper {
    constructor(ROM) {
        this.ROM = ROM;
    }
}

class NROM extends Mapper {
    //
    // Nintendo NROM
    //
    // All Banks are fixed
    // CPU $6000-$7FFF: Family Basic only: PRG RAM, mirrored as necessary to fill entire
    // 8 KiB window, write protectable with an external switch
    // CPU $8000-$BFFF: First 16 KB of ROM.
    // CPU $C000-$FFFF: Last 16 KB of ROM (NROM-256) or mirror of $8000-$BFFF (NROM-128).


    constructor(ROM) {
        super(ROM);

        this.NAME = 'Nintendo NROM';
    }

    readMemory(address) {
        let selectedBank = null;
        if (0x0000 <= address && address <= 0x1FFF) {
            return this.ROM.CHR_ROM[0][address];

        } else if (0x6000 <= address && address <= 0x7FFF) {
            throw new Error('Location not available. Family Basic only.');

        } else if (0x8000 <= address && address <= 0xBFFF) {
            address = address % (CONSTANTS.PRG_BANK_SIZE_IN_KB * CONSTANTS.KB_IN_BYTES);
            selectedBank = this.ROM.getPRGBank(0);
        
        } else if (0xC000 <= address && address <= 0xFFFF) {
            address = address % (CONSTANTS.PRG_BANK_SIZE_IN_KB * CONSTANTS.KB_IN_BYTES);
            selectedBank = this.ROM.getPRGBank(this.ROM.PRG_ROM_BANKS - 1)

        } else {
            throw new Error('ROM memory location not available.');
        }

        return selectedBank[address];
    }
}

class MMC1 extends Mapper {
    constructor(ROM) {
        super(ROM);
    }
}

class MMC2 extends Mapper {
    constructor(ROM) {
        super(ROM);
    }
}

class MMC3 extends Mapper {
    constructor(ROM) {
        super(ROM);
    }
}

export default ROM;