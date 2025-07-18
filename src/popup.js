class GuitarTuner {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.dataArray = null;
        this.isListening = false;
        this.selectedString = null;
        
        // Standard tuning frequencies
        this.standardTuning = {
            'E': [82.41, 329.63],  // Low E and High E
            'A': [110.00],
            'D': [146.83],
            'G': [196.00],
            'B': [246.94]
        };
        
        this.initializeEventListeners();
        this.updateUI();
    }

    initializeEventListeners() {
        // String selection
        document.querySelectorAll('.string-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.selectString(e.target));
        });
        
        // Control buttons
        document.getElementById('startBtn').addEventListener('click', () => this.startTuner());
        document.getElementById('stopBtn').addEventListener('click', () => this.stopTuner());
        
        // Settings
        //document.querySelector('.settings-btn').addEventListener('click', () => this.openSettings());
        document.getElementById('configureMicBtn').addEventListener('click', () => this.openExtensionPermissions());
    }

    selectString(button) {
        // Remove active class from all buttons
        document.querySelectorAll('.string-btn').forEach(btn => 
            btn.classList.remove('active'));
        
        // Add active class to selected button
        button.classList.add('active');
        this.selectedString = {
            note: button.dataset.note,
            frequency: parseFloat(button.dataset.freq)
        };
        
        this.updateStatusDots();
    }

    async startTuner() {
        const permissionState = await this.checkCurrentPermissions();
        console.log('Permission state before starting:', permissionState);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: false,
                    autoGainControl: false,
                    noiseSuppression: false,
                    sampleRate: 44100,
                    channelCount: 1
                }
            });
            console.log('✅ Microphone access granted!', stream);
            
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            
            this.analyser.fftSize = 8192;
            this.analyser.smoothingTimeConstant = 0.3;
            this.dataArray = new Float32Array(this.analyser.frequencyBinCount);
            
            this.microphone.connect(this.analyser);
            this.isListening = true;
            
            // Update UI
            document.getElementById('startBtn').style.display = 'none';
            document.getElementById('stopBtn').style.display = 'block';
            
            this.detectPitch();
        } catch (error) {
            console.log('❌ Microphone access failed:', error);
            this.showMicrophonePermissionError();
        }
    }

    stopTuner() {
        this.isListening = false;
        
        if (this.microphone) {
            this.microphone.disconnect();
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
        
        // Reset UI
        document.getElementById('startBtn').style.display = 'block';
        document.getElementById('stopBtn').style.display = 'none';
        document.getElementById('centsDisplay').textContent = '--';
        document.getElementById('frequencyDisplay').textContent = '-- Hz';
        
        this.resetTuningIndicator();
        this.updateStatusDots();
    }

    detectPitch() {
        if (!this.isListening) return;
        
        this.analyser.getFloatTimeDomainData(this.dataArray);
        const frequency = this.autoCorrelate(this.dataArray, this.audioContext.sampleRate);
        
        if (frequency > 70 && frequency < 400) {
            const note = this.frequencyToNote(frequency);
            const cents = this.getCentsOffPitch(frequency, note);
            
            // Update displays
            document.getElementById('centsDisplay').textContent = Math.abs(cents) + ' ct';
            document.getElementById('frequencyDisplay').textContent = frequency.toFixed(1) + ' Hz';
            
            // Update tuning indicator
            this.updateTuningIndicator(cents);
            this.updateStatusDots(cents);
            
            // Auto-select closest string
            this.autoSelectString(note.note);
        }
        const rms = Math.sqrt(this.dataArray.reduce((sum, val) => sum + val * val, 0) / this.dataArray.length);
    const signalPercent = Math.min(100, Math.floor(rms * 1000));
    document.getElementById('signalLevel').textContent = signalPercent + '%';
        
        setTimeout(() => this.detectPitch(), 50);
    }

    autoCorrelate(buffer, sampleRate) {
        const SIZE = buffer.length;
        const rms = Math.sqrt(buffer.reduce((sum, val) => sum + val * val, 0) / SIZE);
        
        if (rms < 0.003) return -1;

        const minPeriod = Math.floor(sampleRate / 400);  // 400 Hz max
        const maxPeriod = Math.floor(sampleRate / 70);   // 70 Hz min
        
        const correlations = new Array(maxPeriod + 1).fill(0);
    
    //  Optimize correlation calculation
    for (let lag = minPeriod; lag <= maxPeriod; lag++) {
        for (let i = 0; i < SIZE - lag; i++) {
            correlations[lag] += buffer[i] * buffer[i + lag];
        }
    }
    
    //  Find best correlation
    let maxCorrelation = 0;
    let bestPeriod = -1;
    
    for (let lag = minPeriod; lag <= maxPeriod; lag++) {
        if (correlations[lag] > maxCorrelation) {
            maxCorrelation = correlations[lag];
            bestPeriod = lag;
        }
    }
    
    if (bestPeriod === -1) return -1;
    
    // Parabolic interpolation for sub-sample accuracy
    const y1 = correlations[bestPeriod - 1] || 0;
    const y2 = correlations[bestPeriod];
    const y3 = correlations[bestPeriod + 1] || 0;
    
    const a = (y1 - 2 * y2 + y3) / 2;
    const b = (y3 - y1) / 2;
    const betterPeriod = a !== 0 ? bestPeriod - b / (2 * a) : bestPeriod;
    
    return sampleRate / betterPeriod;
    }

    frequencyToNote(frequency) {
        const A4 = 440;
        const C0 = A4 * Math.pow(2, -4.75);
        
        if (frequency > C0) {
            const h = Math.round(12 * Math.log2(frequency / C0));
            const octave = Math.floor(h / 12);
            const n = h % 12;
            const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
            return {
                note: notes[n],
                octave: octave,
                frequency: C0 * Math.pow(2, h / 12)
            };
        }
        return { note: '', octave: 0, frequency: 0 };
    }

    getCentsOffPitch(frequency, noteObj) {
        return Math.floor(1200 * Math.log2(frequency / noteObj.frequency));
    }

    updateTuningIndicator(cents) {
        const needle = document.getElementById('tuningNeedle');
        const maxCents = 50;
        const percentage = Math.max(-100, Math.min(100, (cents / maxCents) * 100));
        const position = 50 + (percentage / 2);
        needle.style.left = position + '%';
        
        // Change needle color based on tuning
        if (Math.abs(cents) <= 5) {
            needle.style.background = '#00C896';
            needle.style.boxShadow = '0 0 10px rgba(0, 200, 150, 0.8)';
        } else if (Math.abs(cents) <= 15) {
            needle.style.background = '#FFB800';
            needle.style.boxShadow = '0 0 10px rgba(255, 184, 0, 0.8)';
        } else {
            needle.style.background = '#FF6B6B';
            needle.style.boxShadow = '0 0 10px rgba(255, 107, 107, 0.8)';
        }
    }

    updateStatusDots(cents = null) {
        const dots = document.querySelectorAll('.dot');
        dots.forEach(dot => {
            dot.classList.remove('active', 'in-tune', 'sharp', 'flat');
        });
        
        if (cents !== null) {
            const activeDot = Math.floor((cents + 50) / 20);
            const clampedDot = Math.max(0, Math.min(5, activeDot));
            
            if (dots[clampedDot]) {
                dots[clampedDot].classList.add('active');
                
                if (Math.abs(cents) <= 5) {
                    dots[clampedDot].classList.add('in-tune');
                } else if (cents > 0) {
                    dots[clampedDot].classList.add('sharp');
                } else {
                    dots[clampedDot].classList.add('flat');
                }
            }
        } else {
            dots[0].classList.add('active');
        }
    }

    autoSelectString(detectedNote) {
        const stringButtons = document.querySelectorAll('.string-btn');
        stringButtons.forEach(btn => {
            if (btn.dataset.note === detectedNote) {
                this.selectString(btn);
            }
        });
    }

    resetTuningIndicator() {
        const needle = document.getElementById('tuningNeedle');
        needle.style.left = '50%';
        needle.style.background = '#FFB800';
        needle.style.boxShadow = '0 0 10px rgba(255, 184, 0, 0.8)';
    }

    updateUI() {
        this.resetTuningIndicator();
        this.updateStatusDots();
    }

    openSettings() {
        // Future: Open settings modal
        console.log('Settings clicked');
    }
    showMicrophonePermissionError() {
        console.log('Showing microphone permission error');
        const errorMessage = `Microphone access is required for the guitar tuner to work.
    
    Please click "Configure Mic" and allow microphone permissions for this extension.
    
    Click OK to open extension settings, or Cancel to dismiss.`;
    if (confirm(errorMessage)) {
        this.openExtensionPermissions();
    }
    }
    
    openExtensionPermissions() {
        // Open Chrome extensions page for this extension
        chrome.tabs.create({
            url: `chrome://settings/content/siteDetails?site=chrome-extension://${chrome.runtime.id}`
        });
    }
    async checkCurrentPermissions() {
    try {
        const permission = await navigator.permissions.query({ name: 'microphone' });
        console.log('🔒 Current microphone permission:', permission.state);
        return permission.state;
    } catch (error) {
        console.log('❓ Could not check permissions:', error);
        return 'unknown';
    }
}
    
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new GuitarTuner();
});

