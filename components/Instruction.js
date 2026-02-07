'use strict'

class Instruction{
    constructor(addressingCycles, instructionCycles) {
        this.instructionCycles = [
            ...addressingCycles,
            ...instructionCycles,
        ]
        this.currentInstructionCycle = 0
    }

    cycle() {
        console.log(`Instruction cycle ${this.currentInstructionCycle}`);
        this.instructionCycles[this.currentInstructionCycle]();
        this.currentInstructionCycle++;
    }
}

export default Instruction;
