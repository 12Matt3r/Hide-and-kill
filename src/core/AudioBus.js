import * as THREE from 'three';

class AudioBus {
    constructor(camera) {
        this.camera = camera;
        this.initialized = false;
        this.soundSources = new Map();
    }

    init() {
        if (this.initialized) return;
        this.listener = new THREE.AudioListener();
        this.camera.add(this.listener);
        this.ctx = this.listener.context;

        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.listener.gain);
        
        this.heartbeat = this.createHeartbeat();
        this.initialized = true;
        console.log("Audio Context Initialized.");
    }
    
    createHeartbeat() {
        const source = this.ctx.createBufferSource();
        const buffer = this.ctx.createBuffer(2, this.ctx.sampleRate * 1.5, this.ctx.sampleRate);
        const sr = this.ctx.sampleRate;
        for (let channel = 0; channel < 2; channel++) {
            const data = buffer.getChannelData(channel);
            for (let i = 0; i < sr * 0.2; i++) {
                if(i < sr * 0.1) data[i] = Math.sin(i / 10) * Math.exp(-i / 500);
            }
             for (let i = 0; i < sr * 0.2; i++) {
                if(i < sr * 0.1) data[i + Math.floor(sr*0.4)] = Math.sin(i / 10) * 0.8 * Math.exp(-i / 500);
            }
        }
        source.buffer = buffer;
        source.loop = true;
        
        const gain = this.ctx.createGain();
        gain.gain.value = 0;
        source.connect(gain).connect(this.masterGain);
        source.start();
        return gain;
    }

    playSoundAt(position, soundType, volume = 1, props = {}) {
        if (!this.initialized) return;
        
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(volume, this.ctx.currentTime);

        let source;
        let isGlobal = false;
        
        switch(soundType) {
            case 'footstep':
                source = this.ctx.createOscillator();
                source.type = 'sawtooth';
                source.frequency.setValueAtTime(100, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
                source.start();
                source.stop(this.ctx.currentTime + 0.1);
                break;
            case 'door_creak':
                source = this.ctx.createOscillator();
                source.type = 'sawtooth';
                source.frequency.setValueAtTime(200, this.ctx.currentTime);
                source.frequency.linearRampToValueAtTime(150, this.ctx.currentTime + 0.5);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
                source.start();
                source.stop(this.ctx.currentTime + 0.5);
                break;
            case 'switch_flick':
                 source = this.ctx.createBufferSource();
                 const sbuf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.05, this.ctx.sampleRate);
                 const sdata = sbuf.getChannelData(0);
                 for (let i=0; i < sdata.length; i++) sdata[i] = Math.random() * 2 - 1;
                 source.buffer = sbuf;
                 source.start();
                 break;
            case 'thunder':
                const thunderSource = this.ctx.createBufferSource();
                const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 3, this.ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < data.length; i++) data[i] = (Math.random()*2-1) * Math.pow(1 - i/data.length, 2);
                thunderSource.buffer = buffer;
                thunderSource.connect(gain).connect(this.masterGain); // thunder is global
                thunderSource.start();
                return;
        }
        
        if (isGlobal) {
            source.connect(gain).connect(this.masterGain);
        } else {
            const panner = this.ctx.createPanner();
            panner.panningModel = 'HRTF';
            panner.distanceModel = 'inverse';
            panner.refDistance = 1;
            panner.maxDistance = 100;
            panner.rolloffFactor = 2;
            panner.positionX.setValueAtTime(position.x, this.ctx.currentTime);
            panner.positionY.setValueAtTime(position.y, this.ctx.currentTime);
            panner.positionZ.setValueAtTime(position.z, this.ctx.currentTime);
            source.connect(gain).connect(panner).connect(this.masterGain);
        }
    }

    playMusic(volume) {
        if (!this.initialized) return;
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = 40;
        const gain = this.ctx.createGain();
        gain.gain.value = volume;
        osc.connect(gain).connect(this.masterGain);
        osc.start();
    }

    update(playerPosition, killerPosition) {
        if (!this.initialized) return;
        this.listener.position.copy(playerPosition);
        const distance = playerPosition.distanceTo(killerPosition);
        const heartbeatVolume = Math.max(0, 1 - (distance / 15));
        this.heartbeat.gain.linearRampToValueAtTime(heartbeatVolume * 0.8, this.ctx.currentTime + 0.1);
    }
}

export default AudioBus;
