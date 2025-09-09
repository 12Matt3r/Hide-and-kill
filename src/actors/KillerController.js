import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import KillerBrain from './AI/KillerBrain.js';
import PhantomBrain from './AI/PhantomBrain.js';

class KillerController {
    constructor(scene, physicsWorld, houseData, config, playerBody, audioBus) {
        this.scene = scene;
        this.config = config;
        this.playerBody = playerBody;
        this.audioBus = audioBus;
        this.footstepTimer = 0.6;

        this.mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 2.8, 8), new THREE.MeshStandardMaterial({ color: 0x220000, roughness: 0.8, metalness: 0.2 }));
        this.mesh.castShadow = true;
        this.scene.add(this.mesh);
        
        const light = new THREE.SpotLight(0xff0000, 5, 20, Math.PI * 0.2, 0.8);
        light.position.set(0, 1.2, 0.5);
        light.target.position.set(0, 0, 5);
        this.mesh.add(light, light.target);
        
        this.body = new CANNON.Body({ mass: 100, shape: new CANNON.Sphere(0.8), allowSleep: false, linearDamping: 0.8 });
        this.body.position.set(1000, 1000, 1000); // Start far away
        physicsWorld.addBody(this.body);
        this.brain = null; // Brain will be created on first update
        this.houseData = houseData;
        this.playerBody = playerBody;

        physicsWorld.addEventListener('postStep', () => {
            this.mesh.position.copy(this.body.position);
            this.mesh.quaternion.copy(this.body.quaternion);
        });
    }

    setDisasters(disasters) {
        this.disasters = disasters;
    }

    update(deltaTime, gameState) {
        if (!this.brain && gameState.killer.type) {
            // First time update, create the correct brain
            switch (gameState.killer.type) {
                case 'phantom':
                    this.brain = new PhantomBrain(this.body, this.houseData, this.config);
                    break;
                default:
                    this.brain = new KillerBrain(this.body, this.houseData, this.config);
            }
        }

        if (gameState.matchPhase === 'setup') {
            if (this.body.position.y < 500) this.body.position.set(1000,1000,1000);
            this.body.velocity.set(0,0,0);
        } else if (this.brain && (gameState.matchPhase === 'hunt' || gameState.matchPhase === 'showdown')) {
            if (this.body.position.y > 500) { // First spawn
                this.body.position.copy(this.brain.getRandomNavPoint());
            }
            this.brain.update(deltaTime, gameState);
        } else {
            this.body.velocity.set(0,0,0);
        }

        // Handle visuals
        this.mesh.material.opacity = gameState.killer.isInvisible ? 0.3 : 1;
        this.mesh.material.transparent = gameState.killer.isInvisible;

        if(this.body.velocity.length() > 1){
            this.footstepTimer -= deltaTime;
            if (this.footstepTimer <= 0) {
                const waterLevel = this.disasters ? this.disasters.getWaterLevel() : -100;
                const isInWater = this.body.position.y < waterLevel + 0.8;
                const sound = isInWater ? 'splash_killer' : 'footstep_killer';
                this.audioBus.playSoundAt(this.body.position, sound, 1.5);
                this.footstepTimer = 0.6 / (this.body.velocity.length() / this.config.walk);
            }
        }
    }
}

export default KillerController;
