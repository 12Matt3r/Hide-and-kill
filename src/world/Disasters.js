import * as THREE from 'three';
import * as CANNON from 'cannon-es';

class Disasters {
    constructor(scene, physicsWorld, config, audioBus) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;
        this.config = config;
        this.audioBus = audioBus;
        this.timer = this.config.minDelaySec + Math.random() * (this.config.maxDelaySec - this.config.minDelaySec);
        this.isEarthquake = false;
    }

    update(deltaTime) {
        this.timer -= deltaTime;
        if (this.timer <= 0) {
            this.triggerRandomDisaster();
            this.timer = this.config.minDelaySec + Math.random() * (this.config.maxDelaySec - this.config.minDelaySec);
        }
    }

    triggerRandomDisaster() {
        const rand = Math.random();
        let cumulativeProb = 0;
        for (const [disaster, prob] of Object.entries(this.config.probabilities)) {
            cumulativeProb += prob;
            if (rand <= cumulativeProb) {
                if (disaster === 'lightning') this.triggerLightning();
                if (disaster === 'earthquake') this.triggerEarthquake();
                return;
            }
        }
    }

    triggerEarthquake() {
        console.log("%cEARTHQUAKE TRIGGERED", "color:red; font-size: 1.5em;");
        this.isEarthquake = true;
        setTimeout(() => this.isEarthquake = false, 2000);
        this.physicsWorld.bodies.forEach(body => {
            if (body.mass > 0 && body.mass < 50) { // Don't shake player too much
                const impulse = new CANNON.Vec3(Math.random()-0.5, 0, Math.random()-0.5).scale(body.mass * 10);
                body.applyImpulse(impulse, body.position);
            }
        });
    }

    triggerLightning() {
        console.log("%cLIGHTNING TRIGGERED", "color:yellow; font-size: 1.5em;");
        this.audioBus.playSoundAt(new THREE.Vector3(50,50,50), 'thunder', 0.8);
        const flash = new THREE.DirectionalLight(0xffffff, 3);
        flash.position.set(Math.random()-0.5, 1, Math.random()-0.5).normalize();
        this.scene.add(flash);
        setTimeout(() => this.scene.remove(flash), 150);
    }
}

export default Disasters;
