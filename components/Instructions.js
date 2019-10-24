// Loading constants
import {ADDRESSING} from '../utils/Constants.js';

// Loading utils
import Byte from '../utils/Byte.js';

class Instruction {
    constructor(opCode, bytes, cycles, addressing, allowExtraCycles) {
        this.opCode = opCode;
        this.cycles = cycles;
        this.bytes  = bytes;
        this.addressing = addressing;
        this.allowExtraCycles = allowExtraCycles;

        this.address = null;
        this.extraCycles = 0;

    }

    run(CPU) {
        throw new Error('generic instruction is not valid');
    }

    execute(CPU) {
        this.preprocess(CPU);
        this.run(CPU);

        return this.extraCycles;
    }

    preprocess(CPU) { 
        this.extraCycles = 0;

        switch (this.addressing) {
            case ADDRESSING.IMPLIED:
            case ADDRESSING.ACCUMULATOR:
                break;

            case ADDRESSING.IMMEDIATE:
                this.address = CPU.PROGRAM_COUNTER + 1;
                break;

            case ADDRESSING.RELATIVE:
                let offsetRel = CPU.get8Bit(CPU.PROGRAM_COUNTER + 1);
                // Offset is read as signed integer (-127/+128)
                offsetRel = offsetRel > 127 ? offsetRel - 256 : offsetRel;
                this.address = CPU.PROGRAM_COUNTER + offsetRel;
                break;

            // Absolute addressings
            case ADDRESSING.ABSOLUTE:
                this.address = CPU.get16Bit(CPU.PROGRAM_COUNTER + 1);
                break;

            case ADDRESSING.ABSOLUTE_X:
                let addressAbsX = CPU.get16Bit(CPU.PROGRAM_COUNTER + 1);
                this.address = addressAbsX + CPU.REG_X;

                if (this.allowExtraCycles) {
                    this.extraCycles += CPU.isMemoryPageDifferent(addressAbsX, this.address) ? 1 : 0;
                }
                break;

            case ADDRESSING.ABSOLUTE_Y:
                let adressAbsY = CPU.get16Bit(CPU.PROGRAM_COUNTER + 1);
                this.address = adressAbsY + CPU.REG_Y;

                if (this.allowExtraCycles) {
                    this.extraCycles +=  CPU.isMemoryPageDifferent(adressAbsY, this.address) ? 1 : 0;
                }
                break;

            // Indirect addressings
            case ADDRESSING.INDIRECT:
                let firstAddressInd = CPU.get16Bit(CPU.PROGRAM_COUNTER + 1);
                this.address = CPU.get16Bit(firstAddressInd);
                break;

            case ADDRESSING.INDIRECT_X:
                let firstByteIndX = CPU.get8Bit(CPU.PROGRAM_COUNTER + 1);
                this.address = CPU.get16Bit(firstByteIndX + CPU.REG_X);
                break;

            case ADDRESSING.INDIRECT_Y:
                let firstByteIndY = CPU.get8Bit(CPU.PROGRAM_COUNTER + 1);
                let addressIndY = CPU.get16Bit(firstByteIndY);
                this.address = addressIndY + CPU.REG_Y;

                if (this.allowExtraCycles) {
                    this.extraCycles +=  CPU.isMemoryPageDifferent(addressIndY, this.address) ? 1 : 0;
                }
                break;

            // Zero page addressings
            case ADDRESSING.ZERO_PAGE:
                this.address = CPU.get8Bit(CPU.PROGRAM_COUNTER + 1);
                break;

            case ADDRESSING.ZERO_PAGE_X:
                this.address = CPU.get8Bit(CPU.PROGRAM_COUNTER + 1) + CPU.REG_X;
                break;

            case ADDRESSING.ZERO_PAGE_Y:
                this.address = CPU.get8Bit(CPU.PROGRAM_COUNTER + 1) + CPU.REG_Y;
                break;

            default:
                throw new Error('addressing mode not valid');
        }
    }
}

// ADC Add memory to accumulator with carry
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Immediate     |   ADC #Oper           |    69   |    2    |    2     |
// |  Zero Page     |   ADC Oper            |    65   |    2    |    3     |
// |  Zero Page,X   |   ADC Oper,X          |    75   |    2    |    4     |
// |  Absolute      |   ADC Oper            |    6D   |    3    |    4     |
// |  Absolute,X    |   ADC Oper,X          |    70   |    3    |    4*    |
// |  Absolute,Y    |   ADC Oper,Y          |    79   |    3    |    4*    |
// |  (Indirect,X)  |   ADC (Oper,X)        |    61   |    2    |    6     |
// |  (Indirect),Y  |   ADC (Oper),Y        |    71   |    2    |    5*    |
// +----------------+-----------------------+---------+---------+----------+
// * Add 1 if page boundary is crossed.
class ADC extends Instruction {
    constructor(opCode, bytes, cycles, addressing, allowExtraCycles) {
        super(opCode, bytes, cycles, addressing, allowExtraCycles);
    }

    run(CPU) {
        let value = CPU.get8Bit(this.address);
        let result = CPU.REG_A + value + (CPU.FLAG_C ? 1 : 0);

        CPU.FLAG_V = Byte.isBitSetAtPosition(((CPU.REG_A ^ result) & (value ^ result)), 7); 

        CPU.REG_A = result;
        
        CPU.FLAG_C = CPU.REG_A > 0xFF;
        CPU.REG_A &= 0xFF;

        CPU.FLAG_N = Byte.isBitSetAtPosition(CPU.REG_A, 7);
        CPU.FLAG_Z = CPU.REG_A === 0;
    }
}

// "AND" memory with accumulator
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Immediate     |   AND #Oper           |    29   |    2    |    2     |
// |  Zero Page     |   AND Oper            |    25   |    2    |    3     |
// |  Zero Page,X   |   AND Oper,X          |    35   |    2    |    4     |
// |  Absolute      |   AND Oper            |    2D   |    3    |    4     |
// |  Absolute,X    |   AND Oper,X          |    3D   |    3    |    4*    |
// |  Absolute,Y    |   AND Oper,Y          |    39   |    3    |    4*    |
// |  (Indirect,X)  |   AND (Oper,X)        |    21   |    2    |    6     |
// |  (Indirect,Y)  |   AND (Oper),Y        |    31   |    2    |    5     |
// +----------------+-----------------------+---------+---------+----------+
// * Add 1 if page boundary is crossed.
class AND extends Instruction {
    constructor(opCode, bytes, cycles, addressing, allowExtraCycles) {
        super(opCode, bytes, cycles, addressing, allowExtraCycles);
    }

    run(CPU) {
        CPU.REG_A = CPU.REG_A & CPU.get8Bit(this.address);

        CPU.FLAG_N = Byte.isBitSetAtPosition(CPU.REG_A, 7);
        CPU.FLAG_Z = CPU.REG_A === 0x00;
    }
}

