'use strict';

const CONSTANTS = {
    'ROM_HEADER_SIZE_IN_BYTES': 16,
    'TRAINER_SIZE_IN_BYTES': 512,

    'H_MIRRORING': 'H',
    'V_MIRRORING': 'V',

    'PRG_BANK_SIZE_IN_KB': 16,
    'CHR_BANK_SIZE_IN_KB': 8,
    'KB_IN_BYTES': 1024,

    'INES_FORMAT': 'iNES',
    'NES2_FORMAT': 'NES2.0',

    'PAL_SYSTEM': 'PAL',
    'NTSC_SYSTEM': 'NTSC'
};

const ADDRESSING = {
    'IMPLIED':     'IMPLIED',
    'RELATIVE':    'RELATIVE',
    'IMMEDIATE':   'IMMEDIATE',
    'ACCUMULATOR': 'ACCUMULATOR',

    'ABSOLUTE':    'ABSOLUTE',
    'ABSOLUTE_X':  'ABSOLUTE_X',
    'ABSOLUTE_Y':  'ABSOLUTE_Y',

    'INDIRECT':    'INDIRECT',
    'INDIRECT_X':  'INDIRECT_X',
    'INDIRECT_Y':  'INDIRECT_Y',

    'ZERO_PAGE':   'ZERO_PAGE',
    'ZERO_PAGE_X': 'ZERO_PAGE_X',
    'ZERO_PAGE_Y': 'ZERO_PAGE_Y',
};

const CPU_STATUS_FLAG = {
    'CARRY': 0,
    'ZERO': 1,
    'INTERRUPT': 2,
    'DECIMAL': 3,
    'UNUSED_B_1': 4,
    'UNUSED_B_2': 5,
    'OVERFLOW': 6,
    'NEGATIVE': 7
};

const PPU_STATUS_FLAGS = {
    'SPRITE_OVERFLOW': 5,
    'SPRITE_0_HIT': 6,
    'VBLANK': 7
};

const INSTRUCTIONS = {
    // Branch instructions
    'BCC': 'BCC',
    'BCS': 'BCS',
    'BEQ': 'BEQ',
    'BMI': 'BMI',
    'BNE': 'BNE',
    'BPL': 'BPL',
    'BVC': 'BVS',
    'BPL': 'BPL',

    // Clear instructions
    'CLC': 'CLC',
    'CLD': 'CLD',
    'CLI': 'CLI',
    'CLV': 'CLV',

    // Compare instructions
    'CPX': 'CPX',

    // Decrement instructions
    'DEX': 'DEX',
    'DEY': 'DEY',

    // Increment instructions
    'INX': 'INX',
    'INY': 'INY',

    // Load instructions
    'LDA': 'LDA',
    'LDX': 'LDX',
    'LDY': 'LDY',

    // Set instructions
    'SEC': 'SEC',
    'SED': 'SED',
    'SEI': 'SEI',

    // Store instructions
    'STA': 'STA',
    'STX': 'STX',
    'STY': 'STY',

    'STOP_CURRENT_INSTRUCTION': 'stop',
};

export {CONSTANTS, ADDRESSING, INSTRUCTIONS, CPU_STATUS_FLAG, PPU_STATUS_FLAGS}

export default CONSTANTS;