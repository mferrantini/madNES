'use strict';

import {
    Byte,
    Register8Bit,
    Register16Bit,
} from "../utils/BinaryStructures.js";

import {
    ADDRESSING,
    INSTRUCTIONS,
    CPU_STATUS_FLAG
} from "../utils/Constants.js";


class CPU {
    constructor(BUS) {
        this.BUS = BUS;

        // Registers
        this.REG_A = new Register8Bit();
        this.REG_X = new Register8Bit();
        this.REG_Y = new Register8Bit();

        // Status register
        this.REG_P = new Register8Bit();
        // Stack pointer
        this.REG_SP = new Register16Bit();
        // Program counter
        this.REG_PC = new Register16Bit();

        // Current instruction steps array
        this.currentInstruction = [];
        // Current instruction step to invoke
        this.currentInstructionStep = 0;
        // Data returned by the executed step
        this.currentContext = {};

        this.pendingNMI = false;

        // Total cycles from the start of the emulation
        this.totalCycles = 0;

        this.INSTRUCTIONS = {
            0x00: this.BRK(ADDRESSING.IMPLIED),
            0x20: this.JSR(),
            0x60: this.RTS(),
            0x40: this.RTI(),

            0x05: this.ORA(ADDRESSING.ZERO_PAGE),
            0x09: this.ORA(ADDRESSING.IMMEDIATE),
            0x0D: this.ORA(ADDRESSING.ABSOLUTE),
            0x19: this.ORA(ADDRESSING.ABSOLUTE_Y),
            0x1D: this.ORA(ADDRESSING.ABSOLUTE_X),
            0x11: this.ORA(ADDRESSING.INDIRECT_Y),
            0x01: this.ORA(ADDRESSING.INDIRECT_X),
            0x15: this.ORA(ADDRESSING.ZERO_PAGE_X),

            0x24: this.BIT(ADDRESSING.ZERO_PAGE),
            0x2C: this.BIT(ADDRESSING.ABSOLUTE),

            0x29: this.AND(ADDRESSING.IMMEDIATE),
            0x25: this.AND(ADDRESSING.ZERO_PAGE),
            0x2D: this.AND(ADDRESSING.ABSOLUTE),
            0x3D: this.AND(ADDRESSING.ABSOLUTE_X),
            0x39: this.AND(ADDRESSING.ABSOLUTE_Y),
            0x21: this.AND(ADDRESSING.INDIRECT_X),
            0x31: this.AND(ADDRESSING.INDIRECT_Y),
            0x35: this.AND(ADDRESSING.ZERO_PAGE_X),

            0x4C: this.JMP(ADDRESSING.ABSOLUTE),
            0x6C: this.JMP(ADDRESSING.INDIRECT),

            0x49: this.EOR(ADDRESSING.IMMEDIATE),
            0x45: this.EOR(ADDRESSING.ZERO_PAGE),
            0x4D: this.EOR(ADDRESSING.ABSOLUTE),
            0x5D: this.EOR(ADDRESSING.ABSOLUTE_X),
            0x59: this.EOR(ADDRESSING.ABSOLUTE_Y),
            0x51: this.EOR(ADDRESSING.INDIRECT_Y),
            0x41: this.EOR(ADDRESSING.INDIRECT_X),
            0x55: this.EOR(ADDRESSING.ZERO_PAGE_X),

            0x10: this.BRANCH_INSTRUCTION(ADDRESSING.RELATIVE, INSTRUCTIONS.BPL),
            0x30: this.BRANCH_INSTRUCTION(ADDRESSING.RELATIVE, INSTRUCTIONS.BMI),
            0x50: this.BRANCH_INSTRUCTION(ADDRESSING.RELATIVE, INSTRUCTIONS.BVC),
            0x70: this.BRANCH_INSTRUCTION(ADDRESSING.RELATIVE, INSTRUCTIONS.BVS),
            0x90: this.BRANCH_INSTRUCTION(ADDRESSING.RELATIVE, INSTRUCTIONS.BCC),
            0xB0: this.BRANCH_INSTRUCTION(ADDRESSING.RELATIVE, INSTRUCTIONS.BCS),
            0xD0: this.BRANCH_INSTRUCTION(ADDRESSING.RELATIVE, INSTRUCTIONS.BNE),
            0xF0: this.BRANCH_INSTRUCTION(ADDRESSING.RELATIVE, INSTRUCTIONS.BEQ),

            0x18: this.CLEAR_INSTRUCTION(ADDRESSING.IMPLIED, INSTRUCTIONS.CLC),
            0x58: this.CLEAR_INSTRUCTION(ADDRESSING.IMPLIED, INSTRUCTIONS.CLI),
            0xB8: this.CLEAR_INSTRUCTION(ADDRESSING.IMPLIED, INSTRUCTIONS.CLV),
            0xD8: this.CLEAR_INSTRUCTION(ADDRESSING.IMPLIED, INSTRUCTIONS.CLD),

            0x38: this.SET_INSTRUCTION(ADDRESSING.IMPLIED, INSTRUCTIONS.SEC),
            0x78: this.SET_INSTRUCTION(ADDRESSING.IMPLIED, INSTRUCTIONS.SEI),
            0xF8: this.SET_INSTRUCTION(ADDRESSING.IMPLIED, INSTRUCTIONS.SED),

            0xA0: this.LOAD_INSTRUCTION(ADDRESSING.IMMEDIATE, INSTRUCTIONS.LDY),
            0xA2: this.LOAD_INSTRUCTION(ADDRESSING.IMMEDIATE, INSTRUCTIONS.LDX),
            0xA4: this.LOAD_INSTRUCTION(ADDRESSING.ZERO_PAGE, INSTRUCTIONS.LDY),
            0xA5: this.LOAD_INSTRUCTION(ADDRESSING.ZERO_PAGE, INSTRUCTIONS.LDA),
            0xA6: this.LOAD_INSTRUCTION(ADDRESSING.ZERO_PAGE, INSTRUCTIONS.LDX),
            0xA9: this.LOAD_INSTRUCTION(ADDRESSING.IMMEDIATE, INSTRUCTIONS.LDA),
            0xAC: this.LOAD_INSTRUCTION(ADDRESSING.ABSOLUTE, INSTRUCTIONS.LDY),
            0xAD: this.LOAD_INSTRUCTION(ADDRESSING.ABSOLUTE, INSTRUCTIONS.LDA),
            0xAE: this.LOAD_INSTRUCTION(ADDRESSING.ABSOLUTE, INSTRUCTIONS.LDX),
            0xB9: this.LOAD_INSTRUCTION(ADDRESSING.ABSOLUTE_Y, INSTRUCTIONS.LDA),
            0xBC: this.LOAD_INSTRUCTION(ADDRESSING.ABSOLUTE_X, INSTRUCTIONS.LDY),
            0xBD: this.LOAD_INSTRUCTION(ADDRESSING.ABSOLUTE_X, INSTRUCTIONS.LDA),
            0xBE: this.LOAD_INSTRUCTION(ADDRESSING.ABSOLUTE_Y, INSTRUCTIONS.LDX),
            0xA1: this.LOAD_INSTRUCTION(ADDRESSING.INDIRECT_X, INSTRUCTIONS.LDA),
            0xB1: this.LOAD_INSTRUCTION(ADDRESSING.INDIRECT_Y, INSTRUCTIONS.LDA),
            0xB5: this.LOAD_INSTRUCTION(ADDRESSING.ZERO_PAGE_X, INSTRUCTIONS.LDA),
            0xB6: this.LOAD_INSTRUCTION(ADDRESSING.ZERO_PAGE_Y, INSTRUCTIONS.LDX),
            0xB4: this.LOAD_INSTRUCTION(ADDRESSING.ZERO_PAGE_X, INSTRUCTIONS.LDY),

            0x84: this.STORE_INSTRUCTION(ADDRESSING.ZERO_PAGE, INSTRUCTIONS.STY),
            0x85: this.STORE_INSTRUCTION(ADDRESSING.ZERO_PAGE, INSTRUCTIONS.STA),
            0x86: this.STORE_INSTRUCTION(ADDRESSING.ZERO_PAGE, INSTRUCTIONS.STX),
            0x8C: this.STORE_INSTRUCTION(ADDRESSING.ABSOLUTE, INSTRUCTIONS.STY),
            0x8D: this.STORE_INSTRUCTION(ADDRESSING.ABSOLUTE, INSTRUCTIONS.STA),
            0x8E: this.STORE_INSTRUCTION(ADDRESSING.ABSOLUTE, INSTRUCTIONS.STX),
            0x9D: this.STORE_INSTRUCTION(ADDRESSING.ABSOLUTE_X, INSTRUCTIONS.STA),
            0x99: this.STORE_INSTRUCTION(ADDRESSING.ABSOLUTE_Y, INSTRUCTIONS.STA),
            0x81: this.STORE_INSTRUCTION(ADDRESSING.INDIRECT_X, INSTRUCTIONS.STA),
            0x91: this.STORE_INSTRUCTION(ADDRESSING.INDIRECT_Y, INSTRUCTIONS.STA),
            0x94: this.STORE_INSTRUCTION(ADDRESSING.ZERO_PAGE_X, INSTRUCTIONS.STY),
            0x95: this.STORE_INSTRUCTION(ADDRESSING.ZERO_PAGE_X, INSTRUCTIONS.STA),
            0x96: this.STORE_INSTRUCTION(ADDRESSING.ZERO_PAGE_Y, INSTRUCTIONS.STX),  

            0xC5: this.COMPARE_INSTRUCTION(ADDRESSING.ZERO_PAGE, INSTRUCTIONS.CMP),
            0xC9: this.COMPARE_INSTRUCTION(ADDRESSING.IMMEDIATE, INSTRUCTIONS.CMP),
            0xCD: this.COMPARE_INSTRUCTION(ADDRESSING.ABSOLUTE,  INSTRUCTIONS.CMP),
            0xD9: this.COMPARE_INSTRUCTION(ADDRESSING.ABSOLUTE_Y, INSTRUCTIONS.CMP),
            0xDD: this.COMPARE_INSTRUCTION(ADDRESSING.ABSOLUTE_X, INSTRUCTIONS.CMP),
            0xD1: this.COMPARE_INSTRUCTION(ADDRESSING.INDIRECT_Y, INSTRUCTIONS.CMP),
            0xC1: this.COMPARE_INSTRUCTION(ADDRESSING.INDIRECT_X, INSTRUCTIONS.CMP),
            0xD5: this.COMPARE_INSTRUCTION(ADDRESSING.ZERO_PAGE_X, INSTRUCTIONS.CMP),
            0xE0: this.COMPARE_INSTRUCTION(ADDRESSING.IMMEDIATE, INSTRUCTIONS.CPX),
            0xE4: this.COMPARE_INSTRUCTION(ADDRESSING.ZERO_PAGE, INSTRUCTIONS.CPX),
            0xEC: this.COMPARE_INSTRUCTION(ADDRESSING.ABSOLUTE,  INSTRUCTIONS.CPX),
            0xC0: this.COMPARE_INSTRUCTION(ADDRESSING.IMMEDIATE, INSTRUCTIONS.CPY),
            0xC4: this.COMPARE_INSTRUCTION(ADDRESSING.ZERO_PAGE, INSTRUCTIONS.CPY),
            0xCC: this.COMPARE_INSTRUCTION(ADDRESSING.ABSOLUTE,  INSTRUCTIONS.CPY),

            // Legal NOP instructions
            0xEA: this.NOP(ADDRESSING.IMPLIED),
            0x08: this.PHP(ADDRESSING.IMPLIED),
            0x48: this.PHA(ADDRESSING.IMPLIED),
            0x68: this.PLA(ADDRESSING.IMPLIED),
            0x28: this.PLP(ADDRESSING.IMPLIED),

            0x65: this.ARITHMETIC_INSTRUCTION(ADDRESSING.ZERO_PAGE, INSTRUCTIONS.ADC),
            0x69: this.ARITHMETIC_INSTRUCTION(ADDRESSING.IMMEDIATE, INSTRUCTIONS.ADC),
            0x6D: this.ARITHMETIC_INSTRUCTION(ADDRESSING.ABSOLUTE, INSTRUCTIONS.ADC),
            0x7D: this.ARITHMETIC_INSTRUCTION(ADDRESSING.ABSOLUTE_X, INSTRUCTIONS.ADC),
            0x79: this.ARITHMETIC_INSTRUCTION(ADDRESSING.ABSOLUTE_Y, INSTRUCTIONS.ADC),
            0x61: this.ARITHMETIC_INSTRUCTION(ADDRESSING.INDIRECT_X, INSTRUCTIONS.ADC),
            0x71: this.ARITHMETIC_INSTRUCTION(ADDRESSING.INDIRECT_Y, INSTRUCTIONS.ADC),
            0x75: this.ARITHMETIC_INSTRUCTION(ADDRESSING.ZERO_PAGE_X, INSTRUCTIONS.ADC),

            0xE9: this.ARITHMETIC_INSTRUCTION(ADDRESSING.IMMEDIATE, INSTRUCTIONS.SBC),
            0xE5: this.ARITHMETIC_INSTRUCTION(ADDRESSING.ZERO_PAGE, INSTRUCTIONS.SBC),
            0xED: this.ARITHMETIC_INSTRUCTION(ADDRESSING.ABSOLUTE, INSTRUCTIONS.SBC),
            0xF9: this.ARITHMETIC_INSTRUCTION(ADDRESSING.ABSOLUTE_Y, INSTRUCTIONS.SBC),
            0xFD: this.ARITHMETIC_INSTRUCTION(ADDRESSING.ABSOLUTE_X, INSTRUCTIONS.SBC),
            0xE1: this.ARITHMETIC_INSTRUCTION(ADDRESSING.INDIRECT_X, INSTRUCTIONS.SBC),
            0xF1: this.ARITHMETIC_INSTRUCTION(ADDRESSING.INDIRECT_Y, INSTRUCTIONS.SBC),
            0xF5: this.ARITHMETIC_INSTRUCTION(ADDRESSING.ZERO_PAGE_X, INSTRUCTIONS.SBC),

            0xCA: this.DECREMENT_INSTRUCTION(ADDRESSING.IMPLIED, INSTRUCTIONS.DEX),
            0x88: this.DECREMENT_INSTRUCTION(ADDRESSING.IMPLIED, INSTRUCTIONS.DEY),
            0xE8: this.INCREMENT_INSTRUCTION(ADDRESSING.IMPLIED, INSTRUCTIONS.INX),
            0xC8: this.INCREMENT_INSTRUCTION(ADDRESSING.IMPLIED, INSTRUCTIONS.INY),

            0xAA: this.TRANSFER_INSTRUCTION(ADDRESSING.IMPLIED, INSTRUCTIONS.TAX),
            0xA8: this.TRANSFER_INSTRUCTION(ADDRESSING.IMPLIED, INSTRUCTIONS.TAY),
            0x8A: this.TRANSFER_INSTRUCTION(ADDRESSING.IMPLIED, INSTRUCTIONS.TXA),
            0x98: this.TRANSFER_INSTRUCTION(ADDRESSING.IMPLIED, INSTRUCTIONS.TYA),
            0x9A: this.TRANSFER_INSTRUCTION(ADDRESSING.IMPLIED, INSTRUCTIONS.TXS),
            0xBA: this.TRANSFER_INSTRUCTION(ADDRESSING.IMPLIED, INSTRUCTIONS.TSX),

            0x4A: this.RMW_INSTRUCTION(ADDRESSING.ACCUMULATOR, INSTRUCTIONS.LSR),
            0x46: this.RMW_INSTRUCTION(ADDRESSING.ZERO_PAGE, INSTRUCTIONS.LSR),
            0x4E: this.RMW_INSTRUCTION(ADDRESSING.ABSOLUTE, INSTRUCTIONS.LSR),
            0x5E: this.RMW_INSTRUCTION(ADDRESSING.ABSOLUTE_X, INSTRUCTIONS.LSR),
            0x56: this.RMW_INSTRUCTION(ADDRESSING.ZERO_PAGE_X, INSTRUCTIONS.LSR),
            0x0A: this.RMW_INSTRUCTION(ADDRESSING.ACCUMULATOR, INSTRUCTIONS.ASL),
            0x06: this.RMW_INSTRUCTION(ADDRESSING.ZERO_PAGE, INSTRUCTIONS.ASL),
            0x0E: this.RMW_INSTRUCTION(ADDRESSING.ABSOLUTE, INSTRUCTIONS.ASL),
            0x1E: this.RMW_INSTRUCTION(ADDRESSING.ABSOLUTE_X, INSTRUCTIONS.ASL),
            0x16: this.RMW_INSTRUCTION(ADDRESSING.ZERO_PAGE_X, INSTRUCTIONS.ASL),
            0x6A: this.RMW_INSTRUCTION(ADDRESSING.ACCUMULATOR, INSTRUCTIONS.ROR),
            0x66: this.RMW_INSTRUCTION(ADDRESSING.ZERO_PAGE, INSTRUCTIONS.ROR),
            0x6E: this.RMW_INSTRUCTION(ADDRESSING.ABSOLUTE, INSTRUCTIONS.ROR),
            0x7E: this.RMW_INSTRUCTION(ADDRESSING.ABSOLUTE_X, INSTRUCTIONS.ROR),
            0x76: this.RMW_INSTRUCTION(ADDRESSING.ZERO_PAGE_X, INSTRUCTIONS.ROR),
            0x2A: this.RMW_INSTRUCTION(ADDRESSING.ACCUMULATOR, INSTRUCTIONS.ROL),
            0x26: this.RMW_INSTRUCTION(ADDRESSING.ZERO_PAGE, INSTRUCTIONS.ROL),
            0x2E: this.RMW_INSTRUCTION(ADDRESSING.ABSOLUTE, INSTRUCTIONS.ROL),
            0x3E: this.RMW_INSTRUCTION(ADDRESSING.ABSOLUTE_X, INSTRUCTIONS.ROL),
            0x36: this.RMW_INSTRUCTION(ADDRESSING.ZERO_PAGE_X, INSTRUCTIONS.ROL),
            0xE6: this.RMW_INSTRUCTION(ADDRESSING.ZERO_PAGE, INSTRUCTIONS.INC),
            0xC6: this.RMW_INSTRUCTION(ADDRESSING.ZERO_PAGE, INSTRUCTIONS.DEC),
            0xDE: this.RMW_INSTRUCTION(ADDRESSING.ABSOLUTE_X, INSTRUCTIONS.DEC),
            0xCE: this.RMW_INSTRUCTION(ADDRESSING.ABSOLUTE, INSTRUCTIONS.DEC),
            0xD6: this.RMW_INSTRUCTION(ADDRESSING.ZERO_PAGE_X, INSTRUCTIONS.DEC),
            0xFE: this.RMW_INSTRUCTION(ADDRESSING.ABSOLUTE_X, INSTRUCTIONS.INC),
            0xEE: this.RMW_INSTRUCTION(ADDRESSING.ABSOLUTE, INSTRUCTIONS.INC),
            0xF6: this.RMW_INSTRUCTION(ADDRESSING.ZERO_PAGE_X, INSTRUCTIONS.INC),
            
            // Illegal instructions
            0x04: this.NOP(ADDRESSING.ZERO_PAGE),
            0x44: this.NOP(ADDRESSING.ZERO_PAGE),
            0x64: this.NOP(ADDRESSING.ZERO_PAGE),
            0x0C: this.NOP(ADDRESSING.ABSOLUTE),
            0x14: this.NOP(ADDRESSING.ZERO_PAGE_X),
            0x34: this.NOP(ADDRESSING.ZERO_PAGE_X),
            0x54: this.NOP(ADDRESSING.ZERO_PAGE_X),
            0x74: this.NOP(ADDRESSING.ZERO_PAGE_X),
            0xD4: this.NOP(ADDRESSING.ZERO_PAGE_X),
            0xF4: this.NOP(ADDRESSING.ZERO_PAGE_X),
            0x1C: this.NOP(ADDRESSING.ABSOLUTE_X),
            0x3C: this.NOP(ADDRESSING.ABSOLUTE_X),
            0x5C: this.NOP(ADDRESSING.ABSOLUTE_X),
            0x7C: this.NOP(ADDRESSING.ABSOLUTE_X),
            0xDC: this.NOP(ADDRESSING.ABSOLUTE_X),
            0xFC: this.NOP(ADDRESSING.ABSOLUTE_X),
            0x1A: this.NOP(ADDRESSING.IMPLIED),
            0x3A: this.NOP(ADDRESSING.IMPLIED),
            0x5A: this.NOP(ADDRESSING.IMPLIED),
            0x7A: this.NOP(ADDRESSING.IMPLIED),
            0xDA: this.NOP(ADDRESSING.IMPLIED),
            0xFA: this.NOP(ADDRESSING.IMPLIED),
            0x80: this.NOP(ADDRESSING.IMMEDIATE),
            0xA3: this.LOAD_INSTRUCTION(ADDRESSING.INDIRECT_X, INSTRUCTIONS.LAX),
            0xA7: this.LOAD_INSTRUCTION(ADDRESSING.ZERO_PAGE, INSTRUCTIONS.LAX),
            0xAF: this.LOAD_INSTRUCTION(ADDRESSING.ABSOLUTE, INSTRUCTIONS.LAX),
            0xB3: this.LOAD_INSTRUCTION(ADDRESSING.INDIRECT_Y, INSTRUCTIONS.LAX),
            0xB7: this.LOAD_INSTRUCTION(ADDRESSING.ZERO_PAGE_Y, INSTRUCTIONS.LAX),
            0xBF: this.LOAD_INSTRUCTION(ADDRESSING.ABSOLUTE_Y, INSTRUCTIONS.LAX),
            0x83: this.STORE_INSTRUCTION(ADDRESSING.INDIRECT_X, INSTRUCTIONS.SAX),
            0x97: this.STORE_INSTRUCTION(ADDRESSING.ZERO_PAGE_Y, INSTRUCTIONS.SAX),
            0x8F: this.STORE_INSTRUCTION(ADDRESSING.ABSOLUTE, INSTRUCTIONS.SAX),
            0x87: this.STORE_INSTRUCTION(ADDRESSING.ZERO_PAGE, INSTRUCTIONS.SAX),
            0xEB: this.ARITHMETIC_INSTRUCTION(ADDRESSING.IMMEDIATE, INSTRUCTIONS.SBC),
            0xC3: this.RMW_INSTRUCTION(ADDRESSING.INDIRECT_X, INSTRUCTIONS.DCP),
            0xC7: this.RMW_INSTRUCTION(ADDRESSING.ZERO_PAGE, INSTRUCTIONS.DCP),
            0xCF: this.RMW_INSTRUCTION(ADDRESSING.ABSOLUTE, INSTRUCTIONS.DCP),
            0xD3: this.RMW_INSTRUCTION(ADDRESSING.INDIRECT_Y, INSTRUCTIONS.DCP),
            0xD7: this.RMW_INSTRUCTION(ADDRESSING.ZERO_PAGE_X, INSTRUCTIONS.DCP),
            0xDB: this.RMW_INSTRUCTION(ADDRESSING.ABSOLUTE_Y, INSTRUCTIONS.DCP),
            0xDF: this.RMW_INSTRUCTION(ADDRESSING.ABSOLUTE_X, INSTRUCTIONS.DCP),
            0xE3: this.RMW_INSTRUCTION(ADDRESSING.INDIRECT_X, INSTRUCTIONS.ISB),
            0xE7: this.RMW_INSTRUCTION(ADDRESSING.ZERO_PAGE, INSTRUCTIONS.ISB),
            0xEF: this.RMW_INSTRUCTION(ADDRESSING.ABSOLUTE, INSTRUCTIONS.ISB),
            0xF3: this.RMW_INSTRUCTION(ADDRESSING.INDIRECT_Y, INSTRUCTIONS.ISB),
            0xF7: this.RMW_INSTRUCTION(ADDRESSING.ZERO_PAGE_X, INSTRUCTIONS.ISB),
            0xFB: this.RMW_INSTRUCTION(ADDRESSING.ABSOLUTE_Y, INSTRUCTIONS.ISB),
            0xFF: this.RMW_INSTRUCTION(ADDRESSING.ABSOLUTE_X, INSTRUCTIONS.ISB),
            0x07: this.RMW_INSTRUCTION(ADDRESSING.ZERO_PAGE, INSTRUCTIONS.SLO),
            0x0F: this.RMW_INSTRUCTION(ADDRESSING.ABSOLUTE, INSTRUCTIONS.SLO),
            0x17: this.RMW_INSTRUCTION(ADDRESSING.ZERO_PAGE_X, INSTRUCTIONS.SLO),
            0x1F: this.RMW_INSTRUCTION(ADDRESSING.ABSOLUTE_X, INSTRUCTIONS.SLO),
            0x1B: this.RMW_INSTRUCTION(ADDRESSING.ABSOLUTE_Y, INSTRUCTIONS.SLO),
            0x03: this.RMW_INSTRUCTION(ADDRESSING.INDIRECT_X, INSTRUCTIONS.SLO),
            0x13: this.RMW_INSTRUCTION(ADDRESSING.INDIRECT_Y, INSTRUCTIONS.SLO),
            0x27: this.RMW_INSTRUCTION(ADDRESSING.ZERO_PAGE, INSTRUCTIONS.RLA),
            0x37: this.RMW_INSTRUCTION(ADDRESSING.ZERO_PAGE_X, INSTRUCTIONS.RLA),
            0x2F: this.RMW_INSTRUCTION(ADDRESSING.ABSOLUTE, INSTRUCTIONS.RLA),
            0x3F: this.RMW_INSTRUCTION(ADDRESSING.ABSOLUTE_X, INSTRUCTIONS.RLA),
            0x3B: this.RMW_INSTRUCTION(ADDRESSING.ABSOLUTE_Y, INSTRUCTIONS.RLA),
            0x23: this.RMW_INSTRUCTION(ADDRESSING.INDIRECT_X, INSTRUCTIONS.RLA),
            0x33: this.RMW_INSTRUCTION(ADDRESSING.INDIRECT_Y, INSTRUCTIONS.RLA),
            0x47: this.RMW_INSTRUCTION(ADDRESSING.ZERO_PAGE, INSTRUCTIONS.SRE),
            0x57: this.RMW_INSTRUCTION(ADDRESSING.ZERO_PAGE_X, INSTRUCTIONS.SRE),
            0x4F: this.RMW_INSTRUCTION(ADDRESSING.ABSOLUTE, INSTRUCTIONS.SRE),
            0x5F: this.RMW_INSTRUCTION(ADDRESSING.ABSOLUTE_X, INSTRUCTIONS.SRE),
            0x5B: this.RMW_INSTRUCTION(ADDRESSING.ABSOLUTE_Y, INSTRUCTIONS.SRE),
            0x43: this.RMW_INSTRUCTION(ADDRESSING.INDIRECT_X, INSTRUCTIONS.SRE),
            0x53: this.RMW_INSTRUCTION(ADDRESSING.INDIRECT_Y, INSTRUCTIONS.SRE),
            0x67: this.RMW_INSTRUCTION(ADDRESSING.ZERO_PAGE, INSTRUCTIONS.RRA),
            0x77: this.RMW_INSTRUCTION(ADDRESSING.ZERO_PAGE_X, INSTRUCTIONS.RRA),
            0x6F: this.RMW_INSTRUCTION(ADDRESSING.ABSOLUTE, INSTRUCTIONS.RRA),
            0x7F: this.RMW_INSTRUCTION(ADDRESSING.ABSOLUTE_X, INSTRUCTIONS.RRA),
            0x7B: this.RMW_INSTRUCTION(ADDRESSING.ABSOLUTE_Y, INSTRUCTIONS.RRA),
            0x63: this.RMW_INSTRUCTION(ADDRESSING.INDIRECT_X, INSTRUCTIONS.RRA),
            0x73: this.RMW_INSTRUCTION(ADDRESSING.INDIRECT_Y, INSTRUCTIONS.RRA),
        };
    }

