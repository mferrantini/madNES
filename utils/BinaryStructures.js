'use strict';

// ── BinaryStructure class ──────────────────────────────────────────────────────
// The BinaryStructure class is the base class for all binary structures.
// It provides the basic functionality for working with binary data.
class BinaryStructure {
    constructor(type, data, mask) {
        this.mask = mask;
        this.data = new (type)(1);
        this.data[0] = (data & mask) || 0;
    }

    /**
     * Get the value.
     * @returns {number} The value.
     */
    get value() {
        return this.data[0] & this.mask;
    }

    /**
     * Set the value.
     * @param {number} value - The value to set.
     */
    set value(value) {
        this.data[0] = value & this.mask;
    }

    /**
     * Clear the value.
     */
    clear() {
        this.value = 0;
    }

    /**
     * Increment the value.
     */
    increment() {
        this.value += 1;
    }

    /**
     * Decrement the value.
     */
    decrement() {
        this.value -= 1;
    }

    /**
     * Get the bit at the given position.
     * @param {number} position - The position of the bit to get.
     * @returns {number} The bit at the given position.
     */
    getBit(position) {
        return (this.value >> position) & 1;
    }

    /**
     * Set the bit at the given position.
     * @param {number} position - The position of the bit to set.
     */
    setBit(position) {
        this.value |= (1 << position);
    }

    /**
     * Set the bit at the given position.
     * @param {number} position - The position of the bit to set.
     * @param {number} value - The value to set the bit to.
     */
    setBitAtPosition(position, value) {
        if (value) {
            this.value |= (1 << position);
        } else {
            this.value &= ~(1 << position);
        }
    }
    
    /**
     * Shift the value left.
     */
    shiftLeft() {
        this.value <<= 1;
    }

    /**
     * Shift the value right.
     */
    shiftRight() {
        this.value >>= 1;
    }

    /**
     * Clear the bit at the given position.
     * @param {number} position - The position of the bit to clear.
     */
    clearBit(position) {
        this.value &= ~(1 << position);
    }

    /**
     * Check if the value is zero.
     * @returns {boolean} True if the value is zero, false otherwise.
     */
    isZero() {
        return this.value === 0;
    }

    /**
     * Check if the value is negative.
     * @returns {boolean} True if the value is negative, false otherwise.
     */
    isNegative() {
        return !!this.getBit(7);
    }

    /**
     * Convert the value to a string.
     * @param {number} base - The base to convert the value to.
     * @returns {string} The value as a string.
     */
    toString(base = 16) {
        return this.value.toString(base);
    }

    /**
     * Check if the value is equal to the given value.
     * @param {number} value - The value to compare to.
     * @returns {boolean} True if the value is equal to the given value, false otherwise.
     */
    isEqualTo(value) {
        return this.value === value;
    }

    /**
     * Get the signed number.
     * @param {number} value - The value to get the signed number of.
     * @returns {number} The signed number.
     */
    static getSignedNumber(value) {
        return new Int8Array(1).fill(value)[0];
    }
}

class Byte extends BinaryStructure {
    constructor(data) {
        super(Uint8Array, data, 0xFF);
    }

    /**
     * Get the lower nibble.
     * @returns {number} The lower nibble.
     */
    get lowerNibble() {
        return this.value & 0x0F;
    }

    /**
     * Get the upper nibble.
     * @returns {number} The upper nibble.
     */
    get upperNibble() {
        return this.value >> 4;
    }

    /**
     * Check if there is an overflow.
     * @param {number} a - The first value.
     * @param {number} b - The second value.
     * @param {number} result - The result of the operation.
     * @returns {boolean} True if there is an overflow, false otherwise.
     */
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

    /**
     * Get the higher byte.
     * @returns {number} The higher byte.
     */
    get higherByte() {
        return this.data[0] >> 8;
    }

    /**
     * Set the higher byte.
     * @param {number} value - The value to set.
     */
    set higherByte(value) {
        // Trim value
        value &= 0xFF;
        // Clean current higher byte
        this.data[0] &= 0xFF;
        // Set the new higher byte
        this.data[0] |= (value << 8);
    }

    /**
     * Get the lower byte.
     * @returns {number} The lower byte.
     */
    get lowerByte() {
        return this.data[0] & 0xFF;
    }