// ASL Shift Left One Bit (Memory or Accumulator)
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Accumulator   |   ASL A               |    0A   |    1    |    2     |
// |  Zero Page     |   ASL Oper            |    06   |    2    |    5     |
// |  Zero Page,X   |   ASL Oper,X          |    16   |    2    |    6     |
// |  Absolute      |   ASL Oper            |    0E   |    3    |    6     |
// |  Absolute, X   |   ASL Oper,X          |    1E   |    3    |    7     |
// +----------------+-----------------------+---------+---------+----------+
class ASL extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        let result, value;

        if (this.addressing === ADDRESSING.ACCUMULATOR) {
            value = CPU.REG_A;
            result = value << 1;
            CPU.REG_A = result & 0xFF;

        } else {
            value = CPU.get8Bit(this.address);
            result = value << 1;
            CPU.writeMemory(result & 0xFF, this.address);
        }

        CPU.FLAG_C = Byte.isBitSetAtPosition(value, 7);
        CPU.FLAG_N = Byte.isBitSetAtPosition(result, 7);
        CPU.FLAG_Z = (result & 0xFF) === 0x00;
    }
}

// BCC Branch on Carry Clear
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Relative      |   BCC Oper            |    90   |    2    |    2*    |
// +----------------+-----------------------+---------+---------+----------+
// * Add 1 if branch occurs to same page.
// * Add 2 if branch occurs to different page.
class BCC extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        if (!CPU.FLAG_C) {            
            this.extraCycles += CPU.isMemoryPageDifferent(CPU.PROGRAM_COUNTER + 3, this.address) ? 2 : 1;
            CPU.PROGRAM_COUNTER = this.address;
        }
    }
}

// BCS Branch on carry set 
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Relative      |   BCS Oper            |    B0   |    2    |    2*    |
// +----------------+-----------------------+---------+---------+----------+
class BCS extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        if (CPU.FLAG_C) {            
            this.extraCycles += CPU.isMemoryPageDifferent(CPU.PROGRAM_COUNTER + 3, this.address) ? 2 : 1;
            CPU.PROGRAM_COUNTER = this.address;
        }
    }
}

// BEQ Branch on result zero
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Relative      |   BEQ Oper            |    F0   |    2    |    2*    |
// +----------------+-----------------------+---------+---------+----------+
class BEQ extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        if (CPU.FLAG_Z) {
            this.extraCycles += CPU.isMemoryPageDifferent(CPU.PROGRAM_COUNTER + 3, this.address) ? 2 : 1;
            CPU.PROGRAM_COUNTER = this.address;
        }
    }
}

// BIT Test bits in memory with accumulator 
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Zero Page     |   BIT Oper            |    24   |    2    |    3     |
// |  Absolute      |   BIT Oper            |    2C   |    3    |    4     |
// +----------------+-----------------------+---------+---------+----------|
class BIT extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        let value = CPU.readMemory(this.address);
        let result = value & CPU.REG_A; 

        CPU.FLAG_V = Byte.isBitSetAtPosition(value, 6);
        CPU.FLAG_N = Byte.isBitSetAtPosition(value, 7);
        CPU.FLAG_Z = result === 0x00;
    }
}

// BMI Branch on result minus
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Relative      |   BMI Oper            |    30   |    2    |    2*    |
// +----------------+-----------------------+---------+---------+----------+
// * Add 1 if branch occurs to same page.
// * Add 1 if branch occurs to different page.

class BMI extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        if (CPU.FLAG_N) {
            this.extraCycles += CPU.isMemoryPageDifferent(CPU.PROGRAM_COUNTER + 3, this.address) ? 2 : 1;
            CPU.PROGRAM_COUNTER = this.address;
        }
    }
}

// BNE Branch on result not zero
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Relative      |   BMI Oper            |    D0   |    2    |    2*    |
// +----------------+-----------------------+---------+---------+----------+
class BNE extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        if (!CPU.FLAG_Z) {
            this.extraCycles += CPU.isMemoryPageDifferent(CPU.PROGRAM_COUNTER + 3, this.address) ? 2 : 1;
            CPU.PROGRAM_COUNTER = this.address;
        }
    }
}

// BPL Branch on result plus
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Relative      |   BPL Oper            |    10   |    2    |    2*    |
// +----------------+-----------------------+---------+---------+----------+
// * Add 1 if branch occurs to same page.
// * Add 2 if branch occurs to different page.
class BPL extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        if (!CPU.FLAG_N) {            
            this.extraCycles += CPU.isMemoryPageDifferent(CPU.PROGRAM_COUNTER + 3, this.address) ? 2 : 1;
            CPU.PROGRAM_COUNTER = this.address;
        }
    }
}

// BRK Force Break
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Implied       |   BRK                 |    00   |    1    |    7     |
// +----------------+-----------------------+---------+---------+----------+
// 1. A BRK command cannot be masked by setting I.
class BRK extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        CPU.PROGRAM_COUNTER++;
        CPU.pushValueOnStack(CPU.PROGRAM_COUNTER >> 8);
        CPU.pushValueOnStack(CPU.PROGRAM_COUNTER & 0xFF);

        CPU.FLAG_B = true;
        CPU.pushValueOnStack(CPU.getStatusRegisterByte());
        CPU.FLAG_I = true;

        CPU.PROGRAM_COUNTER = CPU.get16Bit(0xFFFE) - 1;
    }
}

// BVC Branch on overflow clear
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Relative      |   BVC Oper            |    50   |    2    |    2*    |
// +----------------+-----------------------+---------+---------+----------+
// * Add 1 if branch occurs to same page.
// * Add 2 if branch occurs to different page.
class BVC extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        if (!CPU.FLAG_V) {            
            this.extraCycles += CPU.isMemoryPageDifferent(CPU.PROGRAM_COUNTER + 3, this.address) ? 2 : 1;
            CPU.PROGRAM_COUNTER = this.address;
        }
    }
}

// BVS Branch on overflow set
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Relative      |   BVS Oper            |    70   |    2    |    2*    |
// +----------------+-----------------------+---------+---------+----------+
// * Add 1 if branch occurs to same page.
// * Add 2 if branch occurs to different page.
class BVS extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        if (CPU.FLAG_V) {            
            this.extraCycles += CPU.isMemoryPageDifferent(CPU.PROGRAM_COUNTER + 3, this.address) ? 2 : 1;
            CPU.PROGRAM_COUNTER = this.address;
        }
    }
}

// CLC Clear carry flag
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Implied       |   CLC                 |    18   |    1    |    2     |
// +----------------+-----------------------+---------+---------+----------+
class CLC extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        CPU.FLAG_C = false;
    }
}

// CLD Clear Decimal Mode
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Implied       |   CLD                 |    D8   |    1    |    2     |
// +----------------+-----------------------+---------+---------+----------+
class CLD extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        CPU.FLAG_D = false;
    }
}

// CLI Clear interrupt disable bit
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Implied       |   CLI                 |    58   |    1    |    2     |
// +----------------+-----------------------+---------+---------+----------+
class CLI extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        CPU.FLAG_I = false;
    }
}

