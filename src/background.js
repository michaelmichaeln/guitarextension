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
//extensions startup
chrome.runtime.onStartup.addListener(() => {
    console.log('Guitar Tuner Extension started');
});
//icon clicked
chrome.runtime.onClicked.addListener((message, sender, sendResponse) => {

});
chrome.runtime.onCommand.addListener((command) => {
    switch (message.command){
        case "startTuner":
            console.log("Starting tuner");
            break;
        case "stopTuner":
            console.log("Stopping tuner");
            break;
        case "toggleTuner":
            console.log("Toggling tuner");
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {