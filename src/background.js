chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install") {
        chrome.storage.sync.set({
            selectedTuning: "standard",
            autoDetect: true,
            sensitivity: 0.8,
            referencePitch: 440
        });
    }
});

// Extensions startup
chrome.runtime.onStartup.addListener(() => {
    console.log('Guitar Tuner Extension started');
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case 'saveSettings':
            chrome.storage.sync.set(message.settings, () => {
                sendResponse({ success: true });
            });
            return true; // Keep message channel open for async response
            
        case 'getSettings':
            chrome.storage.sync.get(message.keys || null, (result) => {
                sendResponse(result);
            });
            return true; // Keep message channel open for async response
            
        case 'resetSettings':
            chrome.storage.sync.clear(() => {
                chrome.storage.sync.set({
                    referencePitch: 440,
                    selectedTuning: 'standard',
                    autoDetect: true,
                    sensitivity: 0.8
                });
                sendResponse({ success: true });
            });
            return true;
            
        default:
            console.log('Unknown action:', message.action);
            sendResponse({ error: 'Unknown action' });
    }
});

// Optional: Handle keyboard shortcuts
chrome.commands?.onCommand.addListener((command) => {
    switch (command) {
        case "start-tuner":
            console.log("Starting tuner");
            break;
        case "stop-tuner":
            console.log("Stopping tuner");
            break;
        case "toggle-tuner":
            console.log("Toggling tuner");
            break;
    }
});