import Engine from './core/Engine.js';
import Menu from './ui/Menu.js';
import HUD from './ui/HUD.js';
import Client from './net/Client.js';

class HouseOfLastLight {
    constructor() {
        this.engine = new Engine();
        this.menu = new Menu(this);
        this.hud = new HUD();
        this.client = new Client();
        this.isPaused = true;
        this.lastTime = 0;
        this.gameState = null; // Will be received from server
        this.init();
    }

    async init() {
        console.log("Initializing House of Last Light...");
        await this.loadConfig();

        this.engine.init(this.config, this.client);
        this.menu.showMainMenu();
        this.setupEventListeners();
        
        this.client.onStateUpdate = (newState) => {
            this.gameState = newState;
        };
        this.client.onScoutPing = (position) => {
            this.engine.showScoutPing(position);
        };

        console.log("%cQA CHECKLIST - Awaiting Server Connection...", "color: yellow; font-size: 1.2em;");
    }
    
    async loadConfig() {
        try {
            const response = await fetch('../config/game.config.json');
            this.config = await response.json();
        } catch (error) {
            console.error("Failed to load game config, using fallback.", error);
            this.config = JSON.parse('{"match":{"setupSec":20,"huntSec":180,"showdownSec":90},"survivor":{"walk":3.5,"run":6.5,"crouch":1.8,"staminaMax":7,"staminaRegen":1.2,"sanityMax":100,"sanityDrain":0.5},"killer":{"walk":4.2,"runBurst":8,"burstDur":2.5,"burstCD":8,"senseConeRange":15},"disasters":{"minDelaySec":45,"maxDelaySec":90,"probabilities":{"earthquake":0.4,"lightning":0.6}},"audio":{"masterVolume":0.7}}');
        }
    }

    setupEventListeners() {
        document.body.addEventListener('click', () => this.engine.audioBus.init(), { once: true });
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Escape') {
                this.isPaused = !this.isPaused;
                this.menu.togglePauseMenu(this.isPaused);
                this.engine.togglePointerLock();
            }
            if (this.isPaused || !this.gameState || this.gameState.matchPhase === 'ended') return;

            if (e.code === 'F1') this.hud.toggleHelp();
            if (e.code === 'F2') this.engine.houseBuilder?.toggleDebugView();
            if (e.code === 'F3') this.engine.toggleStats();
        });
    }

    async startGame(seed, charType) {
        try {
            await this.client.connect('ws://localhost:8080', charType);
        } catch (error) {
            console.error("Failed to connect to server.", error);
            alert("Could not connect to the game server. Please ensure it is running.");
            return;
        }

        this.isPaused = false;
        this.menu.hideAll();
        this.hud.show();
        this.engine.start();
        this.engine.requestPointerLock();
        this.lastTime = performance.now();
        this.gameLoop();
    }

    gameLoop(currentTime = performance.now()) {
        requestAnimationFrame(this.gameLoop.bind(this));
        if (!this.gameState || this.isPaused) return;

        if (this.gameState.matchPhase === 'ended') {
             if (!this.hud.isEndScreenVisible) this.hud.showEndScreen(this.gameState.winner);
             return;
        }
        
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        // Send client state to server
        this.client.send('playerUpdate', {
            position: this.engine.playerController.body.position,
            isHiding: this.engine.playerController.state.isHiding
        });
        
        // Engine and HUD are updated with the latest state from the server
        this.engine.update(deltaTime, this.gameState);
        this.hud.update(this.gameState);
    }
}

window.addEventListener('load', () => { window.game = new HouseOfLastLight(); });
