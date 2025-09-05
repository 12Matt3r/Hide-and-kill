// Authoritative Mock Server. Manages the core game state and logic.
class MockServer {
    constructor(gameState, config) {
        this.state = gameState;
        this.config = config;
    }

    startMatch() {
        // In a real game, we'd populate survivors as they join. Here we just have one.
        this.state.setPhase('setup', this.config.match.setupSec);
    }

    update(deltaTime, clientData) {
        if (this.state.matchPhase === 'ended') return;

        this.state.matchTimer -= deltaTime;
        
        // Update survivor data from client
        const survivor = this.state.survivors[clientData.id];
        if (survivor && survivor.status === 'alive') {
            survivor.position.copy(clientData.playerPosition);
            survivor.isHiding = clientData.isPlayerHiding;
        }

        // --- Core Game Logic ---
        if (this.state.matchPhase === 'hunt') {
            this.checkSurvivorCaught();
        } else if (this.state.matchPhase === 'showdown') {
            // TODO: Implement showdown PvP logic
        }
        
        // --- Phase Transitions ---
        if (this.state.matchTimer <= 0) {
            this.transitionOnTimer();
        }
    }

    checkSurvivorCaught() {
        const killerPos = this.state.killer.position;
        for (const id in this.state.survivors) {
            const survivor = this.state.survivors[id];
            if (survivor.status !== 'alive') continue;

            const distance = killerPos.distanceTo(survivor.position);
            if (distance < 1.5 && !survivor.isHiding) {
                console.log(`Survivor ${id} has been caught!`);
                survivor.status = 'dead';
                this.state.livingSurvivorCount--;

                // Check for win/loss conditions
                if (this.state.livingSurvivorCount <= 0) {
                    this.state.winner = 'killer';
                    this.state.setPhase('ended');
                    return; // End update loop
                }

                if (this.state.livingSurvivorCount === 1) {
                    this.transitionPhase('showdown');
                    return; // End update loop
                }
            }
        }
    }
    
    transitionOnTimer() {
        if (this.state.matchPhase === 'setup') {
            this.transitionPhase('hunt');
        } else if (this.state.matchPhase === 'hunt') {
            // If hunt timer runs out, survivors win
            this.state.winner = 'survivors';
            this.state.setPhase('ended');
        } else if (this.state.matchPhase === 'showdown') {
            // If showdown timer runs out, last survivor wins
            this.state.winner = 'survivors';
            this.state.setPhase('ended');
        }
    }

    transitionPhase(newPhase) {
        switch (newPhase) {
            case 'hunt':
                this.state.setPhase('hunt', this.config.match.huntSec);
                break;
            case 'showdown':
                this.state.setPhase('showdown', this.config.match.showdownSec);
                // GDD: Give survivor a buff/tool
                const lastSurvivor = Object.values(this.state.survivors).find(s => s.status === 'alive');
                if(lastSurvivor && lastSurvivor.id === this.state.localPlayer.id) {
                    this.state.localPlayer.hasFinisherTool = true;
                    console.log("FINAL SHOWDOWN: You have a chance to fight back!");
                }
                break;
        }
    }
    
    // In a real server, you'd broadcast state updates periodically
    getLatestState() {
        return this.state;
    }
}

export default MockServer;
