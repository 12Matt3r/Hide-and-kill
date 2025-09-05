// Authoritative Mock Server. Manages the core game state and logic.
class MockServer {
    constructor(gameState, config) {
        this.state = gameState;
        this.config = config;
    }

    startMatch() {
        this.state.setPhase('setup', this.config.match.setupSec);
    }

    update(deltaTime, clientData) {
        this.state.matchTimer -= deltaTime;
        
        // Update player data from client (in a real game, this would be from network packets)
        this.state.players['local_player'] = { 
            position: clientData.playerPosition,
            isHiding: clientData.isPlayerHiding
        };

        if (this.state.matchPhase === 'hunt' || this.state.matchPhase === 'showdown') {
            const killerPos = this.state.killer.position;
            const playerPos = clientData.playerPosition;
            const distance = killerPos.distanceTo(playerPos);

            if (distance < 1.5 && !clientData.isPlayerHiding) {
                this.state.winner = 'killer';
                this.state.setPhase('ended');
            }
        }
        
        if (this.state.matchTimer <= 0 && this.state.matchPhase !== 'ended') {
            this.transitionPhase();
        }
    }
    
    transitionPhase() {
        switch (this.state.matchPhase) {
            case 'setup':
                this.state.setPhase('hunt', this.config.match.huntSec);
                break;
            case 'hunt':
                // For this single player mock, we go straight to showdown
                this.state.setPhase('showdown', this.config.match.showdownSec);
                break;
            case 'showdown':
                this.state.winner = 'survivors'; // Survivor wins if showdown timer runs out
                this.state.setPhase('ended');
                break;
        }
    }
    
    // In a real server, you'd broadcast state updates periodically
    getLatestState() {
        return this.state;
    }
}

export default MockServer;