// CLV Clear overflow flag 
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Implied       |   CLV                 |    B8   |    1    |    2     |
// +----------------+-----------------------+---------+---------+----------+
class CLV extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        CPU.FLAG_V = false;
    }
}

// CMP Compare memory and accumulator
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Immediate     |   CMP #Oper           |    C9   |    2    |    2     |
// |  Zero Page     |   CMP Oper            |    C5   |    2    |    3     |
// |  Zero Page,X   |   CMP Oper,X          |    D5   |    2    |    4     |
// |  Absolute      |   CMP Oper            |    CD   |    3    |    4     |
// |  Absolute,X    |   CMP Oper,X          |    DD   |    3    |    4*    |
// |  Absolute,Y    |   CMP Oper,Y          |    D9   |    3    |    4*    |
// |  (Indirect,X)  |   CMP (Oper,X)        |    C1   |    2    |    6     |
// |  (Indirect),Y  |   CMP (Oper),Y        |    D1   |    2    |    5*    |
// +----------------+-----------------------+---------+---------+----------+
class CMP extends Instruction {
    constructor(opCode, bytes, cycles, addressing, allowExtraCycles) {
        super(opCode, bytes, cycles, addressing, allowExtraCycles);
    }

    run(CPU) {
        let subtraction = CPU.REG_A - CPU.get8Bit(this.address);

        CPU.FLAG_C = subtraction >= 0;
        CPU.FLAG_N = Byte.isBitSetAtPosition(subtraction, 7);
        CPU.FLAG_Z = subtraction === 0;
    }
}

// CPX Compare Memory and Index X
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Immediate     |   CPX *Oper           |    E0   |    2    |    2     |
// |  Zero Page     |   CPX Oper            |    E4   |    2    |    3     |
// |  Absolute      |   CPX Oper            |    EC   |    3    |    4     |
// +----------------+-----------------------+---------+---------+----------+
class CPX extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        let subtraction = CPU.REG_X - CPU.get8Bit(this.address);

        CPU.FLAG_C = subtraction >= 0;
        CPU.FLAG_N = Byte.isBitSetAtPosition(subtraction, 7);
        CPU.FLAG_Z = subtraction === 0;
    }
}

// CPY Compare memory and index Y
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Immediate     |   CPY *Oper           |    C0   |    2    |    2     |
// |  Zero Page     |   CPY Oper            |    C4   |    2    |    3     |
// |  Absolute      |   CPY Oper            |    CC   |    3    |    4     |
// +----------------+-----------------------+---------+---------+----------+
class CPY extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        let subtraction = CPU.REG_Y - CPU.get8Bit(this.address);

        CPU.FLAG_C = subtraction >= 0;
        CPU.FLAG_N = Byte.isBitSetAtPosition(subtraction, 7);
        CPU.FLAG_Z = subtraction === 0;
    }
}

// DEC Decrement memory by one
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Zero Page     |   DEC Oper            |    C6   |    2    |    5     |
// |  Zero Page,X   |   DEC Oper,X          |    D6   |    2    |    6     |
// |  Absolute      |   DEC Oper            |    CE   |    3    |    6     |
// |  Absolute,X    |   DEC Oper,X          |    DE   |    3    |    7     |
// +----------------+-----------------------+---------+---------+----------+
class DEC extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        let newValue = (CPU.get8Bit(this.address) - 1) & 0xFF;
        CPU.writeMemory(newValue, this.address);

        CPU.FLAG_N = Byte.isBitSetAtPosition(newValue, 7);
        CPU.FLAG_Z = newValue === 0x00;
    }
}

// DEX Decrement index X by one
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Implied       |   DEX                 |    CA   |    1    |    2     |
// +----------------+-----------------------+---------+---------+----------+
class DEX extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        CPU.REG_X--;
        CPU.REG_X &= 0xFF;

        CPU.FLAG_N = Byte.isBitSetAtPosition(CPU.REG_X, 7);
        CPU.FLAG_Z = CPU.REG_X === 0;
    }
}

// DEY Decrement index Y by one
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Implied       |   DEY                 |    88   |    1    |    2     |
// +----------------+-----------------------+---------+---------+----------+
class DEY extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        CPU.REG_Y--;
        CPU.REG_Y &= 0xFF;

        CPU.FLAG_N = Byte.isBitSetAtPosition(CPU.REG_Y, 7);
        CPU.FLAG_Z = CPU.REG_Y === 0;
    }
}

// EOR "Exclusive-Or" memory with accumulator
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Immediate     |   EOR #Oper           |    49   |    2    |    2     |
// |  Zero Page     |   EOR Oper            |    45   |    2    |    3     |
// |  Zero Page,X   |   EOR Oper,X          |    55   |    2    |    4     |
// |  Absolute      |   EOR Oper            |    40   |    3    |    4     |
// |  Absolute,X    |   EOR Oper,X          |    50   |    3    |    4*    |
// |  Absolute,Y    |   EOR Oper,Y          |    59   |    3    |    4*    |
// |  (Indirect,X)  |   EOR (Oper,X)        |    41   |    2    |    6     |
// |  (Indirect),Y  |   EOR (Oper),Y        |    51   |    2    |    5*    |
// +----------------+-----------------------+---------+---------+----------+
class EOR extends Instruction {
    constructor(opCode, bytes, cycles, addressing, allowExtraCycles) {
        super(opCode, bytes, cycles, addressing, allowExtraCycles);
    }

    run(CPU) {
        CPU.REG_A = CPU.REG_A ^ CPU.get8Bit(this.address);

        CPU.FLAG_N = Byte.isBitSetAtPosition(CPU.REG_A, 7);
        CPU.FLAG_Z = CPU.REG_A === 0x00;
    }
}

// INC Increment memory by one
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Zero Page     |   INC Oper            |    E6   |    2    |    5     |
// |  Zero Page,X   |   INC Oper,X          |    F6   |    2    |    6     |
// |  Absolute      |   INC Oper            |    EE   |    3    |    6     |
// |  Absolute,X    |   INC Oper,X          |    FE   |    3    |    7     |
// +----------------+-----------------------+---------+---------+----------+
class INC extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        let newValue = (CPU.get8Bit(this.address) + 1) & 0xFF;
        CPU.writeMemory(newValue, this.address);

        CPU.FLAG_N = Byte.isBitSetAtPosition(newValue, 7);
        CPU.FLAG_Z = newValue === 0x00;
    }
}

// INX Increment Index X by one
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Implied       |   INX                 |    E8   |    1    |    2     |
// +----------------+-----------------------+---------+---------+----------+
class INX extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        CPU.REG_X++;
        CPU.REG_X &= 0xFF;

        CPU.FLAG_N = Byte.isBitSetAtPosition(CPU.REG_X, 7);
        CPU.FLAG_Z = CPU.REG_X === 0x00;
    }
}

