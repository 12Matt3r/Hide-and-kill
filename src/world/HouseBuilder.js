import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import Random from '../core/Random.js';
import { Door, FuseBox } from './Interactables.js';
import { Closet } from './HidingSpots.js';

class HouseBuilder {
    constructor(scene, physicsWorld, audioBus, throwableMeshes, doorObjects) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;
        this.rng = new Random(seed);
        this.audioBus = audioBus;
        this.throwableMeshes = throwableMeshes;
        this.doorObjects = doorObjects;
        this.doorCounter = 0;
        this.wallMaterial = new CANNON.Material("wallMaterial");
        this.navPoints = [];
        this.hidingSpots = [];
        this.lights = [];
        this.debugLines = new THREE.Group();
        this.debugLines.visible = false;
        this.scene.add(this.debugLines);
    }

    build(gameState) {
        this.createGround(100, 100);
        
        // Build static geometry from server data
        gameState.walls.forEach(w => this.createBox(w.s.w, w.s.h, w.s.d, w.p));
        gameState.floors.forEach(f => this.createBox(f.s.w, f.s.h, f.s.d, f.p));

        // Build dynamic parts from gameState
        for (const f of gameState.furniture) {
            this.createBox(f.size.w, f.size.h, f.size.d, f.position, 0x3d2a1e, 0);
        }

        // TODO: The rest of the house (doors, hiding spots, stairs) needs to be built from server data too.
        // This is a temporary state.
        return { navPoints: this.navPoints, hidingSpots: this.hidingSpots };
    }
    
    createRoom(room, floorLights) {
        // Floor
        this.createBox(room.w, 0.2, room.d, { x: room.x + room.w/2, y: room.y, z: room.z + room.d/2 }, 0x5a5a5a);
        // Ceiling
        this.createBox(room.w, 0.2, room.d, { x: room.x + room.w/2, y: room.y + 4, z: room.z + room.d/2 }, 0x5a5a5a);
        const navPoint = new THREE.Vector3(room.x + room.w/2, room.y + 1, room.z + room.d/2);
        this.navPoints.push(navPoint);
        this.addDebugSphere(navPoint, 0.3, 0xffff00);

        ['north', 'south', 'west', 'east'].forEach(side => this.createWall(room, side));
        
        const hidingSpot = new Closet(this.scene, new THREE.Vector3(room.x + 1, room.y, room.z + 1));
        this.hidingSpots.push(hidingSpot);

        // Add a throwable object randomly
        if (this.rng.next() > 0.5) {
            const boxPos = { x: room.x + this.rng.nextFloat(2, 8), y: room.y + 0.25, z: room.z + this.rng.nextFloat(2, 8) };
            this.createBox(0.5, 0.5, 0.5, boxPos, 0x999999, 2, { isThrowable: true });
        }

        const light = new THREE.PointLight(0xffddaa, 1, 15, 2);
        light.position.set(navPoint.x, navPoint.y + 2.5, navPoint.z);
        light.castShadow = true;
        this.scene.add(light);
        floorLights.push(light);
        this.lights.push(light);
    }
    
    createWall(room, side) {
        if (this.rng.next() > 0.4) {
            const door = new Door(this.scene, this.physicsWorld, room, side, this.audioBus);
            const doorId = this.doorCounter++;
            door.mesh.userData.doorId = doorId;
            this.doorObjects[doorId] = door;
        } else {
            const wallHeight = 4;
            const pos = {x:0, y: room.y + wallHeight / 2, z:0};
            let w=0, h=wallHeight, d=0.2;
            if (side === 'north' || side === 'south') {
                w = room.w; d = 0.2;
                pos.x = room.x + room.w / 2;
                pos.z = side === 'north' ? room.z : room.z + room.d;
            } else {
                w = 0.2; d = room.d;
                pos.z = room.z + room.d / 2;
                pos.x = side === 'west' ? room.x : room.x + room.w;
            }
            this.createBox(w,h,d,pos);
        }
    }
    
    createStairs(pos) {
        for (let i = 0; i < 10; i++) {
            this.createBox(3, 0.5, 1, { x: pos.x, y: pos.y + i * 0.5, z: pos.z + i * 1 }, 0x6b4a2b);
        }
        this.navPoints.push(new THREE.Vector3(pos.x, pos.y, pos.z), new THREE.Vector3(pos.x, pos.y + 5, pos.z + 10));
    }

    createBox(w, h, d, pos, color = 0xaaaaaa, mass = 0, options = {}) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
        mesh.position.set(pos.x, pos.y, pos.z);
        mesh.castShadow = true; mesh.receiveShadow = true;
        this.scene.add(mesh);

        if (options.isThrowable) {
            mesh.userData.isThrowable = true;
            mesh.userData.prompt = "Pick Up";
            this.throwableMeshes[mesh.uuid] = mesh;
        }

        if (mass >= 0) {
            const body = new CANNON.Body({ mass, material: this.wallMaterial, shape: new CANNON.Box(new CANNON.Vec3(w/2, h/2, d/2)) });
            body.position.copy(mesh.position);
            this.physicsWorld.addBody(body);
            mesh.userData.physicsBody = body; // Link mesh to body
            body.userData = { mesh }; // Link body to mesh
        }
    }

    createGround(w, d) { this.createBox(w, 0.2, d, {x:w/2, y:-0.1, z:d/2}, 0x333333); }
    addDebugSphere(pos, size, color) { this.debugLines.add(new THREE.Mesh(new THREE.SphereGeometry(size, 8, 8), new THREE.MeshBasicMaterial({ color, wireframe: true }))).position.copy(pos); }
    toggleDebugView() { this.debugLines.visible = !this.debugLines.visible; }
    getRandomSpawnPoint() { return this.rng.pick(this.navPoints) || new THREE.Vector3(5, 1, 5); }
}

export default HouseGen;
