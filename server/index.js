import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import CANNON from 'cannon-es';
import GameState from '../src/net/state.js';
import ServerHouseGen from './ServerHouseGen.js';
import KillerBrain from '../src/actors/AI/KillerBrain.js';
import PhantomBrain from '../src/actors/AI/PhantomBrain.js';
// import BruteBrain from '../src/actors/AI/BruteBrain.js'; // For future use
import ServerDisasters from './ServerDisasters.js';
import gameConfig from '../config/game.config.json' assert { type: 'json' };

const server = new WebSocketServer({ port: 8080 });
console.log("WebSocket server started on port 8080");

const rooms = {};

function startShowdown(room) {
    if (room.gameState.matchPhase === 'showdown') return;

    room.gameState.setPhase('showdown', gameConfig.match.showdownSec);
    const lastSurvivor = Object.values(room.gameState.survivors).find(s => s.status === 'alive');
    if (lastSurvivor) {
        lastSurvivor.hasFinisherTool = true;
        console.log(`Showdown started! Survivor ${lastSurvivor.id} has the finisher tool.`);
    }
}

const gameLoop = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;

    const deltaTime = 1 / 20;
    room.disasters.update(deltaTime, room.gameState);

    // Step the physics world
    room.physicsWorld.step(deltaTime);

    // Update gameState with new physics positions
    for (const id in room.throwableBodies) {
        const body = room.throwableBodies[id];
        room.gameState.throwables[id].position = { x: body.position.x, y: body.position.y, z: body.position.z };
    }

    // Update survivor states
    const killerPos = room.gameState.killer.position;
    const waterLevel = room.gameState.waterLevel;
    for (const id in room.gameState.survivors) {
        const survivor = room.gameState.survivors[id];
        if (survivor.status === 'alive') {
            // Sanity
            const distance = Math.sqrt(Math.pow(killerPos.x - survivor.position.x, 2) + Math.pow(killerPos.z - survivor.position.z, 2));
            let drain = survivor.isHiding ? gameConfig.survivor.sanityDrain * 1.5 : 0;
            if (distance < 10) {
                drain += (10 - distance) * 0.2;
            }
            survivor.sanity = Math.max(0, survivor.sanity - drain * deltaTime);

            // Flood debuff
            survivor.isSlowed = survivor.position.y < waterLevel + 0.5;

            // Repair progress
            if (survivor.isRepairing) {
                const box = room.gameState.fuseBoxes[survivor.isRepairing];
                if (box && !box.isRepaired) {
                    const repairSpeed = survivor.type === 'technician' ? 1.15 : 1;
                    box.progress = Math.min(100, box.progress + (10 * deltaTime) * repairSpeed);
                    if (box.progress >= 100) {
                        box.isRepaired = true;
                        survivor.isRepairing = false;
                        console.log(`Fuse box ${box.id} repaired!`);
                    }
                }
            }
        }
    }

    // Check for killer catching survivor
    if (room.gameState.matchPhase === 'hunt') {
        for (const id in room.gameState.survivors) {
            const survivor = room.gameState.survivors[id];
            if (survivor.status === 'alive' && !survivor.isHiding) {
                const distance = Math.sqrt(Math.pow(killerPos.x - survivor.position.x, 2) + Math.pow(killerPos.z - survivor.position.z, 2));
                if (distance < 1.5) {
                    console.log(`Survivor ${id} was caught!`);
                    survivor.status = 'dead';
                    room.gameState.livingSurvivorCount--;
                    if (room.gameState.livingSurvivorCount === 1) {
                        startShowdown(room);
                    } else if (room.gameState.livingSurvivorCount === 0) {
                        room.gameState.winner = 'killer';
                        room.gameState.setPhase('ended');
                    }
                }
            }
        }
    }

    // Update survivor states
    let repairedBoxes = 0;
    for (const id in room.gameState.fuseBoxes) {
        const box = room.gameState.fuseBoxes[id];
        if (box.isRepaired) repairedBoxes++;
    }
    if (repairedBoxes >= 3) {
        room.gameState.winner = 'survivors';
        room.gameState.setPhase('ended');
    }

    // Update door states
    for (const id in room.gameState.doors) {
        const door = room.gameState.doors[id];
        if (door.isJammed) {
            door.jamTimer -= deltaTime;
            if (door.jamTimer <= 0) {
                door.isJammed = false;
            }
        }
    }

    const message = JSON.stringify({ type: 'gameState', payload: room.gameState });
    room.clients.forEach(client => {
        if (client.readyState === 1) { // WebSocket.OPEN
            client.send(message);
        }
    });
};

