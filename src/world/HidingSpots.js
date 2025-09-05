import * as THREE from 'three';
import { Interactable } from './Interactables.js';

class HidingSpot extends Interactable {
    constructor(scene, position, prompt) {
        super();
        this.scene = scene;
        this.position = position;
        this.prompt = prompt;
        this.isOccupied = false;
        this.hidingPosition = position.clone().add(new THREE.Vector3(0, 0.5, 0)); // Inside the object
    }
    
    onInteract(playerController) {
        if (this.isOccupied) return;
        playerController.enterHidingSpot(this);
        this.isOccupied = true;
    }
    
    onExit() { this.isOccupied = false; }
}

export class Closet extends HidingSpot {
    constructor(scene, position) {
        super(scene, position, "Hide in Closet");
        const geo = new THREE.BoxGeometry(1.5, 3, 1.2);
        const mat = new THREE.MeshStandardMaterial({ color: 0x4a2a0a });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.copy(this.position);
        this.mesh.position.y += 1.5;
        this.mesh.castShadow = true;
        this.mesh.userData.interactable = this;
        this.scene.add(this.mesh);
    }
}
