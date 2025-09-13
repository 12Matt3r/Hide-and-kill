import Engine from './core/Engine.js';
import Menu from './ui/Menu.js';
import HUD from './ui/HUD.js';
import Client from './net/Client.js';

class HouseOfLastLight {
    constructor() {
        this.client = new Client();
        this.engine = new Engine();
        this.menu = new Menu(this);
        this.hud = new HUD();
        this.isPaused = true;
        this.lastTime = 0;
        this.gameState = null;
        this.init();
    }

    async init() {
        const response = await fetch('../config/game.config.json');
        this.config = await response.json();

        // Pass the mock client for now, as the engine expects it.
        // This will be removed in the next step.
        this.engine.init(this.config, {});
        this.menu.showMainMenu();
        
        this.client.onStateUpdate = (newState) => {
            this.gameState = newState;
        };

        document.addEventListener('keydown', (e) => {
            if (e.code === 'Escape') {
                this.isPaused = !this.isPaused;
                this.menu.togglePauseMenu(this.isPaused);
                if (this.engine.renderer.domElement) {
                    document.pointerLockElement ? document.exitPointerLock() : this.engine.renderer.domElement.requestPointerLock();
                }
            }
        });
    }

    async startGame(seed) { // Seed is now used by client-side HouseGen
        try {
            await this.client.connect();
            this.client.send('joinRoom', {});
        } catch (error) {
            alert("Could not connect to game server. Please ensure the server is running.");
            return;
        }

        this.isPaused = false;
        this.menu.hideAll();
        this.hud.show();

        // We still use the client-side HouseGen for visuals
        this.engine.start(seed);

        if (this.engine.renderer.domElement) {
            this.engine.renderer.domElement.requestPointerLock();
        }

        this.lastTime = performance.now();
        this.gameLoop();
    }

    gameLoop(currentTime = performance.now()) {
        requestAnimationFrame(this.gameLoop.bind(this));
        if (this.isPaused) return;
        
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        // The engine now only needs the gameState for rendering other players
        this.engine.update(deltaTime, this.gameState);

        if (this.gameState) {
            this.hud.update(this.gameState);
        }
    }
}

window.addEventListener('load', () => { new HouseOfLastLight(); });