server.on('connection', ws => {
    const clientId = uuidv4();
    ws.clientId = clientId;
    console.log(`Client ${clientId} connected.`);

    ws.on('message', message => {
        const data = JSON.parse(message);

        switch (data.type) {
            case 'joinRoom':
                let roomId = data.payload.roomId || 'default';
                if (!rooms[roomId]) {
                    // Create a new room
                    const gameState = new GameState();

                    const killerTypes = ['stalker', 'phantom', 'brute'];
                    gameState.killer.type = killerTypes[Math.floor(Math.random() * killerTypes.length)];
                    console.log(`Selected killer type: ${gameState.killer.type}`);

                    const houseGen = new ServerHouseGen(Date.now());
                    const worldData = houseGen.generate();
                    gameState.throwables = worldData.throwables;
                    gameState.doors = worldData.doors;
                    gameState.furniture = worldData.furniture;
                    gameState.walls = worldData.walls;
                    gameState.floors = worldData.floors;
                    gameState.fuseBoxes = worldData.fuseBoxes;

                    const physicsWorld = new CANNON.World();
                    physicsWorld.gravity.set(0, -9.82, 0);

                    // Server-side AI brain to react to events
                    let killerBrain;
                    const houseData = { navPoints: [], hidingSpots: [] }; // Simplified for server
                    switch (gameState.killer.type) {
                        case 'phantom':
                            killerBrain = new PhantomBrain(null, houseData, gameConfig.killer);
                            break;
                        // case 'brute':
                        //     killerBrain = new BruteBrain(null, houseData, gameConfig.killer);
                        //     break;
                        default:
                            killerBrain = new KillerBrain(null, houseData, gameConfig.killer);
                    }

                    const throwableBodies = {};
                    for (const id in gameState.throwables) {
                        const obj = gameState.throwables[id];
                        const body = new CANNON.Body({ mass: 2, shape: new CANNON.Box(new CANNON.Vec3(0.25, 0.25, 0.25)) });
                        body.position.set(obj.position.x, obj.position.y, obj.position.z);
                        physicsWorld.addBody(body);
                        throwableBodies[id] = body;
                    }

                    const disasters = new ServerDisasters();

                    rooms[roomId] = {
                        clients: new Set(),
                        gameState,
                        physicsWorld,
                        throwableBodies,
                        killerBrain,
                        disasters,
                        interval: null
                    };
                    rooms[roomId].gameState.setPhase('setup', gameConfig.match.setupSec);
                    rooms[roomId].interval = setInterval(() => gameLoop(roomId), 1000 / 20); // 20 Hz
                    console.log(`Room ${roomId} created.`);
                }

                rooms[roomId].clients.add(ws);
                ws.roomId = roomId;
                rooms[roomId].gameState.addSurvivor(clientId, data.payload.charType);
                console.log(`Client ${clientId} joined room ${roomId} as a ${data.payload.charType}`);
                break;

            case 'playerUpdate':
                if (ws.roomId && rooms[ws.roomId]) {
                    const survivor = rooms[ws.roomId].gameState.survivors[clientId];
                    if (survivor) {
                        survivor.position = data.payload.position;
                        survivor.isHiding = data.payload.isHiding;
                    }
                }
                break;

            case 'startRepairing':
                if (ws.roomId && rooms[ws.roomId]) {
                    const survivor = rooms[ws.roomId].gameState.survivors[clientId];
                    if (survivor) survivor.isRepairing = data.payload.fuseBoxId;
                }
                break;

            case 'stopRepairing':
                if (ws.roomId && rooms[ws.roomId]) {
                    const survivor = rooms[ws.roomId].gameState.survivors[clientId];
                    if (survivor) survivor.isRepairing = false;
                }
                break;

            case 'pickupObject':
                if (ws.roomId && rooms[ws.roomId]) {
                    const room = rooms[ws.roomId];
                    const obj = room.gameState.throwables[data.payload.objectId];
                    if (obj && !obj.isHeld) {
                        obj.isHeld = true;
                        obj.holder = clientId;
                        // Remove body from simulation while held
                        room.physicsWorld.removeBody(room.throwableBodies[data.payload.objectId]);
                    }
                }
                break;

            case 'throwObject':
                 if (ws.roomId && rooms[ws.roomId]) {
                    const room = rooms[ws.roomId];
                    const obj = room.gameState.throwables[data.payload.objectId];
                    if (obj && obj.holder === clientId) {
                        obj.isHeld = false;
                        obj.holder = null;

                        const body = room.throwableBodies[data.payload.objectId];
                        const survivorPos = room.gameState.survivors[clientId].position;
                        body.position.set(survivorPos.x, survivorPos.y + 1, survivorPos.z);

                        const direction = new CANNON.Vec3(...data.payload.direction);
                        const impulse = direction.scale(15); // 15 is the throw force

                        room.physicsWorld.addBody(body);
                        body.applyImpulse(impulse, body.position);

                        const onCollide = (e) => {
                            console.log('Thrown object collided, notifying AI.');
                            room.killerBrain.hearNoise(e.contact.rj);
                            body.removeEventListener('collide', onCollide);
                        };
                        body.addEventListener('collide', onCollide);
                    }
                }
                break;

            case 'toggleDoor':
                if (ws.roomId && rooms[ws.roomId]) {
                    const room = rooms[ws.roomId];
                    const door = room.gameState.doors[data.payload.doorId];
                    if (door && !door.isJammed && !door.isLocked) {
                        door.isOpen = !door.isOpen;
                    }
                }
                break;

            case 'ghostWhisper':
                if (ws.roomId && rooms[ws.roomId]) {
                    const room = rooms[ws.roomId];
                    console.log(`Ghost whisper received at ${data.payload.position}`);
                    room.killerBrain.hearNoise(new CANNON.Vec3(...data.payload.position));
                }
                break;

            case 'useScoutAbility':
                if (ws.roomId && rooms[ws.roomId]) {
                    const room = rooms[ws.roomId];
                    const survivor = room.gameState.survivors[clientId];
                    if (survivor && survivor.type === 'scout' && !survivor.abilityUsed) {
                        survivor.abilityUsed = true;
                        const killerPos = room.gameState.killer.position;
                        const privateMessage = JSON.stringify({
                            type: 'scoutPing',
                            payload: { position: {x: killerPos.x, y: killerPos.y, z: killerPos.z} }
                        });
                        ws.send(privateMessage);
                    }
                }
                break;

            case 'useFinisherTool':
                if (ws.roomId && rooms[ws.roomId]) {
                    const room = rooms[ws.roomId];
                    const survivor = room.gameState.survivors[clientId];
                    if (survivor && survivor.hasFinisherTool) {
                        survivor.hasFinisherTool = false; // Consume the tool

                        const killer = room.gameState.killer;
                        const survivorPos = survivor.position;
                        const killerPos = killer.position;

                        const distance = Math.sqrt(
                            Math.pow(killerPos.x - survivorPos.x, 2) +
                            Math.pow(killerPos.y - survivorPos.y, 2) +
                            Math.pow(killerPos.z - survivorPos.z, 2)
                        );

                        if (distance < 10) { // Max range of 10 meters
                            // Simple cone check
                            const survivorToKiller = { x: killerPos.x - survivorPos.x, y: 0, z: killerPos.z - survivorPos.z };
                            const mag = Math.sqrt(survivorToKiller.x**2 + survivorToKiller.z**2);
                            survivorToKiller.x /= mag; survivorToKiller.z /= mag;

                            const forward = {x: data.payload.direction[0], z: data.payload.direction[2]};

                            const dot = survivorToKiller.x * forward.x + survivorToKiller.z * forward.z;

                            if (dot > 0.8) { // ~36 degree cone
                                console.log(`Survivor ${clientId} successfully used the finisher!`);
                                room.gameState.winner = 'survivors';
                                room.gameState.setPhase('ended');
                            } else {
                                console.log(`Survivor ${clientId} missed the finisher.`);
                            }
                        } else {
                            console.log(`Survivor ${clientId} missed the finisher.`);
                        }
                    }
                }
                break;
        }
    });

    ws.on('close', () => {
        console.log(`Client ${clientId} disconnected.`);
        const roomId = ws.roomId;
        if (roomId && rooms[roomId]) {
            rooms[roomId].clients.delete(ws);
            const room = rooms[roomId];
            delete room.gameState.survivors[clientId];
            room.gameState.livingSurvivorCount--;

            if (room.gameState.livingSurvivorCount === 1) {
                startShowdown(room);
            }

            if (room.clients.size === 0) {
                console.log(`Room ${roomId} is empty, closing.`);
                clearInterval(rooms[roomId].interval);
                delete rooms[roomId];
            }
        }
    });
});
