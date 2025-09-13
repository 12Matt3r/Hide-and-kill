# House of Last Light

A low-poly, multiplayer horror hide-and-seek game built with Three.js.

## Running the Game

1.  **Start a local server.** This project uses ES Modules, which require a server to run due to CORS policies. A simple way is to use Python's built-in server. From the project's root directory (the one containing `public`), run:
    ```bash
    python -m http.server 8000
    ```
    Or, if you have Node.js installed, you can use `serve`:
    ```bash
    npx serve .
    ```

2.  **Open your browser** and navigate to `http://localhost:8000/public/` (or the port your server is running on).

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
