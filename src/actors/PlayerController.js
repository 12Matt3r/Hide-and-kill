import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import Input from '../core/Input.js';

class PlayerController {
    constructor(camera, physicsWorld, scene, localPlayerState, config, audioBus) {
        this.camera = camera; this.physicsWorld = physicsWorld; this.scene = scene;
        this.state = localPlayerState; this.config = config; this.audioBus = audioBus;
        this.input = Input;
        this.height = 1.8; this.crouchHeight = 1.2;
        this.currentHidingSpot = null;
        this.footstepTimer = 0;
        
        this.pitchObject = new THREE.Object3D(); this.pitchObject.add(this.camera);
        this.yawObject = new THREE.Object3D(); this.yawObject.add(this.pitchObject);
        
        this.setupPhysics(); this.setupControls(); this.setupInteraction();
    }
    
    setupPhysics() {
        this.capsuleShape = new CANNON.Sphere(0.4);
        this.body = new CANNON.Body({ mass: 70, shape: this.capsuleShape, linearDamping: 0.95, angularDamping: 1.0, allowSleep: false });
        this.body.position.set(0, 5, 0); this.physicsWorld.addBody(this.body);
    }

    setupControls() {
        const onMouseMove = (e) => {
            this.yawObject.rotation.y -= (e.movementX || 0) * 0.002;
            this.pitchObject.rotation.x -= (e.movementY || 0) * 0.002;
            this.pitchObject.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitchObject.rotation.x));
        };
        document.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement) document.addEventListener('mousemove', onMouseMove, false);
            else document.removeEventListener('mousemove', onMouseMove, false);
        });
    }
    
    setupInteraction() {
        this.raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, 0, -1), 0, 3);
        this.interactionPrompt = document.getElementById('interaction-prompt');
    }

    getObject() { return this.yawObject; }
    setPosition(x, y, z) { this.body.position.set(x, y, z); }

    update(deltaTime, killerPosition) {
        const isCrouched = this.input.isKeyDown('KeyC') || this.input.isKeyDown('ControlLeft');
        if (isCrouched !== this.state.isCrouched) this.toggleCrouch(isCrouched);
        
        if (this.state.isHiding) {
            if (this.input.isKeyJustPressed('KeyE')) this.exitHidingSpot();
        } else {
            this.updateMovement(deltaTime);
            this.updateInteraction();
        }
        
        this.updateSanity(deltaTime, killerPosition);
        this.yawObject.position.copy(this.body.position).y += (this.state.isCrouched ? this.crouchHeight : this.height) / 2 - 0.5;
        this.input.resetJustPressed();
    }
    
    setDisasters(disasters) {
        this.disasters = disasters;
    }

    updateMovement(deltaTime) {
        const isSprinting = this.input.isKeyDown('ShiftLeft') && this.state.stamina > 0 && !this.state.isCrouched;
        let currentSpeed = this.state.isCrouched ? this.config.crouch : this.config.walk;
        if (isSprinting) currentSpeed = this.config.run;
        
        if (isSprinting) this.state.stamina = Math.max(0, this.state.stamina - 20 * deltaTime);
        else this.state.stamina = Math.min(100, this.state.stamina + this.config.staminaRegen * 10 * deltaTime);

        const inputVelocity = new THREE.Vector3();
        if (this.input.isKeyDown('KeyW')) inputVelocity.z = -1; if (this.input.isKeyDown('KeyS')) inputVelocity.z = 1;
        if (this.input.isKeyDown('KeyA')) inputVelocity.x = -1; if (this.input.isKeyDown('KeyD')) inputVelocity.x = 1;

        if (inputVelocity.lengthSq() > 0) {
            inputVelocity.normalize().applyEuler(this.yawObject.rotation);
            const forceMultiplier = 3000;
            const force = new CANNON.Vec3(inputVelocity.x * currentSpeed * forceMultiplier * deltaTime, 0, inputVelocity.z * currentSpeed * forceMultiplier * deltaTime);
            this.body.applyForce(force, this.body.position);
            
            this.footstepTimer -= deltaTime;
            if (this.footstepTimer <= 0) {
                const waterLevel = this.disasters ? this.disasters.getWaterLevel() : -100;
                const isInWater = this.body.position.y < waterLevel + 0.5;
                const sound = isInWater ? 'splash' : 'footstep';
                const volume = this.state.isCrouched ? 0.2 : (isSprinting ? 1 : 0.5);
                this.audioBus.playSoundAt(this.body.position, sound, volume * (isInWater ? 1.2 : 1));
                this.footstepTimer = isSprinting ? 0.3 : (this.state.isCrouched ? 0.8 : 0.5);
            }
        }
    }
    
    toggleCrouch(isCrouching) {
        this.state.isCrouched = isCrouching;
    }
    
    updateInteraction() {
        this.raycaster.setFromCamera({x: 0, y: 0}, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        const interactable = intersects.find(i => i.object.userData.interactable)?.object.userData.interactable;
        
        this.interactionPrompt.innerText = interactable ? `[E] ${interactable.prompt}` : '';
        if (interactable && this.input.isKeyJustPressed('KeyE')) interactable.onInteract(this);
    }
    
    updateSanity(deltaTime, killerPosition) {
        const distance = this.body.position.distanceTo(killerPosition);
        let drain = this.state.isHiding ? this.config.sanityDrain * 1.5 : 0;
        if (distance < 10) drain += (10 - distance) * 0.2;
        this.state.sanity = Math.max(0, this.state.sanity - drain * deltaTime);
    }
    
    enterHidingSpot(spot) {
        this.state.isHiding = true; this.currentHidingSpot = spot;
        this.body.type = CANNON.Body.STATIC;
        this.body.position.copy(spot.hidingPosition);
    }
    
    exitHidingSpot() {
        if (!this.currentHidingSpot) return;
        this.state.isHiding = false; this.body.type = CANNON.Body.DYNAMIC;
        this.body.position.x += 1; // Eject from spot
        this.currentHidingSpot.onExit(); this.currentHidingSpot = null;
    }
}

export default PlayerController;
