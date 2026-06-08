window.NetworkManager = {
    peer: null,
    conn: null,
    isHost: false,
    qrScanner: null,

    init: function() {
        this.initPersistentPeer();
        
        document.getElementById('btn-host-pc').addEventListener('click', () => this.startHostMode());
        document.getElementById('btn-connect-tablet').addEventListener('click', () => this.startClientMode());
        
        document.getElementById('btn-close-host').addEventListener('click', () => {
            document.getElementById('host-qr-overlay').classList.add('hidden');
            // Kalıcı peer arka planda yaşamaya devam etmeli, destroy() kaldırıldı.
        });

        document.getElementById('btn-close-reader').addEventListener('click', () => {
            document.getElementById('qr-reader-overlay').classList.add('hidden');
            if (this.qrScanner) {
                this.qrScanner.stop().then(() => {
                    this.qrScanner.clear();
                }).catch(e => console.error(e));
                this.qrScanner = null;
            }
        });

        // Setup Drag & Drop for Asset Loading on Host
        this.setupDragAndDrop();
    },

    initPersistentPeer: function() {
        let peerId = localStorage.getItem('myPersistentPeerId');
        if (!peerId) {
            peerId = localStorage.getItem('myHostPeerId') || ('tp-node-' + Math.random().toString(36).substr(2, 9));
            localStorage.setItem('myPersistentPeerId', peerId);
        }
        
        if (this.peer) this.peer.destroy();
        this.peer = new Peer(peerId);
        
        this.peer.on('connection', (connection) => {
            const lastHost = localStorage.getItem('lastConnectedHostId');
            const lastClient = localStorage.getItem('lastConnectedTabletId');
            
            const qrModal = document.getElementById('host-qr-overlay');
            const isPairingMode = qrModal && !qrModal.classList.contains('hidden');
            
            if (connection.peer !== lastHost && connection.peer !== lastClient && !isPairingMode) {
                console.warn("Rejected unknown connection from: " + connection.peer);
                if (typeof window.showToast === 'function') {
                    window.showToast("Bilinmeyen bir cihaz reddedildi.", 4000, '#ef4444');
                }
                connection.close();
                return;
            }
            
            this.conn = connection;
            if (connection.peer === lastClient) this.isHost = true;
            else if (connection.peer === lastHost) this.isHost = false;
            
            this.setupConnection();
        });
        
        this.peer.on('error', (err) => {
            console.error("Peer error: ", err);
        });
    },

    startHostMode: function() {
        this.isHost = true;
        document.getElementById('host-qr-overlay').classList.remove('hidden');
        document.getElementById('host-status').innerText = '⏳ Bağlantı bekleniyor...';
        document.getElementById('host-status').style.color = '#fbbf24'; // yellow
        document.getElementById('qrcode-container').innerHTML = '';

        // Peer kopmuşsa veya yoksa yeniden bağla
        if (this.peer && this.peer.disconnected) {
            this.peer.reconnect();
        } else if (!this.peer || this.peer.destroyed) {
            this.initPersistentPeer();
        }

        const renderQR = (id) => {
            document.getElementById('qrcode-container').innerHTML = '';
            new QRCode(document.getElementById('qrcode-container'), {
                text: id,
                width: 200, height: 200,
                colorDark : "#000000", colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.H
            });
        };

        // ID'miz zaten belli olduğu için doğrudan QR üretiyoruz
        renderQR(localStorage.getItem('myPersistentPeerId'));
    },

    connectToHost: function(hostId) {
        this.isHost = false;
        localStorage.setItem('lastConnectedHostId', hostId);
        this.conn = this.peer.connect(hostId);
        this.setupConnection();
    },

    connectToTablet: function(tabletId) {
        this.isHost = true;
        localStorage.setItem('lastConnectedTabletId', tabletId);
        this.conn = this.peer.connect(tabletId);
        this.setupConnection();
    },

    startClientMode: function() {
        this.isHost = false;
        document.getElementById('qr-reader-overlay').classList.remove('hidden');
        
        if (this.qrScanner) {
            this.qrScanner.stop().catch(e => console.error(e));
        }
        
        this.qrScanner = new Html5Qrcode("qr-reader");
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        this.qrScanner.start({ facingMode: "environment" }, config, (decodedText) => {
            // QR code scanned!
            this.qrScanner.stop().then(() => {
                this.qrScanner.clear();
            }).catch(e => console.error(e));
            document.getElementById('qr-reader-overlay').classList.add('hidden');
            
            // Connect to host
            localStorage.setItem('lastConnectedHostId', decodedText);
            this.conn = this.peer.connect(decodedText);
            this.setupConnection();
            
        }, (err) => {
            // Ignore frame errors
        }).catch(err => {
            console.error(`Error starting scanner: ${err}`);
        });
    },

    setupConnection: function() {
        this.conn.on('open', () => {
            console.log("Connected to peer!");
            
            this.lastPing = Date.now();
            if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
            if (this.heartbeatCheck) clearInterval(this.heartbeatCheck);
            
            this.heartbeatInterval = setInterval(() => {
                if (this.conn && this.conn.open) {
                    this.conn.send({ type: 'PING' });
                }
            }, 2000);
            
            this.heartbeatCheck = setInterval(() => {
                if (Date.now() - this.lastPing > 6000) {
                    console.warn("Heartbeat timeout! Disconnecting...");
                    if (this.conn) {
                        this.conn.close();
                        // Forcing close UI update in case close event doesn't trigger
                        if (this.conn) this.conn.emit('close'); 
                    }
                }
            }, 3000);
            
            if (this.isHost) {
                // We are Host, the other guy is the Tablet
                localStorage.setItem('lastConnectedTabletId', this.conn.peer);
                
                document.getElementById('host-status').innerText = 'Bağlandı! Tablet kullanıma hazır.';
                document.getElementById('host-status').style.color = '#4ade80'; // green
                
                if (typeof window.showToast === 'function') {
                    window.showToast("Tablete başarıyla bağlandınız!", 4000, '#4ade80');
                }
                
                // Hide painting related panels, but KEEP actions-panel and layers-panel visible
                document.querySelector('.tools-panel').style.display = 'none';
                document.querySelector('.sliders-panel').style.display = 'none';
                document.querySelector('.history-panel').style.display = 'none';
                
                // Close QR overlay
                document.getElementById('host-qr-overlay').classList.add('hidden');
            } else {
                if (typeof window.showToast === 'function') {
                    window.showToast("Bilgisayara başarıyla bağlandınız!", 4000, '#4ade80');
                } else {
                    alert("Bilgisayara başarıyla bağlandınız!");
                }
                
                // İlk bağlantıda tabletin mevcut modelini ve dokusunu PC'ye gönder (Anında senkronizasyon)
                if (typeof currentModelText !== 'undefined' && currentModelText) {
                    this.sendMessage('SYNC_MODEL', { modelText: currentModelText });
                }
                if (typeof window.syncLayersToHost === 'function') window.syncLayersToHost();
                setTimeout(() => {
                    if (typeof getLayerPreviewDataUrl === 'function' && typeof mainRT !== 'undefined') {
                        this.sendMessage('SYNC_TEXTURE', { dataUrl: getLayerPreviewDataUrl({ rt: mainRT }) });
                    }
                }, 500); // Modeli yüklemesi için ufak bir gecikme
            }
        });

        this.conn.on('data', (data) => {
            this.handleMessage(data);
        });

        this.conn.on('close', () => {
            console.log("Connection closed");
            if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
            if (this.heartbeatCheck) clearInterval(this.heartbeatCheck);
            
            if (this.isHost) {
                document.getElementById('host-status').innerText = 'Bağlantı koptu.';
                document.getElementById('host-status').style.color = '#ef4444'; // red
                if (typeof window.showToast === 'function') {
                    window.showToast("Tablet ile bağlantı koptu.", 4000, '#ef4444');
                }
            } else {
                if (typeof window.showToast === 'function') {
                    window.showToast("Bilgisayar ile bağlantı koptu.", 4000, '#ef4444');
                } else {
                    alert("Bilgisayar ile bağlantı koptu.");
                }
            }
            this.conn = null;
        });
    },

    handleMessage: function(msg) {
        this.lastPing = Date.now(); // Any incoming message means connection is alive
        try {
            if (msg.type === 'PING') {
                if (this.conn && this.conn.open) this.conn.send({ type: 'PONG' });
                return;
            }
            if (msg.type === 'PONG') {
                return;
            }
            
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
            else if (msg.type === 'SYNC_MODEL' && this.isHost) {
                // Received model update from tablet
                if (typeof loadModelFromText === 'function') {
                    loadModelFromText(msg.modelText, true);
                }
            }
            else if (msg.type === 'SYNC_LAYERS_META' && this.isHost) {
                if (window.LayerUIManager) {
                    window.LayerUIManager.syncFromMeta(msg.layers);
                }
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
        // Load the image and update mainRT directly
        const img = new Image();
        img.onload = () => {
            if (typeof mainRT !== 'undefined' && mainRT) {
                if (typeof renderImageToRT === 'function') {
                    renderImageToRT(img, mainRT);
                }
            } else {
                // Fallback for cases where mainRT isn't ready
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
                    if (window.NetworkManager && window.NetworkManager.conn && !window.NetworkManager.isHost) {
                        window.NetworkManager.sendMessage('SYNC_MODEL', {
                            modelText: currentModelText
                        });
                    }
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
                    window.LayerUIManager.addLayerToUI(layerObj);
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
