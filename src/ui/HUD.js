class HUD {
    constructor() {
        this.container = document.getElementById('ui-container');
        this.hudElement = document.getElementById('hud-container');
        this.phaseBanner = document.createElement('div');
        this.phaseBanner.id = 'game-phase-banner';
        this.container.appendChild(this.phaseBanner);

        this.staminaFill = document.getElementById('stamina-fill');
        this.sanityFill = document.getElementById('sanity-fill');
        this.phaseText = document.getElementById('hud-phase');
        this.timeText = document.getElementById('hud-time');
        this.isEndScreenVisible = false;
    }

    show() { this.hudElement.style.display = 'block'; }
    hide() { this.hudElement.style.display = 'none'; }
    toggleHelp() { /* TODO */ }

    update(gameState) {
        if (gameState.phaseChanged) {
            this.showPhaseBanner(gameState.matchPhase);
            gameState.phaseChanged = false;
        }
        
        const minutes = Math.floor(gameState.matchTimer / 60).toString().padStart(2, '0');
        const seconds = Math.floor(gameState.matchTimer % 60).toString().padStart(2, '0');
        
        this.phaseText.textContent = gameState.matchPhase.toUpperCase();
        this.timeText.textContent = `${minutes}:${seconds}`;
        
        this.staminaFill.style.width = `${gameState.localPlayer.stamina}%`;
        this.sanityFill.style.width = `${gameState.localPlayer.sanity}%`;
    }
    
    showPhaseBanner(phase) {
        let text = "";
        switch(phase) {
            case 'setup': text = "Find a Place to Hide"; break;
            case 'hunt': text = "The Hunt Begins"; break;
            case 'showdown': text = "FINAL SHOWDOWN"; break;
        }
        this.phaseBanner.textContent = text;
        this.phaseBanner.style.display = 'block';
        this.phaseBanner.style.animation = 'none'; // Reset animation
        setTimeout(() => { this.phaseBanner.style.animation = 'banner-fade 4s forwards'; }, 10);
    }

    showEndScreen(winner) {
        this.isEndScreenVisible = true;
        this.hide();
        const endPanel = document.createElement('div');
        endPanel.className = 'ui-panel';
        endPanel.style.position = 'absolute';
        endPanel.style.top = '50%';
        endPanel.style.left = '50%';
        endPanel.style.transform = 'translate(-50%, -50%)';
        endPanel.innerHTML = `
            <h1 style="color: ${winner === 'survivors' ? 'var(--survivor-blue)' : 'var(--killer-red)'};">
                ${winner === 'survivors' ? 'YOU SURVIVED' : 'YOU DIED'}
            </h1>
            <button onclick="window.location.reload()">Play Again</button>
        `;
        this.container.appendChild(endPanel);
    }
}

export default HUD;
