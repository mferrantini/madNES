import NES from './components/NES.js';

const romPath = './roms/nestest.nes';

let xhr = new XMLHttpRequest();
xhr.open('GET', romPath, true);
xhr.responseType = 'arraybuffer';

xhr.onload = () => {
    let romData = new Uint8Array(xhr.response);

    let nes = new NES();
    nes.loadCartridge(romData);
    nes.powerOn();

    $('canvas').on('click', () => nes.frame());
};

xhr.send();