// INY Increment Index Y by one 
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Implied       |   INY                 |    C8   |    1    |    2     |
// +----------------+-----------------------+---------+---------+----------+
class INY extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        CPU.REG_Y++;
        CPU.REG_Y &= 0xFF;

        CPU.FLAG_N = Byte.isBitSetAtPosition(CPU.REG_Y, 7);
        CPU.FLAG_Z = CPU.REG_Y === 0x00;
    }
}

// JMP Jump to new location
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Absolute      |   JMP Oper            |    4C   |    3    |    3     |
// |  Indirect      |   JMP (Oper)          |    6C   |    3    |    5     |
// +----------------+-----------------------+---------+---------+----------+
class JMP extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }
    
    run(CPU) {
        CPU.PROGRAM_COUNTER = this.address - this.bytes;
    }
}

// JSR Jump to new location saving return address
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Absolute      |   JSR Oper            |    20   |    3    |    6     |
// +----------------+-----------------------+---------+---------+----------+
class JSR extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }
    
    run(CPU) {
        let addressToPush = CPU.PROGRAM_COUNTER + 2;
        CPU.pushValueOnStack(addressToPush >> 8);
        CPU.pushValueOnStack(addressToPush & 0xFF);

        CPU.PROGRAM_COUNTER = this.address;
    }
}

// LDA Load Accumulator with Memory
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Immediate     |   LDA #Oper           |    A9   |    2    |    2     |
// |  Zero Page     |   LDA Oper            |    A5   |    2    |    3     |
// |  Zero Page,X   |   LDA Oper,X          |    B5   |    2    |    4     |
// |  Absolute      |   LDA Oper            |    AD   |    3    |    4     |
// |  Absolute,X    |   LDA Oper,X          |    BD   |    3    |    4*    |
// |  Absolute,Y    |   LDA Oper,Y          |    B9   |    3    |    4*    |
// |  (Indirect,X)  |   LDA (Oper,X)        |    A1   |    2    |    6     |
// |  (Indirect),Y  |   LDA (Oper),Y        |    B1   |    2    |    5*    |
// +----------------+-----------------------+---------+---------+----------+
// * Add 1 if page boundary is crossed.
class LDA extends Instruction {
    constructor(opCode, bytes, cycles, addressing, allowExtraCycles) {
        super(opCode, bytes, cycles, addressing, allowExtraCycles);
    }

    run(CPU) {
        CPU.REG_A = CPU.get8Bit(this.address);
        
        CPU.FLAG_N = Byte.isBitSetAtPosition(CPU.REG_A, 7);
        CPU.FLAG_Z = CPU.REG_A === 0x00;
    }
}

// LDX Load index X with memory
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Immediate     |   LDX #Oper           |    A2   |    2    |    2     |
// |  Zero Page     |   LDX Oper            |    A6   |    2    |    3     |
// |  Zero Page,Y   |   LDX Oper,Y          |    B6   |    2    |    4     |
// |  Absolute      |   LDX Oper            |    AE   |    3    |    4     |
// |  Absolute,Y    |   LDX Oper,Y          |    BE   |    3    |    4*    |
// +----------------+-----------------------+---------+---------+----------+
// * Add 1 when page boundary is crossed.
class LDX extends Instruction {
    constructor(opCode, bytes, cycles, addressing, allowExtraCycles) {
        super(opCode, bytes, cycles, addressing, allowExtraCycles);
    }

    run(CPU) {
        CPU.REG_X = CPU.get8Bit(this.address);
        
        CPU.FLAG_N = Byte.isBitSetAtPosition(CPU.REG_X, 7);
        CPU.FLAG_Z = CPU.REG_X === 0x00;
    }
}

// LDY Load index Y with memory
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Immediate     |   LDY #Oper           |    A0   |    2    |    2     |
// |  Zero Page     |   LDY Oper            |    A4   |    2    |    3     |
// |  Zero Page,X   |   LDY Oper,X          |    B4   |    2    |    4     |
// |  Absolute      |   LDY Oper            |    AC   |    3    |    4     |
// |  Absolute,X    |   LDY Oper,X          |    BC   |    3    |    4*    |
// +----------------+-----------------------+---------+---------+----------+
class LDY extends Instruction {
    constructor(opCode, bytes, cycles, addressing, allowExtraCycles) {
        super(opCode, bytes, cycles, addressing, allowExtraCycles);
    }

    run(CPU) {
        CPU.REG_Y = CPU.get8Bit(this.address);
        
        CPU.FLAG_N = Byte.isBitSetAtPosition(CPU.REG_Y, 7);
        CPU.FLAG_Z = CPU.REG_Y === 0x00;
    }
}

// LSR Shift right one bit (memory or accumulator)
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Accumulator   |   LSR A               |    4A   |    1    |    2     |
// |  Zero Page     |   LSR Oper            |    46   |    2    |    5     |
// |  Zero Page,X   |   LSR Oper,X          |    56   |    2    |    6     |
// |  Absolute      |   LSR Oper            |    4E   |    3    |    6     |
// |  Absolute,X    |   LSR Oper,X          |    5E   |    3    |    7     |
// +----------------+-----------------------+---------+---------+----------+
class LSR extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        let result, value;

        if (this.addressing === ADDRESSING.ACCUMULATOR) {
            value = CPU.REG_A;
            result = value >> 1;
            CPU.REG_A = result & 0xFF;

        } else {
            value = CPU.get8Bit(this.address);
            result = value >> 1;
            CPU.writeMemory(result & 0xFF, this.address);
        }

        CPU.FLAG_C = Byte.isBitSetAtPosition(value, 0);
        CPU.FLAG_N = Byte.isBitSetAtPosition(result, 7);
        CPU.FLAG_Z = (result & 0xFF) === 0x00;
    }
}

// NOP No operation
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Implied       |   NOP                 |    EA   |    1    |    2     |
// +----------------+-----------------------+---------+---------+----------+
class NOP extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        return;
    }
}

// ORA "OR" memory with accumulator
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Immediate     |   ORA #Oper           |    09   |    2    |    2     |
// |  Zero Page     |   ORA Oper            |    05   |    2    |    3     |
// |  Zero Page,X   |   ORA Oper,X          |    15   |    2    |    4     |
// |  Absolute      |   ORA Oper            |    0D   |    3    |    4     |
// |  Absolute,X    |   ORA Oper,X          |    1D   |    3    |    4*    |
// |  Absolute,Y    |   ORA Oper,Y          |    19   |    3    |    4*    |
// |  (Indirect,X)  |   ORA (Oper,X)        |    01   |    2    |    6     |
// |  (Indirect),Y  |   ORA (Oper),Y        |    11   |    2    |    5     |
// +----------------+-----------------------+---------+---------+----------+
class ORA extends Instruction {
    constructor(opCode, bytes, cycles, addressing, allowExtraCycles) {
        super(opCode, bytes, cycles, addressing, allowExtraCycles);
    }

