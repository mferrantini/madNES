'use strict';

import { Register8Bit } from "../utils/BinaryStructures.js";

class Controller {
    constructor() {
        this.BUTTONS_REGISTER = new Register8Bit();
        this.lastStatusBit = 0;

        // Bind Keyboard buttons to the buttons register.
        document.addEventListener('keydown', (event) => {
            // A
            if (event.key === 'a') {
                this.BUTTONS_REGISTER.setBit(0);
            }
            // B
            if (event.key === 's') {
                this.BUTTONS_REGISTER.setBit(1);
            }
            // Select
            if (event.key === 'Space') {
                this.BUTTONS_REGISTER.setBit(2);
            }
            // Start
            if (event.key === 'Enter') {
                this.BUTTONS_REGISTER.setBit(3);
            }
            // Directions
            if (event.key === 'ArrowUp') {
                this.BUTTONS_REGISTER.setBit(4);
            }
            if (event.key === 'ArrowDown') {
                this.BUTTONS_REGISTER.setBit(5);
            }
            if (event.key === 'ArrowLeft') {
                this.BUTTONS_REGISTER.setBit(6);
            }
            if (event.key === 'ArrowRight') {
                this.BUTTONS_REGISTER.setBit(7);
            }
        });

        document.addEventListener('keyup', (event) => {
            // A
            if (event.key === 'a') {
                this.BUTTONS_REGISTER.clearBit(0);
            }
            // B
            if (event.key === 's') {
                this.BUTTONS_REGISTER.clearBit(1);
            }
            // Select
            if (event.key === 'Space') {
                this.BUTTONS_REGISTER.clearBit(2);
            }
            // Start
            if (event.key === 'Enter') {
                this.BUTTONS_REGISTER.clearBit(3);
            }
            // Directions
            if (event.key === 'ArrowUp') {
                this.BUTTONS_REGISTER.clearBit(4);
            }
            if (event.key === 'ArrowDown') {
                this.BUTTONS_REGISTER.clearBit(5);
            }
            if (event.key === 'ArrowLeft') {
                this.BUTTONS_REGISTER.clearBit(6);
            }
            if (event.key === 'ArrowRight') {
                this.BUTTONS_REGISTER.clearBit(7);
            }
        });
    }

    getStatusBit() {
        if (this.lastStatusBit > 7) {
            return 1;
        } else {
            return this.BUTTONS_REGISTER.getBit(this.lastStatusBit++);
        }
    }

    resetRegister() {
        this.lastStatusBit = 0;
    }
}

export default Controller;