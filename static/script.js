let cameraActive = false;
let videoStream = null;

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    loadFaceList();
    setupTabs();
});

function setupEventListeners() {
    // Upload box click
    const uploadBox = document.getElementById('uploadBox');
    uploadBox.addEventListener('click', () => document.getElementById('imageInput').click());
    uploadBox.addEventListener('dragover', handleDragOver);
    uploadBox.addEventListener('drop', handleDrop);

    // Image input change
    document.getElementById('imageInput').addEventListener('change', handleImageUpload);

    // Camera buttons
    document.getElementById('startCameraBtn').addEventListener('click', startCamera);
    document.getElementById('stopCameraBtn').addEventListener('click', stopCamera);
    document.getElementById('captureBtn').addEventListener('click', captureFromCamera);
    document.getElementById('fetchEsp32Btn').addEventListener('click', fetchEsp32Snapshot);

    // Face management
    document.getElementById('addFaceBtn').addEventListener('click', showAddFaceModal);
    document.getElementById('confirmAddBtn').addEventListener('click', addFaceToDatabase);
    document.getElementById('cancelAddBtn').addEventListener('click', closeAddFaceModal);

    // Modal close on background click
    document.getElementById('addFaceModal').addEventListener('click', function(e) {
        if (e.target === this) closeAddFaceModal();
    });
}

function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            
            // Remove active class from all
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked tab
            this.classList.add('active');
            document.getElementById(tabName).classList.add('active');
            
            if (tabName === 'camera-tab') {
                startCamera();
            } else {
                stopCamera();
            }
        });
    });
}

// File upload handlers
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    this.style.opacity = '0.7';
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        document.getElementById('imageInput').files = files;
        handleImageUpload({ target: { files: files } });
    }
    this.style.opacity = '1';
}

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const preview = document.getElementById('previewImg');
        preview.src = event.target.result;
        preview.style.display = 'block';
        
        verifyFace(file);
    };
    reader.readAsDataURL(file);
}

// Face verification
function verifyFace(file) {
    const formData = new FormData();
    formData.append('image', file);

    showLoading(true);

    fetch('/verify-face', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        showLoading(false);
        displayResult(data);
    })
    .catch(error => {
        showLoading(false);
        displayResult({ error: error.message });
    });
}

function displayResult(data) {
    const resultDiv = document.getElementById('result');
    resultDiv.classList.add('show');

    if (data.error) {
        resultDiv.classList.remove('success');
        resultDiv.classList.add('error');
        resultDiv.innerHTML = `
            <h3>❌ Error</h3>
            <p>${data.error}</p>
        `;
        return;
    }

    const match = data.best_match || {};
    let confidence = match.confidence;
    if (confidence === undefined && match.distance !== undefined) {
        const maxDistance = 2.0;
        confidence = Math.max(0, Math.min(100, ((maxDistance - match.distance) / maxDistance) * 100));
    }
    if (confidence === undefined || isNaN(confidence)) {
        confidence = 0;
    }
    const confidenceDisplay = Number(confidence).toFixed(2);

    const confidenceThreshold = 80;
    const isMatch = data.match && confidence >= confidenceThreshold;

    if (isMatch) {
        resultDiv.classList.remove('error');
        resultDiv.classList.add('success');
        resultDiv.innerHTML = `
            <h3>✅ Match Found!</h3>
            <p><strong>Identity:</strong> ${match.identity || 'Unknown'}</p>
            <p><strong>Confidence:</strong> ${confidenceDisplay}%</p>
            <div class="confidence-bar">
                <div class="confidence-fill" style="width: ${confidenceDisplay}%"></div>
            </div>
            <p style="margin-top: 10px; color: #555; font-size: 0.95em;">Distance: ${match.distance !== undefined ? match.distance.toFixed(4) : 'N/A'}</p>
            ${match.threshold !== undefined ? `<p style="color: #555; font-size: 0.85em; margin-top: 6px;">Threshold: ${match.threshold.toFixed(4)}</p>` : ''}
            <p style="color: #555; font-size: 0.85em;">Threshold for match: ${confidenceThreshold}%</p>
        `;
    } else {
        resultDiv.classList.remove('success');
        resultDiv.classList.add('error');
        resultDiv.innerHTML = `
            <h3>❌ No Match</h3>
            <p>The image did not reach ${confidenceThreshold}% confidence.</p>
            ${match.identity ? `<p><strong>Closest candidate:</strong> ${match.identity}</p>` : ''}
            ${match.distance !== undefined ? `<p style="color: #555; font-size: 0.95em;">Distance: ${match.distance.toFixed(4)}</p>` : ''}
            ${match.threshold !== undefined ? `<p style="color: #555; font-size: 0.85em;">Threshold: ${match.threshold.toFixed(4)}</p>` : ''}
            ${match.confidence !== undefined ? `<p style="color: #555; font-size: 0.95em;">Confidence: ${confidenceDisplay}%</p>` : ''}
        `;
    }
}

