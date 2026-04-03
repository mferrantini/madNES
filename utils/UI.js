'use strict';

// ── Opcode map (shared by logState and disassembleAt) ────────────────────────
const OPCODE_MAP = {
    0x4C: { name: 'JMP', mode: 'ABS' },
    0x6C: { name: 'JMP', mode: 'IND' },
    0xA9: { name: 'LDA', mode: 'IMM' },
    0xA5: { name: 'LDA', mode: 'ZPG' },
    0xB5: { name: 'LDA', mode: 'ZPX' },
    0xAD: { name: 'LDA', mode: 'ABS' },
    0xBD: { name: 'LDA', mode: 'ABX' },
    0xB9: { name: 'LDA', mode: 'ABY' },
    0xA1: { name: 'LDA', mode: 'INX' },
    0xB1: { name: 'LDA', mode: 'INY' },
    0xA2: { name: 'LDX', mode: 'IMM' },
    0xA6: { name: 'LDX', mode: 'ZPG' },
    0xB6: { name: 'LDX', mode: 'ZPY' },
    0xAE: { name: 'LDX', mode: 'ABS' },
    0xBE: { name: 'LDX', mode: 'ABY' },
    0xA0: { name: 'LDY', mode: 'IMM' },
    0xA4: { name: 'LDY', mode: 'ZPG' },
    0xB4: { name: 'LDY', mode: 'ZPX' },
    0xAC: { name: 'LDY', mode: 'ABS' },
    0xBC: { name: 'LDY', mode: 'ABX' },
    0x85: { name: 'STA', mode: 'ZPG' },
    0x95: { name: 'STA', mode: 'ZPX' },
    0x8D: { name: 'STA', mode: 'ABS' },
    0x9D: { name: 'STA', mode: 'ABX' },
    0x99: { name: 'STA', mode: 'ABY' },
    0x81: { name: 'STA', mode: 'INX' },
    0x91: { name: 'STA', mode: 'INY' },
    0x86: { name: 'STX', mode: 'ZPG' },
    0x96: { name: 'STX', mode: 'ZPY' },
    0x8E: { name: 'STX', mode: 'ABS' },
    0x84: { name: 'STY', mode: 'ZPG' },
    0x94: { name: 'STY', mode: 'ZPX' },
    0x8C: { name: 'STY', mode: 'ABS' },
    0x69: { name: 'ADC', mode: 'IMM' },
    0x65: { name: 'ADC', mode: 'ZPG' },
    0x75: { name: 'ADC', mode: 'ZPX' },
    0x6D: { name: 'ADC', mode: 'ABS' },
    0x7D: { name: 'ADC', mode: 'ABX' },
    0x79: { name: 'ADC', mode: 'ABY' },
    0x61: { name: 'ADC', mode: 'INX' },
    0x71: { name: 'ADC', mode: 'INY' },
    0xE9: { name: 'SBC', mode: 'IMM' },
    0xE5: { name: 'SBC', mode: 'ZPG' },
    0xF5: { name: 'SBC', mode: 'ZPX' },
    0xED: { name: 'SBC', mode: 'ABS' },
    0xFD: { name: 'SBC', mode: 'ABX' },
    0xF9: { name: 'SBC', mode: 'ABY' },
    0xE1: { name: 'SBC', mode: 'INX' },
    0xF1: { name: 'SBC', mode: 'INY' },
    0xC9: { name: 'CMP', mode: 'IMM' },
    0xC5: { name: 'CMP', mode: 'ZPG' },
    0xD5: { name: 'CMP', mode: 'ZPX' },
    0xCD: { name: 'CMP', mode: 'ABS' },
    0xDD: { name: 'CMP', mode: 'ABX' },
    0xD9: { name: 'CMP', mode: 'ABY' },
    0xC1: { name: 'CMP', mode: 'INX' },
    0xD1: { name: 'CMP', mode: 'INY' },
    0xE0: { name: 'CPX', mode: 'IMM' },
    0xE4: { name: 'CPX', mode: 'ZPG' },
    0xEC: { name: 'CPX', mode: 'ABS' },
    0xC0: { name: 'CPY', mode: 'IMM' },
    0xC4: { name: 'CPY', mode: 'ZPG' },
    0xCC: { name: 'CPY', mode: 'ABS' },
    0x29: { name: 'AND', mode: 'IMM' },
    0x25: { name: 'AND', mode: 'ZPG' },
    0x35: { name: 'AND', mode: 'ZPX' },
    0x2D: { name: 'AND', mode: 'ABS' },
    0x3D: { name: 'AND', mode: 'ABX' },
    0x39: { name: 'AND', mode: 'ABY' },
    0x21: { name: 'AND', mode: 'INX' },
    0x31: { name: 'AND', mode: 'INY' },
    0x09: { name: 'ORA', mode: 'IMM' },
    0x05: { name: 'ORA', mode: 'ZPG' },
    0x15: { name: 'ORA', mode: 'ZPX' },
    0x0D: { name: 'ORA', mode: 'ABS' },
    0x1D: { name: 'ORA', mode: 'ABX' },
    0x19: { name: 'ORA', mode: 'ABY' },
    0x01: { name: 'ORA', mode: 'INX' },
    0x11: { name: 'ORA', mode: 'INY' },
    0x49: { name: 'EOR', mode: 'IMM' },
    0x45: { name: 'EOR', mode: 'ZPG' },
    0x55: { name: 'EOR', mode: 'ZPX' },
    0x4D: { name: 'EOR', mode: 'ABS' },
    0x5D: { name: 'EOR', mode: 'ABX' },
    0x59: { name: 'EOR', mode: 'ABY' },
    0x41: { name: 'EOR', mode: 'INX' },
    0x51: { name: 'EOR', mode: 'INY' },
    0x24: { name: 'BIT', mode: 'ZPG' },
    0x2C: { name: 'BIT', mode: 'ABS' },
    0x0A: { name: 'ASL', mode: 'ACC' },
    0x06: { name: 'ASL', mode: 'ZPG' },
    0x16: { name: 'ASL', mode: 'ZPX' },
    0x0E: { name: 'ASL', mode: 'ABS' },
    0x1E: { name: 'ASL', mode: 'ABX' },
    0x4A: { name: 'LSR', mode: 'ACC' },
    0x46: { name: 'LSR', mode: 'ZPG' },
    0x56: { name: 'LSR', mode: 'ZPX' },
    0x4E: { name: 'LSR', mode: 'ABS' },
    0x5E: { name: 'LSR', mode: 'ABX' },
    0x2A: { name: 'ROL', mode: 'ACC' },
    0x26: { name: 'ROL', mode: 'ZPG' },
    0x36: { name: 'ROL', mode: 'ZPX' },
    0x2E: { name: 'ROL', mode: 'ABS' },
    0x3E: { name: 'ROL', mode: 'ABX' },
    0x6A: { name: 'ROR', mode: 'ACC' },
    0x66: { name: 'ROR', mode: 'ZPG' },
    0x76: { name: 'ROR', mode: 'ZPX' },
    0x6E: { name: 'ROR', mode: 'ABS' },
    0x7E: { name: 'ROR', mode: 'ABX' },
    0xE6: { name: 'INC', mode: 'ZPG' },
    0xF6: { name: 'INC', mode: 'ZPX' },
    0xEE: { name: 'INC', mode: 'ABS' },
    0xFE: { name: 'INC', mode: 'ABX' },
    0xC6: { name: 'DEC', mode: 'ZPG' },
    0xD6: { name: 'DEC', mode: 'ZPX' },
    0xCE: { name: 'DEC', mode: 'ABS' },
    0xDE: { name: 'DEC', mode: 'ABX' },
    0xE8: { name: 'INX', mode: 'IMP' },
    0xC8: { name: 'INY', mode: 'IMP' },
    0xCA: { name: 'DEX', mode: 'IMP' },
    0x88: { name: 'DEY', mode: 'IMP' },
    0xAA: { name: 'TAX', mode: 'IMP' },
    0xA8: { name: 'TAY', mode: 'IMP' },
    0x8A: { name: 'TXA', mode: 'IMP' },
    0x98: { name: 'TYA', mode: 'IMP' },
    0x9A: { name: 'TXS', mode: 'IMP' },
    0xBA: { name: 'TSX', mode: 'IMP' },
    0x48: { name: 'PHA', mode: 'IMP' },
    0x08: { name: 'PHP', mode: 'IMP' },
    0x68: { name: 'PLA', mode: 'IMP' },
    0x28: { name: 'PLP', mode: 'IMP' },
    0x90: { name: 'BCC', mode: 'REL' },
    0xB0: { name: 'BCS', mode: 'REL' },
    0xF0: { name: 'BEQ', mode: 'REL' },
    0xD0: { name: 'BNE', mode: 'REL' },
    0x30: { name: 'BMI', mode: 'REL' },
    0x10: { name: 'BPL', mode: 'REL' },
    0x70: { name: 'BVS', mode: 'REL' },
    0x50: { name: 'BVC', mode: 'REL' },
    0x18: { name: 'CLC', mode: 'IMP' },
    0x38: { name: 'SEC', mode: 'IMP' },
    0xD8: { name: 'CLD', mode: 'IMP' },
    0xF8: { name: 'SED', mode: 'IMP' },
    0x58: { name: 'CLI', mode: 'IMP' },
    0x78: { name: 'SEI', mode: 'IMP' },
    0xB8: { name: 'CLV', mode: 'IMP' },
    0x20: { name: 'JSR', mode: 'ABS' },
    0x60: { name: 'RTS', mode: 'IMP' },
    0x40: { name: 'RTI', mode: 'IMP' },
    0x00: { name: 'BRK', mode: 'IMP' },
    0xEA: { name: 'NOP', mode: 'IMP' },
    // Illegal opcodes
    0x07: { name: 'SLO', mode: 'ZPG' }, 0x17: { name: 'SLO', mode: 'ZPX' },
    0x0F: { name: 'SLO', mode: 'ABS' }, 0x1F: { name: 'SLO', mode: 'ABX' },
    0x1B: { name: 'SLO', mode: 'ABY' }, 0x03: { name: 'SLO', mode: 'INX' },
    0x13: { name: 'SLO', mode: 'INY' },
    0x27: { name: 'RLA', mode: 'ZPG' }, 0x37: { name: 'RLA', mode: 'ZPX' },
    0x2F: { name: 'RLA', mode: 'ABS' }, 0x3F: { name: 'RLA', mode: 'ABX' },
    0x3B: { name: 'RLA', mode: 'ABY' }, 0x23: { name: 'RLA', mode: 'INX' },
    0x33: { name: 'RLA', mode: 'INY' },
    0x47: { name: 'SRE', mode: 'ZPG' }, 0x57: { name: 'SRE', mode: 'ZPX' },
    0x4F: { name: 'SRE', mode: 'ABS' }, 0x5F: { name: 'SRE', mode: 'ABX' },
    0x5B: { name: 'SRE', mode: 'ABY' }, 0x43: { name: 'SRE', mode: 'INX' },
    0x53: { name: 'SRE', mode: 'INY' },
    0x67: { name: 'RRA', mode: 'ZPG' }, 0x77: { name: 'RRA', mode: 'ZPX' },
    0x6F: { name: 'RRA', mode: 'ABS' }, 0x7F: { name: 'RRA', mode: 'ABX' },
    0x7B: { name: 'RRA', mode: 'ABY' }, 0x63: { name: 'RRA', mode: 'INX' },
    0x73: { name: 'RRA', mode: 'INY' },
    0xC7: { name: 'DCP', mode: 'ZPG' }, 0xD7: { name: 'DCP', mode: 'ZPX' },
    0xCF: { name: 'DCP', mode: 'ABS' }, 0xDF: { name: 'DCP', mode: 'ABX' },
    0xDB: { name: 'DCP', mode: 'ABY' }, 0xC3: { name: 'DCP', mode: 'INX' },
    0xD3: { name: 'DCP', mode: 'INY' },
    0xE7: { name: 'ISB', mode: 'ZPG' }, 0xF7: { name: 'ISB', mode: 'ZPX' },
    0xEF: { name: 'ISB', mode: 'ABS' }, 0xFF: { name: 'ISB', mode: 'ABX' },
    0xFB: { name: 'ISB', mode: 'ABY' }, 0xE3: { name: 'ISB', mode: 'INX' },
    0xF3: { name: 'ISB', mode: 'INY' },
    0xA3: { name: 'LAX', mode: 'INX' }, 0xB3: { name: 'LAX', mode: 'INY' },
    0xA7: { name: 'LAX', mode: 'ZPG' }, 0xB7: { name: 'LAX', mode: 'ZPY' },
    0xAF: { name: 'LAX', mode: 'ABS' }, 0xBF: { name: 'LAX', mode: 'ABY' },
    0x87: { name: 'SAX', mode: 'ZPG' }, 0x97: { name: 'SAX', mode: 'ZPY' },
    0x8F: { name: 'SAX', mode: 'ABS' }, 0x83: { name: 'SAX', mode: 'INX' },
    0xEB: { name: 'SBC', mode: 'IMM' },
    // Illegal NOPs
    0x1A: { name: 'NOP', mode: 'IMP' }, 0x3A: { name: 'NOP', mode: 'IMP' },
    0x5A: { name: 'NOP', mode: 'IMP' }, 0x7A: { name: 'NOP', mode: 'IMP' },
    0xDA: { name: 'NOP', mode: 'IMP' }, 0xFA: { name: 'NOP', mode: 'IMP' },
    0x80: { name: 'NOP', mode: 'IMM' }, 0x82: { name: 'NOP', mode: 'IMM' },
    0x89: { name: 'NOP', mode: 'IMM' }, 0xC2: { name: 'NOP', mode: 'IMM' },
    0xE2: { name: 'NOP', mode: 'IMM' },
    0x04: { name: 'NOP', mode: 'ZPG' }, 0x44: { name: 'NOP', mode: 'ZPG' },
    0x64: { name: 'NOP', mode: 'ZPG' },
    0x14: { name: 'NOP', mode: 'ZPX' }, 0x34: { name: 'NOP', mode: 'ZPX' },
    0x54: { name: 'NOP', mode: 'ZPX' }, 0x74: { name: 'NOP', mode: 'ZPX' },
    0xD4: { name: 'NOP', mode: 'ZPX' }, 0xF4: { name: 'NOP', mode: 'ZPX' },
    0x0C: { name: 'NOP', mode: 'ABS' },
    0x1C: { name: 'NOP', mode: 'ABX' }, 0x3C: { name: 'NOP', mode: 'ABX' },
    0x5C: { name: 'NOP', mode: 'ABX' }, 0x7C: { name: 'NOP', mode: 'ABX' },
    0xDC: { name: 'NOP', mode: 'ABX' }, 0xFC: { name: 'NOP', mode: 'ABX' },
};

