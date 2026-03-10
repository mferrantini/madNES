'use strict';

class VGA {
    constructor(height, width) {
        this._height = height;
        this._width = width;

        this.screenCanvas = document
            .getElementById('display')
            .getContext('2d', {'alpha': true});
        this.screenPicture = this.screenCanvas
            .getImageData(0, 0, this._width, this._height);
    }

    drawPixel(x, y, r, g, b, a) {
        let idx = (4 * y * this._width) + (4 * x);
        this.screenPicture.data[idx + 0] = r & 0xFF; // Red
        this.screenPicture.data[idx + 1] = g & 0xFF; // Green
        this.screenPicture.data[idx + 2] = b & 0xFF; // Blue
        this.screenPicture.data[idx + 3] = a;        // Alpha 
    }

    renderFrame() {
        this.screenCanvas.putImageData(this.screenPicture, 0, 0);
    }
}

export default VGA;
