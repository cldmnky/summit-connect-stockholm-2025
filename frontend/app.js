// Stockholm Datacenters Map Application using Leaflet.js
class StockholmDatacentersMap {
    constructor() {
        this.map = null;
        this.datacenters = [];
        this.markers = [];
        this.markerByDcId = new Map();
        this.migrationAnimations = []; // Track active animations
        this.currentLayer = 'satellite';
        this.layers = {};
        
        this.init();
    }
    
    async init() {
        await this.loadDatacenters();
        this.initMap();
        this.addDatacenters();
        this.setupControls();
        this.renderGlobalVMList();
        this.updateStats();
        this.startSimulation();
        
        // Clear any leftover migration animations from previous sessions
        this.clearMigrationAnimations();
        
        // periodically refetch data to pick up migrations
        this.startAutoRefresh(10000); // every 10s
    }
    
    async loadDatacenters() {
        try {
            const response = await fetch('/api/v1/datacenters');
            const data = await response.json();
            this.datacenters = data.datacenters;
            console.log('Loaded datacenters from API:', this.datacenters);
        } catch (error) {
            console.error('Error loading datacenter data from API:', error);
            // Fallback to old JSON file
            try {
                const response = await fetch('/api/v1/datacenters');
                const data = await response.json();
                this.datacenters = data.datacenters;
                console.log('Loaded datacenters from fallback JSON:', this.datacenters);
            } catch (fallbackError) {
                console.error('Error loading fallback datacenter data:', fallbackError);
                // Ultimate fallback to hardcoded data
                this.datacenters = [
                    {
                        id: "dc-stockholm-north",
                        name: "Stockholm North DC",
                        location: "Kista, Stockholm",
                        coordinates: [59.4036, 17.9441],
                        vms: [
                            {
                                id: "vm-001",
                                name: "web-server-01",
                                status: "running",
                                cpu: 4,
                                memory: 8192,
                                disk: 100
                            }
                        ]
                    },
                    {
                        id: "dc-stockholm-south", 
                        name: "Stockholm South DC",
                        location: "Södermalm, Stockholm",
                        coordinates: [59.3181, 18.0755],
                        vms: [
                            {
                                id: "vm-002",
                                name: "web-server-02", 
                                status: "running",
                                cpu: 4,
                                memory: 8192,
                                disk: 100
                            }
                        ]
                    }
                ];
                console.log('Using hardcoded fallback data:', this.datacenters);
            }
        }
    }
    
