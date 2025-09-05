class InputManager {
    constructor() {
        this.keys = {};
        this.keyJustPressed = {};
        
        document.addEventListener('keydown', (e) => {
            if (!this.keys[e.code]) this.keyJustPressed[e.code] = true;
            this.keys[e.code] = true;
        });
        document.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    }

    isKeyDown(keyCode) { return this.keys[keyCode] || false; }
    isKeyJustPressed(keyCode) { return this.keyJustPressed[keyCode] || false; }
    resetJustPressed() { this.keyJustPressed = {}; }
}

const Input = new InputManager();
export default Input;
