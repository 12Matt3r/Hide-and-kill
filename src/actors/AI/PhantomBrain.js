import KillerBrain from './KillerBrain.js';

class PhantomBrain extends KillerBrain {
    constructor(body, houseData, config) {
        super(body, houseData, config);
        this.abilityCooldown = 15;
        this.isInvisible = false;
    }

    update(deltaTime, gameState) {
        super.update(deltaTime, gameState);
        this.abilityCooldown -= deltaTime;

        // Decide when to use the ability
        if (this.abilityCooldown <= 0 && (this.state === 'PATROL' || this.state === 'SEARCH')) {
            // Use ability when starting to patrol a new area
            this.useInvisibility(gameState);
            this.abilityCooldown = 20; // Reset cooldown
        }
    }

    useInvisibility(gameState) {
        console.log("Phantom is turning invisible!");
        gameState.killer.isInvisible = true;
        setTimeout(() => {
            console.log("Phantom is visible again.");
            gameState.killer.isInvisible = false;
        }, 8000); // Invisible for 8 seconds
    }
}

export default PhantomBrain;
