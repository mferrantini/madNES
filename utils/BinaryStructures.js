'use strict';

class BinaryStructure {
    constructor(type, data, mask) {
        this.mask = mask;
        this.data = new (type)(1);
        this.data[0] = (data & mask) || 0;
    }

    get value() {
        return this.data[0] & this.mask;
    }

    set value(value) {
        this.data[0] = value & this.mask;
    }

    clear() {
        this.value = 0;
    }

    increment() {
        this.value += 1;
    }

    decrement() {
        this.value -= 1;
    }

    getBit(position) {
        return (this.value >> position) & 1;
    }

    setBit(position) {
        this.value |= (1 << position);
    }

    setBitAtPosition(position, value) {
        if (value) {
            this.value |= (1 << position);
        } else {
            this.value &= ~(1 << position);
        }
    }
    
    shiftLeft() {
        this.value <<= 1;
    }

    shiftRight() {
        this.value >>= 1;
    }

    clearBit(position) {
        this.value &= ~(1 << position);
    }

    isZero() {
        return this.value === 0;
    }

    isNegative() {
        return !!this.getBit(7);
    }

    toString(base = 16) {
        return this.value.toString(base);
    }

    isEqualTo(value) {
        return this.value === value;
    }

    static getSignedNumber(value) {
        return new Int8Array(1).fill(value)[0];
    }
}

class Byte extends BinaryStructure {
    constructor(data) {
        super(Uint8Array, data, 0xFF);
    }

    get lowerNibble() {
        return this.value & 0x0F;
    }

    get upperNibble() {
        return this.value >> 4;
    }

    static overflow(a, b, result) {
        return !!((~(a ^ b) & (a ^ result)) & 0x80);
    }
}

class Register8Bit extends Byte {
    constructor(data) {
        super(data);
    }
}

class Register16Bit extends BinaryStructure {
    constructor(data) {
        super(Uint16Array, data, 0xFFFF);
    }

    get higherByte() {
        return this.data[0] >> 8;
    }

    set higherByte(value) {
        // Trim value
        value &= 0xFF;
        // Clean current higher byte
        this.data[0] &= 0xFF;
        // Set the new higher byte
        this.data[0] |= (value << 8);
    }

    get lowerByte() {
        return this.data[0] & 0xFF;
    }

    set lowerByte(value) {
        // Trim value
        value &= 0xFF;
        // Clean current lower byte
        this.data[0] &= 0xFF00;
        // Set the new lower byte
        this.data[0] |= value;
    }
}

class PPU15BitRegister extends Register16Bit {
    // yyy NN YYYYY XXXXX
    // ||| || ||||| +++++-- coarse X scroll
    // ||| || +++++-------- coarse Y scroll
    // ||| ++-------------- nametable select
    // +++----------------- fine Y scroll
    constructor(data) {
        super(data);
        this.mask = 0x7FFF;
        this.coarseXMask = 0x001F;
        this.coarseYMask = 0x03E0;
        this.nametableMask = 0x0C00;
        this.nametableHMask = 0x0400; // Bit 10
        this.nametableVMask = 0x0800; // Bit 11
        this.fineYMask = 0x7000;
    }

    set coarseX(value) {
        // Clean current coarse X.
        this.value &= ~this.coarseXMask;
        // Clean the value making it 0-31 (5 bits)
        value &= 0x1F;
        // Set the new coarse X.
        this.value |= value;
    }

    get coarseX() {
        return this.value & this.coarseXMask;
    }

    set coarseY(value) {
        // Clean current coarse Y.
        this.value &= ~this.coarseYMask;
        // Clean the value making it 0-31 (5 bits).
        value &= 0x1F;
        // Set the new coarse Y.
        this.value |= (value << 5);
    }

    get coarseY() {
        return (this.value & this.coarseYMask) >> 5;
    }

    set nametable(value) {
        // Clean current nametable.
        this.value &= ~this.nametableMask;
        // Clean the value making it 0-3 (2 bits).
        value &= 0x03;
        // Set the new nametable.
        this.value |= (value << 10);
    }

    get nametable() {
        return (this.value & this.nametableMask) >> 10;
    }

    set fineY(value) {
        // Clean current fine Y.
        this.value &= ~this.fineYMask;    
        // Clean the value making it 0-7 (3 bits).
        value &= 0x07;
        // Set the new fine Y.
        this.value |= (value << 12);
    }

    get fineY() {
        return (this.value & this.fineYMask) >> 12;
    }

    // Flip vertical nametable bit (bit 11)
    toggleVNametable() {
        this.value ^= this.nametableVMask;
    }

    // Flip horizontal nametable bit (bit 10).
    toggleHNametable() {
        this.value ^= this.nametableHMask;
    }

    // Increment fine Y (0-7) taking into account the wrap around behavior.
    incrementFineY() {
        if (this.fineY < 7) {
            this.fineY += 1;
        } else {
            this.fineY = 0;
            switch (this.coarseY) {
                case 29:
                    this.toggleVNametable();
                    this.coarseY = 0;
                    break;
                case 31:
                    this.coarseY = 0;
                    break;
                default:
                    this.coarseY += 1;
                    break;
            }
        }
    }

    // Increment coarse X (0-31) taking into account the wrap around behavior.
    incrementCoarseX() {
        if (this.coarseX < 31) {
            this.coarseX += 1;
        } else {
            this.coarseX = 0;
            this.toggleHNametable();
        }
    }

    incrementCoarseY() {
        this.coarseY += 1;
    }

    get horizontalComponents() {
        return this.value & (
            this.nametableHMask |
            this.coarseXMask
        );
    }

    set horizontalComponents(value) {
        // Clean current horizontal components
        this.value &= ~(
            this.nametableHMask |
            this.coarseXMask
        );
        // Clean the value
        value &= (
            this.nametableHMask |
            this.coarseXMask
        );
        // Set the new horizontal components
        this.value |= value;
    }

    get verticalComponents() {
        return this.value & (
            this.nametableVMask |
            this.coarseYMask |
            this.fineYMask
        );
    }

    set verticalComponents(value) {
        // Clean current vertical components
        this.value &= ~(
            this.nametableVMask |
            this.coarseYMask |
            this.fineYMask
        );
        // Clean the value
        value &= (
            this.nametableVMask |
            this.coarseYMask |
            this.fineYMask
        );
        // Set the new vertical components
        this.value |= value;
    }

    get nametableAddressOffset() {
        // Get the nametable address offset
        // which corresponds to the lowest 12 bits
        return this.value & (
            this.nametableMask |
            this.coarseXMask |
            this.coarseYMask
        );
    }

    // NN 1111 YYY XXX
    // || |||| ||| +++-- high 3 bits of coarse X (x/4)
    // || |||| +++------ high 3 bits of coarse Y (y/4)
    // || ++++---------- attribute offset (960 bytes)
    // ++--------------- nametable select
    get attributeTableAddressOffset() {
        return (
            this.nametable << 10 |
            (this.coarseY >> 2) << 3 |
            (this.coarseX >> 2)
        )
    }
}


export {
    Byte,
    Register8Bit,
    Register16Bit,
    PPU15BitRegister,
};

export default Byte;