class Byte {
    constructor(byte) {
        // this.byte = byte || 0x00;
    }

    // setBit(position) {
    //     let mask = 1 << position;
    //     return this.byte |= mask;
    // }

    // clearBit(position) {
    //     let mask = 1 << position;
    //     return this.byte &= ~mask;
    // }

    // toggleBit(position) {
    //     let mask = 1 << position;
    //     return this.byte ^= mask;
    // }


    static getBitAtPosition(byte, position) {
        return (byte >> position) & 0x01;
    }

    static isBitSetAtPosition(byte, position) {
        return this.getBitAtPosition(byte, position) === 1;
    }

    static getLowerNibble(byte) {
        return byte & 0x0F;
    }

    static getUpperNibble(byte) {
        return byte >> 4;
    }

    static setBitAtPosition(byte, position) {
        return byte | (1 << position);
    }

    static clearBitAtPosition(byte, position) {
        return byte & (0 << position); 
    }
}

export default Byte;