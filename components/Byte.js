'use strict';

import Register from "./Register.js";


class Byte extends Register {
    constructor(data) {
        super(Uint8Array, data);
    }

    isBitSet(position) {
        return this.getBit(position) === 1;
    }

    isEqualTo(value) {
        return this.data[0] === value;
    }

    lowerNibble() {
        return this.data[0] & 0x0F;
    }

    upperNibble() {
        return this.data[0] >> 4;
    }

    static getSignedNumber(value) {
        return new Int8Array(1).fill(value)[0];
    }
}

export default Byte;
