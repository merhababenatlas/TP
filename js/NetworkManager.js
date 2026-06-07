window.NetworkManager = {
    peer: null,
    conn: null,
    isHost: false,
    qrScanner: null,

    init: function() {
        document.getElementById('btn-host-pc').addEventListener('click', () => this.startHostMode());
        document.getElementById('btn-connect-tablet').addEventListener('click', () => this.startClientMode());
        
        document.getElementById('btn-close-host').addEventListener('click', () => {
            document.getElementById('host-qr-overlay').classList.add('hidden');
            if (this.peer) this.peer.destroy();
            this.peer = null;
        });

        document.getElementById('btn-close-reader').addEventListener('click', () => {
            document.getElementById('qr-reader-overlay').classList.add('hidden');
            if (this.qrScanner) {
                this.qrScanner.stop().catch(e => console.error(e));
                this.qrScanner = null;
            }
        });

        // Setup Drag & Drop for Asset Loading on Host
        this.setupDragAndDrop();
    },

    startHostMode: function() {
        this.isHost = true;
        document.getElementById('host-qr-overlay').classList.remove('hidden');
        document.getElementById('host-status').innerText = 'Bağlantı bekleniyor...';
        document.getElementById('host-status').style.color = '#fbbf24'; // yellow
        document.getElementById('qrcode-container').innerHTML = '';

        // Generate a random Peer ID
        const peerId = 'tp-host-' + Math.random().toString(36).substr(2, 9);
        
        this.peer = new Peer(peerId);

        this.peer.on('open', (id) => {
            // Generate QR Code
            new QRCode(document.getElementById('qrcode-container'), {
                text: id,
                width: 200,
                height: 200,
                colorDark : "#000000",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.H
            });
            console.log('My peer ID is: ' + id);
        });

        this.peer.on('connection', (connection) => {
            this.conn = connection;
            this.setupConnection();
        });
        
        this.peer.on('error', (err) => {
            document.getElementById('host-status').innerText = 'Hata: ' + err.type;
            document.getElementById('host-status').style.color = '#ef4444'; // red
            console.error(err);
        });
    },

    startClientMode: function() {
        this.isHost = false;
        document.getElementById('qr-reader-overlay').classList.remove('hidden');
        
        this.peer = new Peer();

        this.peer.on('open', (id) => {
            console.log('Client Peer ID: ' + id);
            // Start QR Scanner
            this.qrScanner = new Html5Qrcode("qr-reader");
            const config = { fps: 10, qrbox: { width: 250, height: 250 } };

            this.qrScanner.start({ facingMode: "environment" }, config, (decodedText) => {
                // QR code scanned!
                console.log(`Scan result: ${decodedText}`);
                this.qrScanner.stop().catch(e => console.error(e));
                document.getElementById('qr-reader-overlay').classList.add('hidden');
                
                // Connect to host
                this.conn = this.peer.connect(decodedText);
                this.setupConnection();
                
            }, (err) => {
                // Ignore errors (happens every frame it doesn't find a QR)
            }).catch(err => {
                console.error(`Error starting scanner: ${err}`);
                alert("Kamera başlatılamadı. Lütfen kamera izni verin.");
            });
        });
    },

    setupConnection: function() {
        this.conn.on('open', () => {
            console.log("Connected to peer!");
            
            if (this.isHost) {
                document.getElementById('host-status').innerText = 'Bağlandı! Tablet kullanıma hazır.';
                document.getElementById('host-status').style.color = '#4ade80'; // green
                
                // Switch to reference monitor mode
                document.querySelector('.tools-panel').style.display = 'none';
                document.querySelector('.actions-panel').style.display = 'none';
            } else {
                alert("Bilgisayara başarıyla bağlandınız!");
            }
        });

        this.conn.on('data', (data) => {
            this.handleMessage(data);
        });

        this.conn.on('close', () => {
            console.log("Connection closed");
            if (this.isHost) {
                document.getElementById('host-status').innerText = 'Bağlantı koptu.';
                document.getElementById('host-status').style.color = '#ef4444'; // red
            } else {
                alert("Bilgisayar ile bağlantı koptu.");
            }
            this.conn = null;
        });
    },

    handleMessage: function(msg) {
        try {
            if (msg.type === 'SYNC_TEXTURE' && this.isHost) {
                // Received new texture from tablet
                this.applySyncedTexture(msg.dataUrl);
            } 
            else if (msg.type === 'LOAD_ASSET' && !this.isHost) {
                // Received asset from host
                this.loadReceivedAsset(msg.filename, msg.filedata, msg.mime);
            }
            else if (msg.type === 'BACKUP_PROJECT' && this.isHost) {
                // Received backup request from tablet
                this.saveBackup(msg.projectData);
            }
        } catch(e) {
            console.error("Error handling message: ", e);
        }
    },

    sendMessage: function(type, payload) {
        if (this.conn && this.conn.open) {
            this.conn.send(Object.assign({ type: type }, payload));
        }
    },

    // --- Feature Implementations ---

    applySyncedTexture: function(dataUrl) {
        // Load the image and update mainRT / material
        const img = new Image();
        img.onload = () => {
            const tempTex = new THREE.Texture(img);
            tempTex.needsUpdate = true;
            tempTex.flipY = false;
            
            if (typeof cube !== 'undefined' && cube) {
                cube.traverse((child) => {
                    if (child.isMesh && child.material && !child.userData.isWireframeHelper) {
                        child.material.map = tempTex;
                        child.material.needsUpdate = true;
                    }
                });
            }
        };
        img.src = dataUrl;
    },

    loadReceivedAsset: function(filename, filedata, mime) {
        // filedata is an ArrayBuffer
        const blob = new Blob([filedata], { type: mime });
        const file = new File([blob], filename, { type: mime });
        
        if (filename.toLowerCase().endsWith('.obj')) {
            const reader = new FileReader();
            reader.onload = function(evt) {
                try {
                    loadModelFromText(evt.target.result);
                } catch (err) {
                    console.error("Model load error:", err);
                }
            };
            reader.readAsText(file);
        } else if (filename.toLowerCase().match(/\.(png|jpg|jpeg)$/)) {
            const reader = new FileReader();
            reader.onload = async function(evt) {
                const img = new Image();
                img.onload = async () => {
                    // Create a new layer
                    const layerObj = await createLayerObj(null, false);
                    layerObj.name = filename;
                    layers.push(layerObj);
                    document.getElementById('layer-list').appendChild(buildLayerDOM(layerObj));
                    selectLayer(layers.length - 1);
                    
                    // Render image to it
                    renderImageToRT(img, layerObj.rt);
                    blitLayers();
                    triggerAutosave();
                    HistoryManager.saveState();
                }
                img.src = evt.target.result;
            };
            reader.readAsDataURL(file);
        }
    },

    saveBackup: function(projectData) {
        const json = JSON.stringify(projectData);
        const blob = new Blob([json], {type: "application/json"});
        const url  = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'texture_painter_backup_' + Date.now() + '.tp';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    setupDragAndDrop: function() {
        const container = document.body;
        
        container.addEventListener('dragover', (e) => {
            if (!this.isHost || !this.conn || !this.conn.open) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        container.addEventListener('drop', (e) => {
            if (!this.isHost || !this.conn || !this.conn.open) return;
            e.preventDefault();
            
            if (e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                const reader = new FileReader();
                
                // Send visual feedback
                const oldStatus = document.getElementById('host-status').innerText;
                document.getElementById('host-status').innerText = 'Dosya gönderiliyor...';
                
                reader.onload = (event) => {
                    const arrayBuffer = event.target.result;
                    this.sendMessage('LOAD_ASSET', {
                        filename: file.name,
                        filedata: arrayBuffer,
                        mime: file.type
                    });
                    document.getElementById('host-status').innerText = 'Dosya gönderildi!';
                    setTimeout(() => {
                        document.getElementById('host-status').innerText = oldStatus;
                    }, 2000);
                };
                reader.readAsArrayBuffer(file);
            }
        });
    }
};

window.addEventListener('DOMContentLoaded', () => {
    NetworkManager.init();
});
