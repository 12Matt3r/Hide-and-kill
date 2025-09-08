# House of Last Light

A low-poly, multiplayer horror hide-and-seek game built with Three.js.

## Running the Game

This project now uses a true client-server model. You will need to run two processes simultaneously in separate terminals.

**1. Start the Server:**

First, navigate to the server directory and install its dependencies:
```bash
cd server
npm install
```
Then, start the server:
```bash
npm start
```
The server will be running on `ws://localhost:8080`.

**2. Start the Client:**

This project uses ES Modules, which require a server to run due to CORS policies. From the project's **root directory**, run a simple static file server.
A simple way is to use Python's built-in server:
```bash
# Make sure you are in the project's root directory
python -m http.server 8000
```
Or, if you have Node.js installed, you can use `serve`:
```bash
# Make sure you are in the project's root directory
npx serve .
```

**3. Play the Game:**

Open your browser and navigate to `http://localhost:8000/public/`. The game will attempt to connect to the WebSocket server automatically when you start. You can open multiple browser tabs to see multiple players join the same game.

## Controls

*   **W, A, S, D**: Move
*   **Mouse**: Look
*   **Left Shift**: Sprint
*   **C / Left Ctrl**: Crouch
*   **E**: Interact (open doors, hide)
*   **ESC**: Open Menu / Release Mouse
*   **F1**: Toggle Help (Not Implemented)
*   **F2**: Toggle House Generation Debug View
*   **F3**: Toggle Performance Stats

## Tuning the Game

You can adjust game parameters by editing `config/game.config.json`. This includes:
*   Match timings (setup, hunt, showdown)
*   Survivor and Killer speeds, stamina, etc.
*   Disaster probabilities and timing
*   Audio and post-processing settings

## Project Structure

*   `/public`: The web root.
    *   `/assets`: Contains sound effects, UI elements, and 3D models.
    *   `index.html`: The main entry point for the game.
*   `/src`: The game's source code.
    *   `/net`: Networking code (client, server, state).
    *   `/core`: Core engine components (renderer, input, audio, etc.).
    *   `/world`: World generation and interactable objects.
    *   `/actors`: Player and AI controllers.
    *   `/ui`: User interface components.
    *   `/util`: Utility functions.
*   `/config`: Game configuration files.
