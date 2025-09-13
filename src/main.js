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
        this.engine.init(this.config, this.client);
        this.menu.showMainMenu();
        
        this.client.onStateUpdate = (newState) => {
            this.gameState = newState;
        };

        document.addEventListener('keydown', (e) => {
            if (e.code === 'Escape') {
                this.isPaused = !this.isPaused;
                this.menu.togglePauseMenu(this.isPaused);
                document.pointerLockElement ? document.exitPointerLock() : this.engine.requestPointerLock();
            }
        });
    }

    async startGame() {
        try {
            await this.client.connect();
            const { worldSeed } = await this.client.request('joinRoom', {});

            this.isPaused = false;
            this.menu.hideAll();
            this.hud.show();
            this.engine.start(worldSeed);
            this.engine.requestPointerLock();
            this.lastTime = performance.now();
            this.gameLoop();

        } catch (error) {
            console.error("Failed to start game:", error);
            alert("Could not connect to game server. Please ensure it is running.");
        }
    }

    gameLoop(currentTime = performance.now()) {
        requestAnimationFrame(this.gameLoop.bind(this));
        if (this.isPaused || !this.gameState) return;
        
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        if (this.engine.playerController) {
            this.client.send('playerUpdate', {
                position: this.engine.playerController.body.position,
                rotation: this.engine.playerController.yawObject.rotation.y
            });
        }

        this.engine.update(deltaTime, this.gameState);
        this.hud.update(this.gameState);
    }
}

window.addEventListener('load', () => { new HouseOfLastLight(); });
