const { ipcRenderer } = require('electron');

const tabsContainer = document.getElementById('tabs-container');
let activeTabId = null;

// Listen for the list of nodes from the main process
ipcRenderer.on('initialize-tabs', (event, nodes) => {
    // Clear existing tabs to prevent duplication on hot-reload
    tabsContainer.innerHTML = '';
    nodes.forEach((node, index) => {
        const tab = document.createElement('div');
        tab.id = `tab-${node.id}`;
        tab.className = 'tab';
        tab.textContent = node.name;
        
        tab.addEventListener('click', () => {
            if (activeTabId === node.id) return;

            if (activeTabId) {
                document.getElementById(`tab-${activeTabId}`).classList.remove('active');
            }
            tab.classList.add('active');
            activeTabId = node.id;

            ipcRenderer.send('switch-view', node.id);
        });

        tabsContainer.appendChild(tab);

        // Activate the first tab by default
        if (index === 0) {
            tab.classList.add('active'); // Add active class directly
            activeTabId = node.id;       // Set activeTabId
            ipcRenderer.send('switch-view', node.id); // Send initial switch view
        }
    });
});
