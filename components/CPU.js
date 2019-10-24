// Loading utils
import Byte from '../utils/Byte.js';

// Loading Components
import INSTRUCTIONS from './Instructions.js';
import Controller from './Controller.js';

class CPU {
    constructor(memoryController, PPU) {
        // TODO: Remove PPU from here
        this.PPU = PPU;

        this.REG_A = 0x00;
        this.REG_X = 0x00;
        this.REG_Y = 0x00;
        
        // Status register flags
        this.FLAG_C = false; // 0
        this.FLAG_Z = false; // 1
        this.FLAG_I = false; // 2
        this.FLAG_D = false; // 3
        this.FLAG_B = false; // 4
        this.FLAG_U = false; // 5 Unused
        this.FLAG_V = false; // 6
        this.FLAG_N = false; // 7

        // Initial state
        this.setStatusRegisterByte(0x34);

        this.STACK_POINTER   = 0x01FD;
        this.PROGRAM_COUNTER = 0x0000;

        this.nmiToDispatch = false;
        this.dmaToDispatch = false;

        this.cyclesToSkip = 0;        
        this.totalCycles  = 0;
        this.nextInstruction = null;

        this.CONTROLLER_1 = new Controller();
        this.CONTROLLER_2 = new Controller();

        ({
            writeMemory: this.writeMemory,
            readMemory:  this.readMemory,
            checkForNMI: this.checkForNMI,
            checkForDMA: this.checkForDMA,
            dispatchDMA: this.dispatchDMA
        } = memoryController.registerComponent('CPU', this));
    }

    reset() {
        // TODO: https://wiki.nesdev.com/w/index.php/CPU_power_up_state
        // Initialize program counter by reading reset vector.
        this.PROGRAM_COUNTER = this.get16Bit(0xFFFC);
    }

    step() {
        if (this.nextInstruction === null && this.cyclesToSkip === 0) {

            let opCode = null;

            if (this.nmiToDispatch) {
                opCode = 'NMI';
            } else if (this.dmaToDispatch) {
                opCode = 'DMA';
            } else {
                opCode = this.readMemory(this.PROGRAM_COUNTER);
            }

            this.nextInstruction = this.getInstruction(opCode);

            this.cyclesToSkip = this.nextInstruction.cycles * 3;
            this.totalCycles += this.nextInstruction.cycles;

            this.addDebugRow();
            this.nmiToDispatch = false;
        }

        if (this.nextInstruction && this.cyclesToSkip === 3) {

            let extraCycles = this.nextInstruction.execute(this);
            this.PROGRAM_COUNTER += this.nextInstruction.bytes;
            
            this.cyclesToSkip += extraCycles * 3; 
            this.totalCycles  += extraCycles;

            this.nmiToDispatch = this.checkForNMI();
            this.dmaToDispatch = this.checkForDMA();
            this.nextInstruction = null;
        }

        if (this.cyclesToSkip > 0) {
            this.cyclesToSkip--;
        }
    }

    getInstruction(opCode) {
        if (!INSTRUCTIONS[opCode]) {
            throw new Error(`invalid opcode ${opCode.toString(16)}`);
        }

        return  INSTRUCTIONS[opCode]; 
    }

    // Utils
    get8Bit(startingAddress) {
        return this.readMemory(startingAddress);
    }

    get16Bit(startingAddress) {
        let lowerByte = this.get8Bit(startingAddress);
        let upperByte = this.get8Bit(startingAddress + 1);
        return this.joinAddressBytes(upperByte, lowerByte);
    }

    getStatusRegisterByte() {
        return  (this.FLAG_C ? 1 : 0) << 0 |
                (this.FLAG_Z ? 1 : 0) << 1 |
                (this.FLAG_I ? 1 : 0) << 2 |
                (this.FLAG_D ? 1 : 0) << 3 |
                (this.FLAG_B ? 1 : 0) << 4 |
                (this.FLAG_U ? 1 : 0) << 5 |
                (this.FLAG_V ? 1 : 0) << 6 |
                (this.FLAG_N ? 1 : 0) << 7;
    }

    setStatusRegisterByte(byte) {
        byte &= 0xFF;

        this.FLAG_C = Byte.isBitSetAtPosition(byte, 0);
        this.FLAG_Z = Byte.isBitSetAtPosition(byte, 1);
        this.FLAG_I = Byte.isBitSetAtPosition(byte, 2);
        this.FLAG_D = Byte.isBitSetAtPosition(byte, 3);
        this.FLAG_B = Byte.isBitSetAtPosition(byte, 4);
        this.FLAG_U = Byte.isBitSetAtPosition(byte, 5);
        this.FLAG_V = Byte.isBitSetAtPosition(byte, 6);
        this.FLAG_N = Byte.isBitSetAtPosition(byte, 7);
    }

    joinAddressBytes(upperByte, lowerByte) {
        return (upperByte << 8) | (lowerByte & 0xFF);
    }

    isMemoryPageDifferent(firstAddress, secondAddress) {
        return (firstAddress & 0xFF00) !== (secondAddress & 0xFF00);
    }

    getStackPointer() {
        return this.STACK_POINTER;
    }

    setStackPointer(byte) {
        // Stack pointer in always in the 0x01XX memory page
        this.STACK_POINTER = this.joinAddressBytes(0x01, byte);
    }

    pushValueOnStack(value) {
        this.writeMemory(value, this.STACK_POINTER);
        this.STACK_POINTER--;
    }
    
    pullValueFromStack() {
        this.STACK_POINTER++;
        let value = this.readMemory(this.STACK_POINTER);
        // Clean stack position
        // TODO: evaluate if needed
        this.writeMemory(0x00, this.STACK_POINTER);
        return value;
    }










    addDebugRow() {
        if (!this.nextInstruction.disableLog) {
            let regsString = '';
            regsString += this.FLAG_N ? "N" : "";
            regsString += this.FLAG_V ? "V" : "";
            regsString += this.FLAG_D ? "D" : "";
            regsString += this.FLAG_I ? "I" : "";
            regsString += this.FLAG_Z ? "Z" : "";
            regsString += this.FLAG_C ? "C" : "";
            
            let A = this.REG_A.toString(16).toUpperCase();
            A = A.length === 1 ? '0' + A : A;
            let X = this.REG_X.toString(16).toUpperCase();
            X = X.length === 1 ? '0' + X : X;
            let Y = this.REG_Y.toString(16).toUpperCase();
            Y = Y.length === 1 ? '0' + Y : Y;

            let row = '';
            row += `${this.totalCycles - this.nextInstruction.cycles} `;
            row += `${this.PROGRAM_COUNTER.toString(16).toUpperCase()} `;
            row += `A:${A} `;
            row += `X:${X} `;
            row += `Y:${Y} `;
            row += `P:${regsString} `;
            row += `SP:${(this.STACK_POINTER & 0xFF).toString(16).toUpperCase()} `;
            row += `CYC:${this.PPU.cycle} `;
            row += `SL:${this.PPU.scanline}`;

            window.output = window.output || [];
            window.output.push(row);
        }
    }
}

export default CPU;