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
        document.querySelector('.settings-btn').addEventListener('click', () => this.openSettings());
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
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: false,
                    autoGainControl: false,
                    noiseSuppression: false
                }
            });
            
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            
            this.analyser.fftSize = 4096;
            this.analyser.smoothingTimeConstant = 0.8;
            this.dataArray = new Float32Array(this.analyser.frequencyBinCount);
            
            this.microphone.connect(this.analyser);
            this.isListening = true;
            
            // Update UI
            document.getElementById('startBtn').style.display = 'none';
            document.getElementById('stopBtn').style.display = 'block';
            document.getElementById('statusMessage').innerHTML = '<span>LISTENING...</span>';
            
            this.detectPitch();
        } catch (error) {
            console.error('Microphone access error:', error);
            alert('Please allow microphone access to use the tuner.');
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
        document.getElementById('statusMessage').innerHTML = '<span>PLUCK A STRING</span>';
        document.getElementById('centsDisplay').textContent = '--';
        document.getElementById('frequencyDisplay').textContent = '-- Hz';
        
        this.resetTuningIndicator();
        this.updateStatusDots();
    }

    detectPitch() {
        if (!this.isListening) return;
        
        this.analyser.getFloatTimeDomainData(this.dataArray);
        const frequency = this.autoCorrelate(this.dataArray, this.audioContext.sampleRate);
        
        if (frequency > 0) {
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
        
        requestAnimationFrame(() => this.detectPitch());
    }

    autoCorrelate(buffer, sampleRate) {
        const SIZE = buffer.length;
        const rms = Math.sqrt(buffer.reduce((sum, val) => sum + val * val, 0) / SIZE);
        
        if (rms < 0.01) return -1;
        
        let r1 = 0, r2 = SIZE - 1;
        const threshold = 0.2;
        
        for (let i = 0; i < SIZE / 2; i++) {
            if (Math.abs(buffer[i]) < threshold) {
                r1 = i;
                break;
            }
        }
        
        for (let i = 1; i < SIZE / 2; i++) {
            if (Math.abs(buffer[SIZE - i]) < threshold) {
                r2 = SIZE - i;
                break;
            }
        }
        
        buffer = buffer.slice(r1, r2);
        const c = new Array(buffer.length).fill(0);
        
        for (let i = 0; i < buffer.length; i++) {
            for (let j = 0; j < buffer.length - i; j++) {
                c[i] += buffer[j] * buffer[j + i];
            }
        }
        
        let d = 0;
        while (c[d] > c[d + 1]) d++;
        
        let maxVal = -1, maxPos = -1;
        for (let i = d; i < buffer.length; i++) {
            if (c[i] > maxVal) {
                maxVal = c[i];
                maxPos = i;
            }
        }
        
        let T0 = maxPos;
        const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
        const a = (x1 - 2 * x2 + x3) / 2;
        const b = (x3 - x1) / 2;
        if (a) T0 = T0 - b / (2 * a);
        
        return sampleRate / T0;
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
        document.getElementById('statusMessage').innerHTML = '<span>PLUCK A STRING</span>';
        this.resetTuningIndicator();
        this.updateStatusDots();
    }

    openSettings() {
        // Future: Open settings modal
        console.log('Settings clicked');
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new GuitarTuner();
});