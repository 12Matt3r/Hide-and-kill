class VHSOverlay {
    constructor() {
        this.element = document.getElementById('vhs-overlay');
    }
    
    // In a more advanced version, this could control opacity or glitch intensity via JS
    update(gameState) {
        const sanity = gameState.localPlayer.sanity;
        this.element.style.opacity = 0.3 + (100 - sanity) / 100 * 0.5;
    }
}

export default VHSOverlay;
