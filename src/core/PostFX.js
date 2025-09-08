import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
import { GlitchPass } from 'three/addons/postprocessing/GlitchPass.js';

class PostFX {
    constructor(renderer, scene, camera) {
        this.composer = new EffectComposer(renderer);
        this.camera = camera;
        this.composer.addPass(new RenderPass(scene, camera));

        this.bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.4, 0.5, 0.1);
        this.composer.addPass(this.bloomPass);

        this.filmPass = new FilmPass(0.35, 0.5, 2048, false);
        this.composer.addPass(this.filmPass);

        this.glitchPass = new GlitchPass();
        this.glitchPass.enabled = false;
        this.composer.addPass(this.glitchPass);
        
        this.shakeIntensity = 0;
    }

    setBloomEnabled(enabled) {
        this.bloomPass.enabled = enabled;
    }

    update(sanity, isEarthquake) {
        const sanityEffect = (100 - sanity) / 100;
        this.filmPass.uniforms['nIntensity'].value = sanityEffect * 0.8;
        this.filmPass.uniforms['sIntensity'].value = sanityEffect * 1.2;

        if (sanity < 40 && Math.random() < 0.05) {
            this.glitchPass.enabled = true;
            setTimeout(() => { this.glitchPass.enabled = false; }, 100 + Math.random() * 200);
        }
        
        this.shakeIntensity = Math.max(0, this.shakeIntensity - 0.02);
        if (isEarthquake) this.shakeIntensity = 1;

        if(this.shakeIntensity > 0) {
            this.camera.position.x += (Math.random() - 0.5) * 0.1 * this.shakeIntensity;
            this.camera.position.y += (Math.random() - 0.5) * 0.1 * this.shakeIntensity;
        }
    }
}

export default PostFX;
