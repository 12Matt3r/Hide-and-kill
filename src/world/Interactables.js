import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Interactable {
    constructor() {
        this.prompt = "Interact";
    }
    onInteract(player, gameState) { console.log("Interacted with a generic object."); }
}

export class Door extends Interactable {
    constructor(scene, physicsWorld, room, side, audioBus) {
        super();
        this.audioBus = audioBus;
        this.isOpen = false; // This will be overwritten by server state
        this.isLocked = false;
        this.prompt = "Open Door";

        const doorSize = { w: 1, h: 2.2, d: 0.1 };
        const pivot = new THREE.Object3D();
        const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(doorSize.w, doorSize.h, doorSize.d), new THREE.MeshStandardMaterial({ color: 0x8c5a2b }));
        doorMesh.position.x = doorSize.w / 2;
        pivot.add(doorMesh);
        scene.add(pivot);

        let pos, rotY;
        const wallThickness = 0.2;
        switch (side) {
            case 'north': pos = { x: room.x + room.w / 2 - doorSize.w/2, z: room.z }; rotY = 0; break;
            case 'south': pos = { x: room.x + room.w / 2 - doorSize.w/2, z: room.z + room.d }; rotY = Math.PI; break;
            case 'west':  pos = { x: room.x, z: room.z + room.d / 2 - doorSize.w/2}; rotY = -Math.PI / 2; break;
            case 'east':  pos = { x: room.x + room.w, z: room.z + room.d / 2 - doorSize.w/2}; rotY = Math.PI / 2; break;
        }

        pivot.position.set(pos.x, room.y + doorSize.h / 2, pos.z);
        pivot.rotation.y = rotY;
        
        doorMesh.castShadow = true;
        doorMesh.userData.interactable = this;
        
        const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(doorSize.w/2, doorSize.h/2, doorSize.d/2)) });
        physicsWorld.addBody(body);
        
        this.pivot = pivot;
        this.mesh = doorMesh;
        this.body = body;
        this.updatePhysicsBody();
    }
    
    updatePhysicsBody() {
        const worldPosition = new THREE.Vector3();
        const worldQuaternion = new THREE.Quaternion();
        this.mesh.getWorldPosition(worldPosition);
        this.mesh.getWorldQuaternion(worldQuaternion);
        this.body.position.copy(worldPosition);
        this.body.quaternion.copy(worldQuaternion);
    }

    onInteract(player, gameState) {
        const doorId = this.mesh.userData.doorId;
        const doorState = gameState.doors[doorId];

        if (!doorState) return;

        if (doorState.isJammed) {
            this.audioBus.playSoundAt(this.pivot.position, 'door_jammed', 1);
            return;
        }
        if (doorState.isLocked) {
            this.audioBus.playSoundAt(this.pivot.position, 'door_locked', 1);
            return;
        }

        // Send interaction to server instead of changing state locally
        player.client.send('toggleDoor', { doorId: doorId });
    }

    // This method will be called by the Engine to sync state
    syncState(doorState) {
        if (this.isOpen !== doorState.isOpen) {
            this.isOpen = doorState.isOpen;
            this.pivot.rotation.y += this.isOpen ? Math.PI / 2 : -Math.PI / 2;
            this.body.collisionResponse = !this.isOpen;
            if (this.isOpen) {
                this.body.position.set(1000, 1000, 1000);
            } else {
                this.updatePhysicsBody();
            }
            this.audioBus.playSoundAt(this.pivot.position, 'door_creak', 0.5);
        }
        this.isLocked = doorState.isLocked;
        this.prompt = doorState.isJammed ? "Jammed" : (this.isOpen ? "Close Door" : "Open Door");
    }
}

export class FuseBox extends Interactable {
    constructor(scene, mesh) {
        super();
        this.scene = scene;
        this.mesh = mesh;
        this.prompt = "Repair Fuse Box";
    }
    
    // onInteract is now handled by the PlayerController for timed interactions
}
