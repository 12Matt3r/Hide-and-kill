class Pool {
    constructor(factory, initialSize = 10) {
        this.factory = factory;
        this.inactive = Array.from({ length: initialSize }, () => factory());
    }
    get() { return this.inactive.length > 0 ? this.inactive.pop() : this.factory(); }
    release(obj) { if (obj.reset) obj.reset(); this.inactive.push(obj); }
}

export default Pool;
