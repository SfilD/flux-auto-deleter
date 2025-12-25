const fs = require('fs');
const path = require('path');
const { maskSensitiveData } = require('./utils');

class Logger {
    constructor(basePath, config, uiDispatcher) {
        this.basePath = basePath;
        this.config = config;
        this.uiDispatcher = uiDispatcher; // Function to send log to UI windows
        this.logStream = null;
        this.logHistory = [];
        
        this.setupFileLogger();
    }

    setupFileLogger() {
        const logFilePath = path.join(this.basePath, this.config.LOG_FILE);
        const writeMode = this.config.LOG_CLEAR_ON_START ? 'w' : 'a';
        try {
            this.logStream = fs.createWriteStream(logFilePath, { flags: writeMode });
            this.logStream.on('error', (err) => {
                console.error('Log stream error:', err);
                this.logStream = null;
            });
        } catch (err) {
            console.error('Failed to setup file logger:', err);
        }
    }

    dispatchLog(message, isDebug = false) {
        if (isDebug && !this.config.DEBUG_MODE) {
            return;
        }
        
        this.logHistory.push(message);

        if (this.logHistory.length > this.config.MAX_LOG_HISTORY) {
            this.logHistory.shift();
        }

        // Send to UI
        if (this.uiDispatcher) {
            this.uiDispatcher(message);
        }
        
        // Write to file
        if (this.logStream) {
            const logFilePath = path.join(this.basePath, this.config.LOG_FILE);
            
            try {
                if (fs.existsSync(logFilePath)) {
                    const stats = fs.statSync(logFilePath);
                    if (stats.size >= this.config.MAX_LOG_FILE_SIZE_BYTES) {
                        this.rotateLogFile(logFilePath);
                    }
                }
            } catch (err) {
                console.error('Failed to check log file size for rotation:', err);
            }

            if (this.logStream) {
                this.logStream.write(`[${new Date().toISOString()}] ${message}\n`);
            }
        }
    }

    rotateLogFile(logFilePath) {
        try {
            if (this.logStream) {
                this.logStream.end();
                this.logStream = null;
            }

            const oldLogPath = `${logFilePath}.old`;
            if (fs.existsSync(oldLogPath)) {
                try {
                    fs.unlinkSync(oldLogPath);
                } catch (unlinkErr) {
                    console.error('Log Rotation Error: Could not delete old log file.', unlinkErr);
                    throw unlinkErr; 
                }
            }
            
            fs.renameSync(logFilePath, oldLogPath);
            
            this.logStream = fs.createWriteStream(logFilePath, { flags: 'w' });
            
            const rotationMsg = `[SYSTEM] Log file reached maximum size and was rotated. Previous logs saved to ${this.config.LOG_FILE}.old`;
            this.logStream.write(`[${new Date().toISOString()}] ${rotationMsg}\n`);
            
        } catch (err) {
            console.error('Critical error during log rotation:', err);
            try {
                if (!this.logStream) {
                    this.logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
                    this.logStream.write(`[${new Date().toISOString()}] [SYSTEM] Log rotation FAILED (File busy?). Logging continues in the same file.\n`);
                }
            } catch (recoveryErr) {
                console.error('FATAL: Could not recover log stream after failed rotation:', recoveryErr);
                this.logStream = null;
            }
        }
    }

    log(prefix, ...args) {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const timestamp = `[${day}.${month}.${year} ${hours}:${minutes}]`;
        
        const message = `${timestamp}[${prefix}] ${args.map(arg => (typeof arg === 'object' && arg !== null) ? JSON.stringify(maskSensitiveData(arg)) : String(arg)).join(' ')}`;
        this.dispatchLog(message, false);
    }

    logDebug(prefix, ...args) {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const timestamp = `[${day}.${month}.${year} ${hours}:${minutes}]`;

        const message = `${timestamp}[${prefix}] ${args.map(arg => (typeof arg === 'object' && arg !== null) ? JSON.stringify(maskSensitiveData(arg), null, 2) : String(arg)).join(' ')}`;
        this.dispatchLog(message, true);
    }
    
    close() {
        if (this.logStream) {
            this.logStream.end();
            this.logStream = null;
        }
    }
    
    getHistory() {
        return this.logHistory;
    }
}

module.exports = Logger;
