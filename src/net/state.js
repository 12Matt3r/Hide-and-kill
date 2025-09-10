import * as CANNON from 'cannon-es';

class GameState {
    constructor() {
        this.matchPhase = 'waiting';
        this.matchTimer = 0;
        this.winner = null;
        this.players = {};
        this.killer = { position: new CANNON.Vec3(1000, 1000, 1000) }; // Start killer far away
        this.interactables = {};
        this.activeDisaster = null;
        this.phaseChanged = false; // UI flag
        
        // Local state, not synced over network
        this.localPlayer = {
            stamina: 100,
            sanity: 100,
            isHiding: false,
            isCrouched: false
        };
    }
    
    setPhase(phase, duration) {
        if(this.matchPhase === 'ended' || this.matchPhase === phase) return;
        this.matchPhase = phase;
        this.matchTimer = duration;
        this.phaseChanged = true;
        console.log(`%cGAME PHASE: ${phase.toUpperCase()} (${duration}s)`, "color: orange; font-weight: bold;");
    }
}

export default GameState;