    powerOn() {
        // Registers power up state
        this.REG_A.clear();
        this.REG_X.clear();
        this.REG_Y.clear();

        // Status register power up state
        this.REG_P.value = 0x24;

        // Stack pointer power up state
        this.REG_SP.value = 0xFD;

        // Read reset vector
        this.REG_PC.lowerByte = this.BUS.cpuReadMemory(0xFFFC);
        this.REG_PC.higherByte = this.BUS.cpuReadMemory(0xFFFD);

        // this.REG_PC.value = 0xC000; // Nestest default reset vector
        this.totalCycles = 7;
    }

    reset() {
        // Read reset vector
        this.REG_PC.lowerByte = this.BUS.cpuReadMemory(0xFFFC);
        this.REG_PC.higherByte = this.BUS.cpuReadMemory(0xFFFD);

        this.totalCycles = 7;
    }

    getInstruction(opCode) {
        const hexOpCode = opCode.toString(16);

        if (!this.INSTRUCTIONS[opCode]) {
            throw new Error(`Invalid opCode -> ${hexOpCode} - PC ${this.REG_PC.value.toString(16)}`);
        }
  
        return this.INSTRUCTIONS[opCode];
    }

    step() {
        if (this.currentInstruction.length === 0) {
            // dbg.push(this.logState());

            if (this.pendingNMI) {

                this.pendingNMI = false;
                this.currentInstruction = [...this.BRK(ADDRESSING.IMPLIED, true)];
            } else {
                // Fetch opcode from memory
                let opCode = this.BUS.cpuReadMemory(this.REG_PC.value);
                
                // Fetching the corresponding instruction
                this.currentContext = {};
                this.currentInstruction = [...this.getInstruction(opCode)];
            }
        }
        
        // Execute the current instruction step
        this.currentInstruction.shift()(this.currentContext);

        // Increment the total cycles
        this.totalCycles++;
    }

