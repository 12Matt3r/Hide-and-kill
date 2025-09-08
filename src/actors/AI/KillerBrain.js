import * as CANNON from 'cannon-es';

class KillerBrain {
    constructor(body, houseData, config) {
        this.body = body;
        this.navPoints = houseData.navPoints;
        this.hidingSpots = houseData.hidingSpots;
        this.config = config;

        this.state = 'PATROL'; // PATROL, SEARCH, CHASE, INVESTIGATE, BAIT
        this.currentTarget = null; // The survivor object being targeted
        this.targetPoint = this.getRandomNavPoint(); // A location to move towards
        this.stateTimer = 0;
        this.currentRoomHidingSpots = [];
    }
    
    getRandomNavPoint() { return this.navPoints[Math.floor(Math.random() * this.navPoints.length)]; }

    hearNoise(position) {
        // Noise investigation has high priority, but doesn't interrupt a chase
        if (this.state !== 'CHASE') {
            console.log("AI heard a noise, investigating...");
            this.state = 'INVESTIGATE';
            this.targetPoint = position.clone();
            this.stateTimer = 0;
        }
    }

    findTarget(gameState) {
        let closestTarget = null;
        let minDistance = this.config.senseConeRange;

        for (const id in gameState.survivors) {
            const survivor = gameState.survivors[id];
            if (survivor.status !== 'alive' || survivor.isHiding) continue;

            const distance = this.body.position.distanceTo(survivor.position);
            if (distance < minDistance) {
                minDistance = distance;
                closestTarget = survivor;
            }
        }
        return closestTarget;
    }

    update(deltaTime, gameState) {
        this.stateTimer += deltaTime;
        const potentialTarget = this.findTarget(gameState);

        // --- State Transitions ---
        if (potentialTarget) {
            this.state = 'CHASE';
            this.currentTarget = potentialTarget;
            // Always update last known position when a target is in sight
            this.lastKnownTargetPosition = this.currentTarget.position.clone();
        } else if (this.state === 'CHASE') {
            // Lost the target, go search their last known position
            this.state = 'SEARCH';
            this.targetPoint = this.lastKnownTargetPosition.clone(); // Now this is guaranteed to exist
            this.stateTimer = 0;
            this.currentTarget = null;
        }

        // --- State Actions ---
        switch(this.state) {
            case 'PATROL': this.patrol(); break;
            case 'SEARCH': this.search(); break;
            case 'CHASE': this.chase(); break;
            case 'INVESTIGATE': this.investigate(); break;
            case 'BAIT': this.bait(); break;
        }
    }
    
    moveTowards(target, speed) {
        const direction = target.vsub(this.body.position);
        if (direction.lengthSquared() < 1) return; // Close enough
        direction.normalize();

        this.body.velocity.x = direction.x * speed;
        this.body.velocity.z = direction.z * speed;

        const angle = Math.atan2(direction.x, direction.z);
        this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0,1,0), angle);
    }

    patrol() {
        if (!this.targetPoint || this.body.position.distanceTo(this.targetPoint) < 2) {
            this.targetPoint = this.getRandomNavPoint();
        }
        this.moveTowards(this.targetPoint, this.config.walk);
    }
    
    search() {
        if (this.stateTimer < 1.5) { // Pause for 1.5s after checking a spot
            this.body.velocity.set(0,0,0);
            return;
        }

        if (this.body.position.distanceTo(this.targetPoint) < 2 && this.currentRoomHidingSpots.length === 0) {
            // Arrived at search location, now populate hiding spots
            this.currentRoomHidingSpots = this.hidingSpots
                .filter(spot => spot.position.distanceTo(this.body.position) < 8)
                .map(spot => spot.position.clone());
        }

        if (this.currentRoomHidingSpots.length > 0) {
            // Move to the next hiding spot
            this.moveTowards(this.currentRoomHidingSpots[0], this.config.walk * 0.8);
            if (this.body.position.distanceTo(this.currentRoomHidingSpots[0]) < 1.5) {
                this.currentRoomHidingSpots.shift(); // "Checked" it
                this.stateTimer = 0; // Pause after checking each spot
            }
        } else {
            // Finished searching room, decide whether to patrol or bait
            if (Math.random() < 0.25) { // 25% chance to bait
                this.state = 'BAIT';
                this.targetPoint = this.getRandomNavPoint(); // Pick a point outside the room
            } else {
                this.state = 'PATROL';
            }
            this.stateTimer = 0;
        }
    }

    bait() {
        // Move to a point just outside the room and wait
        this.moveTowards(this.targetPoint, this.config.walk);
        if (this.body.position.distanceTo(this.targetPoint) < 2) {
            // Arrived at bait point, now wait
            this.body.velocity.set(0,0,0); // Stand still
            if (this.stateTimer > 8) { // Wait for 8 seconds
                this.state = 'PATROL';
            }
        }
    }

    chase() {
        if (!this.currentTarget) return; // Should not happen due to state transition logic
        this.moveTowards(this.currentTarget.position, this.config.runBurst);
        this.lastKnownTargetPosition = this.currentTarget.position.clone();
    }

    investigate() {
        if (this.body.position.distanceTo(this.targetPoint) < 2) {
            this.state = 'SEARCH'; // Arrived at noise, now search the area
            this.stateTimer = 0;
        } else {
            this.moveTowards(this.targetPoint, this.config.walk * 1.2);
        }
    }
}

export default KillerBrain;
