//offscreen microphone accessing and audio processing
let audioContext = null;
let analyser = null;
let microphone = null;
let dataArray = null;
let isListening = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case 'startAudioProcessing':
            startAudioProcessing().then(() => {
                sendResponse({ success: true });
            }).catch((error) => {
                sendResponse({ success: false, error: error.message });
            });
            return true;
        case 'stopAudioProcessing':
            stopAudioProcessing();
            sendResponse({ success: true });
            break;
        case 'getAudioData':
            if (isListening && analyser && dataArray) {
                const frequency = detectPitch();
                sendResponse({ frequency: frequency });
            } else {
                sendResponse({ frequency: -1 });
            }
            break;
        default:
            sendResponse({ error: 'Unknown action' });
    }
});
async function startAudioProcessing() {
    try {
        console.log('requesting microphone access');
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                sampleRate: 44100,
            },
        });
        console.log('microphone access granted');
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        microphone = audioContext.createMediaStreamSource(stream);

        analyser.fftSize = 8192;
        analyser.smoothingTimeConstant = 0.3;
        dataArray = new Float32Array(analyser.fftSize);
        microphone.connect(analyser);
        isListening = true;
        console.log('audio processing started');
    } catch (error) {
        console.error('error starting audio processing:', error);
        throw error;
    }
}

function stopAudioProcessing() {
    isListening = false;
    if (microphone) {
        microphone.disconnect();
        microphone = null;
    }
    if (audioContext) {
        audioContext.close();
    }
    console.log('audio processing stopped');
}

function detectPitch() {
    if (!isListening || !analyser) return -1;
    
    analyser.getFloatTimeDomainData(dataArray);
    return autocorrelate(dataArray,audioContext.sampleRate);

}

function autocorrelate(data, sampleRate) {
    const N = data.length;
    const max_samples = Math.floor(N / 2);
    const rms = Math.sqrt(data.reduce((sum, val) => sum + val * val, 0) / N);
    if (rms < 0.003) return -1;

    const average = data.reduce((sum, val) => sum + val, 0) / N;
    for (let i = 0; i < N; i++) {
        data[i] -= average; // Center the wave around zero
    }

    const correlations = new Array(max_samples);
    for (let i = 0; i < max_samples; i++) {
        correlations[i] = 0;
    }

    for (let i = 0; i < max_samples; i++) {
        for (let j = 0; j < N - i; j++) {
            correlations[i] += data[j] * data[j + i];
        }
    }
    let d = 1;
    while (d < max_samples && correlations[d] > correlations[d-1]) {
        d++;
    }
    
    // Find the maximum after the minimum
    let maxIndex = d;
    let maxValue = correlations[d];
    
    for (let i = d; i < max_samples; i++) {
        if (correlations[i] > maxValue) {
            maxValue = correlations[i];
            maxIndex = i;
        }
    }
    
    // Parabolic interpolation for better precision
    let T0 = maxIndex;
    if (maxIndex > 0 && maxIndex < correlations.length - 1) {
        const x1 = correlations[maxIndex - 1];
        const x2 = correlations[maxIndex];
        const x3 = correlations[maxIndex + 1];
        
        const a = (x1 - 2 * x2 + x3) / 2;
        const b = (x3 - x1) / 2;
        
        if (a !== 0) {
            T0 = maxIndex - b / (2 * a);
        }
    }
    
    // Convert to frequency
    return sampleRate / T0;
}