    setNmi() {
        this.pendingNMI = true;
    }
    
    processAddressingMode(addressingMode, noRead = false) {
        switch(addressingMode) {
            case ADDRESSING.IMPLIED:
                return [
                    _ => {
                        // Simulating the reading of the instruction
                        // without storing the result in the context
                        this.BUS.cpuReadMemory(this.REG_PC.value);
                    },
                ]
            case ADDRESSING.IMMEDIATE:
                return [
                    context => {
                        this.REG_PC.increment();
                        // Fetch the data from the immediate address
                        context.data = this.BUS.cpuReadMemory(this.REG_PC.value);
                    },
                ]
            case ADDRESSING.ACCUMULATOR:
                return [
                    context => {
                        context.data = this.REG_A.value;
                    },
                ]
            case ADDRESSING.ABSOLUTE:
                return [
                    context => {
                        // Prepare a new register as container for the final
                        // address that will be fetched in the next cycles.
                        context.address = new Register16Bit();

                        this.REG_PC.increment();
                        // Fetch byte which is the lower byte of the final address
                        context.address.lowerByte = this.BUS.cpuReadMemory(this.REG_PC.value);
                    },
                    context => {
                        this.REG_PC.increment();
                        // Fetch byte which is the higher byte of the final address
                        context.address.higherByte = this.BUS.cpuReadMemory(this.REG_PC.value);
                    },
                    context => {
                        // Fetch the data from the final address
                        if (!noRead) {
                            context.data = this.BUS.cpuReadMemory(context.address.value);
                        }
                    },
                ]
            case ADDRESSING.ABSOLUTE_X:
                return [
                    context => {
                        // Prepare a new register as container for the final
                        // address that will be fetched in the next cycles.
                        context.address = new Register16Bit();

                        this.REG_PC.increment();
                        // Fetch byte which is the lower byte of the final address
                        context.address.lowerByte = this.BUS.cpuReadMemory(this.REG_PC.value);
                    },
                    context => {
                        this.REG_PC.increment();
                        // Fetch byte which is the higher byte of the final address
                        context.address.higherByte = this.BUS.cpuReadMemory(this.REG_PC.value);
                        // Check if the page crossing occurred
                        context.pageCrossed = (context.address.lowerByte + this.REG_X.value) > 0xFF;
                        // Add the X offset to the lower byte of the address
                        context.address.lowerByte += this.REG_X.value;
                    },
                    context => {
                        // Fetch the data from the final address
                        context.data = this.BUS.cpuReadMemory(context.address.value);

                        if (context.pageCrossed) {
                            context.address.higherByte += 1;

                            this.currentInstruction.unshift(context => {
                                // Fetch the data from the final address after the page crossing
                                context.data = this.BUS.cpuReadMemory(context.address.value);
                            });
                        }
                    },
                ]
            case ADDRESSING.ABSOLUTE_Y:
                return [
                    context => {
                        // Prepare a new register as container for the final
                        // address that will be fetched in the next cycles.
                        context.address = new Register16Bit();

                        this.REG_PC.increment();
                        // Fetch byte which is the lower byte of the final address
                        context.address.lowerByte = this.BUS.cpuReadMemory(this.REG_PC.value);
                    },
                    context => {
                        this.REG_PC.increment();
                        // Fetch byte which is the higher byte of the final address
                        context.address.higherByte = this.BUS.cpuReadMemory(this.REG_PC.value);
                        // Check if the page crossing occurred
                        context.pageCrossed = (context.address.lowerByte + this.REG_Y.value) > 0xFF;
                        // Add the Y offset to the lower byte of the address
                        context.address.lowerByte += this.REG_Y.value;
                    },
                    context => {
                        // Fetch the data from the final address
                        context.data = this.BUS.cpuReadMemory(context.address.value);

                        if (context.pageCrossed) {
                            context.address.higherByte += 1;

                            this.currentInstruction.unshift(context => {
                                // Fetch the data from the final address after the page crossing
                                context.data = this.BUS.cpuReadMemory(context.address.value);
                            });
                        }
                    },
                ]
            case ADDRESSING.INDIRECT:
                return [
                    context => {
                        this.REG_PC.increment();
                        // Prepare a new register as container for the final
                        // address that will be fetched in the next cycles.
                        context.pointerAddress = new Register16Bit();
                        // Fetch byte which is the lower byte of the pointer address
                        context.pointerAddress.lowerByte = this.BUS.cpuReadMemory(this.REG_PC.value);
                    },
                    context => {
                        this.REG_PC.increment();
                        // Fetch byte which is the higher byte of the pointer address
                        context.pointerAddress.higherByte = this.BUS.cpuReadMemory(this.REG_PC.value);
                    },
                    context => {
                        context.address = new Register16Bit();
                        // Fetch byte which is the lower byte of the address
                        context.address.lowerByte = this.BUS.cpuReadMemory(context.pointerAddress.value);
                    },
                    context => {
                        // Simulating the bug which prevents the higher byte of the zero page from
                        // being incremented if the higher byte is on the second page.
                        context.pointerAddress.lowerByte += 1;
                        // Fetch byte which is the higher byte of the address
                        context.address.higherByte = this.BUS.cpuReadMemory(context.pointerAddress.value);
                    },
                ]
            case ADDRESSING.INDIRECT_X:
                return [
                    context => {
                        this.REG_PC.increment();
                        // Prepare a new register as container for the final
                        // address that will be fetched in the next cycles.
                        context.pointerAddress = new Register16Bit();

                        // Fetch byte which is the lower byte of the address
                        context.pointerAddress.lowerByte = this.BUS.cpuReadMemory(this.REG_PC.value);
                    },
                    context => {
                        // Simulating the read from the memory without storing the result in the context.
                        this.BUS.cpuReadMemory(context.pointerAddress.lowerByte)
                        // Add the X offset to the lower byte of the address
                        context.pointerAddress.lowerByte += this.REG_X.value;
                    },
                    context => {
                        context.address = new Register16Bit();
                        // Fetch byte which is the higher byte of the address
                        context.address.lowerByte = this.BUS.cpuReadMemory(context.pointerAddress.value);
                    },
                    context => {
                        // Simulating the bug which prevents the higher byte of the zero page from
                        // being incremented if the higher byte is on the second page.
                        context.pointerAddress.lowerByte += 1;
                        // Fetch byte which is the higher byte of the address
                        context.address.higherByte = this.BUS.cpuReadMemory(context.pointerAddress.value);
                    },
                    context => {
                        // Fetch the data from the final address
                        context.data = this.BUS.cpuReadMemory(context.address.value);
                    },
                ]
            case ADDRESSING.INDIRECT_Y:
                return [
                    context => {
                        this.REG_PC.increment();
                        // Prepare a new register as container for the final
                        // address that will be fetched in the next cycles.
                        context.pointerAddress = new Register16Bit();

                        // Fetch byte which is the lower byte of the address
                        context.pointerAddress.lowerByte = this.BUS.cpuReadMemory(this.REG_PC.value);
                    },
                    context => {
                        context.address = new Register16Bit();
                        // Fetch byte which is the higher byte of the address
                        context.address.lowerByte = this.BUS.cpuReadMemory(context.pointerAddress.value);
                    },
                    context => {
                        // Simulating the bug which prevents the higher byte of the zero page from
                        // being incremented if the higher byte is on the second page.
                        context.pointerAddress.lowerByte += 1;
                        // Fetch byte which is the higher byte of the address
                        context.address.higherByte = this.BUS.cpuReadMemory(context.pointerAddress.value);
                        // Check if the page crossing occurred
                        context.pageCrossed = (context.address.lowerByte + this.REG_Y.value) > 0xFF;
                        context.address.lowerByte += this.REG_Y.value;
                    },
                    context => {
                        // Fetch the data from the final address
                        context.data = this.BUS.cpuReadMemory(context.address.value);

                        if (context.pageCrossed) {
                            context.address.higherByte += 1;

                            this.currentInstruction.unshift(context => {
                                // Fetch the data from the final address after the page crossing
                                context.data = this.BUS.cpuReadMemory(context.address.value);
                            });
                        }
                    },
                ]
            case ADDRESSING.ZERO_PAGE:
                return [
                    context => {
                        // Prepare a new register as container for the final
                        // address that will be fetched in the next cycles.
                        context.address = new Register16Bit();

                        this.REG_PC.increment();
                        
                        // Fetch byte which is the address
                        context.address.lowerByte = this.BUS.cpuReadMemory(this.REG_PC.value);
                        context.address.higherByte = 0x00;
                    },
                    context => {
                        // Fetch the data from the final address
                        context.data = this.BUS.cpuReadMemory(context.address.value);
                    },
                ]
            case ADDRESSING.ZERO_PAGE_X:
                return [
                    context => {
                        // Prepare a new register as container for the final
                        // address that will be fetched in the next cycles.
                        context.address = new Register16Bit();

                        this.REG_PC.increment();
                        
                        // Fetch byte which is the address
                        context.address.lowerByte = this.BUS.cpuReadMemory(this.REG_PC.value);
                        context.address.higherByte = 0x00;
                    },
                    context => {
                        // Simulating the read from the memory without storing the result in the context.
                        this.BUS.cpuReadMemory(context.address.value);
                        // Add the X offset to the lower byte of the address
                        context.address.lowerByte += this.REG_X.value;
                    },
                    context => {
                        // Fetch the data from the final address
                        context.data = this.BUS.cpuReadMemory(context.address.value);
                    },
                ]
            case ADDRESSING.ZERO_PAGE_Y:
                return [
                    context => {
                        // Prepare a new register as container for the final
                        // address that will be fetched in the next cycles.
                        context.address = new Register16Bit();

                        this.REG_PC.increment();
                        
                        // Fetch byte which is the address
                        context.address.lowerByte = this.BUS.cpuReadMemory(this.REG_PC.value);
                        context.address.higherByte = 0x00;
                    },
                    context => {
                        // Simulating the read from the memory without storing the result in the context.
                        this.BUS.cpuReadMemory(context.address.value);
                        // Add the Y offset to the lower byte of the address
                        context.address.lowerByte += this.REG_Y.value;
                    },
                    context => {
                        // Fetch the data from the final address
                        context.data = this.BUS.cpuReadMemory(context.address.value);
                    },
                ]
            case ADDRESSING.RELATIVE:
                return [
                    context => {
                        this.REG_PC.increment();
                        // Fetch byte which is the address offset
                        context.offset = this.BUS.cpuReadMemory(this.REG_PC.value);
                    }
                ]
            default:
                throw new Error(`Addressing mode "${addressingMode}" not supported!`);
        }
    }

