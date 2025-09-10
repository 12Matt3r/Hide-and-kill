class Menu {
    constructor(game) {
        this.game = game;
        this.container = document.getElementById('ui-container');
    }

    showMainMenu() {
        const menuPanel = document.createElement('div');
        menuPanel.id = 'main-menu'; menuPanel.className = 'ui-panel';
        menuPanel.innerHTML = `
            <h1>House of Last Light</h1>
            <p>Click anywhere to enable audio.</p>
            <div style="margin: 20px 0;">
                <label for="seed-input" style="display: block; margin-bottom: 5px; text-align: left;">Custom Seed (Optional)</label>
                <input type="text" id="seed-input" placeholder="Enter text for a unique house..." style="width: calc(100% - 20px); background: #111; border: 1px solid #555; color: var(--ui-text); padding: 8px; font-family: 'VT323', monospace; font-size: 1.1em;">
            </div>
            <button id="host-game">Enter the House</button>
        `;
        this.container.appendChild(menuPanel);
        document.getElementById('host-game').onclick = () => {
            const seedInput = document.getElementById('seed-input').value;
            this.game.startGame(seedInput ? this.hashCode(seedInput) : Date.now());
        };
    }
    
    hashCode(str) { let h=0;for(let i=0;i<str.length;h=((h<<5)-h)+str.charCodeAt(i++),h|=0);return h; }
    
    togglePauseMenu(isPaused) {
        const existingMenu = document.getElementById('pause-menu');
        if (existingMenu) existingMenu.remove();
        if (isPaused) {
            const pauseMenu = document.createElement('div');
            pauseMenu.id = 'pause-menu'; pauseMenu.className = 'ui-panel';
            pauseMenu.innerHTML = `<h2>Paused</h2><button id="resume-game">Resume</button><button onclick="window.location.reload()">Exit</button>`;
            this.container.appendChild(pauseMenu);
            document.getElementById('resume-game').onclick = () => document.dispatchEvent(new KeyboardEvent('keydown', {'code': 'Escape'}));
        }
    }

    hideAll() { this.container.innerHTML = ''; }
}

export default Menu;
