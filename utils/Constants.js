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
    'BREAK': 4,
    'UNUSED': 5,
    'OVERFLOW': 6,
    'NEGATIVE': 7
};

const PPU_MASK_FLAGS = {
    'GRAYSCALE': 0,
    'SHOW_BACKGROUND': 1,
    'SHOW_SPRITES': 2,
    'ENABLE_BACKGROUND': 3,
    'ENABLE_SPRITES': 4,
    'EMPHASIZE_RED': 5,
    'EMPHASIZE_GREEN': 6,
    'EMPHASIZE_BLUE': 7
};


const PPU_STATUS_FLAGS = {
    'SPRITE_OVERFLOW': 5,
    'SPRITE_0_HIT': 6,
    'VBLANK': 7
};

const PPU_CONTROL_FLAGS = {
    'VRAM_ADDRESS_INCREMENT': 2,
    'BG_PT_ADDRESS': 4,
    'NMI': 7
};

const INSTRUCTIONS = {
    'BRK': 'BRK',

    // Arithmetic instructions
    'ADC': 'ADC',
    'SBC': 'SBC',

    // Transfer instructions
    'TAX': 'TAX',
    'TAY': 'TAY',
    'TXA': 'TXA',
    'TYA': 'TYA',
    'TXS': 'TXS',
    'TSX': 'TSX',

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
    'CMP': 'CMP',
    'CPX': 'CPX',
    'CPY': 'CPY',

    // Decrement instructions
    'DEC': 'DEC',
    'DEX': 'DEX',
    'DEY': 'DEY',

    // Increment instructions
    'INC': 'INC',
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

    // Shift instructions
    'LSR': 'LSR',
    'ASL': 'ASL',
    'ROR': 'ROR',
    'ROL': 'ROL',

    // Illegal instructions
    'LAX': 'LAX',
    'SAX': 'SAX',
    'DCP': 'DCP',
    'ISC': 'ISC',
    'ISB': 'ISB',
    'SLO': 'SLO',
    'RLA': 'RLA',
    'SRE': 'SRE',
    'RRA': 'RRA',
};

export {CONSTANTS, ADDRESSING, INSTRUCTIONS, CPU_STATUS_FLAG, PPU_STATUS_FLAGS, PPU_CONTROL_FLAGS, PPU_MASK_FLAGS}

export default CONSTANTS;