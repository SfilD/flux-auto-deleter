# Gemini Code Understanding

## Project Overview

This project is a configurable, single-window, multi-session Electron application designed to automate the management of applications running on Flux instances. Its primary function is to monitor multiple Flux nodes simultaneously and automatically delete applications that match a list of predefined prefixes.

The application's architecture is centered around a `settings.ini` file, which dictates the configuration. The application creates a single main window with a tabbed interface, where each tab corresponds to a Flux node. Each tab's content is rendered in a separate `BrowserView` with an isolated session (`partition`), ensuring that logins and cookies are kept separate for each node. Node IDs are zero-padded (e.g., `node01`, `node02`).

A preload script (`monitor-preload.js`) is injected into each `BrowserView` to capture the user's authentication token (`zelidauth`) from `localStorage` upon login. This token is then sent via IPC to the main Electron process (`monitor-main.js`).

Once a token is received for a specific node, the main process initiates an automation loop for that node. It periodically makes API calls to the Flux node to:
1.  List all running applications.
2.  Identify applications whose names contain any of the target prefixes defined in `settings.ini`.
3.  Automatically issue a command to remove any matching applications.

## Key Files

*   `settings.ini`: The central configuration file. It defines the general behavior (target prefixes, automation interval, debug mode) and the list of Flux nodes to monitor.
*   `monitor-main.js`: The core of the application. It reads `settings.ini`, creates the main window and all `BrowserView`s, handles IPC for tab switching and authentication, and contains the main automation logic.
*   `monitor-preload.js`: A script that runs in the context of each `BrowserView`. It is responsible for detecting login/logout events and passing the `zelidauth` token to the main process.
*   `shell.html`: The HTML structure for the main application window, containing the tab container.
*   `shell.css`: Styles for the application shell and tabbed interface.
*   `shell-renderer.js`: The renderer-side script for `shell.html`. It dynamically creates the tabs and handles click events to enable view switching.
*   `package.json`: Defines the project's metadata, dependencies, and the `start` script.

## Building and Running

### Prerequisites

*   Node.js and npm must be installed.

### Installation

1.  Install the project dependencies:
    ```bash
    npm install
    ```

### Configuration

1.  Edit the `settings.ini` file to configure the application.

### Running the Application

To run the application, execute the following command in the project root:

```bash
npm start
```

This will launch a single Electron window with tabs for each configured node. You must log in to the Flux web interface in each tab to initiate the automated monitoring for that node.

## Development Workflow

- **Development Environment:** Code is written and edited within the WSL (Windows Subsystem for Linux) environment, specifically the **Ubuntu-22.04** distribution.
- **Testing & Execution Environment:** For testing and final execution, the project files are copied to a **Windows 10 Pro** VMware virtual machine.
- **Working Directory on Windows:** The project is located at `C:\Projects\flux-auto-deleter\` on the Windows VM.
- **Critical Constraint:** All runtime and testing commands (e.g., `npm start`) **must be executed within the Windows 10 Pro environment**, not in WSL.

## Logging Conventions

Log messages are formatted as `[DD.MM.YYYY HH:MM][PREFIX] Message...`
- **[MAIN-node01]**: High-level events related to application control.
- **[AUTO-node01]**: Events related to the automation cycle.
- **[API-node01]**: Events related to direct API calls.
- **[MONITOR-node01]**: Events from the preload script.