// ── Private helpers ───────────────────────────────────────────────────────────
function toHex(val, pad) {
    return val.toString(16).toUpperCase().padStart(pad, '0');
}

/**
 * Decodes one instruction at `addr` using `cpuRead`.
 * Returns { instrName, bytesStr, mnemonic, bytes } without touching registers.
 */
function _decode(cpuRead, addr) {
    const b0 = cpuRead(addr);
    const b1 = cpuRead(addr + 1);
    const b2 = cpuRead(addr + 2);

    const isIllegal = !OPCODE_MAP[b0];
    const instr     = OPCODE_MAP[b0] ?? { name: 'NOP', mode: 'IMP' };
    const instrName = isIllegal ? `*${instr.name}` : instr.name;

    let bytesStr, mnemonic, bytes;

    switch (instr.mode) {
        case 'IMM':
            bytesStr = `${toHex(b0,2)} ${toHex(b1,2)}   `;
            mnemonic = `${instrName} #$${toHex(b1,2)}`;
            bytes = 2;
            break;
        case 'ZPG': {
            const val = cpuRead(b1);
            bytesStr = `${toHex(b0,2)} ${toHex(b1,2)}   `;
            mnemonic = `${instrName} $${toHex(b1,2)} = ${toHex(val,2)}`;
            bytes = 2;
            break;
        }
        case 'ZPX':
            bytesStr = `${toHex(b0,2)} ${toHex(b1,2)}   `;
            mnemonic = `${instrName} $${toHex(b1,2)},X`;
            bytes = 2;
            break;
        case 'ZPY':
            bytesStr = `${toHex(b0,2)} ${toHex(b1,2)}   `;
            mnemonic = `${instrName} $${toHex(b1,2)},Y`;
            bytes = 2;
            break;
        case 'ABS':
            bytesStr = `${toHex(b0,2)} ${toHex(b1,2)} ${toHex(b2,2)}`;
            mnemonic = `${instrName} $${toHex(b2,2)}${toHex(b1,2)}`;
            bytes = 3;
            break;
        case 'ABX':
            bytesStr = `${toHex(b0,2)} ${toHex(b1,2)} ${toHex(b2,2)}`;
            mnemonic = `${instrName} $${toHex(b2,2)}${toHex(b1,2)},X`;
            bytes = 3;
            break;
        case 'ABY':
            bytesStr = `${toHex(b0,2)} ${toHex(b1,2)} ${toHex(b2,2)}`;
            mnemonic = `${instrName} $${toHex(b2,2)}${toHex(b1,2)},Y`;
            bytes = 3;
            break;
        case 'IND':
            bytesStr = `${toHex(b0,2)} ${toHex(b1,2)} ${toHex(b2,2)}`;
            mnemonic = `${instrName} ($${toHex(b2,2)}${toHex(b1,2)})`;
            bytes = 3;
            break;
        case 'INX':
            bytesStr = `${toHex(b0,2)} ${toHex(b1,2)}   `;
            mnemonic = `${instrName} ($${toHex(b1,2)},X)`;
            bytes = 2;
            break;
        case 'INY':
            bytesStr = `${toHex(b0,2)} ${toHex(b1,2)}   `;
            mnemonic = `${instrName} ($${toHex(b1,2)}),Y`;
            bytes = 2;
            break;
        case 'REL': {
            const signedOffset = b1 > 0x7F ? b1 - 0x100 : b1;
            const target = (addr + 2 + signedOffset) & 0xFFFF;
            bytesStr = `${toHex(b0,2)} ${toHex(b1,2)}   `;
            mnemonic = `${instrName} $${toHex(target,4)}`;
            bytes = 2;
            break;
        }
        case 'ACC':
            bytesStr = `${toHex(b0,2)}      `;
            mnemonic = `${instrName} A`;
            bytes = 1;
            break;
        case 'IMP':
        default:
            bytesStr = `${toHex(b0,2)}      `;
            mnemonic = `${instrName}`;
            bytes = 1;
            break;
    }

    return { instrName, bytesStr, mnemonic, bytes };
}