    run(CPU) {
        CPU.REG_A |= CPU.get8Bit(this.address);
        
        CPU.FLAG_N = Byte.isBitSetAtPosition(CPU.REG_A, 7);
        CPU.FLAG_Z = CPU.REG_A === 0x00;
    }
}

// PHA Push accumulator on stack
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Implied       |   PHA                 |    48   |    1    |    3     |
// +----------------+-----------------------+---------+---------+----------+
class PHA extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        CPU.pushValueOnStack(CPU.REG_A);
    }
}

// PHP Push processor status on stack 
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Implied       |   PHP                 |    08   |    1    |    3     |
// +----------------+-----------------------+---------+---------+----------+
class PHP extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        CPU.pushValueOnStack(CPU.getStatusRegisterByte());
    }
}

// PLA Pull accumulator from stack
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Implied       |   PLA                 |    68   |    1    |    4     |
// +----------------+-----------------------+---------+---------+----------+
class PLA extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        CPU.REG_A = CPU.pullValueFromStack();

        CPU.FLAG_N = Byte.isBitSetAtPosition(CPU.REG_A, 7);
        CPU.FLAG_Z = CPU.REG_A === 0x00;
    }
}

// PLP Pull processor status from stack 
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Implied       |   PLP                 |    28   |    1    |    4     |
// +----------------+-----------------------+---------+---------+----------+
class PLP extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        CPU.setStatusRegisterByte(CPU.pullValueFromStack());
    }
}

// ROL Rotate one bit left (memory or accumulator)
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Accumulator   |   ROL A               |    2A   |    1    |    2     |
// |  Zero Page     |   ROL Oper            |    26   |    2    |    5     |
// |  Zero Page,X   |   ROL Oper,X          |    36   |    2    |    6     |
// |  Absolute      |   ROL Oper            |    2E   |    3    |    6     |
// |  Absolute,X    |   ROL Oper,X          |    3E   |    3    |    7     |
// +----------------+-----------------------+---------+---------+----------+
class ROL extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        let result, value;

        if (this.addressing === ADDRESSING.ACCUMULATOR) {
            value = CPU.REG_A;
            result = (value << 1) + CPU.FLAG_C;
            CPU.REG_A = result & 0xFF;

        } else {
            value = CPU.get8Bit(this.address);
            result = (value << 1) + CPU.FLAG_C;
            CPU.writeMemory(result & 0xFF, this.address);
        }

        CPU.FLAG_C = Byte.isBitSetAtPosition(value, 7);
        CPU.FLAG_N = Byte.isBitSetAtPosition(result, 7);
        CPU.FLAG_Z = (result & 0xFF) === 0x00;
    }
}

// ROR Rotate one bit right (memory or accumulator)
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Accumulator   |   ROR A               |    6A   |    1    |    2     |
// |  Zero Page     |   ROR Oper            |    66   |    2    |    5     |
// |  Zero Page,X   |   ROR Oper,X          |    76   |    2    |    6     |
// |  Absolute      |   ROR Oper            |    6E   |    3    |    6     |
// |  Absolute,X    |   ROR Oper,X          |    7E   |    3    |    7     |
// +----------------+-----------------------+---------+---------+----------+
class ROR extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        let result, value;

        if (this.addressing === ADDRESSING.ACCUMULATOR) {
            value = CPU.REG_A;
            result = (value >> 1) | ((CPU.FLAG_C ? 1 : 0) << 7);
            CPU.REG_A = result & 0xFF;

        } else {
            value = CPU.get8Bit(this.address);
            result = (value >> 1) | ((CPU.FLAG_C ? 1 : 0) << 7);
            CPU.writeMemory(result & 0xFF, this.address);
        }

        CPU.FLAG_C = Byte.isBitSetAtPosition(value, 0);
        CPU.FLAG_N = Byte.isBitSetAtPosition(result, 7);
        CPU.FLAG_Z = (result & 0xFF) === 0x00;
    }
}

// RTI Return from interrupt
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Implied       |   RTI                 |    4D   |    1    |    6     |
// +----------------+-----------------------+---------+---------+----------+
class RTI extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        console.log('RTI');
        CPU.setStatusRegisterByte(CPU.pullValueFromStack());

        let lowerByte = CPU.pullValueFromStack();
        let upperByte = CPU.pullValueFromStack();

        CPU.PROGRAM_COUNTER = CPU.joinAddressBytes(upperByte, lowerByte);
        console.log("RTI to " + CPU.PROGRAM_COUNTER.toString(16) + " at cycle " + CPU.totalCycles);
    }
}

// RTS Return from subroutine
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Implied       |   RTS                 |    60   |    1    |    6     |
// +----------------+-----------------------+---------+---------+----------+
class RTS extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        let lowerByte = CPU.pullValueFromStack();
        let upperByte = CPU.pullValueFromStack();

        CPU.PROGRAM_COUNTER = CPU.joinAddressBytes(upperByte, lowerByte);
    }
}

// SBC Subtract memory from accumulator with borrow
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Immediate     |   SBC #Oper           |    E9   |    2    |    2     |
// |  Zero Page     |   SBC Oper            |    E5   |    2    |    3     |
// |  Zero Page,X   |   SBC Oper,X          |    F5   |    2    |    4     |
// |  Absolute      |   SBC Oper            |    ED   |    3    |    4     |
// |  Absolute,X    |   SBC Oper,X          |    FD   |    3    |    4*    |
// |  Absolute,Y    |   SBC Oper,Y          |    F9   |    3    |    4*    |
// |  (Indirect,X)  |   SBC (Oper,X)        |    E1   |    2    |    6     |
// |  (Indirect),Y  |   SBC (Oper),Y        |    F1   |    2    |    5     |
// +----------------+-----------------------+---------+---------+----------+
class SBC extends Instruction {
    constructor(opCode, bytes, cycles, addressing, allowExtraCycles) {
        super(opCode, bytes, cycles, addressing, allowExtraCycles);
    }

    run(CPU) {
        let value = CPU.readMemory(CPU.PROGRAM_COUNTER + 1);
        let result = CPU.REG_A - value - (1 - (CPU.FLAG_C ? 1 : 0));

        CPU.FLAG_V = Byte.isBitSetAtPosition((CPU.REG_A ^ result) & ~(value ^ result), 7); 

        CPU.REG_A = result;

        CPU.FLAG_C = CPU.REG_A >= 0x00;
        CPU.REG_A &= 0xFF;

        CPU.FLAG_N = Byte.isBitSetAtPosition(CPU.REG_A, 7);
        CPU.FLAG_Z = CPU.REG_A === 0x00;
    }
}

// SEC Set carry flag 
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Implied       |   SEC                 |    38   |    1    |    2     |
// +----------------+-----------------------+---------+---------+----------+
class SEC extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        CPU.FLAG_C = true;
    }
}

// SED Set decimal mode
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Implied       |   SED                 |    F8   |    1    |    2     |
// +----------------+-----------------------+---------+---------+----------+
class SED extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        CPU.FLAG_D = true;
    }
}

