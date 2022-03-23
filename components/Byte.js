'use strict';

class Byte {
    constructor(value) {
        this.value = value || 0x00;
    }

    static getSignedNumber(value) {
        return new Int8Array(1).fill(value)[0];
    }


    set(value) {
        this.value = value;
    }

    get() {
        return this.value;
    }

    lowerNibble() {
        return this.value & 0x0F;
    }

    upperNibble() {
        return this.value >> 4;
    }

    isEqualTo(value) {
        return this.value === value;
    }

    getBit(position) {
        return (this.value >> position) & 0x01;
    }

    isBitSet(position) {
        return this.getBit(this.value, position) === 1;
    }

    setBit(position) {
        return this.value | (1 << position);
    }

    clearBit(position) {
        return this.value & (0 << position); 
    }
}


export default Byte;