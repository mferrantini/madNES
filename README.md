# madNES 🎮

> just another JS emulator

A Nintendo Entertainment System emulator running entirely in the browser, with no build step or external dependencies. Written in vanilla JavaScript using native ES modules.

---

## Features

- **CPU** — Subcycle-accurate 6502 processor emulation, including a large set of illegal opcodes
- **PPU** — Picture Processing Unit with background rendering and nametable support
- **ROM loading** — iNES format, Mapper 0 (NROM)
- **Debug sidebar** — toggleable panel with live nametable preview, CPU register values, status flags and a disassembler view
- **Step controls** — run frame-by-frame or instruction-by-instruction directly from the UI
- **FPS counter** — real-time performance display

---

## Project structure

```
madNES/
│
├── index.html              # Entry point — page layout and canvas
├── script.js               # Bootstrap: loads the ROM and powers on the NES
├── style.css               # UI stylesheet
│
├── components/             # Core emulator components
│   ├── NES.js              # The BUS — connects all components and drives the main loop
│   ├── CPU.js              # MOS 6502 processor
│   ├── PPU.js              # Picture Processing Unit
│   ├── ROM.js              # Cartridge and mapper logic
│   └── VGA.js              # Canvas rendering adapter
│
└── utils/                  # Shared utilities
    ├── UI.js               # UI class — debug panel, controls, FPS counter
    ├── BinaryStructures.js # Register and bit-field abstractions
    └── Constants.js        # Shared enumerations and flags
```

### How the pieces fit together

`NES` acts as the central bus. On startup it instantiates the `CPU`, `PPU` and `UI`, then exposes a unified memory map that all components read from and write to. The main loop (driven by `requestAnimationFrame`) calls `NES.frame()` on every tick, which in turn advances the CPU and PPU in lock-step and triggers a render.

The `UI` class owns everything visual outside the game canvas: it binds the control buttons, runs an independent animation loop to keep the debug panel in sync, and receives a direct `updateUI()` call from `NES` at the end of each emulated frame.

---

## Roadmap 🗺️

### Before first release

- [ ] **APU** — implement the Audio Processing Unit for pulse, triangle, noise and DMC channels 🔊
- [ ] **Controllers** — handle joypad input (keyboard mapping + optional gamepad API)

### Accuracy improvements

- [ ] **CPU Addressing** — Refine adressing modes for store instructions

### Nice to have ✨

- [ ] **Additional mappers** — MMC1, MMC3 and UxROM to support a wider game library
- [ ] **UI improvements** — ROM picker, persistent settings, responsive layout for smaller screens
- [ ] **Palette selection** — let the user swap between different NES colour palette presets 🎨
- [ ] **Image filters** — optional CRT scanline, pixel-grid or NTSC composite effects
- [ ] **Theme selection** — optional color theme for the emulator UI
- [ ] **Debug features** — improving Nametable, Pattern table and OAM viewers. Tile grid for main display.

---

## Running locally

No bundler required. Serve the project root over HTTP (browsers block ES module imports from `file://`):

```bash
python3 -m http.server
```

Then open [http://localhost:8000](http://localhost:8000).

---

## License

MIT — see [LICENSE](LICENSE).
