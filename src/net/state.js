import * as CANNON from 'cannon-es';

class GameState {
    constructor() {
        this.matchPhase = 'waiting';
        this.matchTimer = 0;
        this.winner = null;

        this.survivors = {}; // Keyed by player ID
        this.livingSurvivorCount = 0;

        this.killer = {
            position: new CANNON.Vec3(1000, 1000, 1000), // Start killer far away
            isStunned: false
        };
        this.interactables = {}; // e.g., door states
        this.activeDisaster = null;
        this.phaseChanged = false; // UI flag
        
        // Local state, not synced over network
        this.localPlayer = {
            id: 'local_player', // For mock setup
            stamina: 100,
            sanity: 100,
            isHiding: false,
            isCrouched: false,
            hasFinisherTool: false
        };

        // Initialize mock survivor
        this.addSurvivor(this.localPlayer.id);
    }

    addSurvivor(id) {
        if (this.survivors[id]) return;
        this.survivors[id] = {
            id: id,
            position: new CANNON.Vec3(0, 5, 0),
            status: 'alive', // alive, dead
            isHiding: false,
        };
        this.livingSurvivorCount++;
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
