class APU {
    constructor(memoryController) {
        ({
            writeMemory: this.writeMemory,
            readMemory: this.readMemory
        } = memoryController.registerComponent('APU', this));
    }
}

export default APU;