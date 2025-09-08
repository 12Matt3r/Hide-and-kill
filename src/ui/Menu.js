class Menu {
    constructor(game) {
        this.game = game;
        this.mainMenu = document.getElementById('main-menu');
        this.pauseMenu = document.getElementById('pause-menu');
        this.settingsMenu = document.getElementById('settings-menu');

        this.seedInput = document.getElementById('seed-input');
        this.startButton = document.getElementById('start-game-btn');
        this.resumeButton = document.getElementById('resume-game-btn');
        this.settingsButton = document.getElementById('settings-btn');
        this.settingsBackButton = document.getElementById('settings-back-btn');

        this.startButton.onclick = () => {
            const seed = this.seedInput.value;
            this.game.startGame(seed ? this.hashCode(seed) : Date.now());
        };

        this.resumeButton.onclick = () => {
            document.dispatchEvent(new KeyboardEvent('keydown', {'code': 'Escape'}));
        };

        this.settingsButton.onclick = () => this.showSettingsMenu();
        this.settingsBackButton.onclick = () => this.showMainMenu();

        // Settings Toggles
        document.getElementById('bloom-toggle').onchange = (e) => this.game.engine.setBloomEnabled(e.target.checked);
        document.getElementById('vhs-toggle').onchange = (e) => this.game.engine.setVhsEnabled(e.target.checked);
        document.getElementById('shadow-quality').onchange = (e) => this.game.engine.setShadowQuality(e.target.value);
    }

    showMainMenu() {
        this.mainMenu.style.display = 'block';
        this.pauseMenu.style.display = 'none';
        this.settingsMenu.style.display = 'none';
    }

    showSettingsMenu() {
        this.mainMenu.style.display = 'none';
        this.settingsMenu.style.display = 'block';
    }
    
    hashCode(str) {
        let h = 0;
        for (let i = 0; i < str.length; h = ((h << 5) - h) + str.charCodeAt(i++), h |= 0);
        return h;
    }
    
    togglePauseMenu(isPaused) {
        this.pauseMenu.style.display = isPaused ? 'block' : 'none';
    }

    hideAll() {
        this.mainMenu.style.display = 'none';
        this.pauseMenu.style.display = 'none';
    }
}

export default Menu;
