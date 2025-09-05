// Mulberry32 algorithm
class Random {
    constructor(seed) { this.seed = seed; }
    next() {
        let t = this.seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
    nextInt(min, max) { return Math.floor(this.next() * (max - min + 1)) + min; }
    pick(arr) { return arr[this.nextInt(0, arr.length - 1)]; }
}

export default Random;
