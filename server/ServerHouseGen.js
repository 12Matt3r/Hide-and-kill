import { v4 as uuidv4 } from 'uuid';

// A simplified, server-side only version of HouseGen
// It only generates the data for objects that need to be state-managed.
class ServerHouseGen {
    constructor(seed) {
        // In a real implementation, we'd use the seed for deterministic randomness.
        this.seed = seed;
    }

    generate() {
        const throwables = {};
        const doors = {};
        const furniture = [];
        const walls = [];
        const floors = [];
        const fuseBoxes = {};
        const rooms = [
            { x: 0, z: 0, w: 10, d: 10, y: 0 },
            { x: 12, z: 0, w: 10, d: 10, y: 0 },
            { x: 0, z: 12, w: 10, d: 10, y: 0 },
            { x: 12, z: 12, w: 10, d: 10, y: 0 },
        ];

        for (const room of rooms) {
            // Floor
            floors.push({ p: { x: room.x + room.w/2, y: room.y, z: room.z + room.d/2 }, s: { w: room.w, h: 0.2, d: room.d }});
            // Ceiling
            floors.push({ p: { x: room.x + room.w/2, y: room.y + 4, z: room.z + room.d/2 }, s: { w: room.w, h: 0.2, d: room.d }});

            // Walls
            walls.push({ p: {x: room.x + room.w/2, y: room.y + 2, z: room.z}, s: {w: room.w, h: 4, d: 0.2} }); // North
            // Not adding a south wall to leave room for a door
            walls.push({ p: {x: room.x, y: room.y + 2, z: room.z + room.d/2}, s: {w: 0.2, h: 4, d: room.d} }); // West
            walls.push({ p: {x: room.x + room.w, y: room.y + 2, z: room.z + room.d/2}, s: {w: 0.2, h: 4, d: room.d} }); // East

            const t_id = uuidv4();
            throwables[t_id] = {
                id: t_id,
                position: { x: room.x + Math.random()*(room.w-2)+1, y: 0.25, z: room.z + Math.random()*(room.d-2)+1 },
                isHeld: false, holder: null,
            };

            // Add a door on the 'north' side of each room for simplicity
            const d_id = uuidv4();
            doors[d_id] = {
                id: d_id,
                isOpen: false,
                isLocked: false,
                isJammed: false,
                jamTimer: 0,
            };

            // Add furniture
            for (let i = 0; i < 2; i++) { // 2 pieces of furniture per room
                furniture.push({
                    type: 'table',
                    position: { x: room.x + Math.random()*6+2, y: 0, z: room.z + Math.random()*6+2 },
                    size: { w: 2, h: 0.8, d: 1.2 },
                });
            }
            // Add a fusebox to each room
            const f_id = uuidv4();
            fuseBoxes[f_id] = {
                id: f_id,
                position: { x: room.x + 1, y: room.y + 1.5, z: room.z + 1 },
                progress: 0,
                isRepaired: false,
            };
        }

        return { throwables, doors, furniture, walls, floors, fuseBoxes };
    }
}

export default ServerHouseGen;
