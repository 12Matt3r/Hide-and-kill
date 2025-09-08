import gameConfig from '../config/game.config.json' assert { type: 'json' };

class ServerDisasters {
    constructor() {
        this.config = gameConfig.disasters;
        this.timer = this.config.minDelaySec + Math.random() * (this.config.maxDelaySec - this.config.minDelaySec);
        this.activeDisaster = null;
        this.disasterDuration = 0;
    }

    update(deltaTime, gameState) {
        this.timer -= deltaTime;

        if (this.activeDisaster) {
            this.disasterDuration -= deltaTime;
            if (this.disasterDuration <= 0) {
                this.activeDisaster = null;
                gameState.activeDisaster = null;
                gameState.waterLevel = -10;
            }
        }

        if (this.activeDisaster === 'flood' && gameState.waterLevel < 3) {
            gameState.waterLevel += deltaTime * 0.1; // Water rises slowly
        }

        if (this.timer <= 0 && !this.activeDisaster) {
            this.triggerRandomDisaster(gameState);
            this.timer = this.config.minDelaySec + Math.random() * (this.config.maxDelaySec - this.config.minDelaySec);
        }
    }

    triggerRandomDisaster(gameState) {
        const rand = Math.random();
        let cumulativeProb = 0;
        for (const [disaster, prob] of Object.entries(this.config.probabilities)) {
            cumulativeProb += prob;
            if (rand <= cumulativeProb) {
                this.activeDisaster = disaster;
                this.disasterDuration = 30; // All disasters last 30s for now
                gameState.activeDisaster = disaster;
                console.log(`SERVER: Triggered ${disaster.toUpperCase()} disaster.`);

                if (disaster === 'earthquake') {
                    this.jamRandomDoor(gameState);
                }
                return;
            }
        }
    }

    jamRandomDoor(gameState) {
        const doorIds = Object.keys(gameState.doors);
        if (doorIds.length === 0) return;
        const randomDoorId = doorIds[Math.floor(Math.random() * doorIds.length)];
        const door = gameState.doors[randomDoorId];
        if (door) {
            console.log(`SERVER: An earthquake jammed door ${randomDoorId}`);
            door.isJammed = true;
            door.jamTimer = 15; // Jammed for 15 seconds
        }
    }
}

export default ServerDisasters;
