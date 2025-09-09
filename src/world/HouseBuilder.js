import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import Random from '../core/Random.js';
import { Door, FuseBox } from './Interactables.js';
import { Closet } from './HidingSpots.js';

class HouseBuilder {
    constructor(scene, physicsWorld, audioBus, throwableMeshes, doorObjects) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;
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

        for (const id in gameState.fuseBoxes) {
            const boxData = gameState.fuseBoxes[id];
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.2), new THREE.MeshStandardMaterial({ color: 0x555555 }));
            mesh.position.copy(boxData.position);
            mesh.userData.interactable = new FuseBox(this.scene, mesh);
            mesh.userData.fuseBoxId = id;
            this.scene.add(mesh);
        }

        // TODO: The rest of the house (doors, hiding spots, stairs) needs to be built from server data too.
        // This is a temporary state.
        return { navPoints: this.navPoints, hidingSpots: this.hidingSpots };
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
    getRandomSpawnPoint() { return this.navPoints[0] || new THREE.Vector3(5, 1, 5); }
}

export default HouseBuilder;