    BRK(addressingMode, asNMI = false) {
        const instructionSteps = [
            _ => {
                if (!asNMI) {
                    // Incrementing the program counter going to the padding byte
                    this.REG_PC.increment();
                    // Simulating the read from memory without storing the result in the context.
                    this.BUS.cpuReadMemory(this.REG_PC.value);
                    // Incrementing the program counter to skip the BRK padding byte
                    this.REG_PC.increment();
                }
            },
            _ => {
                this.BUS.cpuWriteMemory(0x0100 + this.REG_SP.value, this.REG_PC.higherByte);
                this.REG_SP.decrement();
            },
            _ => {
                this.BUS.cpuWriteMemory(0x0100 + this.REG_SP.value, this.REG_PC.lowerByte);
                this.REG_SP.decrement();
            },
            _ => {
                // Pushing P register value to the stack with bit 4 (Break) and 5 (Unused) forced to 1
                let mask = 0x30;

                if (asNMI) {
                    // If the BRK is called as NMI only the bit 5 (Unused) is forced to 1
                    mask = 0x20;
                }

                this.BUS.cpuWriteMemory(0x0100 + this.REG_SP.value, this.REG_P.value | mask);
                this.REG_SP.decrement();
            },
            _ => {
                this.REG_PC.lowerByte = this.BUS.cpuReadMemory(asNMI ? 0xFFFA : 0xFFFE);
            },
            _ => {
                this.REG_PC.higherByte = this.BUS.cpuReadMemory(asNMI ? 0xFFFB : 0xFFFF);
                this.REG_P.setBit(CPU_STATUS_FLAG.INTERRUPT);
            },
        ];
        return [...this.processAddressingMode(addressingMode), ...instructionSteps];
    }

