import * as CANNON from 'cannon-es';

class KillerBrain {
    constructor(body, houseData, config, playerBody) {
        this.body = body;
        this.navPoints = houseData.navPoints;
        this.hidingSpots = houseData.hidingSpots;
        this.config = config;
        this.playerBody = playerBody;

        this.state = 'PATROL';
        this.targetPoint = this.getRandomNavPoint();
        this.stateTimer = 0;
        this.currentRoomHidingSpots = [];
    }
    
    getRandomNavPoint() { return this.navPoints[Math.floor(Math.random() * this.navPoints.length)]; }

    update(deltaTime, playerState) {
        this.stateTimer += deltaTime;
        
        const distanceToPlayer = this.body.position.distanceTo(this.playerBody.position);
        
        // State transitions
        if (!playerState.isHiding && distanceToPlayer < this.config.senseConeRange) {
            this.state = 'CHASE';
        } else if (this.state === 'CHASE' && distanceToPlayer > this.config.senseConeRange * 1.5) {
            this.state = 'SEARCH';
            this.targetPoint = this.playerBody.position.clone(); // Search last known position
            this.stateTimer = 0;
        }

        switch(this.state) {
            case 'PATROL': this.patrol(); break;
            case 'SEARCH': this.search(); break;
            case 'CHASE': this.chase(); break;
        }
    }
    
    moveTowards(target, speed) {
        const direction = target.vsub(this.body.position);
        if (direction.lengthSquared() < 0.1) return;
        direction.normalize();

        this.body.velocity.x = direction.x * speed;
        this.body.velocity.z = direction.z * speed;

        const angle = Math.atan2(direction.x, direction.z);
        this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0,1,0), angle);
    }

    patrol() {
        if (!this.targetPoint || this.body.position.distanceTo(this.targetPoint) < 2) {
            this.state = 'SEARCH'; // Arrived at a room, start searching it
            this.stateTimer = 0;
            // Find hiding spots in the current area
            this.currentRoomHidingSpots = this.hidingSpots
                .filter(spot => spot.position.distanceTo(this.body.position) < 8)
                .map(spot => spot.position.clone());
        }
        this.moveTowards(this.targetPoint, this.config.walk);
    }
    
    search() {
        if (this.currentRoomHidingSpots.length > 0) {
            // Check the next hiding spot
            this.moveTowards(this.currentRoomHidingSpots[0], this.config.walk * 0.8);
            if (this.body.position.distanceTo(this.currentRoomHidingSpots[0]) < 1.5) {
                this.currentRoomHidingSpots.shift(); // "Checked" it, remove from list
            }
        } else {
            // Finished searching room, go back to patrol
            this.state = 'PATROL';
            this.targetPoint = this.getRandomNavPoint();
        }
    }

    chase() {
        this.moveTowards(this.playerBody.position, this.config.runBurst);
    }
}

export default KillerBrain;