    /**
     * Set the lower byte.
     * @param {number} value - The value to set.
     */
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
    // PPU15BitRegister address structure: (V and T registers)
    // yyy NN YYYYY XXXXX
    // ||| || ||||| +++++-- coarse X scroll
    // ||| || +++++-------- coarse Y scroll
    // ||| ++-------------- nametable select
    // +++----------------- fine Y scroll

    // Private properties
    #mask;
    #data;

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

    /**
     * Set the coarse X value.
     * @param {number} value - The value to set.
     */
    set coarseX(value) {
        // Clean current coarse X.
        this.value &= ~this.coarseXMask;
        // Clean the value making it 0-31 (5 bits)
        value &= 0x1F;
        // Set the new coarse X.
        this.value |= value;
    }

    /**
     * Get the coarse X value.
     * @returns {number} The coarse X value.
     */
    get coarseX() {
        return this.value & this.coarseXMask;
    }

    /**
     * Set the coarse Y value.
     * @param {number} value - The value to set.
     */
    set coarseY(value) {
        // Clean current coarse Y.
        this.value &= ~this.coarseYMask;
        // Clean the value making it 0-31 (5 bits).
        value &= 0x1F;
        // Set the new coarse Y.
        this.value |= (value << 5);
    }

    /**
     * Get the coarse Y value.
     * @returns {number} The coarse Y value.
     */
    get coarseY() {
        return (this.value & this.coarseYMask) >> 5;
    }

    /**
     * Set the nametable value.
     * @param {number} value - The value to set.
     */
    set nametable(value) {
        // Clean current nametable.
        this.value &= ~this.nametableMask;
        // Clean the value making it 0-3 (2 bits).
        value &= 0x03;
        // Set the new nametable.
        this.value |= (value << 10);
    }

    /**
     * Get the nametable value.
     * @returns {number} The nametable value.
     */
    get nametable() {
        return (this.value & this.nametableMask) >> 10;
    }

    /**
     * Set the fine Y value.
     * @param {number} value - The value to set.
     */
    set fineY(value) {
        // Clean current fine Y.
        this.value &= ~this.fineYMask;    
        // Clean the value making it 0-7 (3 bits).
        value &= 0x07;
        // Set the new fine Y.
        this.value |= (value << 12);
    }

    /**
     * Get the fine Y value.
     * @returns {number} The fine Y value.
     */
    get fineY() {
        return (this.value & this.fineYMask) >> 12;
    }

    /**
     * Flip the vertical nametable bit (bit 11).
     */
    toggleVNametable() {
        this.value ^= this.nametableVMask;
    }

    /**
     * Flip the horizontal nametable bit (bit 10).
     */
    toggleHNametable() {
        this.value ^= this.nametableHMask;
    }

    /**
     * Increment the fine Y value (0-7) taking into account the wrap around behavior.
     */
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

    /**
     * Increment the coarse X value (0-31) taking into account the wrap around behavior.
     */
    incrementCoarseX() {
        if (this.coarseX < 31) {
            this.coarseX += 1;
        } else {
            this.coarseX = 0;
            this.toggleHNametable();
        }
    }

    /**
     * Increment the coarse Y value (0-31) taking into account the wrap around behavior.
     */
    incrementCoarseY() {
        this.coarseY += 1;
    }

    /**
     * Get the horizontal components.
     * @returns {number} The horizontal components.
     */
    get horizontalComponents() {
        return this.value & (
            this.nametableHMask |
            this.coarseXMask
        );
    }

    /**
     * Set the horizontal components.
     * @param {number} value - The value to set.
     */
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

    /**
     * Get the vertical components.
     * @returns {number} The vertical components.
     */
    get verticalComponents() {
        return this.value & (
            this.nametableVMask |
            this.coarseYMask |
            this.fineYMask
        );
    }

    /**
     * Set the vertical components.
     * @param {number} value - The value to set.
     */
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

    /**
     * Get the nametable address offset.
     * @returns {number} The nametable address offset.
     */
    get nametableAddressOffset() {
        // Get the nametable address offset
        // which corresponds to the lowest 12 bits
        return this.value & (
            this.nametableMask |
            this.coarseXMask |
            this.coarseYMask
        );
    }

    // Attribute table address structure:
    // NN 1111 YYY XXX
    // || |||| ||| +++-- high 3 bits of coarse X (x/4)
    // || |||| +++------ high 3 bits of coarse Y (y/4)
    // || ++++---------- attribute offset (960 bytes)
    // ++--------------- nametable select

    /**
     * Get the attribute table address offset.
     * @returns {number} The attribute table address offset.
     */
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
