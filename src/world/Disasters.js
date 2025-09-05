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
        this.isFlood = false;
        this.waterLevel = -10;

        // Setup water plane for flood
        const waterGeo = new THREE.PlaneGeometry(100, 100);
        const waterMat = new THREE.MeshStandardMaterial({ color: 0x0066ff, transparent: true, opacity: 0.6, roughness: 0.1 });
        this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
        this.waterMesh.rotation.x = -Math.PI / 2;
        this.waterMesh.visible = false;
        this.scene.add(this.waterMesh);

        this.waterBody = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC, shape: new CANNON.Plane() });
        this.waterBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        this.waterBody.position.y = this.waterLevel;
    }

    getWaterLevel() { return this.isFlood ? this.waterLevel : -100; }
    
    update(deltaTime) {
        this.timer -= deltaTime;
        if (this.timer <= 0 && !this.isFlood) { // Don't trigger new disasters during a flood
            this.triggerRandomDisaster();
            this.timer = this.config.minDelaySec + Math.random() * (this.config.maxDelaySec - this.config.minDelaySec);
        }

        if (this.isFlood && this.waterLevel < 3) {
            this.waterLevel += deltaTime * 0.1; // Water rises slowly
            this.waterMesh.position.y = this.waterLevel;
            this.waterBody.position.y = this.waterLevel;
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
                if (disaster === 'flood') this.triggerFlood();
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

    triggerFlood() {
        if (this.isFlood) return;
        console.log("%cFLOOD TRIGGERED", "color:blue; font-size: 1.5em;");
        this.isFlood = true;
        this.waterMesh.visible = true;
        this.physicsWorld.addBody(this.waterBody);
        this.audioBus.playSoundAt(this.waterMesh.position, 'water_rising', 0.7);
    }
}

export default Disasters;
