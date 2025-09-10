import * as THREE from 'three';
import Stats from 'stats.js';
import Physics from './Physics.js';
import PlayerController from '../actors/PlayerController.js';
import PostFX from './PostFX.js';
import AudioBus from './AudioBus.js';

class Engine {
  constructor({ useStats = true, container = document.body } = {}) {
    // Core
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.physics = new Physics();
    this.audioBus = new AudioBus(this.camera);

    // State
    this.worldObjects = new Map();     // id -> THREE.Object3D
    this.assets = { geos: {}, mats: {} }; // pooled geometries/materials
    this.config = null;
    this.client = null;
    this.worldBuilt = false;
    this.useStats = useStats;
    this.container = container;

    // Optional
    this.stats = null;
    this.postFX = null;

    // Bind handlers once
    this._onResize = this.onWindowResize.bind(this);
  }

  init(config, client) {
    this.config = config;
    this.client = client;

    // Renderer
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.container.appendChild(this.renderer.domElement);

    // Scene baseline
    this.scene.background = new THREE.Color(0x000000);
    this.scene.add(new THREE.AmbientLight(0x404060));

    // Player
    this.playerController = new PlayerController(
      this.camera,
      this.physics.world,
      this.scene,
      this.config?.survivor,
      this.audioBus,
      this.client
    );
    this.scene.add(this.playerController.getObject());

    // PostFX + Stats (optional)
    this.postFX = new PostFX(this.renderer, this.scene, this.camera);
    if (this.useStats) {
      this.stats = new Stats();
      this.container.appendChild(this.stats.dom);
    }

    // Resize
    window.addEventListener('resize', this._onResize, false);

    // Prepare pooled assets
    this.#initAssetPool();
  }

  /** Call once on teardown */
  dispose() {
    window.removeEventListener('resize', this._onResize);

    // Remove all world objects
    for (const [id, obj] of this.worldObjects) {
      this.scene.remove(obj);
    }
    this.worldObjects.clear();

    // Dispose materials/geometries
    Object.values(this.assets.geos).forEach(g => g.dispose());
    Object.values(this.assets.mats).forEach(m => m.dispose());
    this.assets = { geos: {}, mats: {} };

    // Renderer DOM + dispose
    if (this.renderer?.domElement?.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();

    // Stats DOM
    if (this.stats?.dom?.parentNode) {
      this.stats.dom.parentNode.removeChild(this.stats.dom);
    }
  }

  update(deltaTime, gameState) {
    if (!gameState) return;

    if (!this.worldBuilt && gameState.walls) {
      this.#buildWorld(gameState);
      this.worldBuilt = true;
    }

    this.#syncEntities(gameState);

    this.physics.update(deltaTime);
    this.playerController.update(deltaTime);

    if (this.stats) this.stats.update();

    // Prefer PostFX composer; fall back to direct renderer if needed
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

  // -------------------------
  // Internals
  // -------------------------

  #initAssetPool() {
    // Geometries: reuse unit geos; scale per-instance
    this.assets.geos.wall = new THREE.BoxGeometry(1, 1, 1);
    this.assets.geos.floor = new THREE.BoxGeometry(1, 1, 1);
    this.assets.geos.door = new THREE.BoxGeometry(1, 1, 1);
    this.assets.geos.killer = new THREE.CylinderGeometry(0.5, 0.8, 2.8, 8);
    this.assets.geos.survivor = new THREE.CapsuleGeometry(0.4, 1.0, 4, 8);

    // Materials: simple, cheap, reusable
    this.assets.mats.wall = new THREE.MeshStandardMaterial({ color: 0x888888 });
    this.assets.mats.floor = new THREE.MeshStandardMaterial({ color: 0x555555 });
    this.assets.mats.door = new THREE.MeshStandardMaterial({ color: 0x8c5a2b });
    this.assets.mats.killer = new THREE.MeshStandardMaterial({ color: 0x880000 });
    this.assets.mats.survivor = new THREE.MeshStandardMaterial({ color: 0x8888ff });
  }

  #buildWorld(gameState) {
    // Helpers
    const createStatic = (type, id, s, p, r) => {
      const mesh = new THREE.Mesh(this.assets.geos[type], this.assets.mats[type]);
      mesh.matrixAutoUpdate = true; // still dynamic for convenience; set false & updateMatrix() if fully static
      mesh.scale.set(s.w, s.h, s.d);
      mesh.position.copy(p);
      if (r?.y != null) mesh.rotation.y = r.y;
      this.scene.add(mesh);
      this.worldObjects.set(id, mesh);
      return mesh;
    };

    // Walls / Floors / Doors
    (gameState.walls ?? []).forEach(w => createStatic('wall', w.id, w.s, w.p, w.r));
    (gameState.floors ?? []).forEach(f => createStatic('floor', f.id, f.s, f.p, f.r));
    (gameState.doors ?? []).forEach(d => createStatic('door', d.id, d.s, d.p, d.r));

    // Killer placeholder
    const killerMesh = new THREE.Mesh(this.assets.geos.killer, this.assets.mats.killer);
    this.scene.add(killerMesh);
    this.worldObjects.set('killer', killerMesh);
  }

  #ensureSurvivorMesh(id) {
    if (this.worldObjects.has(id)) return this.worldObjects.get(id);
    const mesh = new THREE.Mesh(this.assets.geos.survivor, this.assets.mats.survivor);
    this.scene.add(mesh);
    this.worldObjects.set(id, mesh);
    return mesh;
  }

  #syncEntities(gameState) {
    const seen = new Set();

    // Survivors (skip the local client's visual body, camera/player handles that)
    const survivors = gameState.survivors ?? {};
    for (const id in survivors) {
      seen.add(id);
      if (id === this.client?.id) continue;

      const { position, rotation } = survivors[id] ?? {};
      const mesh = this.#ensureSurvivorMesh(id);
      if (position) mesh.position.copy(position);
      if (typeof rotation === 'number') mesh.rotation.y = rotation;
    }

    // Killer
    const killerMesh = this.worldObjects.get('killer');
    if (killerMesh && gameState.killer?.position) {
      killerMesh.position.copy(gameState.killer.position);
    }
    seen.add('killer');

    // GC: remove any worldObjects that aren't current survivors or 'killer'
    for (const id of Array.from(this.worldObjects.keys())) {
      const isDynamicEntity = id === 'killer' || survivors[id];
      const isStillPresent = seen.has(id) || isDynamicEntity;
      if (!isStillPresent) {
        const obj = this.worldObjects.get(id);
        this.scene.remove(obj);
        this.worldObjects.delete(id);
      }
    }
  }
}

export default Engine;
