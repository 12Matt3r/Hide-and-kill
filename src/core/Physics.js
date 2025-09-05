import * as CANNON from 'cannon-es';

class Physics {
    constructor() {
        this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -20, 0) });
        this.world.broadphase = new CANNON.SAPBroadphase(this.world);
        this.world.allowSleep = true;
    }

    update(deltaTime) {
        this.world.step(1 / 60, deltaTime, 3);
    }
}

export default Physics;
