import * as THREE from 'three';
import Stats from 'stats.js';
import HouseBuilder from '../world/HouseBuilder.js';
import Physics from './Physics.js';
import PlayerController from '../actors/PlayerController.js';
import KillerController from '../actors/KillerController.js';
import PostFX from './PostFX.js';
import AudioBus from './AudioBus.js';

class Engine {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        this.physics = new Physics();
        this.audioBus = new AudioBus(this.camera, this.physics.world);
        this.gameState = null;
        this.throwableMeshes = {};
        this.doorObjects = {};
        this.worldBuilt = false;
    }

    init(config, client) {
        this.config = config;
        this.client = client;
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        document.body.appendChild(this.renderer.domElement);

        this.scene.background = new THREE.Color(0x000000);
        this.scene.fog = new THREE.FogExp2(0x000000, 0.025);
        this.scene.add(new THREE.AmbientLight(0x202030, 0.5));
        
        // Create a default local player state for initialization
        const defaultLocalPlayerState = { stamina: 100, sanity: 100, isHiding: false, isCrouched: false, hasFinisherTool: false };
        this.playerController = new PlayerController(this.camera, this.physics.world, this.scene, defaultLocalPlayerState, this.config.survivor, this.audioBus, this.client);
        this.scene.add(this.playerController.getObject());
        
        this.postFX = new PostFX(this.renderer, this.scene, this.camera);
        this.setupStats();
        
        window.addEventListener('resize', this.onWindowResize.bind(this), false);
    }
    
    setupStats() {
        this.stats = new Stats();
        this.stats.dom.style.display = 'none';
        document.body.appendChild(this.stats.dom);
    }
    
    toggleStats() { this.stats.dom.style.display = this.stats.dom.style.display === 'none' ? 'block' : 'none'; }

    start() {
        // We no longer generate the house here, we wait for the server state
        this.houseBuilder = new HouseBuilder(this.scene, this.physics.world, this.audioBus, this.throwableMeshes, this.doorObjects);
        this.audioBus.playMusic(this.config.audio.masterVolume * 0.2);
    }
    
    update(deltaTime, serverState) {
        if (!serverState) return;
        this.gameState = serverState;

        if (!this.worldBuilt && this.gameState.furniture) {
            this.buildWorld(this.gameState);
            this.worldBuilt = true;
        }
        
        // Update the local player's state from the server's authoritative state
        if(this.gameState.localPlayer) {
            this.playerController.state.stamina = this.gameState.localPlayer.stamina;
            this.playerController.state.sanity = this.gameState.localPlayer.sanity;
            this.playerController.state.hasFinisherTool = this.gameState.localPlayer.hasFinisherTool;

            const localSurvivor = this.gameState.survivors[this.gameState.localPlayer.id];
            if (localSurvivor && localSurvivor.status === 'dead' && !this.playerController.isGhost) {
                this.playerController.becomeGhost();
            }
        }
        
        this.physics.update(deltaTime);
        this.playerController.update(deltaTime, this.killerController?.body.position || new THREE.Vector3(1000,1000,1000), this.gameState);
        
        this.killerController?.update(deltaTime, this.gameState);
        this.audioBus.update(this.playerController.getObject().position, this.killerController?.body.position);

        if (this.postFX.update && this.gameState.localPlayer) {
            const isEarthquake = this.gameState.activeDisaster === 'earthquake';
            this.postFX.update(this.gameState.localPlayer.sanity, isEarthquake);
        }

        // Sync throwable objects
        if (this.gameState.throwables) {
            for (const id in this.throwableMeshes) {
                const mesh = this.throwableMeshes[id];
                const state = this.gameState.throwables[id];
                if (state) {
                    mesh.visible = !state.isHeld;
                    if (mesh.visible) {
                        mesh.position.copy(state.position);
                        // No need to update physics body here, server is authoritative
                    }
                }
            }
        }

        // Sync door objects
        if (this.gameState.doors) {
            for (const id in this.doorObjects) {
                const doorObject = this.doorObjects[id];
                const doorState = this.gameState.doors[id];
                if (doorObject && doorState) {
                    doorObject.syncState(doorState);
                }
            }
        }
        
        this.stats.update();
        this.postFX.composer.render();
    }

    buildWorld(gameState) {
        const houseData = this.houseBuilder.build(gameState);

        this.killerController = new KillerController(this.scene, this.physics.world, houseData, this.config.killer, null, this.audioBus);

        // The player controller still needs a way to check water level for splash sounds.
        // We'll pass a simple object that gets the info from the gameState.
        const disasterStateProvider = {
            getWaterLevel: () => this.gameState?.waterLevel || -100
        };
        this.playerController.setDisasters(disasterStateProvider);
        this.killerController.setDisasters(disasterStateProvider);

        this.playerController.setPosition(...this.houseBuilder.getRandomSpawnPoint().toArray());
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.postFX.composer.setSize(window.innerWidth, window.innerHeight);
    }
    
    setBloomEnabled(enabled) {
        this.postFX.setBloomEnabled(enabled);
    }

    setVhsEnabled(enabled) {
        document.getElementById('vhs-overlay').style.display = enabled ? 'block' : 'none';
    }

    setShadowQuality(quality) {
        // This requires re-creating lights, which is complex.
        // For now, we'll just log it. A full implementation would be needed.
        console.log(`Shadow quality set to: ${quality}`);
        // Example: this.renderer.shadowMap.type = { high: THREE.PCFSoftShadowMap, ... }[quality];
    }

    requestPointerLock() { this.renderer.domElement.requestPointerLock(); }
    togglePointerLock() { document.pointerLockElement === this.renderer.domElement ? document.exitPointerLock() : this.renderer.domElement.requestPointerLock(); }

    showScoutPing(position) {
        const pingGeo = new THREE.SphereGeometry(0.5, 16, 16);
        const pingMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.8 });
        const pingMesh = new THREE.Mesh(pingGeo, pingMat);
        pingMesh.position.set(position.x, position.y, position.z);
        this.scene.add(pingMesh);
        setTimeout(() => {
            this.scene.remove(pingMesh);
        }, 2000); // Visible for 2 seconds
    }
}

export default Engine;
