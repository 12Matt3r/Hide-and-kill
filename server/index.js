import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import GameState from '../src/net/state.js';
import ServerHouseGen from './ServerHouseGen.js';
import gameConfig from '../config/game.config.json' assert { type: 'json' };

// Main Server Logic
const server = new WebSocketServer({ port: 8080 });
const rooms = {};
console.log("WebSocket server started on port 8080");

function gameLoop(roomId) {
    const room = rooms[roomId];
    if (!room) return;
    const { gameState, clients } = room;
    const deltaTime = 1 / 20;
    gameState.matchTimer -= deltaTime;

    if (gameState.matchTimer <= 0 && gameState.matchPhase !== 'ended') {
        transitionPhase(gameState);
    }

    // TODO: Re-implement AI updates and other server-side logic here.

    const message = JSON.stringify({ type: 'gameState', payload: gameState });
    clients.forEach(client => { if (client.readyState === 1) client.send(message); });
}

function transitionPhase(gameState) {
    switch (gameState.matchPhase) {
        case 'setup':
            gameState.setPhase('hunt', gameConfig.match.huntSec);
            break;
        case 'hunt':
            gameState.setPhase('showdown', gameConfig.match.showdownSec);
            break;
        case 'showdown':
            gameState.winner = 'survivors';
            gameState.setPhase('ended');
            break;
    }
}

server.on('connection', ws => {
    const clientId = uuidv4();
    ws.clientId = clientId;
    console.log(`Client ${clientId} connected.`);

    ws.on('message', message => {
        const data = JSON.parse(message);
        let room = rooms[ws.roomId];

        switch (data.type) {
            case 'ping':
                ws.send(JSON.stringify({ type: 'pong' }));
                break;
            case 'joinRoom':
                const roomId = 'default_room';
                if (!rooms[roomId]) {
                    const houseGen = new ServerHouseGen(Date.now());
                    const worldData = houseGen.generate();
                    const newGameState = new GameState();
                    Object.assign(newGameState, worldData);
                    newGameState.setPhase('setup', gameConfig.match.setupSec);

                    rooms[roomId] = {
                        id: roomId,
                        clients: new Set(),
                        gameState: newGameState,
                        interval: setInterval(() => gameLoop(roomId), 1000 / 20)
                    };
                }
                room = rooms[roomId];
                room.clients.add(ws);
                ws.roomId = roomId;

                room.gameState.addSurvivor(clientId);
                console.log(`Client ${clientId} joined room ${roomId}`);
                break;

            case 'playerUpdate':
                if (room) {
                    const survivor = room.gameState.survivors[clientId];
                    if (survivor) {
                        survivor.position = data.payload.position;
                        survivor.rotation = data.payload.rotation;
                    }
                }
                break;
        }
    });

    ws.on('close', () => {
        const room = rooms[ws.roomId];
        if (room) {
            room.clients.delete(ws);
            if (room.gameState.survivors[ws.clientId]) {
                delete room.gameState.survivors[ws.clientId];
                room.gameState.livingSurvivorCount--;
            }
            if (room.clients.size === 0) {
                clearInterval(room.interval);
                delete rooms[ws.roomId];
            }
        }
        console.log(`Client ${clientId} disconnected.`);
    });
});
