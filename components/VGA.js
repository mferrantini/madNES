'use strict';

const DEFAULT_CANVAS_ID = 'display';

// ── VGA class ──────────────────────────────────────────────────────────────────
// The VGA class is responsible for rendering the screen picture to the canvas.

class VGA {

    // Private properties
    #height;
    #width;
    #screenCanvas;
    #screenPicture;

    constructor(height, width, canvasId = DEFAULT_CANVAS_ID) {
        this.#height = height;
        this.#width = width;

        this.#screenCanvas = document
            .getElementById(canvasId)
            .getContext('2d', {'alpha': true});
        this.#screenPicture = this.#screenCanvas
            .getImageData(0, 0, this.#width, this.#height);
    }

    /**
     * Draw a pixel on the screen.
     * @param {number} x - The x coordinate of the pixel.
     * @param {number} y - The y coordinate of the pixel.
     * @param {number} r - The red value of the pixel.
     * @param {number} g - The green value of the pixel.
     * @param {number} b - The blue value of the pixel.
     * @param {number} a - The alpha value of the pixel.
     */
    drawPixel(x, y, r, g, b, a) {
        let idx = (4 * y * this.#width) + (4 * x);
        this.#screenPicture.data[idx + 0] = r & 0xFF; // Red
        this.#screenPicture.data[idx + 1] = g & 0xFF; // Green
        this.#screenPicture.data[idx + 2] = b & 0xFF; // Blue
        this.#screenPicture.data[idx + 3] = a;        // Alpha 
    }

    /**
     * Render the frame to the canvas.
     */
    renderFrame() {
        this.#screenCanvas.putImageData(this.#screenPicture, 0, 0);
    }
}

export default VGA;