// ── Standalone exports ────────────────────────────────────────────────────────

/**
 * Returns the full nestest-compatible log line for the current CPU state.
 */
export function getNesTestLogLine(nes) {
    const cpu  = nes.CPU;
    const pc   = cpu.REG_PC.value;
    const { bytesStr, mnemonic } = _decode(addr => nes.cpuReadMemory(addr), pc);

    const a  = toHex(cpu.REG_A.value,  2);
    const x  = toHex(cpu.REG_X.value,  2);
    const y  = toHex(cpu.REG_Y.value,  2);
    const p  = toHex(cpu.REG_P.value,  2);
    const sp = toHex(cpu.REG_SP.value, 2);

    const ppuY = nes.PPU.currentY.toString().padStart(3, ' ');
    const ppuX = nes.PPU.currentX.toString().padStart(3, ' ');

    return `${toHex(pc,4)}  ${bytesStr}  ${mnemonic.padEnd(31,' ')} A:${a} X:${x} Y:${y} P:${p} SP:${sp} PPU:${ppuY},${ppuX} CYC:${cpu.totalCycles}`;
}

/**
 * Disassembles one instruction at `addr`.
 * Returns { line: string, bytes: number }.
 */
export function disassembleAt(nes, addr) {
    const { bytesStr, mnemonic, bytes } = _decode(a => nes.cpuReadMemory(a), addr);
    return { line: `${toHex(addr,4)}  ${bytesStr}  ${mnemonic}`, bytes };
}

