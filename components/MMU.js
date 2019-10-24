import Byte from "../utils/Byte.js";
import {MIRRORING} from "../utils/Constants.js";

class MMU {
    constructor() {
        this.ROM = null;
        this.CPU = null;
        this.PPU = null;
        this.APU = null;

        this.RAM  = (new Array(0x0800)).fill(0x00);
        this.VRAM = (new Array(0x0800)).fill(0x00);

        this.METHODS = {
            CPU: {
                writeMemory: (value, address) => this.writeMemoryFromCpu(value, address), 
                readMemory:  (address)        => this.readMemoryFromCpu(address),
                checkForNMI: ()               => this.checkForNMI(),
                checkForDMA: ()               => this.checkForDMA(),
                dispatchDMA: ()               => this.dispatchDMA(),
            },
            PPU: {
                writeMemory: (value, address) => this.writeMemoryFromPpu(value, address), 
                readMemory:  (address)        => this.readMemoryFromPpu(address),
                getDMAMemoryPage: (byte, bytesToTransfer) => this.getDMAMemoryPage(byte, bytesToTransfer)
            },
            APU: {
                writeMemory: () => null, 
                readMemory: () => null
            }
        };
    }

    registerComponent(componentLabel, componentInstance) {
        this[componentLabel] = componentInstance;
        return this.METHODS[componentLabel] || null;
    }

    // CPU side methods
    checkForNMI() {
        let NMIOccurred = this.PPU.NMI_OCCURRED;
        this.PPU.NMI_OCCURRED = false;
        return NMIOccurred;
    }

    checkForDMA() {
        let DMAOccurred = this.PPU.DMA_OCCURRED;
        this.PPU.DMA_OCCURRED = false;
        return DMAOccurred;
    }

    dispatchDMA() {
        this.PPU.dispatchDMA();
    }

    readMemoryFromCpu(address) {
        if (0x0000 <= address && address <= 0x17FF) {
            // 2KB internal RAM and mirrors
            address = address % 0x800;
            return this.RAM[address];

        } else if (0x2000 <= address && address <= 0x3FFF) {
            // PPU Registers and mirrors
            let offset = (address % 0x0008);
            
            switch (offset) {
                case 0x00:
                    throw new Error('Could not read 2000 register');
                case 0x01:
                    throw new Error('Could not read 2001 register');
                case 0x02:
                    return this.PPU.read2002();
                case 0x03:
                    throw new Error('Could not read 2003 register');
                case 0x04:
                    return this.PPU.read2004();
                case 0x05:
                    throw new Error('Could not read 2005 register');
                case 0x06: 
                    throw new Error('Could not read 2006 register');
                case 0x07:
                    return this.PPU.read2007(); 
                default:
                    break;
            }

        } else if (0x4000 <= address && address <= 0x4017) {
            switch (address) {
                case 0x4016:
                    return this.CPU.CONTROLLER_1.read();
                case 0x4017:
                    return this.CPU.CONTROLLER_2.read();
                default:
                    break;
            }
            // APU and I/O Registers
        } else if (0x4018 <= address && address <= 0x401F) {
            // APU and I/O functionality that is normally disabled
        } else if (0x4020 <= address && address <= 0xFFFF) {
            // Cartridge space: PRG ROM, PRG RAM, and mapper registers
            return this.ROM.MAPPER.readMemory(address);
        } else {
            throw new Error('memory location not available');
        }

        return 0x00;
    }

    writeMemoryFromCpu(byte, address) {
        if (0x0000 <= address && address <= 0x17FF) {
            // 2KB internal RAM and mirrors
            address = address % 0x800;
            this.RAM[address] = byte;

        } else if (0x2000 <= address && address <= 0x3FFF) {
            // PPU Registers and mirrors
            let offset = (address % 0x0008);

            switch (offset) {
                case 0x00:
                    this.PPU.write2000(byte);
                    break;
                case 0x01:
                    this.PPU.write2001(byte);
                    break;
                case 0x02:
                    throw new Error('Could not write 2002 register');
                case 0x03:
                    this.PPU.write2003(byte);
                    break;
                case 0x04:
                    this.PPU.write2004(byte);
                    break;
                case 0x05:
                    this.PPU.write2005(byte);
                    break;
                case 0x06: 
                    this.PPU.write2006(byte);
                    break;
                case 0x07:
                    this.PPU.write2007(byte); 
                    break;
                default:
                    break;
            }
        } else if (0x4000 <= address && address <= 0x4017) {
            // APU and I/O Registers
            switch (address) {
                case 0x4014: 
                    this.PPU.write4014(byte);
                    break;
                default:
                    break;
            }
        } else if (0x4018 <= address && address <= 0x401F) {
            // APU and I/O functionality that is normally disabled
        } else if (0x4020 <= address && address <= 0xFFFF) {
            // Cartridge space: PRG ROM, PRG RAM, and mapper registers
        } else {
            throw new Error('memory location not available');
        }
    }


    // PPU side methods
    getDMAMemoryPage(memoryPage) {
        return (new Array(0x100)).map((e, idx) => {
            let address = (memoryPage << 8) | idx;
            return this.readMemoryFromCpu(address);
        });
    }

    writeMemoryFromPpu(byte, address) {
        if (0x2000 <= address && address <= 0x3FFF) {
            console.log(`Writing ${byte.toString(16)} to ${address.toString(16)}`);

            this.VRAM[address - 0x2000] = byte;
        } else {
            throw new Error('Illegal PPU memory write');
        }
    }

    readMemoryFromPpu(address) {
        if (0x0000 <= address && address <= 0x1FFF) {
            return this.ROM.MAPPER.readMemory(address);

        } else if (0x2000 <= address && address <= 0x2FFF) {
            switch (this.ROM.getMirroring()) {
                case MIRRORING.HORIZONTAL:
                    return this.VRAM[address - 0x2000];
                    break;

                case MIRRORING.VERTICAL:
                    break;

                case MIRRORING.FOUR_SCREEN:
                    break;

                default:
                    throw new Error('mirroring not supported');
            }
        } else if (address >= 0x3000) {
            return this.VRAM[address - 0x2000];
        }
    }
}

export default MMU;