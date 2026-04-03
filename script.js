import NES from './components/NES.js';

const ROM_URL =
    // './roms/nestest.nes'
    // './roms/donkey.nes'
    './roms/balloon.nes'
    // './roms/smb_jap.nes'
    // './roms/smb2.nes'
    // './roms/sprite_ram.nes'
    // './roms/megaman2.nes'
;

let xhr = new XMLHttpRequest();
xhr.open('GET', ROM_URL, true);
xhr.responseType = 'arraybuffer';

xhr.onload = () => {
    // Load the ROM data
    const romData = new Uint8Array(xhr.response);
    // Create the NES instance
    const nes = new NES();
    // Load cartridge
    nes.loadCartridge(romData);
    // Power on the NES
    nes.powerOn();
};

xhr.send();