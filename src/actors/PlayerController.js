import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import Input from '../core/Input.js';

class PlayerController {
    constructor(camera, physicsWorld, scene, localPlayerState, config, audioBus, client) {
        this.camera = camera; this.physicsWorld = physicsWorld; this.scene = scene;
        this.state = localPlayerState; this.config = config; this.audioBus = audioBus;
        this.client = client;
        this.input = Input;
        this.height = 1.8; this.crouchHeight = 1.2;
        this.currentHidingSpot = null;
        this.heldObject = null;
        this.footstepTimer = 0;
        this.hallucinationTimer = 5; // Start with a delay
        this.isGhost = false;
        
        this.pitchObject = new THREE.Object3D(); this.pitchObject.add(this.camera);
        this.yawObject = new THREE.Object3D(); this.yawObject.add(this.pitchObject);
        
        this.setupPhysics();
        this.setupControls();
        this.setupInteraction();
        this.setupHallucinations();
    }

    setupHallucinations() {
        const geo = new THREE.CylinderGeometry(0.5, 0.8, 2.8, 8);
        const mat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false });
        this.ghostKiller = new THREE.Mesh(geo, mat);
        this.ghostKiller.visible = false;
        this.scene.add(this.ghostKiller);
    }
    
    setupPhysics() {
        this.capsuleShape = new CANNON.Sphere(0.4);
        this.body = new CANNON.Body({ mass: 70, shape: this.capsuleShape, linearDamping: 0.95, angularDamping: 1.0, allowSleep: false });
        this.body.position.set(0, 5, 0); this.physicsWorld.addBody(this.body);
    }

    setupControls() {
        const onMouseMove = (e) => {
            if (document.pointerLockElement) {
                this.yawObject.rotation.y -= (e.movementX || 0) * 0.002;
                this.pitchObject.rotation.x -= (e.movementY || 0) * 0.002;
                this.pitchObject.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitchObject.rotation.x));
            }
        };

        const onMouseDown = (e) => {
            if (!document.pointerLockElement || e.button !== 0) return;

            if (this.isGhost) {
                const raycaster = new THREE.Raycaster();
                raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
                const intersects = raycaster.intersectObjects(this.scene.children, true);
                if (intersects.length > 0) {
                    this.client.send('ghostWhisper', { position: intersects[0].point.toArray() });
                }
            } else if (this.heldObject) {
                this.throwObject();
            } else if (this.state.hasFinisherTool) {
                this.client.send('useFinisherTool', { direction: this.camera.getWorldDirection(new THREE.Vector3()).toArray() });
                this.state.hasFinisherTool = false;
            }
        };

        document.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement) {
                document.addEventListener('mousemove', onMouseMove, false);
                document.addEventListener('mousedown', onMouseDown, false);
            } else {
                document.removeEventListener('mousemove', onMouseMove, false);
                document.removeEventListener('mousedown', onMouseDown, false);
            }
        });
    }
    
    setupInteraction() {
        this.raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, 0, -1), 0, 3);
        this.interactionPrompt = document.getElementById('interaction-prompt');
    }

    getObject() { return this.yawObject; }
    setPosition(x, y, z) { this.body.position.set(x, y, z); }

    update(deltaTime, killerPosition, gameState) {
        const isCrouched = this.input.isKeyDown('KeyC') || this.input.isKeyDown('ControlLeft');
        if (isCrouched !== this.state.isCrouched) this.toggleCrouch(isCrouched);
        
        if (this.state.isHiding) {
            if (this.input.isKeyJustPressed('KeyE')) this.exitHidingSpot();
        } else {
            this.updateMovement(deltaTime);
            this.updateInteraction(gameState);
        }
        
        this.updateSanityEffects(deltaTime);
        this.yawObject.position.copy(this.body.position).y += (this.state.isCrouched ? this.crouchHeight : this.height) / 2 - 0.5;
        this.input.resetJustPressed();
    }
    
    setDisasters(disasters) {
        this.disasters = disasters;
    }

    becomeGhost() {
        this.isGhost = true;
        this.physicsWorld.removeBody(this.body);
        this.hudElement = document.getElementById('hud-container');
        if(this.hudElement) this.hudElement.style.display = 'none';
        console.log("You are now a ghost. Use LMB to whisper.");
    }

    updateMovement(deltaTime) {
        if (this.isGhost) {
            const ghostSpeed = 5;
            const inputVelocity = new THREE.Vector3();
            if (this.input.isKeyDown('KeyW')) inputVelocity.z = -1; if (this.input.isKeyDown('KeyS')) inputVelocity.z = 1;
            if (this.input.isKeyDown('KeyA')) inputVelocity.x = -1; if (this.input.isKeyDown('KeyD')) inputVelocity.x = 1;
            if (this.input.isKeyDown('Space')) inputVelocity.y = 1; if (this.input.isKeyDown('ShiftLeft')) inputVelocity.y = -1;

            if (inputVelocity.lengthSq() > 0) {
                inputVelocity.normalize().applyEuler(this.yawObject.rotation);
                this.yawObject.position.add(inputVelocity.multiplyScalar(ghostSpeed * deltaTime));
            }
            return;
        }

        const isSprinting = this.input.isKeyDown('ShiftLeft') && this.state.stamina > 0 && !this.state.isCrouched;
        let currentSpeed = this.state.isCrouched ? this.config.crouch : this.config.walk;
        if (isSprinting) currentSpeed = this.config.run;

        if (this.state.isSlowed) {
            currentSpeed *= 0.5; // 50% speed reduction in water
        }
        
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
        if (this.heldObject) {
            this.interactionPrompt.innerText = '[LMB] Throw';
            return;
        }

        this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        const firstHit = intersects[0]?.object;

        if (firstHit && (firstHit.userData.interactable || firstHit.userData.isThrowable)) {
            const target = firstHit.userData.interactable || firstHit;
            this.interactionPrompt.innerText = `[E] ${target.userData.prompt || 'Interact'}`;
            if (this.input.isKeyJustPressed('KeyE')) {
                if (target.userData.isThrowable) {
                    this.pickupObject(target);
                } else {
                    target.onInteract(this, gameState);
                }
            }
        } else {
            this.interactionPrompt.innerText = '';
        }
    }

    pickupObject(object) {
        if (this.heldObject) return;
        this.heldObject = object;
        this.client.send('pickupObject', { objectId: object.uuid });
        
        // Hide object on client immediately
        object.visible = false;
        if (object.userData.physicsBody) {
            this.physicsWorld.removeBody(object.userData.physicsBody);
        }
    }

    throwObject() {
        if (!this.heldObject) return;
        const direction = this.camera.getWorldDirection(new THREE.Vector3()).toArray();
        this.client.send('throwObject', { objectId: this.heldObject.uuid, direction });
        this.heldObject = null;
    }

    updateSanityEffects(deltaTime) {
        this.hallucinationTimer -= deltaTime;
        if (this.hallucinationTimer > 0) return;

        const sanityPercent = this.state.sanity / 100;
        if (sanityPercent < 0.6) {
            const chance = (1 - sanityPercent) * 0.1; // Max 10% chance per second at 0 sanity
            if (Math.random() < chance * deltaTime) {
                this.hallucinationTimer = Math.random() * 4 + 2; // Reset timer regardless of which type

                if (Math.random() > 0.6) { // 40% chance of being a visual hallucination
                    // Visual
                    const randomAngle = (Math.random() - 0.5) * 2 * (Math.PI / 3) + this.yawObject.rotation.y; // In a 120deg cone in front
                    const randomDistance = Math.random() * 8 + 8; // 8-16 meters away
                    this.ghostKiller.position.set(
                        this.body.position.x + Math.sin(randomAngle) * randomDistance,
                        this.body.position.y,
                        this.body.position.z + Math.cos(randomAngle) * randomDistance
                    );
                    this.ghostKiller.lookAt(this.body.position);
                    this.ghostKiller.visible = true;
                    setTimeout(() => { this.ghostKiller.visible = false; }, 200);
                } else {
                    // Audio
                    const sound = Math.random() > 0.5 ? 'whisper' : 'footstep_ghost';
                    const randomAngle = Math.random() * Math.PI * 2;
                    const randomDistance = Math.random() * 5 + 3; // 3-8 meters away
                    const pos = new THREE.Vector3(
                        this.body.position.x + Math.cos(randomAngle) * randomDistance,
                        this.body.position.y,
                        this.body.position.z + Math.sin(randomAngle) * randomDistance
                    );
                    this.audioBus.playSoundAt(pos, sound, 0.3);
                }
            }
        }
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
