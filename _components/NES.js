// Loading components
import ROM from './ROM.js';
import CPU from './CPU.js';
import PPU from './PPU.js';
import APU from './APU.js';
import MMU from './MMU.js';

import Controller from './Controller.js';

class NES {
    constructor() {
        this.MMU = new MMU();
        this.PPU = new PPU(this.MMU);
        // TODO: Remove PPU from CPU instantiation
        this.CPU = new CPU(this.MMU, this.PPU);
        this.APU = new APU(this.MMU);
        this.ROM = null;

        this.pauseExecution = false;
    }

    loadRom(ROM_instance) {
        this.MMU.registerComponent('ROM', ROM_instance);
    }

    run() {
        console.log('Run!');

        this.reset();

        let previousFrameTimestamp = 0;

        let frame = frameTimestamp => {
            console.log(`Frame on ${frameTimestamp}`);

            while(!this.PPU.isFrameReady) {
                this.CPU.step();
                this.PPU.step();
            }

            this.PPU.drawFrame();

            previousFrameTimestamp = frameTimestamp;

            // window.requestAnimationFrame(frame);
            // console.log(`%c${(1000 / (frameTimestamp - previousFrameTimestamp)).toFixed(2)} FPS`, 'color:orange');

            var data = new Blob([window.output.join('\n')], {type: 'text/plain'});
            var url = window.URL.createObjectURL(data);
            document.getElementById('download_link').href = url;

            console.log("FRAME");
        };

        $('#processFrame').on('click', () => window.requestAnimationFrame(frame));
    }

    reset() {
        this.CPU.reset();
        this.PPU.reset();
    }
}

// module.exports = NES;
export default NES;