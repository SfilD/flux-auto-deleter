const fs = require('fs');
const path = require('path');
const ini = require('ini');
const net = require('net');

class ConfigManager {
    constructor(basePath) {
        this.basePath = basePath;
        this.config = this.loadSettings();
    }

    loadSettings() {
        try {
            const configPath = path.join(this.basePath, 'settings.ini');
            return ini.parse(fs.readFileSync(configPath, 'utf-8'));
        } catch (error) {
            console.error(`Failed to load settings.ini from ${this.basePath}. Using empty config. Error:`, error);
            return { General: {} };
        }
    }

    getSettings() {
        const c = this.config.General || {};
        
        // Scan IPs
        const scanIps = (c.ScanIPs || '')
            .split(',')
            .map(ip => ip.trim())
            .filter(ip => {
                if (ip && net.isIP(ip)) return true;
                if (ip) console.warn(`Invalid IP address format in settings.ini ignored: '${ip}'`);
                return false;
            });

        // Target App Prefixes
        const targetAppPrefixes = (c.TargetAppPrefixes || '').split(',').map(p => p.trim()).filter(p => p.length > 0);

        // Automation Interval
        let automationIntervalSeconds = parseInt(c.AutomationIntervalSeconds, 10) || 60;
        if (automationIntervalSeconds < 60) {
            console.warn('AutomationIntervalSeconds was set below the minimum of 60s and has been adjusted to 60s.');
            automationIntervalSeconds = 60;
        }

        return {
            SCAN_IPS: scanIps,
            TARGET_APP_PREFIXES: targetAppPrefixes,
            AUTOMATION_INTERVAL: automationIntervalSeconds * 1000,
            DEBUG_MODE: String(c.Debug).toLowerCase() === 'true',
            WINDOW_WIDTH: Math.max(parseInt(c.WindowWidth) || 1300, 1300),
            WINDOW_HEIGHT: Math.max(parseInt(c.WindowHeight) || 850, 850),
            LOG_CLEAR_ON_START: String(c.LogClearOnStart).toLowerCase() === 'true',
            LOG_FILE: c.LogFile || 'session.log',
            FONT_NAME: c.FontName || 'Hack',
            FONT_SIZE: parseInt(c.FontSize) || 10,
            MAX_LOG_HISTORY: parseInt(c.MaxLogHistory) || 1000,
            MAX_LOG_FILE_SIZE_BYTES: (parseInt(c.MaxLogFileSizeMB) || 10) * 1024 * 1024
        };
    }
}

module.exports = ConfigManager;
