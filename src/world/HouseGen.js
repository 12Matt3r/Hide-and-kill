// world/HouseGen.js
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import Random from '../core/Random.js';
import { Door, FuseBox } from './Interactables.js';
import { Closet } from './HidingSpots.js';

/**
 * @typedef {Object} HouseGenOptions
 * @property {[number, number]} floorsRange inclusive [min,max]
 * @property {number} roomsPerFloor count; arranged 2x2
 * @property {THREE.Vector2} roomSize w,d (meters)
 * @property {number} storeyHeight
 * @property {number} wallThickness
 * @property {number} doorChance 0..1
 * @property {boolean} debug
 */

export default class HouseGen {
  /**
   * @param {THREE.Scene} scene
   * @param {CANNON.World} physicsWorld
   * @param {{ seed?: number|string, audioBus?: any, options?: Partial<HouseGenOptions> }} cfg
   */
  constructor(scene, physicsWorld, cfg = {}) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;

    const {
      seed = Date.now(),
      audioBus = null,
      options = {},
    } = cfg;

    /** @type {HouseGenOptions} */
    this.opts = Object.assign(
      {
        floorsRange: [2, 3],
        roomsPerFloor: 4,               // laid out as 2x2 grid
        roomSize: new THREE.Vector2(10, 10),
        storeyHeight: 5,                // floor to floor
        wallThickness: 0.2,
        doorChance: 0.6,
        debug: false,
      },
      options
    );

    this.rng = new Random(seed);
    this.audioBus = audioBus;
    this.materials = this._makeMaterials();
    this.cannon = {
      wallMaterial: new CANNON.Material('wallMaterial'),
    };

    // Runtime collections
    this.root = new THREE.Group();
    this.root.name = 'HouseGenRoot';
    this.scene.add(this.root);

    this.debugGroup = new THREE.Group();
    this.debugGroup.visible = !!this.opts.debug;
    this.root.add(this.debugGroup);