// SEI Set Interrupt Disable Status
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Implied       |   SEI                 |    78   |    1    |    2     |
// +----------------+-----------------------+---------+---------+----------+
class SEI extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        CPU.FLAG_I = true;
    }
}

// STA Store accumulator in memory
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Zero Page     |   STA Oper            |    85   |    2    |    3     |
// |  Zero Page,X   |   STA Oper,X          |    95   |    2    |    4     |
// |  Absolute      |   STA Oper            |    80   |    3    |    4     |
// |  Absolute,X    |   STA Oper,X          |    9D   |    3    |    5     |
// |  Absolute,Y    |   STA Oper, Y         |    99   |    3    |    5     |
// |  (Indirect,X)  |   STA (Oper,X)        |    81   |    2    |    6     |
// |  (Indirect),Y  |   STA (Oper),Y        |    91   |    2    |    6     |
// +----------------+-----------------------+---------+---------+----------+
class STA extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        CPU.writeMemory(CPU.REG_A, this.address);
    }
}

// STX Store index X in memory
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Zero Page     |   STX Oper            |    86   |    2    |    3     |
// |  Zero Page,Y   |   STX Oper,Y          |    96   |    2    |    4     |
// |  Absolute      |   STX Oper            |    8E   |    3    |    4     |
// +----------------+-----------------------+---------+---------+----------+
class STX extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        CPU.writeMemory(CPU.REG_X, this.address);
    }
}

// STY Store index Y in memory
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Zero Page     |   STY Oper            |    84   |    2    |    3     |
// |  Zero Page,X   |   STY Oper,X          |    94   |    2    |    4     |
// |  Absolute      |   STY Oper            |    8C   |    3    |    4     |
// +----------------+-----------------------+---------+---------+----------+
class STY extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        CPU.writeMemory(CPU.REG_Y, this.address);
    }
}

// TAX Transfer accumulator to index X
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Implied       |   TAX                 |    AA   |    1    |    2     |
// +----------------+-----------------------+---------+---------+----------+
class TAX extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        CPU.REG_X = CPU.REG_A;

        CPU.FLAG_N = Byte.isBitSetAtPosition(CPU.REG_X, 7);
        CPU.FLAG_Z = CPU.REG_X === 0x00;
    }
}

// TAY Transfer accumulator to index Y
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Implied       |   TAY                 |    A8   |    1    |    2     |
// +----------------+-----------------------+---------+---------+----------+
class TAY extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        CPU.REG_Y = CPU.REG_A;

        CPU.FLAG_N = Byte.isBitSetAtPosition(CPU.REG_Y, 7);
        CPU.FLAG_Z = CPU.REG_Y === 0x00;
    }
}

// TSX Transfer stack pointer to index X 
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Implied       |   TSX                 |    BA   |    1    |    2     |
// +----------------+-----------------------+---------+---------+----------+
class TSX extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        CPU.REG_X = CPU.STACK_POINTER & 0xFF;

        CPU.FLAG_N = Byte.isBitSetAtPosition(CPU.REG_X, 7);
        CPU.FLAG_Z = CPU.REG_X === 0x00;
    }
}

// TXA Transfer index X to accumulator 
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Implied       |   TXA                 |    8A   |    1    |    2     |
// +----------------+-----------------------+---------+---------+----------+
class TXA extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        CPU.REG_A = CPU.REG_X;

        CPU.FLAG_N = Byte.isBitSetAtPosition(CPU.REG_A, 7);
        CPU.FLAG_Z = CPU.REG_A === 0x00;
    }
}

// TXS Transfer index X to stack pointer
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Implied       |   TXS                 |    9A   |    1    |    2     |
// +----------------+-----------------------+---------+---------+----------+
class TXS extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        CPU.setStackPointer(CPU.REG_X);
    }
}

// TYA Transfer index Y to accumulator
// +----------------+-----------------------+---------+---------+----------+
// | Addressing Mode| Assembly Language Form| OP CODE |No. Bytes|No. Cycles|
// +----------------+-----------------------+---------+---------+----------+
// |  Implied       |   TYA                 |    98   |    1    |    2     |
// +----------------+-----------------------+---------+---------+----------+
class TYA extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
    }

    run(CPU) {
        CPU.REG_A = CPU.REG_Y;

        CPU.FLAG_N = Byte.isBitSetAtPosition(CPU.REG_A, 7);
        CPU.FLAG_Z = CPU.REG_A === 0x00;
    }
}

// NMI Pseudo instruction
class NMI extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
        this.disableLog = true;
    }

    run(CPU) {
        CPU.PROGRAM_COUNTER++;
        CPU.pushValueOnStack(CPU.PROGRAM_COUNTER >> 8);
        CPU.pushValueOnStack(CPU.PROGRAM_COUNTER & 0xFF);

        CPU.FLAG_B = false;
        CPU.pushValueOnStack(CPU.getStatusRegisterByte());
        CPU.FLAG_I = true;

        CPU.PROGRAM_COUNTER = CPU.get16Bit(0xFFFA);

        window.output.push(`[NMI - Cycle: ${CPU.totalCycles - 1}]`);
    }
}

class DMA extends Instruction {
    constructor(opCode, bytes, cycles, addressing) {
        super(opCode, bytes, cycles, addressing);
        this.disableLog = true;
    }

    run(CPU) {
        window.output.push(`[Sprite DMA Start - Cycle: ${CPU.totalCycles - 513 - 1}]`);
        CPU.dispatchDMA();
        window.output.push(`[Sprite DMA End - Cycle: ${CPU.totalCycles - 1}]`);
    }
}

