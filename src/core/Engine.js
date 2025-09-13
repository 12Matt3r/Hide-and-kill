import * as THREE from 'three';
import Stats from 'stats.js';
import Physics from './Physics.js';
import PlayerController from '../actors/PlayerController.js';
import PostFX from './PostFX.js';
import AudioBus from './AudioBus.js';
import HouseGen from '../world/HouseGen.js';
import KillerController from '../actors/KillerController.js';
import Disasters from '../world/Disasters.js';

class Engine {
  constructor({ useStats = true, container = document.body } = {}) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.physics = new Physics();
    this.audioBus = new AudioBus(this.camera);
    this.useStats = useStats;
    this.container = container;
    this.stats = null;
    this.postFX = null;
    this._onResize = this.onWindowResize.bind(this);
  }

  init(config, client) { // client is the mock client here
    this.config = config;
    this.client = client;

    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x000000);
    this.scene.add(new THREE.AmbientLight(0x404060));

    // This is from the original single-player mock Engine
    this.playerController = new PlayerController(
      this.camera,
      this.physics.world,
      this.scene,
      this.client.getLatestState().localPlayer, // Pass the localPlayer state
      this.config?.survivor,
      this.audioBus
    );
    this.scene.add(this.playerController.getObject());

    this.postFX = new PostFX(this.renderer, this.scene, this.camera);
    if (this.useStats) {
      this.stats = new Stats();
      this.container.appendChild(this.stats.dom);
    }
    window.addEventListener('resize', this._onResize, false);
  }

  start(seed) {
    // This is from the original single-player mock Engine
    this.houseGen = new HouseGen(this.scene, this.physics.world, seed, this.audioBus);
    const houseData = this.houseGen.generate();

    this.killerController = new KillerController(this.scene, this.physics.world, houseData, this.config.killer, this.playerController.body, this.audioBus);
    this.disasters = new Disasters(this.scene, this.physics.world, this.config.disasters, this.audioBus);

    this.playerController.setPosition(...this.houseGen.getRandomSpawnPoint().toArray());
    this.audioBus.playMusic(this.config.audio.masterVolume * 0.2);
  }

  update(deltaTime, gameState) {
    // This is from the original single-player mock Engine
    this.physics.update(deltaTime);
    this.playerController.update(deltaTime, this.killerController.body.position);
    gameState.killer.position.copy(this.killerController.body.position);
    this.killerController?.update(deltaTime, gameState);
    this.disasters?.update(deltaTime);
    this.audioBus.update(this.playerController.getObject().position, this.killerController.body.position);
    this.postFX.update(gameState.localPlayer.sanity, this.disasters.isEarthquake);

    if (this.stats) this.stats.update();
    if (this.postFX?.composer) {
      this.postFX.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  onWindowResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.postFX?.composer) this.postFX.composer.setSize(w, h);
  }

  requestPointerLock() {
    this.renderer.domElement.requestPointerLock();
  }

  togglePointerLock() {
    if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock();
    } else {
        this.renderer.domElement.requestPointerLock();
    }
  }
}

export default Engine;