    JSR() {
        let instructionSteps = [
            context => {
                // Prepare a new register as container for the final
                // address that will be used in the next cycles.
                context.address = new Register16Bit();

                this.REG_PC.increment();
                // Fetch byte which is the higher byte of the final address
                context.address.lowerByte = this.BUS.cpuReadMemory(this.REG_PC.value);
            },
            _ => {
                // Simulating the read from the stack without storing the result in the context.
                this.BUS.cpuReadMemory(0x0100 + this.REG_SP.value);
            },
            _ => {
                this.REG_PC.increment();

                // Pushing PC Higher Byte on the stack
                this.BUS.cpuWriteMemory(
                    // Stack pointer is in the 0x01XX memory page
                    0x0100 + this.REG_SP.value,
                    this.REG_PC.higherByte
                );
                this.REG_SP.decrement();
            },
            _ => {
                // Pushing PC Higher Byte on the stack
                this.BUS.cpuWriteMemory(
                    // Stack pointer is in the 0x01XX memory page
                    0x0100 + this.REG_SP.value,
                    this.REG_PC.lowerByte
                );
                this.REG_SP.decrement();
            },
            context => {
                // Fetch byte which is the higher byte of the final address
                context.address.higherByte = this.BUS.cpuReadMemory(this.REG_PC.value);
            },
            context => {
                // Set the Program Counter to the final address
                this.REG_PC.value = context.address.value;
            }
        ];
        return [...instructionSteps];
    }

    RTI() {
        let instructionSteps = [
            _ => {
                // Simulating the read from memory without storing the result in the context.
                this.BUS.cpuReadMemory(this.REG_PC.value);
            },
            _ => {
                // Simulating the read from the stack without storing the result in the context.
                this.BUS.cpuReadMemory(0x0100 + this.REG_SP.value);
            },
            _ => {
                this.REG_SP.increment();
            },
            _ => {
                this.REG_P.value = this.BUS.cpuReadMemory(0x0100 + this.REG_SP.value);
                this.REG_P.clearBit(CPU_STATUS_FLAG.BREAK);
                this.REG_P.setBit(CPU_STATUS_FLAG.UNUSED);
                this.REG_SP.increment();
            },
            _ => {
                this.REG_PC.lowerByte = this.BUS.cpuReadMemory(0x0100 + this.REG_SP.value);
                this.REG_SP.increment();
            },
            _ => {
                this.REG_PC.higherByte = this.BUS.cpuReadMemory(0x0100 + this.REG_SP.value);
            },
        ];

        return [...instructionSteps];
    }