export default {
    0x69: new ADC(0x69, 2, 2, ADDRESSING.IMMEDIATE),
    0x65: new ADC(0x65, 2, 3, ADDRESSING.ZERO_PAGE),
    0x75: new ADC(0x75, 2, 4, ADDRESSING.ZERO_PAGE_X),
    0x6D: new ADC(0x6D, 3, 4, ADDRESSING.ABSOLUTE),
    0x7D: new ADC(0x7D, 3, 4, ADDRESSING.ABSOLUTE_X, true),
    0x79: new ADC(0x79, 3, 4, ADDRESSING.ABSOLUTE_Y, true),
    0x61: new ADC(0x61, 2, 6, ADDRESSING.INDIRECT_X),
    0x71: new ADC(0x71, 2, 5, ADDRESSING.INDIRECT_Y, true),

    0x29: new AND(0x29, 2, 2, ADDRESSING.IMMEDIATE),
    0x25: new AND(0x25, 2, 3, ADDRESSING.ZERO_PAGE),
    0x35: new AND(0x35, 2, 4, ADDRESSING.ZERO_PAGE_X),
    0x2D: new AND(0x2D, 3, 4, ADDRESSING.ABSOLUTE),
    0x3D: new AND(0x3D, 3, 4, ADDRESSING.ABSOLUTE_X, true),
    0x39: new AND(0x39, 3, 4, ADDRESSING.ABSOLUTE_Y, true),
    0x21: new AND(0x21, 2, 6, ADDRESSING.INDIRECT_X),
    0x31: new AND(0x31, 2, 5, ADDRESSING.INDIRECT_Y, true),

    0x0A: new ASL(0x0A, 1, 2, ADDRESSING.ACCUMULATOR),
    0x06: new ASL(0x06, 2, 5, ADDRESSING.ZERO_PAGE),
    0x16: new ASL(0x16, 2, 6, ADDRESSING.ZERO_PAGE_X),
    0x0E: new ASL(0x0E, 3, 6, ADDRESSING.ABSOLUTE),
    0x1E: new ASL(0x1E, 3, 7, ADDRESSING.ABSOLUTE_X),

    0x90: new BCC(0x90, 2, 2, ADDRESSING.RELATIVE),
    
    0xB0: new BCS(0xB0, 2, 2, ADDRESSING.RELATIVE),

    0xF0: new BEQ(0xF0, 2, 2, ADDRESSING.RELATIVE),

    0x24: new BIT(0x24, 2, 3, ADDRESSING.ZERO_PAGE),
    0x2C: new BIT(0x2C, 3, 4, ADDRESSING.ABSOLUTE),

    0x30: new BMI(0x30, 2, 2, ADDRESSING.RELATIVE),

    0xD0: new BNE(0xD0, 2, 2, ADDRESSING.RELATIVE),

    0x10: new BPL(0x10, 2, 2, ADDRESSING.RELATIVE),

    0x00: new BRK(0x00, 1, 7, ADDRESSING.IMPLIED),

    0x50: new BVC(0x50, 2, 2, ADDRESSING.RELATIVE),

    0x70: new BVS(0x70, 2, 2, ADDRESSING.RELATIVE),

    0x18: new CLC(0x18, 1, 2, ADDRESSING.IMPLIED),

    0xD8: new CLD(0xD8, 1, 2, ADDRESSING.IMPLIED),

    0x58: new CLI(0x58, 1, 2, ADDRESSING.IMPLIED),

    0xB8: new CLV(0xB8, 1, 2, ADDRESSING.IMPLIED),

    0xC9: new CMP(0xC9, 2, 2, ADDRESSING.IMMEDIATE),
    0xC5: new CMP(0xC5, 2, 3, ADDRESSING.ZERO_PAGE),
    0xD5: new CMP(0xD5, 2, 4, ADDRESSING.ZERO_PAGE_X),
    0xCD: new CMP(0xCD, 3, 4, ADDRESSING.ABSOLUTE),
    0xDD: new CMP(0xDD, 3, 4, ADDRESSING.ABSOLUTE_X, true),
    0xD9: new CMP(0xD9, 3, 4, ADDRESSING.ABSOLUTE_Y, true),
    0xC1: new CMP(0xC1, 2, 6, ADDRESSING.INDIRECT_X),
    0xD1: new CMP(0xD1, 2, 5, ADDRESSING.INDIRECT_Y, true),

    0xE0: new CPX(0xE0, 2, 2, ADDRESSING.IMMEDIATE),
    0xE4: new CPX(0xE4, 2, 3, ADDRESSING.ZERO_PAGE),
    0xEC: new CPX(0xEC, 3, 4, ADDRESSING.ABSOLUTE),

    0xC0: new CPY(0xC0, 2, 2, ADDRESSING.IMMEDIATE),
    0xC4: new CPY(0xC4, 2, 3, ADDRESSING.ZERO_PAGE),
    0xCC: new CPY(0xCC, 3, 4, ADDRESSING.ABSOLUTE),

    0xC6: new DEC(0xC6, 2, 5, ADDRESSING.ZERO_PAGE),
    0xD6: new DEC(0xC6, 2, 6, ADDRESSING.ZERO_PAGE_X),
    0xCE: new DEC(0xC6, 3, 6, ADDRESSING.ABSOLUTE),
    0xDE: new DEC(0xC6, 3, 7, ADDRESSING.ABSOLUTE_X),

    0xCA: new DEX(0xCA, 1, 2, ADDRESSING.IMPLIED),

    0x88: new DEY(0x88, 1, 2, ADDRESSING.IMPLIED),

    0x49: new EOR(0x49, 2, 2, ADDRESSING.IMMEDIATE),
    0x45: new EOR(0x45, 2, 3, ADDRESSING.ZERO_PAGE),
    0x55: new EOR(0x55, 2, 4, ADDRESSING.ZERO_PAGE_X),
    0x4D: new EOR(0x4D, 3, 4, ADDRESSING.ABSOLUTE),
    0x5D: new EOR(0x5D, 3, 4, ADDRESSING.ABSOLUTE_X, true),
    0x59: new EOR(0x59, 3, 4, ADDRESSING.ABSOLUTE_Y, true),
    0x41: new EOR(0x41, 2, 6, ADDRESSING.INDIRECT_X),
    0x51: new EOR(0x51, 2, 5, ADDRESSING.INDIRECT_Y, true),

    0xE6: new INC(0xE6, 2, 5, ADDRESSING.ZERO_PAGE),
    0xF6: new INC(0xF6, 2, 6, ADDRESSING.ZERO_PAGE_X),
    0xEE: new INC(0xEE, 3, 6, ADDRESSING.ABSOLUTE),
    0xFE: new INC(0xFE, 3, 7, ADDRESSING.ABSOLUTE_X),

    0xE8: new INX(0xE8, 1, 2, ADDRESSING.IMPLIED),

    0xC8: new INY(0xC8, 1, 2, ADDRESSING.IMPLIED),

    0x4C: new JMP(0x4C, 3, 3, ADDRESSING.ABSOLUTE),
    0x6C: new JMP(0x6C, 3, 5, ADDRESSING.INDIRECT),

    0x20: new JSR(0x20, 3, 6, ADDRESSING.ABSOLUTE),

    0xA9: new LDA(0xA9, 2, 2, ADDRESSING.IMMEDIATE),
    0xA5: new LDA(0xA5, 2, 3, ADDRESSING.ZERO_PAGE),
    0xB5: new LDA(0xB5, 2, 4, ADDRESSING.ZERO_PAGE_X),
    0xAD: new LDA(0xAD, 3, 4, ADDRESSING.ABSOLUTE),
    0xBD: new LDA(0xBD, 3, 4, ADDRESSING.ABSOLUTE_X, true),
    0xB9: new LDA(0xB9, 3, 4, ADDRESSING.ABSOLUTE_Y, true),
    0xA1: new LDA(0xA1, 2, 6, ADDRESSING.INDIRECT_X),
    0xB1: new LDA(0xB1, 2, 5, ADDRESSING.INDIRECT_Y, true),

    0xA2: new LDX(0xA2, 2, 2, ADDRESSING.IMMEDIATE),
    0xA6: new LDX(0xA6, 2, 3, ADDRESSING.ZERO_PAGE),
    0xB6: new LDX(0xB6, 2, 4, ADDRESSING.ZERO_PAGE_Y),
    0xAE: new LDX(0xAE, 3, 4, ADDRESSING.ABSOLUTE),
    0xBE: new LDX(0xBE, 3, 4, ADDRESSING.ABSOLUTE_Y, true),

    0xA0: new LDY(0xA0, 2, 2, ADDRESSING.IMMEDIATE),
    0xA4: new LDY(0xA4, 2, 3, ADDRESSING.ZERO_PAGE),
    0xB4: new LDY(0xB4, 2, 4, ADDRESSING.ZERO_PAGE_X),
    0xAC: new LDY(0xAC, 3, 4, ADDRESSING.ABSOLUTE),
    0xBC: new LDY(0xBC, 3, 4, ADDRESSING.ABSOLUTE_X, true),

    0x4A: new LSR(0x4A, 1, 2, ADDRESSING.ACCUMULATOR),
    0x46: new LSR(0x46, 2, 5, ADDRESSING.ZERO_PAGE),
    0x56: new LSR(0x56, 2, 6, ADDRESSING.ZERO_PAGE_X),
    0x4E: new LSR(0x4E, 3, 6, ADDRESSING.ABSOLUTE),
    0x5E: new LSR(0x5E, 3, 7, ADDRESSING.ABSOLUTE_X),

    0xEA: new NOP(0xEA, 1, 2, ADDRESSING.IMPLIED),

    0x09: new ORA(0x09, 2, 2, ADDRESSING.IMMEDIATE),
    0x05: new ORA(0x05, 2, 3, ADDRESSING.ZERO_PAGE),
    0x15: new ORA(0x15, 2, 4, ADDRESSING.ZERO_PAGE_X),
    0x0D: new ORA(0x0D, 3, 4, ADDRESSING.ABSOLUTE),
    0x1D: new ORA(0x1D, 3, 4, ADDRESSING.ABSOLUTE_X, true),
    0x19: new ORA(0x19, 3, 4, ADDRESSING.ABSOLUTE_Y, true),
    0x01: new ORA(0x01, 2, 6, ADDRESSING.INDIRECT_X),
    0x11: new ORA(0x11, 2, 5, ADDRESSING.INDIRECT_Y, true),

    0x48: new PHA(0x48, 1, 3, ADDRESSING.IMPLIED),

    0x08: new PHP(0x08, 1, 3, ADDRESSING.IMPLIED),

    0x68: new PLA(0x68, 1, 4, ADDRESSING.IMPLIED),

    0x28: new PLP(0x28, 1, 4, ADDRESSING.IMPLIED),

    0x2A: new ROL(0x2A, 1, 2, ADDRESSING.ACCUMULATOR),
    0x26: new ROL(0x26, 2, 5, ADDRESSING.ZERO_PAGE),
    0x36: new ROL(0x36, 2, 6, ADDRESSING.ZERO_PAGE_X),
    0x2E: new ROL(0x2E, 3, 6, ADDRESSING.ABSOLUTE),
    0x3E: new ROL(0x3E, 3, 7, ADDRESSING.ABSOLUTE_X),

    0x6A: new ROR(0x6A, 1, 2, ADDRESSING.ACCUMULATOR),
    0x66: new ROR(0x66, 2, 5, ADDRESSING.ZERO_PAGE),
    0x76: new ROR(0x76, 2, 6, ADDRESSING.ZERO_PAGE_X),
    0x6E: new ROR(0x6E, 3, 6, ADDRESSING.ABSOLUTE),
    0x7E: new ROR(0x7E, 3, 7, ADDRESSING.ABSOLUTE_X),

    0x40: new RTI(0x40, 1, 6, ADDRESSING.IMPLIED),

    0x60: new RTS(0x60, 1, 6, ADDRESSING.IMPLIED),


    0xE9: new SBC(0xE9, 2, 2, ADDRESSING.IMMEDIATE),
    0xE5: new SBC(0xE5, 2, 3, ADDRESSING.ZERO_PAGE),
    0xF5: new SBC(0xF5, 2, 4, ADDRESSING.ZERO_PAGE_X),
    0xED: new SBC(0xED, 3, 4, ADDRESSING.ABSOLUTE),
    0xFD: new SBC(0xFD, 3, 4, ADDRESSING.ABSOLUTE_X, true),
    0xF9: new SBC(0xF9, 3, 4, ADDRESSING.ABSOLUTE_Y, true),
    0xE1: new SBC(0xE1, 2, 6, ADDRESSING.INDIRECT_X),
    0xF1: new SBC(0xF1, 2, 5, ADDRESSING.INDIRECT_Y, true),

    0x38: new SEC(0x38, 1, 2, ADDRESSING.IMPLIED),

    0xF8: new SED(0xF8, 1, 2, ADDRESSING.IMPLIED),
    
    0x78: new SEI(0x78, 1, 2, ADDRESSING.IMPLIED),

    0x85: new STA(0x85, 2, 3, ADDRESSING.ZERO_PAGE),
    0x95: new STA(0x95, 2, 4, ADDRESSING.ZERO_PAGE_X),
    0x8D: new STA(0x8D, 3, 4, ADDRESSING.ABSOLUTE),
    0x9D: new STA(0x9D, 3, 5, ADDRESSING.ABSOLUTE_X),
    0x99: new STA(0x99, 3, 5, ADDRESSING.ABSOLUTE_Y),
    0x81: new STA(0x81, 2, 6, ADDRESSING.INDIRECT_X),
    0x91: new STA(0x91, 2, 6, ADDRESSING.INDIRECT_Y),
    
    0x86: new STX(0x86, 2, 3, ADDRESSING.ZERO_PAGE),
    0x96: new STX(0x96, 2, 4, ADDRESSING.ZERO_PAGE_Y),
    0x8E: new STX(0x8E, 3, 4, ADDRESSING.ABSOLUTE),

    0x84: new STY(0x84, 2, 3, ADDRESSING.ZERO_PAGE),
    0x94: new STY(0x94, 2, 4, ADDRESSING.ZERO_PAGE_X),
    0x8C: new STY(0x8C, 3, 4, ADDRESSING.ABSOLUTE),
    
    0xAA: new TAX(0xAA, 1, 2, ADDRESSING.IMPLIED),

    0xA8: new TAY(0xA8, 1, 2, ADDRESSING.IMPLIED),

    0xBA: new TSX(0xBA, 1, 2, ADDRESSING.IMPLIED),

    0x8A: new TXA(0x8A, 1, 2, ADDRESSING.IMPLIED),

    0x9A: new TXS(0x9A, 1, 2, ADDRESSING.IMPLIED),

    0x98: new TYA(0x98, 1, 2, ADDRESSING.IMPLIED),

    // pseudo instruction
    'NMI': new NMI('NMI', 0,   7, ADDRESSING.IMPLIED),
    'DMA': new DMA('DMA', 0, 513, ADDRESSING.IMPLIED)
};