// ── UI class ──────────────────────────────────────────────────────────────────

const DISASM_ROWS = 36;

export default class UI {

    // ── Private state ─────────────────────────────────────────────────────────
    #BUS;
    #isDebugOpen = false;

    // ── DOM refs ──────────────────────────────────────────────────────────────
    #elFps;
    #sidebar;
    #btnPlay;
    #btnPlaySidebar;
    #btnReset;
    #btnDebug;
    #btnStep;
    #btnFrame;
    #resetDialog;
    #btnConfirm;
    #btnCancel;
    #disasmArea;
    #statusBits;
    #elRegA;
    #elRegX;
    #elRegY;
    #elRegSP;
    #elRegPC;
    #elRegP;

    constructor(bus) {
        this.#BUS = bus;
        this.#queryDOM();
        this.#bindEvents();
        this.#syncPlayButton();
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /** Called by NES every emulated frame to refresh the FPS counter. */
    updateUI() {
        const fps = 1000 / this.#BUS.frameDuration;
        if (this.#elFps) this.#elFps.textContent = `FPS: ${fps.toFixed(2)}`;

        this.#refreshDebug();
    }

    // ── Initialisation ────────────────────────────────────────────────────────

    #queryDOM() {
        this.#elFps          = document.getElementById('fps');
        this.#sidebar        = document.getElementById('debug-sidebar');
        this.#btnPlay        = document.getElementById('btn-play');
        this.#btnPlaySidebar = document.getElementById('btn-play-sidebar');
        this.#btnReset       = document.getElementById('btn-reset');
        this.#btnDebug       = document.getElementById('btn-debug');
        this.#btnStep        = document.getElementById('btn-step');
        this.#btnFrame       = document.getElementById('btn-frame');
        this.#resetDialog    = document.getElementById('reset-dialog');
        this.#btnConfirm     = document.getElementById('btn-reset-confirm');
        this.#btnCancel      = document.getElementById('btn-reset-cancel');
        this.#disasmArea     = document.getElementById('disassembly');
        this.#statusBits     = document.querySelectorAll('#cpu-status .status-bit');
        this.#elRegA         = document.getElementById('reg-a');
        this.#elRegX         = document.getElementById('reg-x');
        this.#elRegY         = document.getElementById('reg-y');
        this.#elRegSP        = document.getElementById('reg-sp');
        this.#elRegPC        = document.getElementById('reg-pc');
        this.#elRegP         = document.getElementById('reg-p');
    }

    #bindEvents() {
        this.#btnPlay?.addEventListener('click', () => this.#togglePlay());
        this.#btnPlaySidebar?.addEventListener('click', () => this.#togglePlay());

        this.#btnReset?.addEventListener('click', () => {
            if (this.#resetDialog) this.#resetDialog.hidden = false;
        });