    RTS() {
        let instructionSteps = [
            _ => {
                // Simulating the read from memory without storing the result in the context.
                this.BUS.cpuReadMemory(this.REG_PC.value);
            },
            _ => {
                // Simulating the read from the stack without storing the result in the context.
                this.BUS.cpuReadMemory(0x0100 + this.REG_SP.value);
            },
            context => {
                this.REG_SP.increment();
                context.address = new Register16Bit();
                context.address.lowerByte = this.BUS.cpuReadMemory(0x0100 + this.REG_SP.value);
            },
            _ => {
                // Simulating the read from memory without storing the result in the context.
                this.BUS.cpuReadMemory(this.REG_PC.value);
            },
            context => {
                this.REG_SP.increment();
                context.address.higherByte = this.BUS.cpuReadMemory(0x0100 + this.REG_SP.value);
            },
            context => {
                this.REG_PC.value = context.address.value;
                this.REG_PC.increment();
            },
        ];

        return [...instructionSteps];
    }

    JMP(addressingMode) {
        let instructionSteps = [
            context => {
                this.REG_PC.value = context.address.value;
            },
        ];
        
        let addressingSteps = this.processAddressingMode(addressingMode);

        if (addressingMode === ADDRESSING.ABSOLUTE) {
            addressingSteps.pop();
        }

        return [...addressingSteps, ...instructionSteps];
    }

    

    CLEAR_INSTRUCTION(addressingMode, instructionName) {
        let instructionSteps = [
            () => {
                switch(instructionName) {
                    case INSTRUCTIONS.CLC:
                        this.REG_P.clearBit(CPU_STATUS_FLAG.CARRY);
                        break;
                    case INSTRUCTIONS.CLD:
                        this.REG_P.clearBit(CPU_STATUS_FLAG.DECIMAL);
                        break;
                    case INSTRUCTIONS.CLI:
                        this.REG_P.clearBit(CPU_STATUS_FLAG.INTERRUPT);
                        break;
                    case INSTRUCTIONS.CLV:
                        this.REG_P.clearBit(CPU_STATUS_FLAG.OVERFLOW);
                        break;
                    default:
                        throw new Error('CLEAR instruction not supported');
                }

                this.REG_PC.increment();
            }
        ];

        return [...this.processAddressingMode(addressingMode), ...instructionSteps];
    }

    SET_INSTRUCTION(addressingMode, instructionName) {
        let instructionSteps = [
            () => {
                switch(instructionName) {
                    case INSTRUCTIONS.SEC:
                        this.REG_P.setBit(CPU_STATUS_FLAG.CARRY);
                        break;
                    case INSTRUCTIONS.SED:
                        this.REG_P.setBit(CPU_STATUS_FLAG.DECIMAL);
                        break;
                    case INSTRUCTIONS.SEI:
                        this.REG_P.setBit(CPU_STATUS_FLAG.INTERRUPT);
                        break;
                    default:
                        throw new Error('SET instruction not supported');
                }

                this.REG_PC.increment();
            }
        ];

        return [...this.processAddressingMode(addressingMode), ...instructionSteps];
    }

    LOAD_INSTRUCTION(addressingMode, instructionName) {
        let instructionSteps = [
            context => {
                let isZero = false;
                let isNegative = false;

                switch(instructionName) {
                    case INSTRUCTIONS.LDA:
                        this.REG_A.value = context.data;
                        isZero = this.REG_A.isZero();
                        isNegative = this.REG_A.isNegative();
                        break;

                    case INSTRUCTIONS.LDX:
                        this.REG_X.value = context.data;
                        isZero = this.REG_X.isZero();
                        isNegative = this.REG_X.isNegative();
                        break;

                    case INSTRUCTIONS.LDY:
                        this.REG_Y.value = context.data;
                        isZero = this.REG_Y.isZero();
                        isNegative = this.REG_Y.isNegative();
                        break;
                    // Illegal instruction
                    case INSTRUCTIONS.LAX:
                        this.REG_A.value = context.data;
                        this.REG_X.value = context.data;
                        isZero = this.REG_A.isZero();
                        isNegative = this.REG_A.isNegative();
                        break;

                    default:
                        throw new Error('LOAD instruction not supported');
                }

                if (isZero) {
                    this.REG_P.setBit(CPU_STATUS_FLAG.ZERO);
                } else {
                    this.REG_P.clearBit(CPU_STATUS_FLAG.ZERO);
                }

                if (isNegative) {
                    this.REG_P.setBit(CPU_STATUS_FLAG.NEGATIVE);
                } else {
                    this.REG_P.clearBit(CPU_STATUS_FLAG.NEGATIVE);
                }

                this.REG_PC.increment();
            }
        ];

        return [...this.processAddressingMode(addressingMode), ...instructionSteps];
    }

    STORE_INSTRUCTION(addressingMode, instructionName) {
        const addressingSteps = [...this.processAddressingMode(addressingMode, true)];

        if (addressingMode === ADDRESSING.INDIRECT_Y ||
            addressingMode === ADDRESSING.ABSOLUTE_Y ||
            addressingMode === ADDRESSING.ABSOLUTE_X) {
            const previousStep = addressingSteps.pop();

            // Deactivate the page crossing detection for the indirect Y, absolute Y, absolute X addressing mode.
            addressingSteps.push(
                context => {
                    // Simulating the read from the memory without storing the result in the context.
                    this.BUS.cpuReadMemory(context.address.value);
                },
                context => {
                    if (context.pageCrossed) {
                        context.address.higherByte += 1;
                    }
                    context.pageCrossed = false;

                    previousStep(context);
                }
            );
        }

        const getValueToConsider = instructionName => {
            switch(instructionName) {
                case INSTRUCTIONS.STA:
                    return this.REG_A.value;
                case INSTRUCTIONS.STX:
                    return this.REG_X.value;
                case INSTRUCTIONS.STY:
                    return this.REG_Y.value;
                // Illegal instruction
                case INSTRUCTIONS.SAX:
                    return this.REG_A.value & this.REG_X.value;
                default:
                    throw new Error("STORE instruction not supported");
            }
        };

        let instructionSteps = [
            context => {
                this.BUS.cpuWriteMemory(
                    context.address.value,
                    getValueToConsider(instructionName),
                );
                this.REG_PC.increment();
            }
        ]
        return [...addressingSteps, ...instructionSteps];
    }

    COMPARE_INSTRUCTION(addressingMode, instructionName) {
        let instructionSteps = [
            context => {
                switch(instructionName) {
                    case INSTRUCTIONS.CMP:
                        this._executeCompare(this.REG_A.value, context.data);
                        break;
                    case INSTRUCTIONS.CPX:
                        this._executeCompare(this.REG_X.value, context.data);
                        break;
                    case INSTRUCTIONS.CPY:
                        this._executeCompare(this.REG_Y.value, context.data);
                        break;
                    default:
                        throw new Error("COMPARE instruction not supported");
                }
                this.REG_PC.increment();
            }
        ];

        return [...this.processAddressingMode(addressingMode), ...instructionSteps];
    }

    BRANCH_INSTRUCTION(addressingMode, instructionName) {
        let instructionSteps = [
            context => {
                switch(instructionName) {
                    case INSTRUCTIONS.BCC:
                        context.isBranchTaken = !this.REG_P.getBit(CPU_STATUS_FLAG.CARRY);
                        break;
                    case INSTRUCTIONS.BCS:
                        context.isBranchTaken = this.REG_P.getBit(CPU_STATUS_FLAG.CARRY);
                        break;
                    case INSTRUCTIONS.BEQ:
                        context.isBranchTaken = this.REG_P.getBit(CPU_STATUS_FLAG.ZERO);
                        break;
                    case INSTRUCTIONS.BMI:
                        context.isBranchTaken = this.REG_P.getBit(CPU_STATUS_FLAG.NEGATIVE);
                        break;
                    case INSTRUCTIONS.BNE:
                        context.isBranchTaken = !this.REG_P.getBit(CPU_STATUS_FLAG.ZERO);
                        break;
                    case INSTRUCTIONS.BPL:
                        context.isBranchTaken = !this.REG_P.getBit(CPU_STATUS_FLAG.NEGATIVE);
                        break;
                    case INSTRUCTIONS.BVC:
                        context.isBranchTaken = !this.REG_P.getBit(CPU_STATUS_FLAG.OVERFLOW);
                        break;
                    case INSTRUCTIONS.BVS:
                        context.isBranchTaken = this.REG_P.getBit(CPU_STATUS_FLAG.OVERFLOW);
                        break;
                    default:
                        throw new Error('BRANCH instruction not supported');
                }

                this.REG_PC.increment();

                if (context.isBranchTaken) {
                    this.currentInstruction.unshift(context => {
                        // Store the higher byte of the old PC value to check if the page crossing occurred
                        const oldHigherByte = this.REG_PC.higherByte;

                        this.REG_PC.value = this.REG_PC.value + Byte.getSignedNumber(context.offset);

                        context.pageCrossed = this.REG_PC.higherByte !== oldHigherByte;

                        if (context.pageCrossed) {
                            this.currentInstruction.unshift(_ => {
                                // Fetch the data from the final address after the page crossing
                                // but without storing the result in the context. (Simulating the read)
                                this.BUS.cpuReadMemory(this.REG_PC.value);
                            });
                        }
                    });
                }
            }
        ];

        return [...this.processAddressingMode(addressingMode), ...instructionSteps];
    }

    DECREMENT_INSTRUCTION(addressingMode, instructionName) {
        let instructionSteps = [
            instructionContext => {
                let decrementResult = new Register8Bit();
                switch(instructionName) {
                    case INSTRUCTIONS.DEX:
                        this.REG_X.decrement();
                        decrementResult.value = this.REG_X.value;
                        break;
                    case INSTRUCTIONS.DEY:
                        this.REG_Y.decrement();
                        decrementResult.value = this.REG_Y.value;
                        break;
                    default:
                        throw new Error("Decrement instruction not valid");
                }

                this._setZeroAndNegativeFlags(decrementResult);
                this.REG_PC.increment();
            }
        ];
        return [...this.processAddressingMode(addressingMode), ...instructionSteps];
    }

    INCREMENT_INSTRUCTION(addressingMode, instructionName) {
        let instructionSteps = [
            instructionContext => {
                let incrementResult = new Register8Bit();

                switch(instructionName) {
                    case INSTRUCTIONS.INX:
                        this.REG_X.increment();
                        incrementResult.value = this.REG_X.value;
                        break;
                    case INSTRUCTIONS.INY:
                        this.REG_Y.increment();
                        incrementResult.value = this.REG_Y.value;
                        break;
                    default:
                        throw new Error("Decrement instruction not valid");
                }

                if (incrementResult.isZero()) {
                    this.REG_P.setBit(CPU_STATUS_FLAG.ZERO);
                } else {
                    this.REG_P.clearBit(CPU_STATUS_FLAG.ZERO);
                }

                if (incrementResult.isNegative()) {
                    this.REG_P.setBit(CPU_STATUS_FLAG.NEGATIVE);
                } else {
                    this.REG_P.clearBit(CPU_STATUS_FLAG.NEGATIVE);
                }

                this.REG_PC.increment();
            }
        ];
        return [...this.processAddressingMode(addressingMode), ...instructionSteps];
    }

    TRANSFER_INSTRUCTION(addressingMode, instructionName) {
        let instructionSteps = [
            _ => {
                let valueToConsider = new Register8Bit();

                switch(instructionName) {
                    case INSTRUCTIONS.TAX:
                        this.REG_X.value = this.REG_A.value;
                        valueToConsider.value = this.REG_X.value;
                        break;
                    case INSTRUCTIONS.TAY:
                        this.REG_Y.value = this.REG_A.value;
                        valueToConsider.value = this.REG_Y.value;
                        break;
                    case INSTRUCTIONS.TXA:
                        this.REG_A.value = this.REG_X.value;
                        valueToConsider.value = this.REG_A.value;
                        break;
                    case INSTRUCTIONS.TYA:
                        this.REG_A.value = this.REG_Y.value;
                        valueToConsider.value = this.REG_A.value;
                        break;
                    case INSTRUCTIONS.TXS:
                        this.REG_SP.value = this.REG_X.value;
                        // No value to consider for TXS
                        break;
                    case INSTRUCTIONS.TSX:
                        this.REG_X.value = this.REG_SP.value;
                        valueToConsider.value = this.REG_X.value;
                        break;
                }

                if (instructionName !== INSTRUCTIONS.TXS) {
                    this._setZeroAndNegativeFlags(valueToConsider);
                }

                this.REG_PC.increment();
            }
        ];
        return [...this.processAddressingMode(addressingMode), ...instructionSteps];
    }

    _processingRMWAddressingSteps(addressingMode) {
        const regularAddressingSteps = [...this.processAddressingMode(addressingMode, true)];

        const lastRegularAddressingStep = regularAddressingSteps.pop();

        if (addressingMode === ADDRESSING.ABSOLUTE_X ||
            addressingMode === ADDRESSING.ABSOLUTE_Y) {
            regularAddressingSteps.push(
                context => {
                    context.data = this.BUS.cpuReadMemory(context.address.value);
                }
            );
        }

        const correctionStep = context => {
            if (context.pageCrossed) {
                context.address.higherByte += 1;
            }
        };

        if (addressingMode === ADDRESSING.INDIRECT_Y) {
            regularAddressingSteps.push(
                context => {
                    correctionStep(context);
                },
                context => {
                    context.pageCrossed = false;

                    lastRegularAddressingStep(context);
                }
            );
        } else {
            regularAddressingSteps.push(
                context => {
                    correctionStep(context);

                    context.pageCrossed = false;

                    lastRegularAddressingStep(context);
                }
            );
        }

        return regularAddressingSteps;
    }

    


    
 

    NOP(addressingMode) {
        let instructionSteps = [
            _ => {
                this.REG_PC.increment();
            }
        ];
        return [...this.processAddressingMode(addressingMode), ...instructionSteps];
    }

    BIT(addressingMode) {
        let instructionSteps = [
            context => {
                let dataByte = new Byte(context.data);
                let resultByte = new Byte(this.REG_A.value & dataByte.value);

                if (resultByte.isZero()) {
                    this.REG_P.setBit(CPU_STATUS_FLAG.ZERO);
                } else {
                    this.REG_P.clearBit(CPU_STATUS_FLAG.ZERO);
                }

                // Other flags depend on the value read from the memory
                if (dataByte.isNegative()) {
                    this.REG_P.setBit(CPU_STATUS_FLAG.NEGATIVE);
                } else {
                    this.REG_P.clearBit(CPU_STATUS_FLAG.NEGATIVE);
                }

                // Checking for overflow
                if (dataByte.getBit(6)) {
                    this.REG_P.setBit(CPU_STATUS_FLAG.OVERFLOW);
                } else {
                    this.REG_P.clearBit(CPU_STATUS_FLAG.OVERFLOW);
                }   

                this.REG_PC.increment();
            }
        ];
        return [...this.processAddressingMode(addressingMode), ...instructionSteps];
    }

    PHP(addressingMode) {
        let instructionSteps = [
            _ => {
                // Copying the status register to the stack with the break flag set
                let pCopy = new Register8Bit(this.REG_P.value);
                pCopy.setBit(CPU_STATUS_FLAG.BREAK);

                this.BUS.cpuWriteMemory(0x0100 + this.REG_SP.value, pCopy.value);
                this.REG_SP.decrement();
            },
            _ => {
                this.REG_PC.increment();
            }
        ];

        return [...this.processAddressingMode(addressingMode), ...instructionSteps];
    }

    PLA(addressingMode) {
        let instructionSteps = [
            _ => {
                // Simulating the read from the stack without storing the result in the context.
                this.BUS.cpuReadMemory(0x0100 + this.REG_SP.value);
            },
            _ => {
                this.REG_SP.increment();
            },
            _ => {
                this.REG_A.value = this.BUS.cpuReadMemory(0x0100 + this.REG_SP.value);

                if (this.REG_A.isZero()) {
                    this.REG_P.setBit(CPU_STATUS_FLAG.ZERO);
                } else {
                    this.REG_P.clearBit(CPU_STATUS_FLAG.ZERO);
                }
                
                if (this.REG_A.isNegative()) {
                    this.REG_P.setBit(CPU_STATUS_FLAG.NEGATIVE);
                } else {
                    this.REG_P.clearBit(CPU_STATUS_FLAG.NEGATIVE);
                }

                this.REG_PC.increment();
            }
        ];
        return [...this.processAddressingMode(addressingMode), ...instructionSteps];
    }

    PHA(addressingMode) {
        let instructionSteps = [
            _ => {
                this.BUS.cpuReadMemory(this.REG_PC.value);
            },
            _ => {
                this.BUS.cpuWriteMemory(0x0100 + this.REG_SP.value, this.REG_A.value);
                this.REG_SP.decrement();

                this.REG_PC.increment();
            },
        ];
        return [...this.processAddressingMode(addressingMode), ...instructionSteps];
    }

