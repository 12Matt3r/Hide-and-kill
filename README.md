# House of Last Light

Welcome to **House of Last Light**, a low-poly, multiplayer horror hide-and-seek game. One player takes on the role of a terrifying Killer, while the others play as resourceful Survivors. Built with Three.js, Cannon-es, and a custom WebSocket server, this project is a showcase of modern web-based 3D game development.

## Features

*   **Asymmetric Multiplayer:** A tense 1-vs-many gameplay loop.
*   **Procedural World Generation:** Every match features a unique, procedurally generated house layout, created authoritatively by the server.
*   **Dynamic Objectives:** Survivors must work together to repair a set of fuse boxes to power the exit and escape.
*   **Skill-Based Interactions:** Repairing objectives requires passing timed skill checks, adding a layer of risk and engagement.
*   **Advanced Player Abilities:** Choose from different Survivor and Killer archetypes, each with unique abilities that change the strategic landscape.
*   **Impactful Disasters:** Random, server-driven events like floods and earthquakes alter the map and gameplay.
*   **Immersive Audio:** A positional audio system with real-time obstruction detection means you can use your ears to track friends and foes.
*   **Ghost/Spectator Mode:** Dead players can continue to observe the match and have limited interaction with the world.

## Getting Started

To run the game, you need to run both the **server** and the **client** processes simultaneously.

### Prerequisites

*   [Node.js](https://nodejs.org/) (v16 or higher)
*   A modern web browser that supports WebSockets (Chrome, Firefox, Edge)

### 1. Run the Server

The server handles all game logic, physics, and state management.

1.  Open a terminal and navigate to the `/server` directory:
    ```bash
    cd server
    ```
2.  Install the required dependencies:
    ```bash
    npm install
    ```
3.  Start the server:
    ```bash
    npm start
    ```

You should see the message `WebSocket server started on port 8080`. The server is now running.

### 2. Run the Client

The client is a static web application that renders the game.

1.  Open a **second, separate terminal** and navigate to the **root directory** of the project.
2.  Run a simple static file server. If you have Python installed, you can use its built-in server:
    ```bash
    # In the project's root directory
    python -m http.server 8000
    ```
    Alternatively, if you have Node.js, you can use the `serve` package:
    ```bash
    # In the project's root directory
    npx serve .
    ```

### 3. Play the Game

1.  Open your web browser and navigate to: `http://localhost:8000/public/`
2.  The main menu will appear. You can enter a custom seed for the house generation or leave it blank for a random one.
3.  Click "Continue" and choose your Survivor character.
4.  The game will start and connect to the server. You can open multiple browser tabs to have multiple players join the same match.

## How to Play

### Controls
*   **W, A, S, D**: Move
*   **Mouse**: Look
*   **Left Shift**: Sprint
*   **C / Ctrl**: Crouch
*   **E**: Interact (Open Doors, Repair Fuse Boxes)
*   **Left Mouse Button**: Use equipped item (Finisher Tool, Throw Object)
*   **F**: Use Character Ability (e.g., Scout's Ping)
*   **ESC**: Pause / Release Mouse

### Gameplay Loop
A match in House of Last Light is divided into several phases:
1.  **Setup Phase:** Survivors spawn and have a short time to explore the house and find hiding spots before the Killer appears.
2.  **Hunt Phase:** The Killer is released and begins hunting the Survivors.
3.  **Showdown Phase:** When only one Survivor remains, they are granted a "Finisher Tool" and have a chance to fight back and win the game.
4.  **Collapse Phase:** If the Survivors complete all objectives, the Endgame Collapse begins. A 2-minute timer starts, the Killer gets a speed boost, and the house begins to fall apart. Survive the timer to win.

### Objectives
The primary objective for Survivors is to find and repair **3 fuse boxes** scattered throughout the house. To repair a box, approach it and hold down the `E` key. While repairing, you will be periodically prompted with a **Skill Check**. Press the `Spacebar` at the right time to succeed. Failing a skill check will regress the repair progress and create a loud noise, alerting the Killer to your location.

## Architecture Overview

This project uses a modern, authoritative client-server architecture.
*   **Server:** The Node.js server in the `/server` directory is the single source of truth. It runs the game loop, manages all game state (player positions, objectives, etc.), simulates physics for key objects, and runs the Killer AI.
*   **Client:** The client-side application in `/src` is a "dumb" renderer. It receives game state snapshots from the server 20 times per second and renders the world based on that data. It does not contain any game logic and only sends player inputs (intents) to the server for validation.
*   **Networking:** Communication is handled via WebSockets, using a custom, production-ready client module that features heartbeats, auto-reconnect, and a message queue.
