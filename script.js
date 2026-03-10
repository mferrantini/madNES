import NES from './components/NES.js';

let xhr = new XMLHttpRequest();
xhr.open(
    'GET',
    // './roms/nestest.nes',
    // './roms/donkey.nes',
    './roms/balloon.nes',
    // './roms/smb.nes',
    true,
);

xhr.responseType = 'arraybuffer';

xhr.onload = () => {
    // Load ROM data
    let romData = new Uint8Array(xhr.response);
    // Create NES instance
    let nes = new NES();
    // Load ROM data into NES
    nes.loadCartridge(romData);
    // Run NES
    nes.powerOn();
};

xhr.send();