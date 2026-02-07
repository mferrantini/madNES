'use strict';

class Register {
    constructor(type, value) {
        this.data = new (type)(1);
        this.data[0] = value || 0;
    }

    get value() {
        return this.data[0];
    }

    set value(value) {
        this.data[0] = value;
    }

    clear() {
        this.data[0] = 0;
    }

    increment() {
        this.data[0] += 1;
    }

    decrement() {
        this.data[0] -= 1;
    }

    getBit(position) {
        return (this.data[0] >> position) & 1;
    }

    setBit(position) {
        this.data[0] |= (1 << position);
    }

    clearBit(position) {
        this.data[0] &= ~(1 << position);
    }

    isZero() {
        return this.data[0] === 0;
    }

    isNegative() {
        return !!this.getBit(7);
    }
}

class Register8Bit extends Register {
    constructor(data) {
        super(Uint8Array, data);
    }
}

class Register16Bit extends Register {
    constructor(data) {
        super(Uint16Array, data);
    }

    get higherByte() {
        return this.data[0] >> 8;
    }

    set higherByte(value) {
        // Trim value
        value &= 0x00FF;
        // Clean current higher byte
        this.data[0] &= 0x00FF;
        // Set the new higher byte
        this.data[0] |= (value << 8);
    }

    get lowerByte() {
        return this.data[0] & 0x00FF;
    }

    set lowerByte(value) {
        // Trim value
        value &= 0x00FF;
        // Clean current lower byte
        this.data[0] &= 0xFF00;
        // Set the new lower byte
        this.data[0] |= value;
    }
}

export {
    Register,
    Register8Bit,
    Register16Bit,
};

export default Register;