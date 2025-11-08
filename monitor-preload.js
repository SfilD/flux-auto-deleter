const { ipcRenderer } = require('electron');

// Extract arguments passed from main process
let nodeId = 'unknown';
let DEBUG = false; // Default to false

const nodeIdArg = process.argv.find(arg => arg.startsWith('--node-id='));
if (nodeIdArg) {
    nodeId = nodeIdArg.split('=')[1];
}

const debugModeArg = process.argv.find(arg => arg.startsWith('--debug-mode='));
if (debugModeArg) {
    DEBUG = debugModeArg.split('=')[1] === 'true';
}

// --- Debug Utility ---
function log() {
  if (DEBUG) {
    const args = [`[MONITOR-${nodeId}]`];
    for (let i = 0; i < arguments.length; i++) {
      args.push(arguments[i]);
    }
    console.log.apply(console, args);
  }
}

function logState(context) {
    if (!DEBUG) return;
    console.log(`
----- [${context} - ${nodeId}] -----`);
    console.log('Timestamp:', new Date().toISOString());

    console.log('\n--- localStorage ---');
    try {
        const ls = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            ls[key] = localStorage.getItem(key);
        }
        console.log(JSON.stringify(ls, null, 2));
    } catch (e) {
        console.log(`Error reading localStorage: ${e.message}`);
    }

    console.log('\n--- sessionStorage ---');
    try {
        const ss = {};
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            ss[key] = sessionStorage.getItem(key);
        }
        console.log(JSON.stringify(ss, null, 2));
    } catch (e) {
        console.log(`Error reading sessionStorage: ${e.message}`);
    }

    console.log('\n--- Cookies ---');
    console.log(document.cookie || '(empty)');
    console.log(`----- End of [${context} - ${nodeId}] -----
`);
}


// --- Main Logic ---

function initializeMonitor() {
    log('Preload script injected. Monitoring authentication state...');
    let lastSentToken = null;

    const checkAuthState = () => {
        const currentToken = localStorage.getItem('zelidauth');
        
        // Case 1: User has logged in (new token found)
        if (currentToken && currentToken !== lastSentToken) {
            log('Login detected or token changed.');
            logState('Post-Login State');
            ipcRenderer.send('auth-state-changed', { nodeId: nodeId, loggedIn: true, token: currentToken });
            log('Auth state [LOGGED IN] sent to main process.');
            lastSentToken = currentToken;
        } 
        // Case 2: User has logged out (token disappeared)
        else if (!currentToken && lastSentToken !== null) {
            log('Logout detected.');
            logState('Post-Logout State');
            ipcRenderer.send('auth-state-changed', { nodeId: nodeId, loggedIn: false, token: null });
            log('Auth state [LOGGED OUT] sent to main process.');
            lastSentToken = null;
        }
    };

    // Set an interval to periodically check for the auth state.
    // This will run for the lifetime of the window.
    setInterval(checkAuthState, 2000); // Check every 2 seconds

    window.addEventListener('load', () => {
        log('Page fully loaded. Performing initial state log.');
        logState('Initial State (After Load)');
        // Perform an initial check as soon as the page loads
        checkAuthState();
    });
}

window.addEventListener('DOMContentLoaded', initializeMonitor);