    /** @type {THREE.Vector3[]} */
    this.navPoints = [];
    /** @type {any[]} */
    this.hidingSpots = [];
    /** @type {THREE.Light[]} */
    this.lights = [];
    /** @type {{mesh:THREE.Object3D, body?:CANNON.Body}[]} */
    this._spawned = [];
    /** @type {CANNON.Body[]} */
    this._bodies = [];
  }

  /* ===================== PUBLIC API ===================== */

  /**
   * Generate the house structure. Call dispose() before re-generating.
   */
  generate() {
    this._createGround(100, 100);

    const floors = this.rng.nextInt(this.opts.floorsRange[0], this.opts.floorsRange[1]);
    const roomsPerFloor = this.opts.roomsPerFloor;
    const allRooms = [];

    for (let y = 0; y < floors; y++) {
      const baseY = y * this.opts.storeyHeight;
      /** @type {THREE.Light[]} */
      const floorLights = [];

      for (let i = 0; i < roomsPerFloor; i++) {
        // layout 2x2 grid
        const col = i % 2;
        const row = Math.floor(i / 2);
        const room = {
          x: col * (this.opts.roomSize.x + 2), // 2m gap between rooms for walls
          z: row * (this.opts.roomSize.y + 2),
          w: this.opts.roomSize.x,
          d: this.opts.roomSize.y,
          y: baseY,
        };
        allRooms.push(room);
        this._createRoom(room, floorLights);
      }

      // Per-floor interactable fuse box
      new FuseBox(
        this.root, // parent
        new THREE.Vector3(allRooms[0].x + 1, baseY + 1.5, allRooms[0].z + 1),
        floorLights,
        this.audioBus
      );

      // Stairs between floors
      if (y < floors - 1) {
        // place near middle corridor
        const stairOrigin = {
          x: allRooms[0].x + this.opts.roomSize.x * 0.5,
          y: baseY,
          z: allRooms[0].z + this.opts.roomSize.y + 1,
        };
        this._createStairs(stairOrigin);
      }
    }

    return {
      rooms: allRooms,
      navPoints: this.navPoints,
      hidingSpots: this.hidingSpots,
    };
  }

  toggleDebugView(force) {
    if (typeof force === 'boolean') this.debugGroup.visible = force;
    else this.debugGroup.visible = !this.debugGroup.visible;
  }

  getRandomSpawnPoint() {
    return this.rng.pick(this.navPoints) || new THREE.Vector3(5, 1, 5);
  }

  /**
   * Remove meshes/bodies created by the generator.
   */
  dispose() {
    // Three
    for (const { mesh } of this._spawned) {
      if (!mesh) continue;
      mesh.parent?.remove(mesh);
      this._disposeObject(mesh);
    }
    this._spawned.length = 0;

    // Cannon
    for (const body of this._bodies) {
      try { this.physicsWorld.removeBody(body); } catch {}
    }
    this._bodies.length = 0;

    // Root & debug
    this.root.parent?.remove(this.root);
    this._disposeObject(this.root);
  }

  /* ===================== INTERNALS ===================== */

  _makeMaterials() {
    return {
      ground: new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 1 }),
      floor: new THREE.MeshStandardMaterial({ color: 0x5a5a5a, roughness: 0.9 }),
      ceiling: new THREE.MeshStandardMaterial({ color: 0x5a5a5a, roughness: 0.9 }),
      wall: new THREE.MeshStandardMaterial({ color: 0x9a9fa6, roughness: 0.95 }),
      stair: new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.9 }),
      debugWire: new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true }),
    };
  }

  _createRoom(room, floorLights) {
    const h = this.opts.storeyHeight - 1; // visual ceiling height (~4m if storey=5)

    // Floor & ceiling
    this._box(
      room.w, 0.2, room.d,
      { x: room.x + room.w / 2, y: room.y, z: room.z + room.d / 2 },
      this.materials.floor, 0
    );
    this._box(
      room.w, 0.2, room.d,
      { x: room.x + room.w / 2, y: room.y + h, z: room.z + room.d / 2 },
      this.materials.ceiling, 0
    );

    // Navpoint
    const nav = new THREE.Vector3(room.x + room.w / 2, room.y + 1, room.z + room.d / 2);
    this.navPoints.push(nav);
    this._debugSphere(nav, 0.25);

    // Walls (N,S,W,E) — door or solid
    this._createWallOrDoor(room, 'north', h);
    this._createWallOrDoor(room, 'south', h);
    this._createWallOrDoor(room, 'west',  h);
    this._createWallOrDoor(room, 'east',  h);

    // Hiding spot
    const closet = new Closet(this.root, new THREE.Vector3(room.x + 1, room.y, room.z + 1));
    this.hidingSpots.push(closet);

    // Light
    const pl = new THREE.PointLight(0xffddaa, 1, 15, 2);
    pl.position.set(nav.x, nav.y + 2.5, nav.z);
    pl.castShadow = true;
    this.root.add(pl);
    floorLights.push(pl);
    this.lights.push(pl);
  }

  _createWallOrDoor(room, side, wallHeight) {
    const t = this.opts.wallThickness;
    const useDoor = this.rng.next() < this.opts.doorChance;

    if (useDoor) {
      // Door will add its own meshes/bodies; pass parent group
      new Door(this.root, this.physicsWorld, room, side, this.audioBus);
      return;
    }

    // Solid wall segment
    const pos = { x: 0, y: room.y + wallHeight / 2, z: 0 };
    let w = 0, h = wallHeight, d = t;

    if (side === 'north' || side === 'south') {
      w = room.w;
      pos.x = room.x + room.w / 2;
      pos.z = side === 'north' ? room.z : room.z + room.d;
    } else {
      d = room.d;
      w = t;
      pos.z = room.z + room.d / 2;
      pos.x = side === 'west' ? room.x : room.x + room.w;
    }
    this._box(w, h, d, pos, this.materials.wall, 0, this.cannon.wallMaterial);
  }

  _createStairs(origin) {
    const steps = 10;
    const stepW = 3, stepH = 0.5, stepD = 1;

    // Use InstancedMesh for draw-call efficiency
    const geom = new THREE.BoxGeometry(stepW, stepH, stepD);
    const inst = new THREE.InstancedMesh(geom, this.materials.stair, steps);
    inst.castShadow = true; inst.receiveShadow = true;
    this.root.add(inst);
    this._spawned.push({ mesh: inst });

    const m = new THREE.Matrix4();
    for (let i = 0; i < steps; i++) {
      m.makeTranslation(origin.x, origin.y + i * stepH, origin.z + i * stepD);
      inst.setMatrixAt(i, m);
      // Physics: simple individual static boxes for collision
      const body = this._bodyBox(stepW, stepH, stepD, { x: origin.x, y: origin.y + i * stepH, z: origin.z + i * stepD }, 0, this.cannon.wallMaterial);
      this._bodies.push(body);
    }

    // Add nav points at bottom/top
    this.navPoints.push(
      new THREE.Vector3(origin.x, origin.y + 0.1, origin.z),
      new THREE.Vector3(origin.x, origin.y + steps * stepH, origin.z + steps * stepD)
    );
  }

  _createGround(w, d) {
    this._box(w, 0.2, d, { x: w / 2, y: -0.1, z: d / 2 }, this.materials.ground, 0, this.cannon.wallMaterial);
  }

  /* ----------------- Low-level helpers ----------------- */

  _box(w, h, d, pos, material, mass = 0, cannonMaterial) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(pos.x, pos.y, pos.z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    this.root.add(mesh);

    const body = this._bodyBox(w, h, d, pos, mass, cannonMaterial);

    this._spawned.push({ mesh, body });
    if (body) this._bodies.push(body);
    return { mesh, body };
  }

  _bodyBox(w, h, d, pos, mass = 0, cannonMaterial) {
    const shape = new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2));
    const body = new CANNON.Body({ mass, material: cannonMaterial || this.cannon.wallMaterial });
    body.addShape(shape);
    body.position.set(pos.x, pos.y, pos.z);
    this.physicsWorld.addBody(body);
    return body;
  }

  _debugSphere(pos, r = 0.3) {
    if (!this.debugGroup.visible) return;
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8), this.materials.debugWire);
    sphere.position.copy(pos);
    this.debugGroup.add(sphere);
    this._spawned.push({ mesh: sphere });
  }

  _disposeObject(obj) {
    obj.traverse((o) => {
      if (o.isMesh) {
        o.geometry?.dispose?.();
        if (Array.isArray(o.material)) o.material.forEach(m => m?.dispose?.());
        else o.material?.dispose?.();
      }
    });
  }
}