// Camera functions
async function startCamera() {
    if (cameraActive) return;

    try {
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user' }
        });
        
        const video = document.getElementById('cameraVideo');
        video.srcObject = videoStream;
        video.style.display = 'block';
        
        document.getElementById('startCameraBtn').style.display = 'none';
        document.getElementById('stopCameraBtn').style.display = 'block';
        document.getElementById('captureBtn').style.display = 'block';
        
        cameraActive = true;
    } catch (error) {
        alert('Camera access denied: ' + error.message);
    }
}

function stopCamera() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
    }
    
    const video = document.getElementById('cameraVideo');
    video.style.display = 'none';
    
    document.getElementById('startCameraBtn').style.display = 'block';
    document.getElementById('stopCameraBtn').style.display = 'none';
    document.getElementById('captureBtn').style.display = 'none';
    
    cameraActive = false;
}

function captureFromCamera() {
    const video = document.getElementById('cameraVideo');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    canvas.toBlob(blob => {
        const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
        
        const reader = new FileReader();
        reader.onload = function(event) {
            document.getElementById('previewImg').src = event.target.result;
            document.getElementById('previewImg').style.display = 'block';
            verifyFace(file);
        };
        reader.readAsDataURL(blob);
    }, 'image/jpeg', 0.95);
}

function fetchEsp32Snapshot() {
    const cameraUrl = document.getElementById('esp32UrlInput').value.trim();
    if (!cameraUrl) {
        alert('Please enter the ESP32 camera address. Example: http://192.168.1.100/capture');
        return;
    }

    showLoading(true);
    fetch(`/esp32/snapshot?camera_url=${encodeURIComponent(cameraUrl)}`)
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.error || 'Failed to fetch ESP32 snapshot');
                });
            }
            return response.blob();
        })
        .then(blob => {
            const preview = document.getElementById('esp32PreviewImg');
            const objectUrl = URL.createObjectURL(blob);
            preview.src = objectUrl;
            preview.style.display = 'block';

            const file = new File([blob], 'esp32-capture.jpg', { type: blob.type || 'image/jpeg' });
            verifyFace(file);
        })
        .catch(error => {
            displayResult({ error: error.message });
        })
        .finally(() => {
            showLoading(false);
        });
}

// Face database management
function loadFaceList() {
    fetch('/get-faces')
        .then(response => response.json())
        .then(data => {
            displayFaceList(data.faces || []);
        })
        .catch(error => console.error('Error loading faces:', error));
}

function displayFaceList(faces) {
    const faceList = document.getElementById('faceList');
    
    if (faces.length === 0) {
        faceList.innerHTML = '<div class="empty-message">No faces in database yet. Add your first face!</div>';
        return;
    }

    faceList.innerHTML = faces.map(face => `
        <div class="face-item">
            <span class="face-item-name">👤 ${face}</span>
            <button class="btn-danger" onclick="deleteFace('${face}')">Remove</button>
        </div>
    `).join('');
}

function showAddFaceModal() {
    document.getElementById('addFaceModal').classList.add('show');
    document.getElementById('faceNameInput').value = '';
    document.getElementById('faceImageInput').click();
}

function closeAddFaceModal() {
    document.getElementById('addFaceModal').classList.remove('show');
}

function addFaceToDatabase() {
    const name = document.getElementById('faceNameInput').value.trim();
    const file = document.getElementById('faceImageInput').files[0];

    if (!name) {
        alert('Please enter a name');
        return;
    }

    if (!file) {
        alert('Please select an image');
        return;
    }

    const formData = new FormData();
    formData.append('image', file);
    formData.append('name', name);

    showLoading(true);

    fetch('/add-face', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        showLoading(false);
        if (data.success) {
            alert('Face added successfully!');
            closeAddFaceModal();
            loadFaceList();
        } else {
            alert('Error: ' + (data.error || 'Failed to add face'));
        }
    })
    .catch(error => {
        showLoading(false);
        alert('Error: ' + error.message);
    });
}

function deleteFace(faceName) {
    if (!confirm(`Delete "${faceName}" from database?`)) {
        return;
    }

    fetch('/delete-face', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: faceName })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Face deleted successfully!');
            loadFaceList();
        } else {
            alert('Error: ' + (data.error || 'Failed to delete face'));
        }
    })
    .catch(error => alert('Error: ' + error.message));
}

// Utility functions
function showLoading(show) {
    const loading = document.getElementById('loading');
    if (show) {
        loading.classList.add('show');
    } else {
        loading.classList.remove('show');
    }
}
