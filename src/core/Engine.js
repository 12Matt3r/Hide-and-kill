import * as THREE from 'three';
import Stats from 'stats.js';
import HouseGen from '../world/HouseGen.js';
import Physics from './Physics.js';
import PlayerController from '../actors/PlayerController.js';
import KillerController from '../actors/KillerController.js';
import PostFX from './PostFX.js';
import Disasters from '../world/Disasters.js';
import AudioBus from './AudioBus.js';

class Engine {
    constructor(initialGameState) {
        this.gameState = initialGameState;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        this.physics = new Physics();
        this.audioBus = new AudioBus(this.camera);
    }

    init(config) {
        this.config = config;
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        document.body.appendChild(this.renderer.domElement);

        this.scene.background = new THREE.Color(0x000000);
        this.scene.fog = new THREE.FogExp2(0x000000, 0.025);
        this.scene.add(new THREE.AmbientLight(0x202030, 0.5));
        
        this.playerController = new PlayerController(this.camera, this.physics.world, this.scene, this.gameState.localPlayer, this.config.survivor, this.audioBus);
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

    start(seed) {
        this.houseGen = new HouseGen(this.scene, this.physics.world, seed, this.audioBus);
        const houseData = this.houseGen.generate();
        
        this.killerController = new KillerController(this.scene, this.physics.world, houseData, this.config.killer, null, this.audioBus);
        this.disasters = new Disasters(this.scene, this.physics.world, this.config.disasters, this.audioBus);
        
        // Pass disaster controller to entities that need to know about it
        this.playerController.setDisasters(this.disasters);
        this.killerController.setDisasters(this.disasters);

        this.playerController.setPosition(...this.houseGen.getRandomSpawnPoint().toArray());
        this.audioBus.playMusic(this.config.audio.masterVolume * 0.2);
    }
    
    update(deltaTime, serverState) {
        this.gameState = serverState;
        
        this.physics.update(deltaTime);
        this.playerController.update(deltaTime, this.killerController.body.position);
        
        // Update server state with killer's position (in mock, this is direct)
        this.gameState.killer.position.copy(this.killerController.body.position);
        
        this.killerController?.update(deltaTime, this.gameState);
        this.disasters?.update(deltaTime);
        this.audioBus.update(this.playerController.getObject().position, this.killerController.body.position);
        this.postFX.update(this.gameState.localPlayer.sanity, this.disasters.isEarthquake);
        
        this.stats.update();
        this.postFX.composer.render();
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.postFX.composer.setSize(window.innerWidth, window.innerHeight);
    }
    
    requestPointerLock() { this.renderer.domElement.requestPointerLock(); }
    togglePointerLock() { document.pointerLockElement === this.renderer.domElement ? document.exitPointerLock() : this.renderer.domElement.requestPointerLock(); }
}

export default Engine;
