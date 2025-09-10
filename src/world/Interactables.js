import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Interactable {
    constructor() {
        this.prompt = "Interact";
    }
    onInteract(player) { console.log("Interacted with a generic object."); }
}

export class Door extends Interactable {
    constructor(scene, physicsWorld, room, side, audioBus) {
        super();
        this.audioBus = audioBus;
        this.isOpen = false;
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

    onInteract() {
        if (this.isLocked) {
            // Play locked sound
            return;
        }
        this.isOpen = !this.isOpen;
        this.pivot.rotation.y += this.isOpen ? Math.PI / 2 : -Math.PI / 2;

        this.body.collisionResponse = !this.isOpen;
        // A bit of a hack: move the body far away when open
        if (this.isOpen) {
            this.body.position.set(1000, 1000, 1000);
        } else {
            this.updatePhysicsBody();
        }

        this.prompt = this.isOpen ? "Close Door" : "Open Door";
        this.audioBus.playSoundAt(this.pivot.position, 'door_creak', 0.5);
    }
}

export class FuseBox extends Interactable {
    constructor(scene, position, lights, audioBus) {
        super();
        this.lights = lights;
        this.audioBus = audioBus;
        this.areLightsOn = true;
        this.prompt = "Cut Power";

        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.2), new THREE.MeshStandardMaterial({ color: 0x555555 }));
        mesh.position.copy(position);
        mesh.userData.interactable = this;
        scene.add(mesh);
        this.mesh = mesh;
    }
    
    onInteract() {
        this.areLightsOn = !this.areLightsOn;
        this.lights.forEach(light => light.visible = this.areLightsOn);
        this.prompt = this.areLightsOn ? "Cut Power" : "Restore Power";
        this.audioBus.playSoundAt(this.mesh.position, 'switch_flick', 1);
    }
}
