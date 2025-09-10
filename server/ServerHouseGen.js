import { v4 as uuidv4 } from 'uuid';
import Random from '../src/core/Random.js'; // Assuming this can be imported

// A server-side data generator that mirrors the logic of the user's new HouseGen.js
class ServerHouseGen {
  constructor(seed) {
    this.rng = new Random(seed);
    this.opts = { // Mirroring the default options
        floorsRange: [2, 3],
        roomsPerFloor: 4,
        roomSize: { x: 10, y: 10 },
        storeyHeight: 5,
        wallThickness: 0.2,
        doorChance: 0.6,
    };
    this.worldData = {
        walls: [],
        floors: [],
        doors: [],
        hidingSpots: [],
        navPoints: [],
    };
  }

  generate() {
    this._createGround(100, 100);

    const floors = this.rng.nextInt(this.opts.floorsRange[0], this.opts.floorsRange[1]);
    const roomsPerFloor = this.opts.roomsPerFloor;
    const allRooms = [];

    for (let y = 0; y < floors; y++) {
      const baseY = y * this.opts.storeyHeight;
      for (let i = 0; i < roomsPerFloor; i++) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const room = {
          x: col * (this.opts.roomSize.x + 2),
          z: row * (this.opts.roomSize.y + 2),
          w: this.opts.roomSize.x,
          d: this.opts.roomSize.y,
          y: baseY,
        };
        allRooms.push(room);
        this._createRoom(room);
      }
    }
    return this.worldData;
  }

  _createRoom(room) {
    const h = this.opts.storeyHeight - 1;
    // Floor & ceiling
    this.worldData.floors.push({ id: uuidv4(), p: { x: room.x + room.w / 2, y: room.y, z: room.z + room.d / 2 }, s: { w: room.w, h: 0.2, d: room.d } });
    this.worldData.floors.push({ id: uuidv4(), p: { x: room.x + room.w / 2, y: room.y + h, z: room.z + room.d / 2 }, s: { w: room.w, h: 0.2, d: room.d } });
    // Navpoint
    this.worldData.navPoints.push({ x: room.x + room.w / 2, y: room.y + 1, z: room.z + room.d / 2 });
    // Hiding spot
    this.worldData.hidingSpots.push({ id: uuidv4(), p: { x: room.x + 1, y: room.y, z: room.z + 1 }, type: 'closet' });
    // Walls
    this._createWallOrDoor(room, 'north', h);
    this._createWallOrDoor(room, 'south', h);
    this._createWallOrDoor(room, 'west',  h);
    this._createWallOrDoor(room, 'east',  h);
  }

  _createWallOrDoor(room, side, wallHeight) {
    const t = this.opts.wallThickness;
    const useDoor = this.rng.next() < this.opts.doorChance;
    let pos = { x: 0, y: room.y + wallHeight / 2, z: 0 };
    let s = { w: 0, h: wallHeight, d: t };
    let r = { y: 0 };

    if (side === 'north' || side === 'south') {
      s.w = room.w;
      pos.x = room.x + room.w / 2;
      pos.z = side === 'north' ? room.z : room.z + room.d;
      if (side === 'south') r.y = Math.PI;
    } else {
      s.d = room.d;
      s.w = t;
      pos.z = room.z + room.d / 2;
      pos.x = side === 'west' ? room.x : room.x + room.w;
       if (side === 'west') r.y = -Math.PI / 2;
       else r.y = Math.PI / 2;
    }

    if (useDoor) {
      this.worldData.doors.push({ id: uuidv4(), p: pos, s: {w: 1, h: 2.2, d: 0.1}, r: r, isOpen: false, isLocked: false, isJammed: false, jamTimer: 0 });
    } else {
      this.worldData.walls.push({ id: uuidv4(), p: pos, s: s, isWeak: Math.random() < 0.2 });
    }
  }

  _createGround(w, d) {
    this.worldData.floors.push({ id: uuidv4(), p: { x: w / 2, y: -0.1, z: d / 2 }, s: { w: w, h: 0.2, d: d } });
  }
}

export default ServerHouseGen;
