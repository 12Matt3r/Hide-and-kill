class HUD {
    constructor() {
        this.hudElement = document.getElementById('hud-container');
        this.phaseBanner = document.getElementById('game-phase-banner');
        this.endScreen = document.getElementById('end-screen');
        this.endScreenTitle = document.getElementById('end-screen-title');
        this.playAgainBtn = document.getElementById('play-again-btn');

        this.staminaFill = document.getElementById('stamina-fill');
        this.sanityFill = document.getElementById('sanity-fill');
        this.phaseText = document.getElementById('hud-phase');
        this.timeText = document.getElementById('hud-time');
        this.finisherPrompt = document.getElementById('finisher-tool-prompt');

        this.isEndScreenVisible = false;
        this.playAgainBtn.onclick = () => window.location.reload();
    }

    show() { this.hudElement.style.display = 'block'; }
    hide() { this.hudElement.style.display = 'none'; }
    toggleHelp() { /* TODO */ }

    update(gameState) {
        if (this.isEndScreenVisible) return;

        if (gameState.phaseChanged) {
            this.showPhaseBanner(gameState.matchPhase);
            gameState.phaseChanged = false;
        }
        
        const minutes = Math.floor(gameState.matchTimer / 60).toString().padStart(2, '0');
        const seconds = Math.floor(gameState.matchTimer % 60).toString().padStart(2, '0');
        
        this.phaseText.textContent = gameState.matchPhase.toUpperCase();
        this.timeText.textContent = `${minutes}:${seconds}`;
        
        if (gameState.localPlayer) {
            this.staminaFill.style.width = `${gameState.localPlayer.stamina}%`;
            this.sanityFill.style.width = `${gameState.localPlayer.sanity}%`;
            this.finisherPrompt.style.display = gameState.localPlayer.hasFinisherTool ? 'block' : 'none';
        }
    }
    
    showPhaseBanner(phase) {
        let text = "";
        switch(phase) {
            case 'setup': text = "Find a Place to Hide"; break;
            case 'hunt': text = "The Hunt Begins"; break;
            case 'showdown': text = "FINAL SHOWDOWN"; break;
        }
        if (!text) return;

        this.phaseBanner.textContent = text;
        this.phaseBanner.style.display = 'block';
        this.phaseBanner.style.animation = 'none'; // Reset animation
        setTimeout(() => { this.phaseBanner.style.animation = 'banner-fade 4s forwards'; }, 10);
    }

    showEndScreen(winner) {
        if (this.isEndScreenVisible) return;
        this.isEndScreenVisible = true;
        this.hide();

        const isSurvivorWin = winner === 'survivors';
        this.endScreenTitle.textContent = isSurvivorWin ? 'YOU SURVIVED' : 'YOU DIED';
        this.endScreenTitle.style.color = isSurvivorWin ? 'var(--survivor-blue)' : 'var(--killer-red)';
        this.endScreen.style.display = 'block';
    }
}

export default HUD;
