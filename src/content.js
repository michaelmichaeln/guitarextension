// Content script for Guitar Tuner Extension
// Runs on web pages to detect guitar-related content

(function() {
    'use strict';
    
    // Only run on pages that might contain guitar content
    if (document.body) {
        detectGuitarContent();
    } else {
        document.addEventListener('DOMContentLoaded', detectGuitarContent);
    }
    
    function detectGuitarContent() {
        // Look for common guitar-related keywords
        const guitarKeywords = [
            'guitar', 'chord', 'tab', 'tablature', 'tuning', 'fret',
            'capo', 'pick', 'strum', 'fingerpicking', 'acoustic', 'electric'
        ];
        
        const textContent = document.body.textContent.toLowerCase();
        const hasGuitarContent = guitarKeywords.some(keyword => 
            textContent.includes(keyword)
        );
        
        if (hasGuitarContent) {
            console.log('Guitar-related content detected on this page');
            // Future enhancement: Could add visual indicators
        }
    }
    
    // Listen for messages from popup or background
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        switch (request.action) {
            case 'detectGuitarContent':
                detectGuitarContent();
                sendResponse({ success: true });
                break;
                
            case 'getPageInfo':
                sendResponse({
                    url: window.location.href,
                    title: document.title,
                    hasGuitarContent: containsGuitarContent()
                });
                break;
                
            default:
                console.log('Unknown content script action:', request.action);
        }
    });
    
    function containsGuitarContent() {
        const guitarKeywords = [
            'guitar', 'chord', 'tab', 'tablature', 'tuning', 'fret'
        ];
        const textContent = document.body.textContent.toLowerCase();
        return guitarKeywords.some(keyword => textContent.includes(keyword));
    }
})();
