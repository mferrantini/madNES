'use strict';

import Byte from "./Byte.js";
import {Register8Bit, Register16Bit} from "./Register.js";
import CONSTANTS, {ADDRESSING, INSTRUCTIONS, CPU_STATUS_FLAG} from "./Constants.js";

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


        // Current instructions steps array
        this.currentInstruction = null;
        // Current instruction step to invoke
        this.currentInstructionStep = 0;
        // Data returned by the executed step
        this.currentInstructionStepOutcome = {};


        this.currentCycle = 7; // TODO: Verify why not 0 in Mesen

        this.INSTRUCTIONS = {
            // 0x69: this.ADC(ADDRESSING.IMMEDIATE),
            // 0x65: this.ADC(ADDRESSING.ZERO_PAGE),
            // 0x75: this.ADC(ADDRESSING.ZERO_PAGE_X),
            // 0x6D: this.ADC(ADDRESSING.ABSOLUTE),
            // 0x70: this.ADC(ADDRESSING.ABSOLUTE_X),
            // 0x79: this.ADC(ADDRESSING.ABSOLUTE_Y),
            // 0x61: this.ADC(ADDRESSING.INDIRECT_X),
            // 0x71: this.ADC(ADDRESSING.INDIRECT_Y),

            0xD0: this.BRANCH_INSTRUCTION(ADDRESSING.RELATIVE, INSTRUCTIONS.BNE),
            0x10: this.BRANCH_INSTRUCTION(ADDRESSING.RELATIVE, INSTRUCTIONS.BPL),
            0x18: this.CLEAR_INSTRUCTION(ADDRESSING.IMPLIED, INSTRUCTIONS.CLC),
            0xD8: this.CLEAR_INSTRUCTION(ADDRESSING.IMPLIED, INSTRUCTIONS.CLD),
            0x58: this.CLEAR_INSTRUCTION(ADDRESSING.IMPLIED, INSTRUCTIONS.CLI),
            0xB8: this.CLEAR_INSTRUCTION(ADDRESSING.IMPLIED, INSTRUCTIONS.CLV),
            0xE0: this.COMPARE_INSTRUCTION(ADDRESSING.IMMEDIATE, INSTRUCTIONS.CPX),
            // 0xE4: this.COMPARE_INSTRUCTION(ADDRESSING.ZERO_PAGE, INSTRUCTIONS.CPX),
            // 0xEC: this.COMPARE_INSTRUCTION(ADDRESSING.ABSOLUTE, INSTRUCTIONS.CPX),
            0xCA: this.DECREMENT_INSTRUCTION(ADDRESSING.IMPLIED, INSTRUCTIONS.DEX),
            0x88: this.DECREMENT_INSTRUCTION(ADDRESSING.IMPLIED, INSTRUCTIONS.DEY),
            0xE8: this.INCREMENT_INSTRUCTION(ADDRESSING.IMPLIED, INSTRUCTIONS.INX),
            0xC8: this.INCREMENT_INSTRUCTION(ADDRESSING.IMPLIED, INSTRUCTIONS.INY),
            0x38: this.SET_INSTRUCTION(ADDRESSING.IMPLIED, INSTRUCTIONS.SEC),
            0xF8: this.SET_INSTRUCTION(ADDRESSING.IMPLIED, INSTRUCTIONS.SED),
            0x78: this.SET_INSTRUCTION(ADDRESSING.IMPLIED, INSTRUCTIONS.SEI),
            0xA9: this.LOAD_INSTRUCTION(ADDRESSING.IMMEDIATE, INSTRUCTIONS.LDA),
            // 0xA5: this.LOAD_INSTRUCTION(ADDRESSING.ZERO_PAGE, INSTRUCTIONS.LDA),
            // 0xB5: this.LOAD_INSTRUCTION(ADDRESSING.ZERO_PAGE_X, INSTRUCTIONS.LDA),
            0xAD: this.LOAD_INSTRUCTION(ADDRESSING.ABSOLUTE, INSTRUCTIONS.LDA),
            0xBD: this.LOAD_INSTRUCTION(ADDRESSING.ABSOLUTE_X, INSTRUCTIONS.LDA),
            // 0xB9: this.LOAD_INSTRUCTION(ADDRESSING.ABSOLUTE_Y, INSTRUCTIONS.LDA),
            // 0xA1: this.LOAD_INSTRUCTION(ADDRESSING.INDIRECT_X, INSTRUCTIONS.LDA),
            // 0xB1: this.LOAD_INSTRUCTION(ADDRESSING.INDIRECT_Y, INSTRUCTIONS.LDA),
            0xA2: this.LOAD_INSTRUCTION(ADDRESSING.IMMEDIATE, INSTRUCTIONS.LDX),
            // 0xA6: this.LOAD_INSTRUCTION(ADDRESSING.ZERO_PAGE, INSTRUCTIONS.LDX),
            // 0xB6: this.LOAD_INSTRUCTION(ADDRESSING.ZERO_PAGE_Y, INSTRUCTIONS.LDX),
            // 0xAE: this.LOAD_INSTRUCTION(ADDRESSING.ABSOLUTE, INSTRUCTIONS.LDX),
            // 0xBE: this.LOAD_INSTRUCTION(ADDRESSING.ABSOLUTE_Y, INSTRUCTIONS.LDX),
            0xA0: this.LOAD_INSTRUCTION(ADDRESSING.IMMEDIATE, INSTRUCTIONS.LDY),
            // 0xA4: this.LOAD_INSTRUCTION(ADDRESSING.ZERO_PAGE, INSTRUCTIONS.LDY),
            // 0xB4: this.LOAD_INSTRUCTION(ADDRESSING.ZERO_PAGE_X, INSTRUCTIONS.LDY),
            // 0xAC: this.LOAD_INSTRUCTION(ADDRESSING.ABSOLUTE, INSTRUCTIONS.LDY),
            // 0xBC: this.LOAD_INSTRUCTION(ADDRESSING.ABSOLUTE_X, INSTRUCTIONS.LDY),
            0x85: this.STORE_INSTRUCTION(ADDRESSING.ZERO_PAGE, INSTRUCTIONS.STA),
            // 0x95: this.STORE_INSTRUCTION(ADDRESSING.ZERO_PAGE_X, INSTRUCTIONS.STA),
            0x8D: this.STORE_INSTRUCTION(ADDRESSING.ABSOLUTE, INSTRUCTIONS.STA),
            // 0x9D: this.STORE_INSTRUCTION(ADDRESSING.ABSOLUTE_X, INSTRUCTIONS.STA),
            // 0x99: this.STORE_INSTRUCTION(ADDRESSING.ABSOLUTE_Y, INSTRUCTIONS.STA),
            // 0x81: this.STORE_INSTRUCTION(ADDRESSING.INDIRECT_X, INSTRUCTIONS.STA),
            // 0x91: this.STORE_INSTRUCTION(ADDRESSING.INDIRECT_Y, INSTRUCTIONS.STA),
            // 0x86: this.STORE_INSTRUCTION(ADDRESSING.ZERO_PAGE, INSTRUCTIONS.STX),
            // 0x96: this.STORE_INSTRUCTION(ADDRESSING.ZERO_PAGE_Y, INSTRUCTIONS.STX),
            0x8E: this.STORE_INSTRUCTION(ADDRESSING.ABSOLUTE, INSTRUCTIONS.STX),
            0x8C: this.STORE_INSTRUCTION(ADDRESSING.ABSOLUTE, INSTRUCTIONS.STY),

            0x20: this.JSR(ADDRESSING.ABSOLUTE),
            0x9A: this.TXS(ADDRESSING.IMPLIED),
            0x60: this.RTS(ADDRESSING.IMPLIED),
        };
    }

    powerOn() {
        // Status register power up state
        this.REG_P.set(0x34);
        // Stack pointer power up state
        this.REG_SP.set(0x01FD);
        // Read reset vector
        this.REG_PC.setLowerByte(this.BUS.cpuReadMemory(0xFFFC));
        this.REG_PC.setHigherByte(this.BUS.cpuReadMemory(0xFFFD));

        // this.REG_PC.set(0xC2ED);
    }

    reset() {}

    getInstruction(opCode) {
        // console.log(`cycle: ${this.currentCycle}  PC: ${this.REG_PC.value().toString(16)}  OP: ${opCode.toString(16)}`);

        if (!this.INSTRUCTIONS[opCode]) {
            throw new Error(`Invalid opCode -> ${opCode.toString(16)}`);
        }
        return this.INSTRUCTIONS[opCode];
    }

    step() {
        if (this.currentInstruction) {
            // Execute the instruction step which returns a dictionary which are 
            // used as parameters for the next instruction steps. If the returned
            // value is a specific STOP_CURRENT_INSTRUCTION label, the instruction
            // execution is stopped and the remaining steps will be ignored. If in
            // the returned dictionary there is a "skip" key, "skip" value steps
            // will be skipped. See use cases in conditions below.

            this.currentInstructionStepOutcome =
                this.currentInstruction[this.currentInstructionStep](this.currentInstructionStepOutcome);

            this.currentInstructionStep += 1;

            if (this.currentInstructionStepOutcome) {
                if (this.currentInstructionStepOutcome === INSTRUCTIONS.STOP_CURRENT_INSTRUCTION) {
                    // Check if the instruction must be terminated and the rest of the
                    // remaining cycles completely skipped. See branch instructions for
                    // example, when additional steps could not be executed depending
                    // on the branch condition evaluation.
                    this.currentInstructionStep = this.currentInstruction.length;

                } else if ('skip' in this.currentInstructionStepOutcome) {
                    // Check if there is a 'skip' key in the returned dictionary, if 
                    // so, the related value will be added to the current step count,
                    // skipping a certain number of steps. See for example Indexed
                    // addressings where the addition of the index value, could require
                    // additional cycles based of the carry flag value.
                    this.currentInstructionStep += 1 + this.currentInstructionStepOutcome.skip;
                    delete this.currentInstructionStepOutcome.skip;
                }
            }

            // If it was the last instruction step, reset currentInstruction
            if (this.currentInstruction.length <= this.currentInstructionStep) {
                this.currentInstruction = null;
                this.currentInstructionStep = 0;
                this.currentInstructionStepOutcome = {};
            }
        }

        // This block is at the end of the CPU Step since the last cycle of every
        // instructions corresponds to the fetch of the next opcode and instruction
        if (this.currentInstruction === null) {
            // Fetch opcode from memory
            let opCode = this.BUS.cpuReadMemory(this.REG_PC.value());

            // Retrieve the corresponding instruction
            this.currentInstruction = this.getInstruction(opCode);

            this.REG_PC.increment();
        }

        this.currentCycle += 1;
    }

    processAddressingMode(addressingMode) {
        switch (addressingMode) {
            case ADDRESSING.IMPLIED:
                return [() => ({'address': new Register16Bit()})]
            case ADDRESSING.RELATIVE:
            case ADDRESSING.IMMEDIATE:            
                return [
                    instructionContext => {
                        instructionContext = {
                            'data': this.BUS.cpuReadMemory(this.REG_PC.value())
                        };
                        this.REG_PC.increment();
                        return instructionContext;
                    }
                ]
            case ADDRESSING.ACCUMULATOR:
                return []
            case ADDRESSING.ABSOLUTE:
                return [
                    instructionContext => {
                        instructionContext = {'address': new Register16Bit()};
                        instructionContext.address.setLowerByte(
                            this.BUS.cpuReadMemory(this.REG_PC.value())
                        );
                        this.REG_PC.increment();
                        return instructionContext;
                    },
                    instructionContext => {
                        instructionContext.address.setHigherByte(
                            this.BUS.cpuReadMemory(this.REG_PC.value())
                        );
                        this.REG_PC.increment();
                        return instructionContext;
                    },
                    instructionContext => {
                        instructionContext.data = 
                            this.BUS.cpuReadMemory(instructionContext.address.value());
                        return instructionContext;
                    },
                ]
            case ADDRESSING.ABSOLUTE_X:
                return [
                    instructionContext => {
                        // Fetch the lower byte of the target address
                        instructionContext = {'address': new Register16Bit()};

                        instructionContext.address.setLowerByte(
                            this.BUS.cpuReadMemory(this.REG_PC.value())
                        );
                        this.REG_PC.increment();
                        return instructionContext;
                    },
                    instructionContext => {
                        // Add X offset to the address which now contains just the
                        // lower byte.
                        instructionContext.address.set(
                            instructionContext.address.value() + this.REG_X.value()
                        );
                        // Check if the addition did create a carry and set the
                        // corresponding flag into the status register.
                        if (instructionContext.address.getBit(8)) {
                            this.REG_P.setBit(CPU_STATUS_FLAG.CARRY);
                        }

                        // Fetch the higher byte of the target address
                        instructionContext.address.setHigherByte(
                            this.BUS.cpuReadMemory(this.REG_PC.value())
                        );
                        this.REG_PC.increment();
                        return instructionContext;
                    }, 
                    instructionContext => {
                        // Potentially the final address is now available, but we
                        // need to check if the index addition in the previous step
                        // did set the carry flag. If so, this step will be used to 
                        // add the carry to the higher byte of the address and the
                        // data will be fetched in the next one.

                        if (this.REG_P.getBit(CPU_STATUS_FLAG.CARRY)) {
                            instructionContext.address.setHigherByte(
                                instructionContext.address.getHigherByte() + 1
                            );

                            // TODO: check if the carry clear here is ok or not.
                            this.REG_P.clearBit(CPU_STATUS_FLAG.CARRY);

                            // Exit since the data will be fetched on the next step
                            return instructionContext;
                        }

                        // Data are fetched now, so we can skip the next step.
                        instructionContext.data = this.BUS.cpuReadMemory(
                            instructionContext.address.value()
                        );
                        
                        // Skip the following step.
                        instructionContext.skip = 1;

                        return instructionContext;
                    },
                    instructionContext => {
                        // If this step is executed, means that the index did generate
                        // a page crossing and the final address is available just now
                        instructionContext.data = this.BUS.cpuReadMemory(
                            instructionContext.address.value()
                        );
                        return instructionContext;
                    }
                ]
            case ADDRESSING.ABSOLUTE_Y:
                return []
            case ADDRESSING.INDIRECT:
                return [
                    instructionContext => {
                        instructionContext.zeroPageAddress = new Register16Bit();
                        instructionContext.zeroPageAddress.setLowerByte(
                            this.BUS.cpuReadMemory(this.REG_PC.value())
                        );
                        return instructionContext;
                    },
                    instructionContext => {
                        instructionContext.address = new Register16Bit();
                        instructionContext.address.setLowerByte(
                            this.BUS.cpuReadMemory(
                                instructionContext.zeroPageAddress.value()
                            )
                        );

                        return instructionContext;
                    },
                    instructionContext => {
                        // Reproduce the bug which prevents the higher byte of 
                        // the zero page from being incremented if the higher byte
                        // is on the second page. I.e. ADL 0x00FF and ADH on 0x0000
                        // (not 0x0100)
                        instructionContext.zeroPageAddress.increment();
                        instructionContext.zeroPageAddress.setHigherByte(0x00);

                        instructionContext.address.setHigherByte(
                            this.BUS.cpuReadMemory(
                                instructionContext.zeroPageAddress.value()
                            )                            
                        )
                    }
                ]
            case ADDRESSING.INDIRECT_X:
                return []
            case ADDRESSING.INDIRECT_Y:
                return []
            case ADDRESSING.ZERO_PAGE:
                return [
                    instructionContext => {
                        instructionContext = {'address': new Register16Bit()};
                        instructionContext.address.setLowerByte(
                            this.BUS.cpuReadMemory(this.REG_PC.value())
                        );
                        this.REG_PC.increment();
                        return instructionContext;
                    },
                    instructionContext => {
                        // The data are fetched from the resulting address which has
                        // higher byte still on zero. This means that the address is 
                        // pointing to the very first page, which is the Zero Page.
                        instructionContext.data = 
                            this.BUS.cpuReadMemory(instructionContext.address.value());

                        // Based on the instruction, the data could not be used at
                        // all, but just the address we just calculated.
                        return instructionContext;
                    },
                ]
            case ADDRESSING.ZERO_PAGE_X:
                return []
            case ADDRESSING.ZERO_PAGE_Y:
                return []
            default:
                throw new Error('Addressing mode not valid');
        }
    }

    // Generic instructions
    BRANCH_INSTRUCTION(addressingMode, instructionName) {
        let addressingSteps = this.processAddressingMode(addressingMode);
        let instructionSteps = [
            instructionContext => {
                // Make the fetched value a relative number
                let offset = Byte.getSignedNumber(instructionContext.data);

                instructionContext.next_PC = 
                    new Register16Bit(this.REG_PC.value() + offset);

                let isBranchTaken = false;
                // Evaluate branch condition based on the branch instruction name
                switch(instructionName) {
                    case INSTRUCTIONS.BNE:
                        isBranchTaken = !this.REG_P.getBit(CPU_STATUS_FLAG.ZERO);
                        break;
                    case INSTRUCTIONS.BPL:
                        isBranchTaken = !this.REG_P.getBit(CPU_STATUS_FLAG.NEGATIVE);
                        break;
                    default:
                        throw new Error('Branch instruction not supported');
                }

                if (!isBranchTaken) {
                    // Stop the execution and prevent the next steps from being
                    // executed if the branch hasn't been taken.
                    return INSTRUCTIONS.STOP_CURRENT_INSTRUCTION;
                }

                return instructionContext;
            },
            instructionContext => {
                let isPageCrossed = 
                        this.REG_PC.getHigherByte() !== instructionContext.next_PC.getHigherByte();

                this.REG_PC.setLowerByte(instructionContext.next_PC.getLowerByte());

                if (!isPageCrossed) {
                    // Stop the execution and prevent the next steps from being
                    // executed if the page hasn't been crossed.
                    return INSTRUCTIONS.STOP_CURRENT_INSTRUCTION;
                }

                return instructionContext;
            },
            instructionContext => {
                // This step is executed just if the branch goes to a different page
                // since we need to set also the higher byte just in that situation.
                this.REG_PC.setHigherByte(instructionContext.next_PC.getHigherByte());
            }
        ];
        return [...addressingSteps, ...instructionSteps];
    }

    CLEAR_INSTRUCTION(addressingMode, instructionName) {
        let addressingSteps = this.processAddressingMode(addressingMode);
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
                        throw new Error("Clear instruction not supported");
                }
            }
        ];
        return [...addressingSteps, ...instructionSteps];
    }

    COMPARE_INSTRUCTION(addressingMode, instructionName) {
        let addressingSteps = this.processAddressingMode(addressingMode);
        let instructionSteps = [
            instructionContext => {
                let comparisonResult = new Register8Bit();

                switch(instructionName) {
                    case INSTRUCTIONS.CPX:
                        comparisonResult.set(this.REG_X.value() - instructionContext.data);
                        break;
                    default:
                        throw new Error("Compare instruction not valid");
                }

                // TODO: check if this is true or not
                if (comparisonResult.value() >= 0) {
                    this.REG_P.setBit(CPU_STATUS_FLAG.CARRY);
                } else {
                    this.REG_P.clearBit(CPU_STATUS_FLAG.CARRY);
                }

                if (comparisonResult.value() === 0) {
                    this.REG_P.setBit(CPU_STATUS_FLAG.ZERO);
                } else {
                    this.REG_P.clearBit(CPU_STATUS_FLAG.ZERO);
                }

                if (comparisonResult.getBit(7)) {
                    this.REG_P.setBit(CPU_STATUS_FLAG.NEGATIVE);
                } else {
                    this.REG_P.clearBit(CPU_STATUS_FLAG.NEGATIVE);
                }
            }
        ];
        return [...addressingSteps, ...instructionSteps];
    }

    SET_INSTRUCTION(addressingMode, instructionName) {
        let addressingSteps = this.processAddressingMode(addressingMode);
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
                        throw new Error("Set instruction not supported");
                }
            }
        ];
        return [...addressingSteps, ...instructionSteps];
    }

    LOAD_INSTRUCTION(addressingMode, instructionName) {
        let addressingSteps = this.processAddressingMode(addressingMode);
        let instructionSteps = [
            instructionContext => {
                let loadResult = new Register8Bit();

                switch(instructionName) {
                    case INSTRUCTIONS.LDA:
                        this.REG_A.set(instructionContext.data);
                        loadResult.set(this.REG_A.value());
                        break;
                    case INSTRUCTIONS.LDX:
                        this.REG_X.set(instructionContext.data);
                        loadResult.set(this.REG_X.value());
                        break;
                    case INSTRUCTIONS.LDY:
                        this.REG_Y.set(instructionContext.data);
                        loadResult.set(this.REG_Y.value());
                        break;
                    default:
                        throw new Error("Decrement instruction not valid");
                }

                if (loadResult.value() === 0) {
                    this.REG_P.setBit(CPU_STATUS_FLAG.ZERO);
                } else {
                    this.REG_P.clearBit(CPU_STATUS_FLAG.ZERO);
                }

                if (loadResult.getBit(7)) {
                    this.REG_P.setBit(CPU_STATUS_FLAG.NEGATIVE);
                } else {
                    this.REG_P.clearBit(CPU_STATUS_FLAG.NEGATIVE);
                }
            }
        ];
        return [...addressingSteps, ...instructionSteps];
    }

    STORE_INSTRUCTION(addressingMode, instructionName) {
        let addressingSteps = this.processAddressingMode(addressingMode);
        let instructionSteps = [
            instructionContext => {
                switch(instructionName) {
                    case INSTRUCTIONS.STA:
                        this.BUS.cpuWriteMemory(
                            instructionContext.address.value(),
                            this.REG_A.value()
                        );
                        break;
                    case INSTRUCTIONS.STX:
                        this.BUS.cpuWriteMemory(
                            instructionContext.address.value(),
                            this.REG_X.value()
                        );
                        break;
                    case INSTRUCTIONS.STY:
                        this.BUS.cpuWriteMemory(
                            instructionContext.address.value(),
                            this.REG_Y.value()
                        );
                        break;
                    default:
                        throw new Error("Store instruction not valid");
                }
            }
        ]
        return [...addressingSteps, ...instructionSteps];
    }

    DECREMENT_INSTRUCTION(addressingMode, instructionName) {
        let addressingSteps = this.processAddressingMode(addressingMode);
        let instructionSteps = [
            instructionContext => {
                let decrementResult = new Register8Bit();

                switch(instructionName) {
                    case INSTRUCTIONS.DEX:
                        this.REG_X.decrement();
                        decrementResult.set(this.REG_X.value());
                        break;
                    case INSTRUCTIONS.DEY:
                        this.REG_Y.decrement();
                        decrementResult.set(this.REG_Y.value());
                        break;
                    default:
                        throw new Error("Decrement instruction not valid");
                }

                if (decrementResult.value() === 0) {
                    this.REG_P.setBit(CPU_STATUS_FLAG.ZERO);
                } else {
                    this.REG_P.clearBit(CPU_STATUS_FLAG.ZERO);
                }

                if (decrementResult.getBit(7)) {
                    this.REG_P.setBit(CPU_STATUS_FLAG.NEGATIVE);
                } else {
                    this.REG_P.clearBit(CPU_STATUS_FLAG.NEGATIVE);
                }
            }
        ];
        return [...addressingSteps, ...instructionSteps];
    }

    INCREMENT_INSTRUCTION(addressingMode, instructionName) {
        let addressingSteps = this.processAddressingMode(addressingMode);
        let instructionSteps = [
            instructionContext => {
                let incrementResult = new Register8Bit();

                switch(instructionName) {
                    case INSTRUCTIONS.INX:
                        this.REG_X.increment();
                        incrementResult.set(this.REG_X.value());
                        break;
                    case INSTRUCTIONS.INY:
                        this.REG_Y.increment();
                        incrementResult.set(this.REG_Y.value());
                        break;
                    default:
                        throw new Error("Decrement instruction not valid");
                }

                if (incrementResult.value() === 0) {
                    this.REG_P.setBit(CPU_STATUS_FLAG.ZERO);
                } else {
                    this.REG_P.clearBit(CPU_STATUS_FLAG.ZERO);
                }

                if (incrementResult.getBit(7)) {
                    this.REG_P.setBit(CPU_STATUS_FLAG.NEGATIVE);
                } else {
                    this.REG_P.clearBit(CPU_STATUS_FLAG.NEGATIVE);
                }
            }
        ];
        return [...addressingSteps, ...instructionSteps];
    }

    // Specific instructions
    TXS(addressingMode) {
        let addressingSteps = this.processAddressingMode(addressingMode);
        let instructionSteps = [
            instructionContext => {
                this.REG_SP.setLowerByte(this.REG_X.value());
            }
        ];
        return [...addressingSteps, ...instructionSteps];
    }

    // JMP(addressingMode) {
    //     let addressingSteps = this.processAddressingMode(addressingMode);
    //     let instructionSteps = [
    //         instructionContext => {
    //             this.REG_PC.set(instructionContext.address.value());
    //         }
    //     ];
    //     return [...addressingSteps, ...instructionSteps];
    // }

    // TODO: check implementation results
    JSR(addressingMode) {
        let addressingSteps = this.processAddressingMode(addressingMode);
        let instructionSteps = [
            instructionContext => {
                // Decrement beacuse it has been incremented 1 extra time
                // in the absolute addressing respect from the JSR requirements
                this.REG_PC.decrement();

                this.BUS.cpuWriteMemory(
                    this.REG_SP.value(),
                    this.REG_PC.getHigherByte()
                );
                this.REG_SP.decrement();
                return instructionContext;
            },
            instructionContext => {
                this.BUS.cpuWriteMemory(
                    this.REG_SP.value(),
                    this.REG_PC.getLowerByte()
                )
                this.REG_SP.decrement();
                return instructionContext;
            },
            instructionContext => {
                this.REG_PC.set(instructionContext.address.value());
                // console.log(`JSR goes to ${this.REG_PC.value().toString(16)}`);
            }
        ];
        return [...addressingSteps, ...instructionSteps];
    }

    // TODO: check implementation results
    RTS(addressingMode) {
        let addressingSteps = this.processAddressingMode(addressingMode);
        let instructionSteps = [
            instructionContext => {
                this.REG_SP.increment();
                return instructionContext;
            },
            instructionContext => {
                // Fetch lower byte of former PC
                instructionContext.address.setLowerByte(
                    this.BUS.cpuReadMemory(this.REG_SP.value())
                );
                this.REG_SP.increment();
                return instructionContext;
            },
            instructionContext => {
                // Fetch higher byte of former PC
                instructionContext.address.setHigherByte(
                    this.BUS.cpuReadMemory(this.REG_SP.value())
                );
                return instructionContext;
            },
            instructionContext => {
                this.REG_PC.set(instructionContext.address.value());
                this.REG_PC.increment();
                // console.log(`RTS back to ${this.REG_PC.value().toString(16)}`);
            },
            instructionContext => {}
        ];
        return [...addressingSteps, ...instructionSteps];
    }
}

export default CPU;