        this.#btnConfirm?.addEventListener('click', () => {
            this.#resetDialog.hidden = true;
            this.#BUS.reset?.();
            this.#syncPlayButton();
        });

        this.#btnCancel?.addEventListener('click', () => {
            this.#resetDialog.hidden = true;
        });

        this.#resetDialog?.addEventListener('click', (e) => {
            if (e.target === this.#resetDialog) this.#resetDialog.hidden = true;
        });

        if (typeof this.#BUS.reset !== 'function' && this.#btnReset) {
            this.#btnReset.disabled = true;
            this.#btnReset.title = 'Reset non ancora implementato';
        }

        this.#btnStep?.addEventListener('click', () => {
            this.#pauseIfRunning();
            this.#BUS.step();
            this.#refreshDebug();
        });

        this.#btnFrame?.addEventListener('click', () => {
            this.#pauseIfRunning();
            this.#BUS.frame();
            this.#refreshDebug();
        });

        this.#btnDebug?.addEventListener('click', () => this.#setDebug(!this.#isDebugOpen));
    }

    // ── Playback controls ─────────────────────────────────────────────────────

    #syncPlayButton() {
        const paused = this.#BUS.pauseExecution;

        if (this.#btnPlay) {
            this.#btnPlay.innerHTML = paused ? '&#9654; Play' : '&#9646;&#9646; Pause';
            this.#btnPlay.classList.toggle('active', !paused);
        }

        if (this.#btnPlaySidebar) {
            this.#btnPlaySidebar.innerHTML = paused ? '&#9654;' : '&#9646;&#9646;';
            this.#btnPlaySidebar.classList.toggle('active', !paused);
            this.#btnPlaySidebar.title = paused ? 'Play' : 'Pause';
        }
    }

    #togglePlay() {
        this.#BUS.pauseExecution = !this.#BUS.pauseExecution;
        this.#syncPlayButton();
    }

    #pauseIfRunning() {
        if (!this.#BUS.pauseExecution) {
            this.#BUS.pauseExecution = true;
            this.#syncPlayButton();
        }
    }

    // ── Debug sidebar ─────────────────────────────────────────────────────────

    #setDebug(open) {
        this.#isDebugOpen = open;
        this.#BUS.debugViewActive = open;
        this.#sidebar?.classList.toggle('open', open);
        this.#btnDebug?.classList.toggle('active', open);
    }

    // ── Debug panel refresh ───────────────────────────────────────────────────

    #refreshDisassembly() {
        if (!this.#disasmArea || !this.#BUS.CPU) return;

        const pc       = this.#BUS.CPU.REG_PC.value;
        const fragment = document.createDocumentFragment();
        let addr = pc;

        for (let i = 0; i < DISASM_ROWS; i++) {
            try {
                const { line, bytes } = disassembleAt(this.#BUS, addr);
                const row = document.createElement('div');
                row.className = 'disasm-row' + (addr === pc ? ' current' : '');
                row.textContent = line;
                fragment.appendChild(row);
                addr = (addr + bytes) & 0xFFFF;
            } catch {
                break;
            }
        }

        this.#disasmArea.replaceChildren(fragment);
    }

    #refreshStatusRegister() {
        if (!this.#BUS.CPU) return;

        const cpu = this.#BUS.CPU;
        const p   = cpu.REG_P.value;

        if (this.#elRegA)  this.#elRegA.textContent  = toHex(cpu.REG_A.value,  2);
        if (this.#elRegX)  this.#elRegX.textContent  = toHex(cpu.REG_X.value,  2);
        if (this.#elRegY)  this.#elRegY.textContent  = toHex(cpu.REG_Y.value,  2);
        if (this.#elRegSP) this.#elRegSP.textContent = toHex(cpu.REG_SP.value, 2);
        if (this.#elRegPC) this.#elRegPC.textContent = toHex(cpu.REG_PC.value, 4);
        if (this.#elRegP)  this.#elRegP.textContent  = toHex(p,                2);

        this.#statusBits.forEach(el => {
            const bit = parseInt(el.dataset.bit, 10);
            el.classList.toggle('set', !!(p & (1 << bit)));
        });
    }

    #refreshDebug() {
        if (!this.#isDebugOpen) return;
        this.#refreshDisassembly();
        this.#refreshStatusRegister();
    }
}
