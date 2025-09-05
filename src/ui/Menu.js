class Menu {
    constructor(game) {
        this.game = game;
        this.mainMenu = document.getElementById('main-menu');
        this.pauseMenu = document.getElementById('pause-menu');
        this.seedInput = document.getElementById('seed-input');
        this.startButton = document.getElementById('start-game-btn');
        this.resumeButton = document.getElementById('resume-game-btn');

        this.startButton.onclick = () => {
            const seed = this.seedInput.value;
            this.game.startGame(seed ? this.hashCode(seed) : Date.now());
        };

        this.resumeButton.onclick = () => {
            // Simulate an 'Escape' keypress to toggle the pause state in main.js
            document.dispatchEvent(new KeyboardEvent('keydown', {'code': 'Escape'}));
        };
    }

    showMainMenu() {
        this.mainMenu.style.display = 'block';
        this.pauseMenu.style.display = 'none';
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
