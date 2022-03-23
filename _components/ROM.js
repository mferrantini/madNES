// Loading utils
import {CONSTANTS, MIRRORING} from '../utils/Constants.js';

import Byte from '../utils/Byte.js';

class ROM {
    constructor(romBytes) {
        this.romBytes = romBytes;
        this.header  = {};

        this.PRG_ROM = null;
        this.CHR_ROM = null;

        // Check the ROM header type
        if (romBytes[0] === 0x4E && // 0x4E -> N
            romBytes[1] === 0x45 && // 0x45 -> E
            romBytes[2] === 0x53 && // 0x53 -> S
            romBytes[3] === 0x1A) { // 0x1A -> MS-DOS EOF

            this.header.FORMAT = 'iNES';
        } else {
            throw new Error('ROM format not yet supported');
        }

        // These numbers are expressed in 16 and 8 KB units
        this.header.PRG_ROM_BANKS = romBytes[4];
        this.header.PRG_ROM_SIZE  = romBytes[4] * CONSTANTS.PRG_BANK_SIZE_IN_KB * 1024;
        this.header.CHR_ROM_BANKS = romBytes[5];
        this.header.CHR_ROM_SIZE  = romBytes[5] * CONSTANTS.CHR_BANK_SIZE_IN_KB  * 1024;

        /**
        Flags 6 Byte
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
        this.header.MIRRORING_TYPE = Byte.isBitSetAtPosition(romBytes[6], 0) ? MIRRORING.VERTICAL : MIRRORING.HORIZONTAL;
        this.header.BATTERY_MEMORY = Byte.isBitSetAtPosition(romBytes[6], 1);
        this.header.TRAINER        = Byte.isBitSetAtPosition(romBytes[6], 2);

        /**
        Flags 7 Byte
        --------
        76543210
        ||||||||
        |||||||+- VS Unisystem
        ||||||+-- PlayChoice-10 (8KB of Hint Screen data stored after CHR data)
        ||||++--- If equal to 2, flags 8-15 are in NES 2.0 format
        ++++----- Upper nybble of mapper number
        **/
        this.header.MAPPER_ID = Byte.getUpperNibble(romBytes[7]) + Byte.getUpperNibble(romBytes[6]);

        if (this.header.FORMAT === 'iNES' &&
            !Byte.isBitSetAtPosition(romBytes[7], 2) && Byte.isBitSetAtPosition(romBytes[7], 3)) {

                this.header.FORMAT = 'NES2.0';
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

        if (romBytes[8] === 0x00) {
            this.header.PRG_RAM_SIZE = 8 * CONSTANTS.KB_IN_BYTES;
        } else {
            this.header.PRG_RAM_SIZE = 8 * CONSTANTS.KB_IN_BYTES * romBytes[8];
        }

        /**
        Flags 9 Byte
        --------
        76543210
        ||||||||
        |||||||+- TV system (0: NTSC; 1: PAL)
        +++++++-- Reserved, set to zero
        **/
        this.header.TV_SYSTEM = Byte.isBitSetAtPosition(romBytes[9], 0) ? 'PAL' : 'NTSC';

        /**
        Flags 10 Byte
        --------
        76543210
        ||  ||
        ||  ++- TV system (0: NTSC; 2: PAL; 1/3: dual compatible)
        |+----- PRG RAM ($6000-$7FFF) (0: present; 1: not present)
        +------ 0: Board has no bus conflicts; 1: Board has bus conflicts
        **/

        // Byte 10 is unused


        let offset = 16; // Header size
        if (this.header.TRAINER) {
            offset += 512; // Trainer size
        }

        // Load memory banks
        this.PRG_ROM = new Array(this.header.PRG_ROM_BANKS);
        let prgBankSizeInBytes = CONSTANTS.PRG_BANK_SIZE_IN_KB * CONSTANTS.KB_IN_BYTES;

        for (let bank = 0; bank < this.header.PRG_ROM_BANKS; bank++) {
            this.PRG_ROM[bank] = romBytes.slice(offset, offset + prgBankSizeInBytes);
            offset += prgBankSizeInBytes;
        }

        this.CHR_ROM = new Array(this.header.CHR_ROM_SIZE);
        let chrBankSizeInBytes = CONSTANTS.CHR_BANK_SIZE_IN_KB * CONSTANTS.KB_IN_BYTES;

        for (let bank = 0; bank < this.header.CHR_ROM_BANKS; bank++) {
            this.CHR_ROM[bank] = romBytes.slice(offset, offset + chrBankSizeInBytes);
        }

        let SUPPORTED_MAPPERS = [
            NROM,
            // MMC1,
            // MMC2,
            // MMC3
        ];

        if (!SUPPORTED_MAPPERS[this.header.MAPPER_ID]) {
            throw new Error('ROM Mapper not supported');
        }

        this.MAPPER = new (SUPPORTED_MAPPERS[this.header.MAPPER_ID])(this);
        // memoryController.registerComponent('ROM', this);
    }



    // Utils
    getPrgBank(bankNumber) {
        if (!this.PRG_ROM[bankNumber]) {
            throw new Error('unable to load PRG ROM bank');
        }

        return this.PRG_ROM[bankNumber];
    }

    getFirstPrgBank() {
        return this.getPrgBank(0);
    }

    getLastPrgBank() {
        return this.getPrgBank(this.header.PRG_ROM_BANKS - 1);
    }



    getHeader() {
        return Object.assign(this.header, {});
    }

    printHeader() {
        console.log('ROM HEADER INFO');
        console.table(this.getHeader());
    }

    getMirroring() {
        return this.header.MIRRORING_TYPE;
    }
}

class Mapper {
    constructor(ROM) {
        this.ROM = ROM;

        let MAPPER_NAMES = [
            'Nintendo NROM'
        ];

        this.ROM.header.MAPPER_NAME = MAPPER_NAMES[this.ROM.header.MAPPER_ID];
    }
}

class NROM extends Mapper {
    constructor(ROM) {
        super(ROM);
        
    }

    readMemory(address) {
        let bank = null;
        if (0x0000 <= address && address <= 0x1FFF) {
            return this.ROM.CHR_ROM[0][address];

        } else if (0x8000 <= address && address <= 0xBFFF) {
            address = address % 0x4000;
            bank = this.ROM.getFirstPrgBank();
        
        } else if (0xC000 <= address && address <= 0xFFFF) {
            address = address % 0x4000;
            bank = this.ROM.getLastPrgBank();

        } else {
            throw new Error('ROM memory location not available');
        }

        return bank[address];
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