    PLP(addressingMode) {
        let instructionSteps = [
            _ => {
                // Simulating the read from the stack without storing the result in the context.
                this.BUS.cpuReadMemory(0x0100 + this.REG_SP.value);
            },
            _ => {
                this.REG_SP.increment();
            },
            context => {
                // Reading the status register from the stack
                this.REG_P.value = this.BUS.cpuReadMemory(0x0100 + this.REG_SP.value);
                
                // Clearing the break flag since it is not part of the status register
                this.REG_P.clearBit(CPU_STATUS_FLAG.BREAK);

                // Setting the unused flag to 1
                this.REG_P.setBit(CPU_STATUS_FLAG.UNUSED);
                this.REG_PC.increment();
            },
        ];
        return [...this.processAddressingMode(addressingMode), ...instructionSteps];
    }

    AND(addressingMode) {
        let instructionSteps = [
            context => {
                this._executeAND(new Register8Bit(context.data));
                this.REG_PC.increment();
            },
        ];
        return [...this.processAddressingMode(addressingMode), ...instructionSteps];
    }

    ORA(addressingMode) {
        let instructionSteps = [
            context => {
                this._executeORA(new Register8Bit(context.data));
                this.REG_PC.increment();
            }
        ];
        return [...this.processAddressingMode(addressingMode), ...instructionSteps];
    }

    EOR(addressingMode) {
        let instructionSteps = [
            context => {
                this._executeEOR(new Register8Bit(context.data));
                this.REG_PC.increment();
            },
        ];
        return [...this.processAddressingMode(addressingMode), ...instructionSteps];
    }

    _setZeroAndNegativeFlags(value) {
        this.REG_P.setBitAtPosition(
            CPU_STATUS_FLAG.ZERO,
            value.isZero(),
        );
        this.REG_P.setBitAtPosition(
            CPU_STATUS_FLAG.NEGATIVE,
            value.isNegative(),
        );
    }

    _executeAND(valueToConsider) {
        this.REG_A.value = this.REG_A.value & valueToConsider.value;
        this._setZeroAndNegativeFlags(this.REG_A);
    }

    _executeORA(valueToConsider) {
        this.REG_A.value = this.REG_A.value | valueToConsider.value;
        this._setZeroAndNegativeFlags(this.REG_A);
    }

    _executeEOR(valueToConsider) {
        this.REG_A.value = this.REG_A.value ^ valueToConsider.value;
        this._setZeroAndNegativeFlags(this.REG_A);
    }

    _executeSBC(valueToConsider) {
        return this._executeADC(new Register8Bit(~valueToConsider.value));
    }

    _executeADC(valueToConsider) {
        const resultingValue = this.REG_A.value + valueToConsider.value + this.REG_P.getBit(CPU_STATUS_FLAG.CARRY);

        this.REG_P.setBitAtPosition(
            CPU_STATUS_FLAG.CARRY,
            resultingValue > 0xFF,
        );

        const previousValue = this.REG_A.value;
        this.REG_A.value = resultingValue;
        this._setZeroAndNegativeFlags(this.REG_A);

        this.REG_P.setBitAtPosition(
            CPU_STATUS_FLAG.OVERFLOW,
            Byte.overflow(previousValue, valueToConsider.value, resultingValue),
        );

        return new Register8Bit(resultingValue);
    }

    _executeLSR(valueToConsider) {
        this.REG_P.setBitAtPosition(
            CPU_STATUS_FLAG.CARRY,
            valueToConsider.getBit(0),
        );
        return new Register8Bit(valueToConsider.value >> 1);
    }

    _executeASL(valueToConsider) {
        this.REG_P.setBitAtPosition(
            CPU_STATUS_FLAG.CARRY,
            valueToConsider.getBit(7),
        );
        return new Register8Bit(valueToConsider.value << 1);
    }

    _executeROR(valueToConsider) {
        const previousCarry = this.REG_P.getBit(CPU_STATUS_FLAG.CARRY);
        this.REG_P.setBitAtPosition(
            CPU_STATUS_FLAG.CARRY,
            valueToConsider.getBit(0),
        );
        const resultValue = new Register8Bit(valueToConsider.value >> 1);
        resultValue.setBitAtPosition(7, previousCarry);
        return resultValue;
    }

    _executeROL(valueToConsider) {
        const previousCarry = this.REG_P.getBit(CPU_STATUS_FLAG.CARRY);
        this.REG_P.setBitAtPosition(
            CPU_STATUS_FLAG.CARRY,
            valueToConsider.getBit(7),
        );
        const resultValue = new Register8Bit(valueToConsider.value << 1);
        resultValue.setBitAtPosition(0, previousCarry);
        return resultValue;
    }

    _executeINC(valueToConsider) {
        return new Register8Bit(valueToConsider.value + 1);
    }

    _executeDEC(valueToConsider) {
        return new Register8Bit(valueToConsider.value - 1);
    }

    _executeCompare(valueFromRegister, valueFromMemory) {
        const comparisonResult = new Register8Bit(valueFromRegister - valueFromMemory);
        this._setZeroAndNegativeFlags(comparisonResult);
        this.REG_P.setBitAtPosition(
            CPU_STATUS_FLAG.CARRY,
            valueFromRegister >= valueFromMemory,
        );
    }

    RMW_INSTRUCTION(addressingMode, instructionName) {
        const addressingSteps = this._processingRMWAddressingSteps(addressingMode);

        const getValueToConsider = (instructionName, context) => {
            let resultValue = null;
            let valueToConsider = new Register8Bit(context.data);

            switch(instructionName) {
                case INSTRUCTIONS.LSR:
                    resultValue = this._executeLSR(valueToConsider);
                    break;
                case INSTRUCTIONS.ASL:
                    resultValue = this._executeASL(valueToConsider);
                    break;
                case INSTRUCTIONS.ROR:
                    resultValue = this._executeROR(valueToConsider);
                    break;
                case INSTRUCTIONS.ROL:
                    resultValue = this._executeROL(valueToConsider);
                    break;
                case INSTRUCTIONS.INC:
                    resultValue = this._executeINC(valueToConsider);
                    break;
                case INSTRUCTIONS.DEC:
                    resultValue = this._executeDEC(valueToConsider);
                    break; 
                // Illegal instructions
                case INSTRUCTIONS.ISB:
                    resultValue = this._executeINC(valueToConsider);
                    break;
                case INSTRUCTIONS.DCP:
                    resultValue = this._executeDEC(valueToConsider);
                    break;
                case INSTRUCTIONS.SLO:
                    resultValue = this._executeASL(valueToConsider);
                    break;
                case INSTRUCTIONS.RLA:
                    resultValue = this._executeROL(valueToConsider);
                    break;
                case INSTRUCTIONS.SRE:
                    resultValue = this._executeLSR(valueToConsider);
                    break;
                case INSTRUCTIONS.RRA:
                    resultValue = this._executeROR(valueToConsider);
                    break;
                default:
                    throw new Error("SHIFT instruction not supported");
            }
            return resultValue;
        }

        // In RMW instructions, ACCUMULATOR addressing mode differs and must be handled separately.
        if (addressingMode === ADDRESSING.ACCUMULATOR) {
            return [
                ...this.processAddressingMode(addressingMode),
                context => {
                    this.REG_A.value = getValueToConsider(instructionName, context).value;
                    this._setZeroAndNegativeFlags(this.REG_A);
                    this.REG_PC.increment();
                }
            ];
        }

        let instructionSteps = [
            context => {
                context.data = this.BUS.cpuReadMemory(context.address.value);
            },
            context => {
                // Simulating the write to the memory which happens before the shift operation.
                this.BUS.cpuWriteMemory(context.address.value, context.data);
            },
            context => {
                context.result = getValueToConsider(instructionName, context);
                this.BUS.cpuWriteMemory(context.address.value, context.result.value);

                switch(instructionName) {
                    case INSTRUCTIONS.ISB:
                        this._executeSBC(context.result);
                        break;
                    case INSTRUCTIONS.DCP:
                        this._executeCompare(this.REG_A.value, context.result.value);
                        break;
                    case INSTRUCTIONS.SLO:
                        this._executeORA(context.result);
                        break;
                    case INSTRUCTIONS.RLA:
                        this._executeAND(context.result);
                        break;
                    case INSTRUCTIONS.SRE:
                        this._executeEOR(context.result);
                        break;
                    case INSTRUCTIONS.RRA:
                        this._executeADC(context.result);
                        break;
                    default:
                        this._setZeroAndNegativeFlags(context.result);
                }
                
                this.REG_PC.increment();
            }
        ];
        return [...addressingSteps, ...instructionSteps];
    }

    ARITHMETIC_INSTRUCTION(addressingMode, instructionName) {
        let instructionSteps = [
            context => {
                switch(instructionName) {
                    case INSTRUCTIONS.ADC:
                        this._executeADC(new Register8Bit(context.data));
                        break;
                    case INSTRUCTIONS.SBC:
                        this._executeSBC(new Register8Bit(context.data));
                        break;
                    default:
                        throw new Error("ARITHMETIC instruction not supported");
                }
                this.REG_PC.increment();
            },
        ];
        return [...this.processAddressingMode(addressingMode), ...instructionSteps];
    }

}

export default CPU;