const { ipcRenderer } = require('electron');

const tabsContainer = document.getElementById('tabs-container');
let activeTabId = null;

ipcRenderer.on('initialize-tabs', (event, data) => {
    const { nodes, activeId } = data;
    // Clear existing tabs to prevent duplication
    tabsContainer.innerHTML = '';
    
    nodes.forEach((node) => {
        const tab = document.createElement('div');
        tab.id = `tab-${node.id}`;
        tab.className = 'tab';
        tab.textContent = node.name;

        // Set the active class based on the data from the main process
        if (node.id === activeId) {
            tab.classList.add('active');
        }
        
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
    });

    // Set the renderer's local activeTabId state
    activeTabId = activeId;
});
