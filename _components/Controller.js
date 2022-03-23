class Controller {
    constructor(memoryController) {
        this.value = 0x00;
    }

    read() { 
        return (this.value & 0x1F) | (0b010 << 5);
    }
}

export default Controller;