    initMap() {
        // Initialize map centered on Stockholm
        this.map = L.map('map').setView([59.3293, 18.0686], 11);
        
        // Define different tile layers
        this.layers.street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 18
        });

        this.layers.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
            maxZoom: 18
        });

        // Add default layer (satellite)
        this.layers.satellite.addTo(this.map);

        // Setup migration controls after layers are available
        this.setupMigrationControls();
        
        // Add scale control
        L.control.scale({
            position: 'bottomright',
            imperial: false
        }).addTo(this.map);
        
        console.log('Map initialized at Stockholm coordinates');
    }
    
    addDatacenters() {
        this.datacenters.forEach(dc => {
            this.createDatacenterMarker(dc);
        });
        
        // Fit map to show all datacenters with some padding
        if (this.markers.length > 0) {
            const group = new L.featureGroup(this.markers);
            this.map.fitBounds(group.getBounds().pad(0.2));
        }

        // render VM list after markers are added
        this.renderGlobalVMList();
    }
    
    createDatacenterMarker(datacenter) {
        // Create custom icon with label positioned to the right of the marker
        const datacenterIcon = L.divIcon({
            className: 'datacenter-marker',
            html: `
                <div class="datacenter-marker-container">
                    <div class="datacenter-point" style="
                        width: 16px; 
                        height: 16px; 
                        background: #ff6b6b; 
                        border: 3px solid #fff; 
                        border-radius: 50%;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                        position: absolute;
                        left: 0;
                        top: 0;
                    "></div>
                    <div class="datacenter-label" style="
                        position: absolute;
                        left: 25px;
                        top: -8px;
                        background: rgba(21, 21, 21, 0.9);
                        color: white;
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 12px;
                        font-weight: 600;
                        white-space: nowrap;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                        font-family: 'Red Hat Text', Arial, sans-serif;
                    ">${datacenter.name}</div>
                </div>
            `,
            iconSize: [200, 30],
            iconAnchor: [10, 10],
            popupAnchor: [0, -10]
        });
        
        // Create marker
        const marker = L.marker([datacenter.coordinates[0], datacenter.coordinates[1]], {
            icon: datacenterIcon
        }).addTo(this.map);
        
        // Add popup with datacenter information
        const vmCount = datacenter.vms ? datacenter.vms.length : 0;
        const runningVMs = datacenter.vms ? datacenter.vms.filter(vm => vm.status === 'running').length : 0;
        const readyVMs = datacenter.vms ? datacenter.vms.filter(vm => vm.ready === true).length : 0;
        
        // Generate VM summary for popup
        let vmSummary = '';
        if (datacenter.vms && datacenter.vms.length > 0) {
            const firstFewVMs = datacenter.vms.slice(0, 3);
            vmSummary = '<div style="margin-top: 8px; font-size: 11px; color: #666;"><strong>VMs:</strong><br/>';
            firstFewVMs.forEach(vm => {
                const readyIcon = vm.ready === true ? '✓' : vm.ready === false ? '✗' : '?';
                const nodeInfo = vm.nodeName ? ` @ ${vm.nodeName}` : '';
                const clusterInfo = vm.cluster ? ` [${vm.cluster}]` : '';
                vmSummary += `• ${vm.name} (${vm.status}) ${readyIcon}${nodeInfo}${clusterInfo}<br/>`;
            });
            if (datacenter.vms.length > 3) {
                vmSummary += `• ...and ${datacenter.vms.length - 3} more<br/>`;
            }
            vmSummary += '</div>';
        }
        
        const popupContent = `
            <div style="min-width: 220px;">
                <h3 style="margin: 0 0 10px 0; color: #333;">${datacenter.name}</h3>
                <div style="line-height: 1.6;">
                    <strong>📍 Location:</strong> ${datacenter.location}<br/>
                    <strong>💻 VMs:</strong> ${vmCount} (${runningVMs} running, ${readyVMs} ready)<br/>
                    <strong>⚡ Status:</strong> <span style="color: #28a745; font-weight: bold;">ACTIVE</span><br/>
                </div>
                ${vmSummary}
                <button onclick="app.showDatacenterDetails('${datacenter.id}')" 
                        style="margin-top: 10px; padding: 5px 10px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    View Details
                </button>
            </div>
        `;
        
        marker.bindPopup(popupContent);
        
        // Add click event for info panel
        marker.on('click', () => {
            this.showDatacenterInfo(datacenter);
            // highlight or refresh VM list to focus on this datacenter
            this.renderGlobalVMList(datacenter.id);
        });
        
    // Store marker reference
    this.markers.push(marker);
    this.markerByDcId.set(datacenter.id, marker);
        
        // Add VM activity visualization
        this.addVMActivityVisualization(datacenter);
    }

    // Flatten all VMs from datacenters into a single array with parent dc reference
    flattenVMs() {
        const rows = [];
        this.datacenters.forEach(dc => {
            const list = dc.vms || []; // Use dc.vms instead of dc.vmsList for new API
            list.forEach(vm => {
                rows.push(Object.assign({}, vm, { datacenterId: dc.id, datacenterName: dc.name, dcLocation: dc.location }));
            });
        });
        return rows;
    }

    renderGlobalVMList(focusDatacenterId = null) {
        const container = document.getElementById('vm-list-rows');
        if (!container) return;
        container.innerHTML = '';

        let vms = this.flattenVMs();

        // Sort by latest migration timestamp first. If no _lastMigratedAt, keep existing order.
        vms = vms.sort((a, b) => {
            const parse = v => {
                if (!v) return 0;
                if (typeof v === 'number') return v;
                // try ISO date string
                const t = Date.parse(v);
                return isNaN(t) ? 0 : t;
            };
            const ta = parse(a._lastMigratedAt);
            const tb = parse(b._lastMigratedAt);
            // newer migrations first
            if (ta === tb) return 0;
            return tb - ta;
        });

        vms.forEach(vm => {
            const row = document.createElement('div');
            row.className = 'vm-row';

            // highlight if belongs to focused datacenter
            if (focusDatacenterId && vm.datacenterId === focusDatacenterId) {
                row.style.background = '#f1f5ff';
                row.style.borderColor = '#e0e7ff';
            }

            const meta = document.createElement('div');
            meta.className = 'vm-meta';
            
            // Build VM status and KubeVirt info - use phase instead of status to avoid duplication
            const vmStatus = vm.phase || vm.status || 'Unknown';
            let kubeVirtInfo = '';
            if (vm.cluster) kubeVirtInfo += ` • Cluster: ${vm.cluster}`;
            if (vm.namespace) kubeVirtInfo += ` • NS: ${vm.namespace}`;
            if (vm.ip) kubeVirtInfo += ` • IP: ${vm.ip}`;
            if (vm.nodeName) kubeVirtInfo += ` • Node: ${vm.nodeName}`;
            if (vm.ready !== undefined) kubeVirtInfo += ` • Ready: ${vm.ready ? '✓' : '✗'}`;
            if (vm.age) kubeVirtInfo += ` • Age: ${vm.age}`;
            
            meta.innerHTML = `<div>
                    <div class="vm-name">${vm.name}</div>
                    <div class="vm-sub">${vm.id} • ${vm.datacenterName} • ${vmStatus}${kubeVirtInfo}</div>
                    <div class="vm-resources">CPU: ${vm.cpu || 'N/A'} • Memory: ${vm.memory || 'N/A'}MB • Disk: ${vm.disk || 'N/A'}GB</div>
                </div>`;

            const actions = document.createElement('div');
            actions.className = 'vm-actions';
            actions.innerHTML = `
                <button title="Center on datacenter">Center</button>
            `;

            actions.querySelector('button').addEventListener('click', () => {
                const dc = this.datacenters.find(d => d.id === vm.datacenterId);
                if (dc && this.map) {
                    this.map.setView([dc.coordinates[0], dc.coordinates[1]], 14, { animate: true });
                    this.showDatacenterInfo(dc);
                }
            });

            row.appendChild(meta);
            row.appendChild(actions);
            container.appendChild(row);
        });
    }

    // Remove existing markers from the map and reset
    clearMarkers() {
        if (this.markers && this.markers.length) {
            this.markers.forEach(m => {
                try { this.map.removeLayer(m); } catch (e) { /* ignore */ }
            });
        }
        this.markers = [];
        // clear mapping
        this.markerByDcId.clear();
    }

    // Periodically fetch datacenters API and merge changes (detect migrations)
    startAutoRefresh(intervalMs = 10000) {
        // store interval id so it could be cleared later if needed
        this._autoRefreshInterval = setInterval(() => this.fetchAndMergeDatacenters(), intervalMs);
    }

    async fetchAndMergeDatacenters() {
        try {
            // Clear any leftover migration animations before refresh
            this.clearMigrationAnimations();
            
            const resp = await fetch('/api/v1/datacenters', { cache: 'no-store' });
            if (!resp.ok) throw new Error('Failed to fetch datacenters from API');
            const data = await resp.json();
            const newDCs = data.datacenters || [];

            // Build maps of vmId -> datacenterId for old and new data
            const oldMap = new Map();
            this.datacenters.forEach(dc => {
                (dc.vms || []).forEach(vm => oldMap.set(vm.id, dc.id));
            });

            const newMap = new Map();
            newDCs.forEach(dc => {
                (dc.vms || []).forEach(vm => newMap.set(vm.id, dc.id));
            });

            // Detect migrations: vmId present in both maps but with different dc id
            const migrations = [];
            newMap.forEach((toDcId, vmId) => {
                const fromDcId = oldMap.get(vmId);
                if (fromDcId && fromDcId !== toDcId) {
                    const fromDc = this.datacenters.find(d => d.id === fromDcId);
                    const toDc = newDCs.find(d => d.id === toDcId);
                    const vm = newDCs.find(d => d.id === toDcId)?.vms?.find(v => v.id === vmId) || null;
                    if (fromDc && toDc && vm) {
                        // mark this VM with a migration timestamp so UI can sort by latest migrations
                        try { vm._lastMigratedAt = Date.now(); } catch (e) { /* ignore */ }
                        migrations.push({ vm, fromDc, toDc });
                    }
                }
            });

            // Replace local datacenters with the fresh data (keep structure)
            this.datacenters = newDCs;

            // Refresh markers: remove and recreate
            this.clearMarkers();
            this.addDatacenters();

            // Refresh UI lists/stats
            this.updateStats();
            this.renderGlobalVMList();

            // Play migration animations
            if (migrations.length > 0) {
                console.log('Detected migrations:', migrations.map(m => ({ vmId: m.vm.id, from: m.fromDc.name, to: m.toDc.name })));
                // show a short toast for the first migration to give user feedback
                try {
                    const toastEl = document.getElementById('toast');
                    if (toastEl) {
                        const first = migrations[0];
                        toastEl.textContent = `Migration: ${first.vm.id} → ${first.fromDc.name} → ${first.toDc.name}`;
                        toastEl.style.display = 'block';
                        clearTimeout(toastEl._t);
                        toastEl._t = setTimeout(() => toastEl.style.display = 'none', 2200);
                    }
                } catch (e) { /* ignore toast errors */ }

                migrations.forEach(mig => {
                    try { this.animateMigration(mig.fromDc, mig.toDc, mig.vm); } catch (e) { console.warn('animateMigration failed', e); }
                });
            } else {
                // no migrations detected
                // console.debug('No migrations in this refresh');
            }
        } catch (err) {
            console.warn('Auto-refresh failed:', err.message || err);
        }
    }

    // Clear all active migration animations and their visual elements
    clearMigrationAnimations() {
        // Clear any intervals
        this.migrationAnimations.forEach(animation => {
            if (animation.interval) {
                clearInterval(animation.interval);
            }
            if (animation.timeout) {
                clearTimeout(animation.timeout);
            }
            // Remove visual elements from map
            try {
                if (animation.mover) this.map.removeLayer(animation.mover);
                if (animation.line) this.map.removeLayer(animation.line);
            } catch (e) {
                console.warn('Error clearing animation elements:', e);
            }
        });
        this.migrationAnimations = [];
    }

    // Simple migration animation: draw a polyline and move a small marker along it
    animateMigration(fromDc, toDc, vm) {
        if (!this.map || !fromDc || !toDc) return;
        
        console.log('Starting migration animation:', { from: fromDc.name, to: toDc.name, vm: vm?.vmId });

        const start = L.latLng(fromDc.coordinates[0], fromDc.coordinates[1]);
        const end = L.latLng(toDc.coordinates[0], toDc.coordinates[1]);

        // Draw migration line
        const line = L.polyline([start, end], { color: '#ffc107', weight: 3, dashArray: '6,6' }).addTo(this.map);

        // Create a moving VM marker with simpler styling
        const mover = L.circleMarker(start, { 
            radius: 8, 
            fillColor: '#0ea5a4', 
            color: '#fff', 
            weight: 2, 
            fillOpacity: 1,
            interactive: false
        }).addTo(this.map);

        const steps = 40;
        let i = 0;
        const stepMs = 30;
        
        // Track this animation
        const animation = { mover, line, interval: null, timeout: null };
        this.migrationAnimations.push(animation);
        
        animation.interval = setInterval(() => {
            i += 1;
            const t = i / steps;
            const lat = start.lat + (end.lat - start.lat) * t;
            const lng = start.lng + (end.lng - start.lng) * t;
            mover.setLatLng([lat, lng]);

            if (i >= steps) {
                clearInterval(animation.interval);

                // Flash effect at destination
                mover.setStyle({ fillColor: '#34d399', radius: 10 });

                // incoming highlight on datacenter marker element
                const destMarker = this.markerByDcId.get(Number(toDc.id));
                if (destMarker) {
                    const destEl = (typeof destMarker.getElement === 'function') ? destMarker.getElement() : null;
                    if (destEl && destEl.classList) {
                        destEl.classList.add('incoming');
                        setTimeout(() => destEl.classList.remove('incoming'), 620);
                    }
                }

                animation.timeout = setTimeout(() => {
                    try { this.map.removeLayer(mover); } catch (e) {}
                    try { this.map.removeLayer(line); } catch (e) {}
                    // Remove from tracking
                    const index = this.migrationAnimations.indexOf(animation);
                    if (index > -1) this.migrationAnimations.splice(index, 1);
                }, 800);
            }
        }, stepMs);
    }
    
    addVMActivityVisualization(datacenter) {
        // Add pulsing circles to represent VM activity
        const vmCount = datacenter.vms ? datacenter.vms.length : 0;
        const capacity = 20; // Assume 20 VM capacity per datacenter
        const vmIntensity = Math.min(vmCount / capacity, 1);
        const numRings = Math.ceil(vmIntensity * 3) || 1; // 1-3 rings based on activity, minimum 1
        
        const lat = datacenter.coordinates[0];
        const lon = datacenter.coordinates[1];
        
        for (let i = 0; i < numRings; i++) {
            setTimeout(() => {
                const activityCircle = L.circle([lat, lon], {
                    radius: 100 + (i * 50), // Different sizes
                    fillColor: '#4ecdc4',
                    color: '#4ecdc4',
                    weight: 2,
                    opacity: 0.6,
                    fillOpacity: 0.1
                }).addTo(this.map);
                
                // Animate the circle
                let opacity = 0.6;
                const fadeOut = setInterval(() => {
                    opacity -= 0.05;
                    if (opacity <= 0) {
                        this.map.removeLayer(activityCircle);
                        clearInterval(fadeOut);
                    } else {
                        activityCircle.setStyle({ opacity: opacity, fillOpacity: opacity * 0.2 });
                    }
                }, 100);
            }, i * 500);
        }
        
        // Repeat animation every 3 seconds
        setTimeout(() => {
            this.addVMActivityVisualization(datacenter);
        }, 3000);
    }
    
    setupControls() {
        // Satellite/Street view toggle
        const toggleBtn = document.getElementById('toggle-satellite');
        const centerBtn = document.getElementById('center-map');
        const triggerBtn = document.getElementById('trigger-migrate');
        const demoBtn = document.getElementById('demo-migrate');

        // apply Bulma button classes
        [toggleBtn, centerBtn, triggerBtn, demoBtn].forEach(b => {
            if (b) b.classList.add('button', 'is-small');
        });

        toggleBtn.addEventListener('click', () => {
            this.toggleMapLayer();
        });
        
        // Center map button
        centerBtn && centerBtn.addEventListener('click', () => {
            this.centerMap();
        });
    }
    
    toggleMapLayer() {
        const button = document.getElementById('toggle-satellite');
        
        if (this.currentLayer === 'street') {
            this.map.removeLayer(this.layers.street);
            this.map.addLayer(this.layers.satellite);
            this.currentLayer = 'satellite';
            button.textContent = 'Street View';
        } else {
            this.map.removeLayer(this.layers.satellite);
            this.map.addLayer(this.layers.street);
            this.currentLayer = 'street';
            button.textContent = 'Satellite View';
        }
    }
    
    centerMap() {
        if (this.markers.length > 0) {
            const group = new L.featureGroup(this.markers);
            this.map.fitBounds(group.getBounds().pad(0.2));
        } else {
            this.map.setView([59.3293, 18.0686], 11);
        }
    }
    
    showDatacenterInfo(datacenter) {
        const infoPanel = document.getElementById('datacenter-info');
        if (!infoPanel) return; // datacenter info panel removed from layout
        const utilizationPercent = Math.round((datacenter.vms / datacenter.capacity) * 100);
        
        infoPanel.innerHTML = `
            <h3>${datacenter.name}</h3>
            <div class="datacenter-details active">
                <div class="detail-item">
                    <span class="detail-label">Location:</span>
                    <span class="detail-value">${datacenter.location}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Provider:</span>
                    <span class="detail-value">${datacenter.provider}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">VMs:</span>
                    <span class="detail-value">${datacenter.vms} / ${datacenter.capacity}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Utilization:</span>
                    <span class="detail-value">${utilizationPercent}%</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Status:</span>
                    <span class="detail-value" style="color: ${datacenter.status === 'active' ? '#28a745' : '#dc3545'}">
                        ${datacenter.status.toUpperCase()}
                    </span>
                </div>
                ${datacenter.tier ? `
                <div class="detail-item">
                    <span class="detail-label">Tier:</span>
                    <span class="detail-value">${datacenter.tier}</span>
                </div>` : ''}
                ${datacenter.established ? `
                <div class="detail-item">
                    <span class="detail-label">Established:</span>
                    <span class="detail-value">${datacenter.established}</span>
                </div>` : ''}
                ${datacenter.powerCapacity ? `
                <div class="detail-item">
                    <span class="detail-label">Power:</span>
                    <span class="detail-value">${datacenter.powerCapacity}</span>
                </div>` : ''}
                ${datacenter.connectivity ? `
                <div class="detail-item">
                    <span class="detail-label">Connectivity:</span>
                    <span class="detail-value">${datacenter.connectivity.join(', ')}</span>
                </div>` : ''}
            </div>
        `;
    }
    
    showDatacenterDetails(id) {
        const datacenter = this.datacenters.find(dc => dc.id === id);
        if (datacenter) {
            this.showDatacenterInfo(datacenter);
            // Close popup
            this.map.closePopup();
        }
    }
    
    updateStats() {
        console.log('updateStats called, datacenters:', this.datacenters);
        const totalVMs = this.datacenters.reduce((sum, dc) => sum + (dc.vms ? dc.vms.length : 0), 0);
        const activeDatacenters = this.datacenters.length; // All datacenters are considered active in the new API
        
        console.log('Total VMs calculated:', totalVMs, 'Active datacenters:', activeDatacenters);
        
        document.getElementById('total-vms').textContent = totalVMs;
        document.getElementById('active-datacenters').textContent = activeDatacenters;

        // refresh global VM list since counts may have changed
        this.renderGlobalVMList();
    }
    
    startSimulation() {
        // Start VM activity visualization for all datacenters
        console.log('Starting VM activity visualization...');
        this.startVMActivitySimulation();
    }
    
    startVMActivitySimulation() {
        // Periodically show VM activity visualization for all datacenters
        setInterval(() => {
            this.datacenters.forEach(datacenter => {
                // Only show activity if datacenter has VMs
                if (datacenter.vms && datacenter.vms.length > 0) {
                    this.addVMActivityVisualization(datacenter);
                }
            });
        }, 3000); // Show activity every 3 seconds
    }

    setupMigrationControls() {
        const triggerBtn = document.getElementById('trigger-migrate');
        const demoBtn = document.getElementById('demo-migrate');
        const liveToggle = document.getElementById('live-migrations-toggle');
        const toastEl = document.getElementById('toast');

        const serverBase = '';

        let demoIntervalId = null;

        function showToast(msg, ms = 2500) {
            if (!toastEl) return;
            toastEl.textContent = msg;
            toastEl.style.display = 'block';
            clearTimeout(toastEl._t);
            toastEl._t = setTimeout(() => toastEl.style.display = 'none', ms);
        }

        triggerBtn.addEventListener('click', async () => {
            try {
                const useLive = liveToggle && liveToggle.checked;
                const url = `${serverBase}/api/v1/migrate${useLive ? '' : '?dry-run=1'}`;
                const res = await fetch(url);
                const json = await res.json();
                if (json.ok) {
                    showToast(json.migrated ? `Migrated ${json.vmId}${useLive ? '' : ' (dry-run)'}` : `No migration: ${json.reason}`);

                    // If server reports a migration but we're in dry-run (server didn't mutate file),
                    // animate it client-side using the reported from/to and local vm info.
                    if (json.migrated && !useLive) {
                        try {
                            const fromId = json.from;
                            const toId = json.to;
                            const fromDc = this.datacenters.find(d => d.id === fromId);
                            const toDc = this.datacenters.find(d => d.id === toId);
                            let vm = null;
                            if (fromDc) vm = (fromDc.vms || []).find(v => v.id === json.vmId) || null;
                            if (!vm && toDc) vm = (toDc.vms || []).find(v => v.id === json.vmId) || null;
                            if (fromDc && toDc) {
                                this.animateMigration(fromDc, toDc, vm || { vmId: json.vmId });
                            }
                        } catch (e) {
                            console.warn('Failed to animate reported dry-run migration', e);
                        }
                    }

                    // refresh local data (in case server actually applied changes or for status update)
                    await this.fetchAndMergeDatacenters();
                } else {
                    showToast('Migration failed');
                }
            } catch (err) {
                showToast('Error contacting migration server');
                console.warn(err);
            }
        });

        demoBtn.addEventListener('click', async () => {
            // Demo runs in dry-run mode by default to avoid mutating the backend datastore
            if (demoIntervalId) {
                clearInterval(demoIntervalId);
                demoIntervalId = null;
                demoBtn.textContent = 'Start Demo Migrations';
                showToast('Demo stopped (dry-run)');
                return;
            }

            demoBtn.textContent = 'Stop Demo Migrations';
            showToast('Starting demo migrations (dry-run)');

            demoIntervalId = setInterval(async () => {
                try {
                    const useLive = liveToggle && liveToggle.checked;
                    const url = `${serverBase}/api/v1/migrate${useLive ? '' : '?dry-run=1'}`;
                    const res = await fetch(url);
                    const json = await res.json();
                    if (json.ok) {
                        showToast(json.migrated ? `Migrated ${json.vmId}${useLive ? '' : ' (dry-run)'}` : `No migration`, 1200);

                        // If dry-run, animate the migration based on server response so user sees it
                        if (json.migrated && !useLive) {
                            try {
                                const fromId = json.from;
                                const toId = json.to;
                                const fromDc = this.datacenters.find(d => d.id === fromId);
                                const toDc = this.datacenters.find(d => d.id === toId);
                                let vm = null;
                                if (fromDc) vm = (fromDc.vms || []).find(v => v.id === json.vmId) || null;
                                if (!vm && toDc) vm = (toDc.vms || []).find(v => v.id === json.vmId) || null;
                                if (fromDc && toDc) {
                                    this.animateMigration(fromDc, toDc, vm || { vmId: json.vmId });
                                }
                            } catch (e) {
                                console.warn('Failed to animate reported dry-run migration', e);
                            }
                        }

                        // fetch fresh data
                        await this.fetchAndMergeDatacenters();
                    }
                } catch (err) {
                    console.warn('Demo migration error', err);
                }
            }, 2500);
        });
    }
}

// Global variable for popup button access
let app;

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    app = new StockholmDatacentersMap();
    
    // Handle window resize
    window.addEventListener('resize', () => {
        setTimeout(() => {
            if (app.map) {
                app.map.invalidateSize();
            }
        }, 100);
    });
});