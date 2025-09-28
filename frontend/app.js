// Stockholm Datacenters Map Application using Leaflet.js
class StockholmDatacentersMap {
    constructor() {
        this.map = null;
        this.datacenters = [];
        this.markers = [];
        this.markerByDcId = new Map();
        this.migrationAnimations = []; // Track active animations
        this.migrationLines = new Map(); // Track active migration lines
        this.migrationOverlays = new Map(); // Track migration overlay elements
        this.forceGraphs = new Map(); // Track force-directed graphs for each datacenter
        this.migrations = []; // Track migration data
        this.currentLayer = 'satellite';
        this.layers = {};
        
        this.currentPopupDcId = null; // track which datacenter popup is open
        this.init();
    }

    // Setup observers so panels reposition when their content changes size (expands/collapses)
    setupRightOverlayObservers() {
        try {
            const dcPanel = document.getElementById('datacenter-overview-panel');
            const vmPanel = document.getElementById('active-vms-panel');

            const resizeCb = () => {
                // Small throttle to avoid flood
                if (this._repositionTimeout) clearTimeout(this._repositionTimeout);
                this._repositionTimeout = setTimeout(() => {
                    this.adjustMigrationsPanelPosition();
                }, 80);
            };

            // Use ResizeObserver if available
            if (window.ResizeObserver) {
                const ro = new ResizeObserver(resizeCb);
                if (dcPanel) ro.observe(dcPanel);
                if (vmPanel) ro.observe(vmPanel);
                // also observe inner bodies if present so expansions inside trigger reposition
                const dcBody = dcPanel ? dcPanel.querySelector('.pf-v6-c-card__body') : null;
                const vmBody = vmPanel ? vmPanel.querySelector('.pf-v6-c-card__body') : null;
                if (dcBody) ro.observe(dcBody);
                if (vmBody) ro.observe(vmBody);
                this._rightOverlayResizeObserver = ro;
            } else {
                // Fallback: MutationObserver for class changes that may expand/collapse
                const mo = new MutationObserver(resizeCb);
                const opts = { attributes: true, childList: true, subtree: true };
                if (dcPanel) mo.observe(dcPanel, opts);
                if (vmPanel) mo.observe(vmPanel, opts);
                const dcBody = dcPanel ? dcPanel.querySelector('.pf-v6-c-card__body') : null;
                const vmBody = vmPanel ? vmPanel.querySelector('.pf-v6-c-card__body') : null;
                if (dcBody) mo.observe(dcBody, opts);
                if (vmBody) mo.observe(vmBody, opts);
                this._rightOverlayMutationObserver = mo;
            }
        } catch (e) {
            console.warn('setupRightOverlayObservers error', e);
        }
    }
    
    async init() {
        await this.loadDatacenters();
        this.initMap();
        this.addDatacenters();
        this.setupControls();
        // Ensure migration panel is positioned correctly relative to header
        this.adjustMigrationsPanelPosition();
        
        // Initialize count badges
        this.updateVMCountBadge(0, 0);
        this.updateMigrationCountBadge(0, 0);
        
        this.renderGlobalVMList();
        this.renderDatacenterView();
        this.updateStats();
        this.startSimulation();
        
        // Load and render migration data
        await this.loadMigrations();
        this.renderMigrationList();
        
        // Load and display migration overlays
        await this.updateMigrationOverlays();
        
        // Clear any leftover migration animations from previous sessions
        this.clearMigrationAnimations();
        
        // Create force graphs after a short delay to ensure map is fully ready
        setTimeout(() => {
            console.log('[DEBUG] Creating force graphs after map initialization delay');
            this.createAllForceGraphs();
        }, 1000);
        
        // Force style corrections after everything is loaded
        setTimeout(() => {
            this.forceCorrectStyling();
        }, 1500);

        // Recalculate panel position on window resize
        window.addEventListener('resize', () => {
            this.adjustMigrationsPanelPosition();
        });

        // If map exists, adjust on relevant map events
        if (this.map && this.map.on) {
            const cb = () => this.adjustMigrationsPanelPosition();
            this.map.on('zoomend moveend resize', cb);
        }

        // Set up observers so that when right-side panels expand/collapse we recompute stacking
        this.setupRightOverlayObservers();
        
        // periodically refetch data to pick up migrations
        this.startAutoRefresh(5000); // every 5s
    }

    // Adjust Active Migrations panel position and max-height so it doesn't overlap header
    adjustMigrationsPanelPosition() {
        try {
            const panel = document.querySelector('.migrations-below-map');
            if (!panel) return;
            // Find the visible header (patternfly main section header)
            const header = document.querySelector('header.pf-v6-c-page__main-section');
            const headerHeight = header ? Math.ceil(header.getBoundingClientRect().height) : 0;

            // Measure Leaflet zoom/control area (prefer explicit zoom control element)
            let controlsHeight = 0;
            try {
                // Prefer the zoom control specifically
                let zoomEl = document.querySelector('.leaflet-control-zoom');
                if (!zoomEl) {
                    // Fallback: measure the grouped top-left controls container
                    zoomEl = document.querySelector('.leaflet-control-container .leaflet-top.leaflet-left');
                }
                if (zoomEl) {
                    controlsHeight = Math.ceil(zoomEl.getBoundingClientRect().height);
                }
            } catch (e) {
                controlsHeight = 0;
            }

            // Add a small gap below header and controls
            const gap = 12;
            const topPx = headerHeight + controlsHeight + gap;

            // Apply top offset and compute a dynamic maxHeight so the panel fits the viewport
            panel.style.top = topPx + 'px';
            // Use the actual migrations panel top as the base for right overlays when available
            let baseTopForRight = topPx;
            try {
                const migrationsPanel = document.querySelector('.migrations-below-map');
                if (migrationsPanel) {
                    const rect = migrationsPanel.getBoundingClientRect();
                    if (rect && typeof rect.top === 'number' && !isNaN(rect.top)) {
                        // rect.top is relative to the viewport; reuse that value to align visually
                        baseTopForRight = Math.round(rect.top);
                    }
                }
            } catch (e) {
                baseTopForRight = topPx;
            }
            const bottomGap = 40; // leave room from bottom of viewport
            const maxH = Math.max(160, window.innerHeight - topPx - bottomGap);
            panel.style.maxHeight = maxH + 'px';

            // Ensure internal card body can scroll inside the panel
            const body = panel.querySelector('.pf-v6-c-card__body');
            if (body) {
                body.style.maxHeight = (maxH - (headerHeight ? 0 : 48)) + 'px';
                body.style.overflowY = 'auto';
                body.style.minHeight = '0';
            }

            // Also adjust right-side overlays (datacenter overview and active VMs)
            try {
                const bottomGap = 40;
                const remH = window.innerHeight - topPx - bottomGap;

                const dcPanel = document.getElementById('datacenter-overview-panel');
                const vmPanel = document.getElementById('active-vms-panel');

                // Compute map bounding rect so we position right-overlays over the map area
                let mapRect = null;
                try {
                    const mapEl = document.getElementById('map');
                    if (mapEl) mapRect = mapEl.getBoundingClientRect();
                } catch (e) {
                    mapRect = null;
                }

                // compute right offset such that overlay sits inside the map's right edge with a margin
                const defaultRightMargin = 16;
                let rightOffsetPx = defaultRightMargin;
                if (mapRect) {
                    const viewportRightGap = Math.max(0, window.innerWidth - mapRect.right);
                    rightOffsetPx = Math.max(8, viewportRightGap + defaultRightMargin);
                }

                // Use measured element heights to stack panels vertically without overlap
                let currentTop = baseTopForRight;
                const gapBetween = 12;
                const rightYOffset = 12; // nudge right overlays slightly down from migrations top

                if (dcPanel) {
                    dcPanel.style.top = (currentTop + rightYOffset) + 'px';
                    // anchor horizontally to stay inside map
                    dcPanel.style.right = rightOffsetPx + 'px';
                    // compute max height available for dcPanel (but let it expand up to 65% of remaining area)
                    const dcMax = Math.max(180, Math.floor(remH * 0.65));
                    dcPanel.style.maxHeight = dcMax + 'px';
                    const dcBody = dcPanel.querySelector('.pf-v6-c-card__body');
                    if (dcBody) {
                        dcBody.style.maxHeight = (dcMax - 48) + 'px';
                        dcBody.style.overflowY = 'auto';
                        dcBody.style.minHeight = '0';
                    }
                    // compute actual height used (respecting maxHeight)
                    const used = Math.min(dcPanel.getBoundingClientRect().height || dcMax, dcMax);
                    currentTop = currentTop + rightYOffset + used + gapBetween;
                }

                if (vmPanel) {
                    // place vmPanel at the next available top to avoid overlapping
                    vmPanel.style.top = currentTop + 'px';
                    // anchor horizontally to stay inside map
                    vmPanel.style.right = rightOffsetPx + 'px';
                    const vmMax = Math.max(160, window.innerHeight - currentTop - bottomGap);
                    vmPanel.style.maxHeight = vmMax + 'px';
                    const vmBody = vmPanel.querySelector('.pf-v6-c-card__body');
                    if (vmBody) {
                        vmBody.style.maxHeight = (vmMax - 48) + 'px';
                        vmBody.style.overflowY = 'auto';
                        vmBody.style.minHeight = '0';
                    }
                }
            } catch (e) {
                // don't let right-overlay adjustments break everything
                console.warn('adjust right overlays failed', e);
            }
        } catch (e) {
            console.warn('adjustMigrationsPanelPosition failed', e);
        }
    }
    
    // Force correct styling with JavaScript
    forceCorrectStyling() {
        console.log('[DEBUG] Forcing correct styling...');
        
        // Don't force pixel dimensions - let CSS grid handle layout
        // Just ensure Leaflet map resizes properly
        if (this.map) {
            console.log('[DEBUG] Invalidating map size...');
            setTimeout(() => {
                this.map.invalidateSize();
                console.log('[DEBUG] Map size invalidated');
            }, 100);
        }
        
        // Force remove borders from collapsed panels (but don't override layout)
        const collapsedContents = document.querySelectorAll('.pf-v6-c-card__body.collapsed');
        collapsedContents.forEach(content => {
            content.style.setProperty('border', 'none', 'important');
            content.style.setProperty('padding', '0', 'important');
            content.style.setProperty('margin', '0', 'important');
        });
        
        console.log('[DEBUG] Styling corrections applied');
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

        
        // Add scale control
        L.control.scale({
            position: 'bottomright',
            imperial: false
        }).addTo(this.map);
        
        // Add map movement handlers for force graphs and migration overlays
        this.map.on('zoom viewreset moveend', () => {
            this.datacenters.forEach(dc => {
                this.updateForceGraphPosition(dc.id);
            });
            this.updateMigrationOverlayPositions();
        });
        
        console.log('Map initialized at Stockholm coordinates');
    }
    
    addDatacenters(fitBounds = true) {
        this.datacenters.forEach(dc => {
            this.createDatacenterMarker(dc);
        });

        // Fit map to show all datacenters with some padding (optional)
        if (fitBounds && this.markers.length > 0) {
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
                    <div class="datacenter-point"></div>
                    <div class="map-datacenter-label">${datacenter.name}</div>
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
        
        // Add click event for datacenter view panel (no popup)
        marker.on('click', () => {
            this.currentPopupDcId = datacenter.id;
            this.showDatacenterInfo(datacenter);
            this.renderGlobalVMList(datacenter.id);
            this.renderDatacenterView(datacenter.id); // Update datacenter view
        });
        
    // Store marker reference
    this.markers.push(marker);
    this.markerByDcId.set(datacenter.id, marker);
        
        // Add VM activity visualization
        this.addVMActivityVisualization(datacenter);
        
        // Note: Force-directed graphs are now created separately after map initialization
    }

    // Flatten all VMs from datacenters into a single array with parent dc reference
    flattenVMs() {
        const rows = [];
        this.datacenters.forEach(dc => {
            // Ensure we're accessing the correct VMs array from API response
            const vmsList = dc.vms || dc.VMs || [];
            console.log(`[DEBUG] Flattening VMs for datacenter ${dc.name}: found ${vmsList.length} VMs`);
            vmsList.forEach(vm => {
                rows.push(Object.assign({}, vm, { datacenterId: dc.id, datacenterName: dc.name, dcLocation: dc.location }));
            });
        });
        console.log(`[DEBUG] Total flattened VMs: ${rows.length}`);
        return rows;
    }

    renderGlobalVMList(focusDatacenterId = null) {
        const container = document.getElementById('vm-list-rows');
        if (!container) {
            console.warn('[DEBUG] VM list container not found!');
            return;
        }
        container.innerHTML = '';

        let vms = this.flattenVMs();

        // Apply configurable filters
        const filterModeEl = document.getElementById('vm-filter-mode');
        const hideInactiveEl = document.getElementById('vm-hide-inactive');
        const nameFilterEl = document.getElementById('vm-name-filter');

        // Load saved preferences if controls aren't present yet
        const savedMode = localStorage.getItem('vmFilterMode');
        const savedHide = localStorage.getItem('vmHideInactive');
        const savedNameFilter = localStorage.getItem('vmNameFilter');
        if (filterModeEl && savedMode) filterModeEl.value = savedMode;
        if (hideInactiveEl && savedHide !== null) hideInactiveEl.checked = savedHide === 'true';
        if (nameFilterEl && savedNameFilter !== null) nameFilterEl.value = savedNameFilter;

        const mode = (filterModeEl && filterModeEl.value) || savedMode || 'all';
        const hideInactive = (hideInactiveEl && hideInactiveEl.checked) || (savedHide === 'true');
        const nameFilter = (nameFilterEl && nameFilterEl.value) || savedNameFilter || '';

        // Store total VM count before filtering for badge update
        const totalVMCount = vms.length;

        // If hiding inactive, filter them out
        if (hideInactive) {
            const inactiveStatuses = new Set(['stopped', 'stopping', 'terminated', 'shutdown', 'deleted', 'failed', 'succeeded']);
            // Also check both status and phase fields to catch all inactive VMs
            vms = vms.filter(vm => {
                const status = String((vm.status || '').toLowerCase());
                const phase = String((vm.phase || '').toLowerCase());
                return !inactiveStatuses.has(status) && !inactiveStatuses.has(phase);
            });
        }

        // Mode-based filtering
        if (mode === 'migrating') {
            vms = vms.filter(vm => vm.migrationStatus === 'migrating' || vm.status === 'migrating' || vm.status === 'waitingforreceiver');
        }

        // Name-based filtering
        if (nameFilter.trim()) {
            const filterLower = nameFilter.trim().toLowerCase();
            vms = vms.filter(vm => {
                const vmName = (vm.name || vm.id || '').toLowerCase();
                return vmName.includes(filterLower);
            });
        }

        // Update VM count badge
        this.updateVMCountBadge(vms.length, totalVMCount);

        console.log('[DEBUG] renderGlobalVMList called with', vms.length, 'VMs');

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

            // migrating state
            if (vm.migrationStatus === "migrating" || vm.status === "migrating" || vm.status === "waitingforreceiver") {
                row.classList.add('migrating');
            }

            // focus highlight
            if (focusDatacenterId && vm.datacenterId === focusDatacenterId) {
                row.style.background = '#f1f5ff';
                row.style.borderColor = '#e0e7ff';
            }

            // Build a compact table-like grid for VM metadata
            const table = document.createElement('div');
            table.className = 'vm-table';

            // Left column: primary label (name / id)
            const leftLabel = document.createElement('div');
            leftLabel.className = 'label';
            leftLabel.textContent = vm.name || vm.id || 'unnamed';

            // Right column: values (datacenter, status, kubevirt info) and actions
            const rightValue = document.createElement('div');
            rightValue.className = 'value';

            // Status / migration display
            const vmStatus = vm.phase || vm.status || 'Unknown';
            let kubeVirtPieces = [];
            if (vm.cluster) kubeVirtPieces.push(`Cluster: ${vm.cluster}`);
            if (vm.namespace) kubeVirtPieces.push(`NS: ${vm.namespace}`);
            if (vm.ip) kubeVirtPieces.push(`IP: ${vm.ip}`);
            if (vm.nodeName) kubeVirtPieces.push(`Node: ${vm.nodeName}`);
            if (vm.ready !== undefined) kubeVirtPieces.push(`Ready: ${vm.ready ? '✓' : '✗'}`);
            if (vm.age) kubeVirtPieces.push(`Age: ${vm.age}`);

            let statusDisplay = vmStatus;
            if (vm.migrationStatus === "migrating" || vm.status === "migrating" || vm.status === "waitingforreceiver") {
                const icon = '🔄';
                statusDisplay = vm.status === "waitingforreceiver" ? `${icon} Waiting for receiver` : `${icon} Migrating`;
            }

            // Compose right column content
            const metaLine = document.createElement('div');
            metaLine.style.display = 'flex';
            metaLine.style.justifyContent = 'space-between';
            metaLine.style.alignItems = 'center';

            const metaText = document.createElement('div');
            metaText.innerHTML = `<div class="vm-sub">${vm.id} • ${vm.datacenterName} • <span class="vm-status">${statusDisplay}</span>${kubeVirtPieces.length ? ' • ' + kubeVirtPieces.join(' • ') : ''}</div>
                <div class="vm-resources">CPU: ${vm.cpu || 'N/A'} • Mem: ${vm.memory || 'N/A'}MB • Disk: ${vm.disk || 'N/A'}GB</div>`;

            const actions = document.createElement('div');
            actions.className = 'vm-actions';
            const btn = document.createElement('button');
            btn.title = 'Center on datacenter';
            btn.textContent = 'Center';
            btn.addEventListener('click', () => {
                const dc = this.datacenters.find(d => d.id === vm.datacenterId);
                if (dc && this.map) {
                    this.map.setView([dc.coordinates[0], dc.coordinates[1]], 14, { animate: true });
                    this.showDatacenterInfo(dc);
                }
            });
            actions.appendChild(btn);

            metaLine.appendChild(metaText);
            metaLine.appendChild(actions);

            rightValue.appendChild(metaLine);

            table.appendChild(leftLabel);
            table.appendChild(rightValue);

            row.appendChild(table);
            container.appendChild(row);
        });
    }

    renderDatacenterView(selectedDatacenterId = null) {
        const container = document.getElementById('datacenter-view');
        if (!container) {
            console.warn('[DEBUG] Datacenter view container not found!');
            return;
        }

        // Clear existing content
        container.innerHTML = '';

        if (this.datacenters.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No datacenters available</p>
                </div>
            `;
            return;
        }

        // If no datacenter is selected, show all datacenters
        if (!selectedDatacenterId) {
            // Show all datacenters in a summary view
            this.datacenters.forEach(dc => {
                const dcCard = this.createDatacenterCard(dc, false);
                container.appendChild(dcCard);
            });
            return;
        }

        // Show detailed view for selected datacenter
        const selectedDc = this.datacenters.find(dc => dc.id === selectedDatacenterId);
        if (selectedDc) {
            const dcCard = this.createDatacenterCard(selectedDc, true);
            container.appendChild(dcCard);
        }
    }

    createDatacenterCard(datacenter, isSelected = false) {
        const vmsList = datacenter.vms || datacenter.VMs || [];
        const card = document.createElement('div');
        card.className = `datacenter-card ${isSelected ? 'selected' : ''}`;
        
        // Group VMs by cluster
        const vmsByCluster = new Map();
        const clusters = datacenter.clusters || [];
        
        // Initialize clusters
        clusters.forEach(cluster => {
            vmsByCluster.set(cluster, []);
        });
        
        // Group VMs by their cluster
        vmsList.forEach(vm => {
            const cluster = vm.cluster || 'unknown';
            if (!vmsByCluster.has(cluster)) {
                vmsByCluster.set(cluster, []);
            }
            vmsByCluster.get(cluster).push(vm);
        });

        const runningVMs = vmsList.filter(vm => vm.status === 'running' || vm.phase === 'Running').length;
        const totalVMs = vmsList.length;
        
        card.innerHTML = `
            <div class="datacenter-header" onclick="window.app.focusOnDatacenter('${datacenter.id}')">
                <h4 class="datacenter-title">${datacenter.name}</h4>
                <div class="datacenter-status">
                    <div class="status-indicator"></div>
                    <span>Active</span>
                </div>
            </div>
            <div class="datacenter-meta">
                📍 ${datacenter.location}<br>
                💻 ${totalVMs} VMs (${runningVMs} running)<br>
                ⚙️ ${clusters.length} cluster${clusters.length !== 1 ? 's' : ''}
            </div>
        `;

        // Add back button for detailed view
        if (isSelected) {
            const backButton = document.createElement('button');
            backButton.className = 'pf-v6-c-button pf-m-link pf-m-small datacenter-back-btn';
            backButton.innerHTML = '← Back to Overview';
            backButton.onclick = () => {
                this.renderDatacenterView(); // Go back to overview
                this.currentPopupDcId = null; // Clear selected datacenter
            };
            card.insertBefore(backButton, card.firstChild);
        }

        if (isSelected && clusters.length > 0) {
            const clustersSection = document.createElement('div');
            clustersSection.className = 'clusters-section';
            clustersSection.innerHTML = '<h5 class="clusters-title">🔧 Clusters & VMs</h5>';
            
            // Sort clusters by VM count (descending)
            const sortedClusters = Array.from(vmsByCluster.entries())
                .sort((a, b) => b[1].length - a[1].length);
            
            sortedClusters.forEach(([clusterName, clusterVMs]) => {
                const clusterCard = this.createClusterCard(clusterName, clusterVMs, datacenter.id);
                clustersSection.appendChild(clusterCard);
            });
            
            card.appendChild(clustersSection);
        }
        
        return card;
    }

    createClusterCard(clusterName, vms, datacenterId) {
        const clusterCard = document.createElement('div');
        clusterCard.className = 'cluster-card';
        
        const runningVMs = vms.filter(vm => vm.status === 'running' || vm.phase === 'Running').length;
        const migratingVMs = vms.filter(vm => vm.migrationStatus === 'migrating' || vm.status === 'migrating').length;
        
        const clusterId = `cluster-${datacenterId}-${clusterName}`;
        const isExpanded = localStorage.getItem(`cluster-expanded-${clusterId}`) !== 'false'; // Default to expanded
        
        clusterCard.innerHTML = `
            <div class="cluster-header">
                <div class="cluster-name">${clusterName}</div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    ${migratingVMs > 0 ? `<span style="color: #0ea5a4; font-size: 11px;">🔄 ${migratingVMs}</span>` : ''}
                    <span class="vm-count-badge">${vms.length}</span>
                    <button class="expand-toggle ${isExpanded ? 'expanded' : ''}" onclick="window.app.toggleCluster('${clusterId}')">▶</button>
                </div>
            </div>
        `;
        
        const vmsList = document.createElement('div');
        vmsList.className = `cluster-vms ${isExpanded ? '' : 'collapsed'}`;
        vmsList.id = `vms-${clusterId}`;
        
        if (vms.length === 0) {
            vmsList.innerHTML = '<div class="no-vms">No VMs in this cluster</div>';
        } else {
            // Sort VMs: migrating first, then by status, then by name
            const sortedVMs = vms.sort((a, b) => {
                const aMigrating = a.migrationStatus === 'migrating' || a.status === 'migrating' ? 1 : 0;
                const bMigrating = b.migrationStatus === 'migrating' || b.status === 'migrating' ? 1 : 0;
                
                if (aMigrating !== bMigrating) return bMigrating - aMigrating;
                
                const aStatus = a.status || a.phase || 'unknown';
                const bStatus = b.status || b.phase || 'unknown';
                if (aStatus !== bStatus) return aStatus.localeCompare(bStatus);
                
                return a.name.localeCompare(b.name);
            });
            
            sortedVMs.forEach(vm => {
                const vmItem = this.createVMItem(vm);
                vmsList.appendChild(vmItem);
            });
        }
        
        clusterCard.appendChild(vmsList);
        return clusterCard;
    }

    createVMItem(vm) {
        const vmItem = document.createElement('div');
        vmItem.className = 'vm-item';
        
        if (vm.migrationStatus === 'migrating' || vm.status === 'migrating') {
            vmItem.classList.add('migrating');
        }
        
        const status = vm.status || vm.phase || 'unknown';
        const statusClass = this.getVMStatusClass(status, vm);
        
        const resources = [];
        if (vm.cpu) resources.push(`${vm.cpu} CPU`);
        if (vm.memory) resources.push(`${vm.memory}MB RAM`);
        if (vm.disk) resources.push(`${vm.disk}GB`);
        
        const vmStatusText = vm.migrationStatus === 'migrating' ? '🔄 Migrating' : 
                            vm.status === 'waitingforreceiver' ? '🔄 Waiting' : status;
        
        vmItem.innerHTML = `
            <div class="vm-info">
                <div class="vm-name">${vm.name}</div>
                <div class="vm-details">
                    ${resources.join(' • ')}
                    ${vm.nodeName ? ` • ${vm.nodeName}` : ''}
                    ${vm.age ? ` • ${vm.age}` : ''}
                </div>
            </div>
            <div class="vm-status">
                <div class="vm-status-icon ${statusClass}"></div>
                <span>${vmStatusText}</span>
            </div>
        `;
        
        return vmItem;
    }

    getVMStatusClass(status, vm) {
        if (vm.migrationStatus === 'migrating' || vm.status === 'migrating' || vm.status === 'waitingforreceiver') {
            return 'migrating';
        }
        
        const normalizedStatus = status.toLowerCase();
        if (normalizedStatus.includes('running')) return 'running';
        if (normalizedStatus.includes('stopped')) return 'stopped';
        if (normalizedStatus.includes('starting')) return 'starting';
        
        return 'running'; // Default
    }

    focusOnDatacenter(datacenterId) {
        const datacenter = this.datacenters.find(dc => dc.id === datacenterId);
        if (datacenter && this.map) {
            this.map.setView([datacenter.coordinates[0], datacenter.coordinates[1]], 14, { animate: true });
            
            // Update the current selection and render the datacenter view
            this.currentPopupDcId = datacenterId;
            this.renderDatacenterView(datacenterId);
        }
    }

    toggleCluster(clusterId) {
        const vmsList = document.getElementById(`vms-${clusterId}`);
        const toggle = document.querySelector(`#datacenter-view .expand-toggle[onclick*="${clusterId}"]`);
        
        if (vmsList && toggle) {
            const isCollapsed = vmsList.classList.contains('collapsed');
            
            if (isCollapsed) {
                vmsList.classList.remove('collapsed');
                toggle.classList.add('expanded');
                localStorage.setItem(`cluster-expanded-${clusterId}`, 'true');
            } else {
                vmsList.classList.add('collapsed');
                toggle.classList.remove('expanded');
                localStorage.setItem(`cluster-expanded-${clusterId}`, 'false');
            }
        }
    }

    // Remove existing markers from the map and reset
    clearMarkers(clearForceGraphsToo = true) {
        if (this.markers && this.markers.length) {
            this.markers.forEach(m => {
                try { this.map.removeLayer(m); } catch (e) { /* ignore */ }
            });
        }
        this.markers = [];
        // clear mapping
        this.markerByDcId.clear();
        
        // Clear force graphs only if requested
        if (clearForceGraphsToo) {
            this.clearForceGraphs();
        }
    }

    // Periodically fetch datacenters API and merge changes (detect migrations)
    startAutoRefresh(intervalMs = 10000) {
        // store interval id so it could be cleared later if needed
        this._autoRefreshInterval = setInterval(() => this.fetchAndMergeDatacenters(), intervalMs);
    }

    async fetchAndMergeDatacenters() {
        try {
            console.log('[DEBUG] Starting fetchAndMergeDatacenters...');
            // Clear any leftover migration animations before refresh
            this.clearMigrationAnimations();
            
            const resp = await fetch('/api/v1/datacenters', { cache: 'no-store' });
            if (!resp.ok) throw new Error('Failed to fetch datacenters from API');
            const data = await resp.json();
            const newDCs = data.datacenters || [];

            console.log('[DEBUG] Fetched data:', newDCs.length, 'datacenters');
            console.log('[DEBUG] Current VMs before update:', this.flattenVMs().length);

            // Build maps of vmId -> datacenterId for old and new data
            const oldMap = new Map();
            this.datacenters.forEach(dc => {
                const vmsList = dc.vms || dc.VMs || [];
                vmsList.forEach(vm => oldMap.set(vm.id, dc.id));
            });

            const newMap = new Map();
            newDCs.forEach(dc => {
                const vmsList = dc.vms || dc.VMs || [];
                vmsList.forEach(vm => newMap.set(vm.id, dc.id));
            });

            // Detect VMs in migration states and sync with migration API
            const migratingVMs = [];
            
            // Enhanced migration detection using both VM status and migration API data
            await this.syncMigrationAnimations(newDCs);
            
            newDCs.forEach(dc => {
                const vmsList = dc.vms || dc.VMs || [];
                vmsList.forEach(vm => {
                    if (vm.migrationStatus === "migrating" || vm.status === "migrating" || vm.status === "waitingforreceiver") {
                        migratingVMs.push({ vm, dc });
                    }
                });
            });

            // Show migration notifications for active migrations using migration API data
            if (migratingVMs.length > 0) {
                migratingVMs.forEach(({ vm, dc }) => {
                    this.showMigrationAnimationFromAPI(vm, dc);
                });
            }

            // Clean up old migration lines periodically
            if (migratingVMs.length === 0) {
                this.cleanupOldMigrationLines();
            }

            // Clean up migration lines for VMs that are no longer migrating
            this.cleanupCompletedMigrations(migratingVMs);

            // Detect migrations: vmId present in both maps but with different dc id
            const migrations = [];
            newMap.forEach((toDcId, vmId) => {
                const fromDcId = oldMap.get(vmId);
                if (fromDcId && fromDcId !== toDcId) {
                    const fromDc = this.datacenters.find(d => d.id === fromDcId);
                    const toDc = newDCs.find(d => d.id === toDcId);
                    // Use consistent VM list access
                    const targetDc = newDCs.find(d => d.id === toDcId);
                    const vmsList = targetDc?.vms || targetDc?.VMs || [];
                    const vm = vmsList.find(v => v.id === vmId) || null;
                    
                    if (fromDc && toDc && vm) {
                        // mark this VM with a migration timestamp so UI can sort by latest migrations
                        try { vm._lastMigratedAt = Date.now(); } catch (e) { /* ignore */ }
                        migrations.push({ vm, fromDc, toDc });
                        
                        // Remove migration line for completed migration
                        this.removeMigrationLineForVM(vm.id);
                        
                        // Show completion notification with null checks
                        const fromName = fromDc?.name || 'Unknown DC';
                        const toName = toDc?.name || 'Unknown DC';
                        const vmName = vm?.name || 'Unknown VM';
                        console.log(`Migration completed: VM ${vmName} migrated from ${fromName} to ${toName}`);
                    } else {
                        console.warn('Migration detected but missing data:', { fromDc: !!fromDc, toDc: !!toDc, vm: !!vm, fromDcId, toDcId, vmId });
                    }
                }
            });

            // Replace local datacenters with the fresh data (keep structure)
            this.datacenters = newDCs;

            console.log('[DEBUG] Updated datacenters, new VM count:', this.flattenVMs().length);

            // Refresh markers: remove and recreate (but keep force graphs)
            // Preserve currently selected datacenter for the datacenter view
            const selectedDcId = this.currentPopupDcId;
            this.clearMarkers(false); // Don't clear force graphs
            // Re-add markers without changing map view (avoid fitBounds on refresh)
            this.addDatacenters(false);

            // Restore datacenter view selection if one was active
            if (selectedDcId) {
                this.currentPopupDcId = selectedDcId; // Keep the selection
                this.renderDatacenterView(selectedDcId);
            }

            console.log('[DEBUG] Refreshing UI lists/stats...');
            // Refresh UI lists/stats
            this.updateStats();
            this.renderGlobalVMList();
            this.renderDatacenterView(this.currentPopupDcId); // Update datacenter view
            
            console.log('[DEBUG] Updating force graphs...');
            // Update force-directed graphs smartly (only if data changed)
            this.updateForceGraphs();

            // Play migration animations (guarded)
            if (migrations.length > 0) {
                const validMigrations = migrations.filter(m => m && m.vm && m.fromDc && m.toDc);
                if (validMigrations.length > 0) {
                    console.log('Detected migrations:', validMigrations.map(m => ({ vmId: m.vm?.id || 'unknown', from: m.fromDc?.name || 'unknown', to: m.toDc?.name || 'unknown' })));
                    try {
                        const toastEl = document.getElementById('toast');
                        if (toastEl) {
                            const first = validMigrations[0];
                            toastEl.textContent = `Migration: ${first.vm.id} → ${first.fromDc.name} → ${first.toDc.name}`;
                            toastEl.style.display = 'block';
                            clearTimeout(toastEl._t);
                            toastEl._t = setTimeout(() => toastEl.style.display = 'none', 2200);
                        }
                    } catch (e) { /* ignore toast errors */ }

                    validMigrations.forEach(mig => {
                        try { this.animateMigration(mig.fromDc, mig.toDc, mig.vm); } catch (e) { console.warn('animateMigration failed', e); }
                    });
                } else {
                    console.warn('Migrations detected but no valid entries to animate', migrations);
                }
            }

            // Refresh migration data and update overlays
            try {
                await this.loadMigrations();
                this.renderMigrationList();
                await this.updateMigrationOverlays();
            } catch (e) {
                console.warn('Failed to refresh migration data:', e);
            }
        } catch (err) {
            console.error('Auto-refresh failed:', err.message || err);
            // Even if processing failed, attempt to refresh UI lists/stats to keep the view current
            try {
                this.updateStats();
            } catch (e) {
                console.warn('Failed to update stats after refresh error:', e);
            }
            try {
                this.renderGlobalVMList();
            } catch (e) {
                console.warn('Failed to refresh global VM list after refresh error:', e);
            }
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
        
        // Also clear migration overlays
        this.clearMigrationOverlays();
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
    
    drawMigrationLine(fromDatacenter, toDatacenter, vm) {
        if (!this.map || !fromDatacenter || !toDatacenter || fromDatacenter.id === toDatacenter.id) {
            return null;
        }

        // Create a unique key for this migration line
        const lineKey = `${fromDatacenter.id}-${toDatacenter.id}-${vm.id}`;
        
        // Remove existing line if it exists
        if (this.migrationLines && this.migrationLines.has(lineKey)) {
            const existingLine = this.migrationLines.get(lineKey);
            try {
                this.map.removeLayer(existingLine.line);
                if (existingLine.pulseInterval) {
                    clearInterval(existingLine.pulseInterval);
                }
            } catch (e) {
                console.warn('Error removing existing migration line:', e);
            }
        }

        // Initialize migration lines tracking if not exists
        if (!this.migrationLines) {
            this.migrationLines = new Map();
        }

        const fromCoords = [fromDatacenter.coordinates[0], fromDatacenter.coordinates[1]];
        const toCoords = [toDatacenter.coordinates[0], toDatacenter.coordinates[1]];

        // Create animated migration line
        const migrationLine = L.polyline([fromCoords, toCoords], {
            color: '#ff6b35', // Orange color for ongoing migrations
            weight: 4,
            opacity: 0.8,
            dashArray: '10, 10',
            className: 'migration-line'
        }).addTo(this.map);

        // Add pulsing animation
        let opacity = 0.8;
        let increasing = false;
        const pulseInterval = setInterval(() => {
            if (increasing) {
                opacity += 0.05;
                if (opacity >= 1.0) {
                    increasing = false;
                }
            } else {
                opacity -= 0.05;
                if (opacity <= 0.3) {
                    increasing = true;
                }
            }
            migrationLine.setStyle({ opacity });
        }, 100);

        // Store the line and its interval
        const lineData = {
            line: migrationLine,
            pulseInterval: pulseInterval,
            vm: vm,
            from: fromDatacenter.id,
            to: toDatacenter.id,
            timestamp: Date.now()
        };
        
        this.migrationLines.set(lineKey, lineData);

        console.log(`Added migration line for VM ${vm.name} from ${fromDatacenter.name} to ${toDatacenter.name}`);
        
        return lineData;
    }
    
    removeMigrationLine(fromDatacenterId, toDatacenterId, vmId) {
        if (!this.migrationLines) return;
        
        const lineKey = `${fromDatacenterId}-${toDatacenterId}-${vmId}`;
        const lineData = this.migrationLines.get(lineKey);
        
        if (lineData) {
            try {
                this.map.removeLayer(lineData.line);
                if (lineData.pulseInterval) {
                    clearInterval(lineData.pulseInterval);
                }
                this.migrationLines.delete(lineKey);
                console.log(`Removed migration line for VM ${vmId}`);
            } catch (e) {
                console.warn('Error removing migration line:', e);
            }
        }
    }
    
    cleanupOldMigrationLines() {
        if (!this.migrationLines) return;
        
        const now = Date.now();
        const maxAge = 10 * 60 * 1000; // 10 minutes
        
        this.migrationLines.forEach((lineData, key) => {
            if (now - lineData.timestamp > maxAge) {
                this.removeMigrationLine(lineData.from, lineData.to, lineData.vm.id);
            }
        });
    }
    
    cleanupCompletedMigrations(currentMigratingVMs) {
        if (!this.migrationLines) return;
        
        // Get list of currently migrating VM IDs
        const currentMigratingVMIds = new Set(currentMigratingVMs.map(({ vm }) => vm.id));
        
        // Remove migration lines for VMs that are no longer migrating
        const linesToRemove = [];
        this.migrationLines.forEach((lineData, key) => {
            if (!currentMigratingVMIds.has(lineData.vm.id)) {
                linesToRemove.push({
                    key,
                    from: lineData.from,
                    to: lineData.to,
                    vmId: lineData.vm.id
                });
            }
        });
        
        // Remove the lines
        linesToRemove.forEach(({ from, to, vmId }) => {
            this.removeMigrationLine(from, to, vmId);
            console.log(`Removed migration line for completed migration of VM ${vmId}`);
        });
    }
    
    removeMigrationLineForVM(vmId) {
        if (!this.migrationLines) return;
        
        // Find all migration lines for this VM
        const linesToRemove = [];
        this.migrationLines.forEach((lineData, key) => {
            if (lineData.vm.id === vmId) {
                linesToRemove.push({
                    key,
                    from: lineData.from,
                    to: lineData.to,
                    vmId: vmId
                });
            }
        });
        
        // Remove the lines
        linesToRemove.forEach(({ from, to, vmId: id }) => {
            this.removeMigrationLine(from, to, id);
            console.log(`Removed migration line for VM ${id} (migration completed)`);
        });
    }
    
    // Enhanced migration animation sync using migration API
    async syncMigrationAnimations(datacenters) {
        try {
            // Load active migrations from the API
            const activeMigrations = await this.loadActiveMigrations();
            console.log('[DEBUG] Active migrations for animation sync:', activeMigrations.length);
            
            // Clear existing migration overlays
            this.clearMigrationOverlays();
            
            // Create migration overlays for active migrations
            activeMigrations.forEach(migration => {
                if (!migration.completed && migration.phase !== 'Succeeded' && migration.phase !== 'Failed') {
                    this.showMigrationAnimationFromMigrationData(migration, datacenters);
                    this.createMigrationOverlay(migration, datacenters);
                }
            });
        } catch (error) {
            console.warn('Failed to sync migration animations:', error);
        }
    }
    
    // Create migration overlay showing "vm: source → target"
    createMigrationOverlay(migration, datacenters) {
        console.log('[DEBUG] Creating migration overlay for:', migration);
        
        let sourceDc = null;
        let targetDc = null;
        let sourceCluster = migration.sourceCluster;
        let targetCluster = migration.targetCluster;
        
        // Handle cases where sourceCluster is not populated
        if (!sourceCluster && migration.direction === 'incoming') {
            // For incoming migrations, try to infer source from available clusters
            // Find all clusters that are NOT the target cluster
            const allClusters = [];
            datacenters.forEach(dc => {
                if (dc.clusters) {
                    allClusters.push(...dc.clusters);
                }
            });
            const otherClusters = allClusters.filter(cluster => cluster !== targetCluster);
            if (otherClusters.length > 0) {
                sourceCluster = otherClusters[0]; // Use first available cluster as source
            }
        }
        
        if (!sourceCluster || !targetCluster) {
            console.warn('Migration missing source or target cluster:', migration);
            return;
        }
        
        // Find source and target datacenters
        datacenters.forEach(dc => {
            if (dc.clusters && dc.clusters.includes(sourceCluster)) {
                sourceDc = dc;
            }
            if (dc.clusters && dc.clusters.includes(targetCluster)) {
                targetDc = dc;
            }
        });
        
        if (!sourceDc || !targetDc) {
            console.warn('Could not find source or target datacenter for migration:', {
                migration: migration.id,
                sourceCluster,
                targetCluster,
                sourceDc: sourceDc?.name,
                targetDc: targetDc?.name
            });
            return;
        }
        
        // Skip if source and target are the same datacenter
        if (sourceDc.id === targetDc.id) {
            console.log('Skipping overlay for same-datacenter migration:', migration.id);
            return;
        }
        
        // Create overlay key
        const overlayKey = `${migration.id}-overlay`;
        
        // Position overlay in left column (offset from map edge)
        const mapBounds = this.map.getBounds();
        const leftEdge = mapBounds.getWest();
        const topEdge = mapBounds.getNorth();
        const overlayLat = topEdge - (0.01 * (this.migrationOverlays.size + 1)); // Stack vertically
        const overlayLng = leftEdge + 0.02; // Offset from left edge
        
        // Create migration overlay with OpenShift-inspired styling
        const migrationOverlay = L.divIcon({
            className: 'migration-overlay openshift-styled',
            html: `
                <div class="migration-overlay-container" style="
                    background: rgba(255, 255, 255, 0.95);
                    border: 1px solid #d2d2d2;
                    border-radius: 4px;
                    padding: 8px 12px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                    font-family: 'RedHatText', 'Red Hat Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    font-size: 13px;
                    color: #151515;
                    min-width: 200px;
                    backdrop-filter: blur(4px);
                ">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <div style="
                            width: 16px;
                            height: 16px;
                            background: #0066cc;
                            border-radius: 2px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: white;
                            font-size: 10px;
                            font-weight: 600;
                        ">VM</div>
                        <div style="
                            font-weight: 600;
                            color: #151515;
                            font-size: 13px;
                        ">${migration.vmName}</div>
                    </div>
                    <div style="
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        margin: 6px 0;
                        color: #6a6e73;
                        font-size: 12px;
                    ">
                        <span style="
                            background: #f0f0f0;
                            padding: 2px 6px;
                            border-radius: 2px;
                            font-size: 11px;
                            font-weight: 500;
                        ">${sourceDc.name.replace('Stockholm ', '').replace(' DC', '')}</span>
                        <span style="color: #0066cc;">→</span>
                        <span style="
                            background: #e8f4fd;
                            color: #0066cc;
                            padding: 2px 6px;
                            border-radius: 2px;
                            font-size: 11px;
                            font-weight: 500;
                        ">${targetDc.name.replace('Stockholm ', '').replace(' DC', '')}</span>
                    </div>
                    <div style="
                        font-size: 11px;
                        color: #6a6e73;
                        display: flex;
                        align-items: center;
                        gap: 4px;
                    ">
                        <div style="
                            width: 8px;
                            height: 8px;
                            background: ${migration.phase === 'Running' ? '#3e8635' : '#0066cc'};
                            border-radius: 50%;
                        "></div>
                        ${migration.phase}
                    </div>
                </div>
            `,
            iconSize: [220, 70],
            iconAnchor: [10, 35]
        });
        
        // Create marker at left column position
        const overlayMarker = L.marker([overlayLat, overlayLng], {
            icon: migrationOverlay,
            interactive: false,
            zIndexOffset: 1200
        }).addTo(this.map);
        
        // Store overlay for cleanup
        this.migrationOverlays.set(overlayKey, {
            marker: overlayMarker,
            migration: migration,
            timestamp: Date.now()
        });
        
        console.log(`Created migration overlay for ${migration.vmName}: ${sourceDc.name} → ${targetDc.name} (${migration.phase})`);
    }
    
    // Clear all migration overlays
    clearMigrationOverlays() {
        if (this.migrationOverlays) {
            this.migrationOverlays.forEach((overlay, key) => {
                try {
                    this.map.removeLayer(overlay.marker);
                } catch (e) {
                    console.warn('Error removing migration overlay:', e);
                }
            });
            this.migrationOverlays.clear();
        }
    }
    
    // Update migration overlay positions when map moves
    updateMigrationOverlayPositions() {
        if (!this.migrationOverlays || this.migrationOverlays.size === 0) return;
        
        const mapBounds = this.map.getBounds();
        const leftEdge = mapBounds.getWest();
        const topEdge = mapBounds.getNorth();
        
        let index = 0;
        this.migrationOverlays.forEach((overlay, key) => {
            const overlayLat = topEdge - (0.01 * (index + 1));
            const overlayLng = leftEdge + 0.02;
            overlay.marker.setLatLng([overlayLat, overlayLng]);
            index++;
        });
    }
    async updateMigrationOverlays() {
        try {
            const allMigrations = await this.loadAllMigrations();
            
            // Clear old overlays
            this.clearMigrationOverlays();
            
            // Only show migrations that are actively migrating (not succeeded or failed)
            const activeMigrations = allMigrations.filter(migration => {
                const isActive = !migration.completed && 
                                migration.phase !== 'Succeeded' && 
                                migration.phase !== 'Failed' &&
                                (migration.phase === 'Running' || 
                                 migration.phase === 'Pending' ||
                                 migration.phase === 'Scheduling' ||
                                 migration.phase === 'Scheduled' ||
                                 migration.phase === 'PreparingTarget' ||
                                 migration.phase === 'TargetReady');
                
                if (isActive) {
                    console.log('[DEBUG] Including active migration:', migration.vmName, migration.phase);
                }
                return isActive;
            });
            
            console.log(`[DEBUG] Showing ${activeMigrations.length} active migration overlays out of ${allMigrations.length} total migrations`);
            
            // Create overlays for active migrations
            activeMigrations.forEach(migration => {
                this.createMigrationOverlay(migration, this.datacenters);
            });
        } catch (error) {
            console.warn('Failed to update migration overlays:', error);
        }
    }
    
    async loadAllMigrations() {
        try {
            const response = await fetch('/api/v1/migrations');
            const data = await response.json();
            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.error('Error loading all migrations from API:', error);
            return [];
        }
    }
    
    // Show migration animation using migration API data
    showMigrationAnimationFromAPI(vm, currentDc) {
        // Find matching migration data from API
        const matchingMigration = this.migrations.find(m => 
            m.vmId === vm.id || m.vmName === vm.name
        );
        
        if (matchingMigration && matchingMigration.sourceNode && matchingMigration.targetNode) {
            // Use migration API data for more accurate animations
            this.showMigrationAnimationFromMigrationData(matchingMigration, this.datacenters);
        } else {
            // Fallback to existing logic
            const otherDc = this.datacenters.find(d => d.id !== currentDc.id);
            if (otherDc) {
                console.log(`Migration fallback: VM ${vm.name} from ${currentDc.name} to ${otherDc.name}`);
                this.drawMigrationLine(currentDc, otherDc, vm);
            }
        }
    }
    
    // Show migration animation using migration API data directly
    showMigrationAnimationFromMigrationData(migration, datacenters) {
        if (!migration.sourceNode || !migration.targetNode) return;
        
        // Find datacenters based on node information
        let sourceDc = null;
        let targetDc = null;
        
        // Try to match by cluster information from nodes
        datacenters.forEach(dc => {
            const vmsList = dc.vms || dc.VMs || [];
            vmsList.forEach(vm => {
                if (vm.nodeName === migration.sourceNode) {
                    sourceDc = dc;
                }
                if (vm.nodeName === migration.targetNode) {
                    targetDc = dc;
                }
            });
        });
        
        // If we can't find exact matches, use datacenterId from migration
        if (!sourceDc && migration.datacenterId) {
            sourceDc = datacenters.find(dc => dc.id === migration.datacenterId);
        }
        
        if (!targetDc) {
            // Find the other datacenter as target
            targetDc = datacenters.find(dc => dc.id !== migration.datacenterId);
        }
        
        if (sourceDc && targetDc && sourceDc.id !== targetDc.id) {
            const vm = {
                id: migration.vmId,
                name: migration.vmName,
                migrationStatus: 'migrating'
            };
            
            // Enhanced migration notification with more details
            this.showEnhancedMigrationNotification(vm, sourceDc, targetDc, migration);
            this.drawMigrationLine(sourceDc, targetDc, vm);
            
            console.log(`[MIGRATION] Showing animation for ${migration.vmName}: ${sourceDc.name} → ${targetDc.name} (${migration.phase})`);
        }
    }
    
    // Enhanced migration notification with migration API details
    showEnhancedMigrationNotification(vm, fromDatacenter, toDatacenter, migrationData = null) {
        const phaseInfo = migrationData ? ` (${migrationData.phase})` : '';
        const timeInfo = migrationData && migrationData.startTime ? 
            ` • Started ${this.formatTimeAgo(migrationData.startTime)}` : '';
        
        const message = `VM ${vm.name || vm.vmId}${phaseInfo} is migrating from ${fromDatacenter.name} to ${toDatacenter.name}${timeInfo}`;
        
        // Create or get the notification container
        let notificationContainer = document.getElementById('notification-container');
        if (!notificationContainer) {
            notificationContainer = document.createElement('div');
            notificationContainer.id = 'notification-container';
            notificationContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                pointer-events: none;
            `;
            document.body.appendChild(notificationContainer);
        }
        
        // Create notification toast with enhanced styling
        const notification = document.createElement('div');
        notification.className = 'toast migration enhanced';
        notification.style.cssText = `
            margin-bottom: 10px;
            pointer-events: auto;
            max-width: 400px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
        `;
        
        const phaseIcon = this.getMigrationPhaseIcon(migrationData?.phase);
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <div style="font-size: 20px;">${phaseIcon}</div>
                <div>
                    <strong>Migration ${migrationData?.phase || 'In Progress'}</strong><br>
                    <span style="font-size: 0.9em; opacity: 0.95;">${vm.name || vm.vmId}</span><br>
                    <span style="font-size: 0.8em; opacity: 0.8;">${fromDatacenter.name} → ${toDatacenter.name}${timeInfo}</span>
                </div>
            </div>
        `;
        
        // Add to container
        notificationContainer.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        }, 50);
        
        // Remove after delay
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 6000);
    }
    
    // Get appropriate icon for migration phase
    getMigrationPhaseIcon(phase) {
        const icons = {
            'Pending': '⏳',
            'Scheduling': '📋',
            'Scheduled': '📅', 
            'PreparingTarget': '🔧',
            'TargetReady': '✅',
            'Running': '🚀',
            'Succeeded': '✅',
            'Failed': '❌'
        };
        return icons[phase] || '🔄';
    }
    
    addVMActivityVisualization(datacenter) {
        // Add pulsing circles to represent VM activity
        const vmsList = datacenter.vms || datacenter.VMs || [];
        const vmCount = vmsList.length;
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
    
    createForceDirectedGraph(datacenter) {
        // Skip if no VMs
        const vmsList = datacenter.vms || datacenter.VMs || [];
        if (vmsList.length === 0) {
            return;
        }
        
        // Remove existing graph if it exists
        const existingGraph = this.forceGraphs.get(datacenter.id);
        if (existingGraph) {
            try {
                if (existingGraph.simulation) {
                    existingGraph.simulation.stop();
                }
                if (existingGraph.elements) {
                    if (existingGraph.elements.link) existingGraph.elements.link.remove();
                    if (existingGraph.elements.node) existingGraph.elements.node.remove();
                    if (existingGraph.elements.label) existingGraph.elements.label.remove();
                }
            } catch (e) {
                console.warn('Error removing existing force graph:', e);
            }
        }
        
        const dcCoords = datacenter.coordinates;
        const dcPoint = this.map.latLngToLayerPoint([dcCoords[0], dcCoords[1]]);
        
        // Get or create the SVG layer
        let svg = d3.select(this.map.getPanes().overlayPane).select('svg');
        
        if (svg.empty()) {
            // Create SVG overlay if it doesn't exist
            svg = d3.select(this.map.getPanes().overlayPane)
                .append('svg')
                .style('pointer-events', 'auto')
                .style('position', 'absolute')
                .style('top', '0')
                .style('left', '0')
                .style('width', '100%')
                .style('height', '100%')
                .attr('class', 'leaflet-svg-layer');
        }
        
        let g = svg.select('g');
        if (g.empty()) {
            g = svg.append('g').attr('class', 'force-graph');
        } else {
            // ensure existing group has the expected class so CSS rules apply
            g.attr('class', (d, i, nodes) => {
                const existing = nodes && nodes[0] && nodes[0].getAttribute && nodes[0].getAttribute('class');
                if (existing && existing.indexOf('force-graph') !== -1) return existing;
                return (existing ? existing + ' ' : '') + 'force-graph';
            });
        }
        
        // Prepare data
        const nodes = [
            { 
                id: `datacenter-${datacenter.id}`, 
                type: 'datacenter', 
                x: dcPoint.x, 
                y: dcPoint.y, 
                fx: dcPoint.x, 
                fy: dcPoint.y 
            }
        ];
        
        const links = [];
        
        // Add VM nodes
        vmsList.forEach(vm => {
            const vmId = `vm-${datacenter.id}-${vm.id}`;
            nodes.push({
                id: vmId,
                type: 'vm',
                name: vm.name,
                status: vm.status,
                ready: vm.ready,
                migrationStatus: vm.migrationStatus,
                vm: vm
            });
            
            // Connect VM to datacenter
            links.push({
                source: `datacenter-${datacenter.id}`,
                target: vmId
            });
        });
        
        // Create force simulation
        const simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(d => d.id).distance(50))
            .force('charge', d3.forceManyBody().strength(-100))
            .force('center', d3.forceCenter(dcPoint.x, dcPoint.y))
            .force('collision', d3.forceCollide().radius(15));
        
        // Create links
        const link = g.selectAll(`.link-${datacenter.id}`)
            .data(links)
            .enter().append('line')
            .attr('class', `link-${datacenter.id} vm-link`)
            .attr('stroke', '#ff4d4f')
            .attr('stroke-opacity', 0.95)
            .attr('stroke-width', 2)
            .attr('stroke-linecap', 'round');

        // ensure links are rendered beneath nodes by moving each line to be the group's first child
        try {
            link.each(function() {
                const p = this.parentNode;
                if (p && p.firstChild !== this) p.insertBefore(this, p.firstChild);
            });
        } catch (e) {
            // ignore if DOM manipulation fails in some environments
        }
            
        // Create VM nodes
        const node = g.selectAll(`.node-${datacenter.id}`)
            .data(nodes)
            .enter().append('circle')
            .attr('class', d => `node-${datacenter.id} ${d.type}-node ${d.type === 'vm' ? this.getVMNodeClass(d) : ''}`)
            .attr('r', d => d.type === 'datacenter' ? 8 : 6)
            .attr('fill', d => {
                if (d.type === 'datacenter') return '#333';
                return this.getVMNodeColor(d);
            })
            .style('pointer-events', 'all')
            .style('cursor', 'pointer')
            .on('mouseover', (event, d) => {
                if (d.type === 'vm') {
                    this.showVMTooltip(event, d.vm);
                }
            })
            .on('mouseout', () => {
                this.hideTooltip();
            });
        
        // Add labels for VMs
        const label = g.selectAll(`.label-${datacenter.id}`)
            .data(nodes.filter(d => d.type === 'vm'))
            .enter().append('text')
            .attr('class', `label-${datacenter.id} vm-label`)
            .text(d => d.name.length > 8 ? d.name.substring(0, 8) + '...' : d.name)
            .attr('font-family', 'Red Hat Text, Arial, sans-serif')
            .attr('font-size', '12px')
            .attr('font-weight', '600')
            .attr('fill', '#222')
            .attr('stroke', '#fff')
            .attr('stroke-width', '3px')
            .attr('paint-order', 'stroke fill')
            .attr('text-anchor', 'middle')
            .style('pointer-events', 'none')
            .style('user-select', 'none');
        
        // Update positions on simulation tick
        simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);
            
            node
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);
            
            label
                .attr('x', d => d.x)
                .attr('y', d => d.y + 18);
        });
        
        // Store the graph data
        this.forceGraphs.set(datacenter.id, {
            simulation: simulation,
            nodes: nodes,
            links: links,
            elements: { link, node, label }
        });
    }
    
    getVMNodeClass(node) {
        let classes = [];
        
        if (node.migrationStatus === 'migrating' || node.status === 'migrating' || node.status === 'waitingforreceiver') {
            classes.push('migrating');
        } else if (node.ready === true) {
            classes.push('ready');
        } else if (node.ready === false) {
            classes.push('not-ready');
        }
        
        return classes.join(' ');
    }

    getVMNodeColor(node) {
        if (node.migrationStatus === 'migrating' || node.status === 'migrating' || node.status === 'waitingforreceiver') {
            return '#ff7f50'; // Orange for migrating
        } else if (node.ready === true) {
            return '#4caf50'; // Green for ready
        } else if (node.ready === false) {
            return '#f44336'; // Red for not ready
        }
        return '#999'; // Gray for unknown
    }
    
    updateForceGraphPosition(datacenterId) {
        const graphData = this.forceGraphs.get(datacenterId);
        if (!graphData) return;
        
        const datacenter = this.datacenters.find(dc => dc.id === datacenterId);
        if (!datacenter) return;
        
        const dcCoords = datacenter.coordinates;
        const dcPoint = this.map.latLngToLayerPoint([dcCoords[0], dcCoords[1]]);
        
        // Update datacenter node position
        const dcNode = graphData.nodes.find(n => n.id === `datacenter-${datacenterId}`);
        if (dcNode) {
            dcNode.fx = dcPoint.x;
            dcNode.fy = dcPoint.y;
        }
        
        // Restart simulation with new center
        graphData.simulation
            .force('center', d3.forceCenter(dcPoint.x, dcPoint.y))
            .alpha(0.3)
            .restart();
    }
    
    clearForceGraphs() {
        if (this.forceGraphs) {
            this.forceGraphs.forEach((graphData, datacenterId) => {
                try {
                    if (graphData.simulation) {
                        graphData.simulation.stop();
                    }
                    // Remove SVG elements
                    if (graphData.elements) {
                        if (graphData.elements.link) graphData.elements.link.remove();
                        if (graphData.elements.node) graphData.elements.node.remove();
                        if (graphData.elements.label) graphData.elements.label.remove();
                    }
                } catch (e) {
                    console.warn('Error clearing force graph:', e);
                }
            });
            this.forceGraphs.clear();
        }
    }

    createAllForceGraphs() {
        this.datacenters.forEach(datacenter => {
            const vmsList = datacenter.vms || datacenter.VMs || [];
            if (vmsList.length > 0) {
                this.createForceDirectedGraph(datacenter);
            }
        });
    }

    updateForceGraphs() {
        // Update all force graphs with current VM data
        // Only recreate if VM data has changed
        this.datacenters.forEach(datacenter => {
            const vmsList = datacenter.vms || datacenter.VMs || [];
            if (vmsList.length > 0) {
                const existingGraph = this.forceGraphs.get(datacenter.id);
                
                // Check if we need to recreate the graph
                if (!existingGraph || this.hasVMDataChanged(datacenter, existingGraph)) {
                    this.createForceDirectedGraph(datacenter);
                }
            } else {
                // No VMs, remove any existing graph
                const existingGraph = this.forceGraphs.get(datacenter.id);
                if (existingGraph) {
                    try {
                        if (existingGraph.simulation) {
                            existingGraph.simulation.stop();
                        }
                        if (existingGraph.elements) {
                            if (existingGraph.elements.link) existingGraph.elements.link.remove();
                            if (existingGraph.elements.node) existingGraph.elements.node.remove();
                            if (existingGraph.elements.label) existingGraph.elements.label.remove();
                        }
                    } catch (e) {
                        console.warn('Error removing force graph:', e);
                    }
                    this.forceGraphs.delete(datacenter.id);
                }
            }
        });
    }

    hasVMDataChanged(datacenter, existingGraph) {
        // Check if VM count changed
        const vmsList = datacenter.vms || datacenter.VMs || [];
        const currentVMCount = vmsList.length;
        const existingVMCount = existingGraph.nodes.filter(n => n.type === 'vm').length;
        
        if (currentVMCount !== existingVMCount) {
            return true;
        }
        
        // Check if VM IDs changed
        const currentVMIds = new Set(vmsList.map(vm => vm.id));
        const existingVMIds = new Set(existingGraph.nodes.filter(n => n.type === 'vm').map(n => n.vm.id));
        
        if (currentVMIds.size !== existingVMIds.size) {
            return true;
        }
        
        for (let vmId of currentVMIds) {
            if (!existingVMIds.has(vmId)) {
                return true;
            }
        }
        
        // Check if VM status changed (for color updates)
        for (let vm of vmsList) {
            const existingNode = existingGraph.nodes.find(n => n.type === 'vm' && n.vm.id === vm.id);
            if (existingNode && (
                existingNode.vm.ready !== vm.ready ||
                existingNode.vm.status !== vm.status ||
                existingNode.vm.migrationStatus !== vm.migrationStatus
            )) {
                return true;
            }
        }
        
        return false;
    }
    
    showVMTooltip(event, vm) {
        const tooltip = document.getElementById('tooltip');
        if (!tooltip) return;
        
        const readyIcon = vm.ready === true ? '✅' : vm.ready === false ? '❌' : '❓';
        const migrationIcon = vm.migrationStatus === 'migrating' ? '🔄' : '';
        
        tooltip.innerHTML = `
            <strong>${vm.name}</strong><br>
            Status: ${vm.status} ${readyIcon} ${migrationIcon}<br>
            CPU: ${vm.cpu || 'N/A'} | Memory: ${vm.memory || 'N/A'}MB<br>
            ${vm.cluster ? `Cluster: ${vm.cluster}<br>` : ''}
            ${vm.nodeName ? `Node: ${vm.nodeName}` : ''}
        `;
        
        tooltip.style.display = 'block';
        tooltip.style.left = (event.pageX + 10) + 'px';
        tooltip.style.top = (event.pageY - 10) + 'px';
    }
    
    hideTooltip() {
        const tooltip = document.getElementById('tooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    }
    
    testForceGraphs() {
        console.log('Force Graph Status:');
        console.log(`- D3.js available: ${typeof d3 !== 'undefined'}`);
        console.log(`- Total datacenters: ${this.datacenters.length}`);
        console.log(`- Force graphs created: ${this.forceGraphs.size}`);
        
        // Check SVG elements
        const svg = d3.select(this.map.getPanes().overlayPane).select('svg');
        console.log(`- SVG overlay exists: ${!svg.empty()}`);
        if (!svg.empty()) {
            const g = svg.select('g');
            console.log(`- SVG group exists: ${!g.empty()}`);
            console.log(`- SVG element count: ${g.selectAll('*').size()}`);
        }
        
        this.forceGraphs.forEach((graphData, dcId) => {
            const dc = this.datacenters.find(d => d.id === dcId);
            console.log(`- ${dc?.name || dcId}:`, {
                nodes: graphData.nodes.length,
                simulationActive: graphData.simulation.alpha() > 0,
                nodeElements: graphData.elements.node.size(),
                linkElements: graphData.elements.link.size(),
                labelElements: graphData.elements.label.size()
            });
        });
        
        if (this.forceGraphs.size === 0) {
            console.log('No force graphs found. Checking datacenters:');
            this.datacenters.forEach(dc => {
                console.log(`- ${dc.name}: ${dc.vms ? dc.vms.length : 0} VMs`);
            });
            console.log('Recreating force graphs...');
            this.createAllForceGraphs();
        }
    }
    
    setupControls() {
        // Satellite/Street view toggle
        const toggleBtn = document.getElementById('toggle-satellite');
        const centerBtn = document.getElementById('center-map');
        const triggerBtn = document.getElementById('trigger-migrate');
        const demoBtn = document.getElementById('demo-migrate');
        const testForceBtn = document.getElementById('test-force-graphs');

        // apply PatternFly button classes
        [toggleBtn, centerBtn, triggerBtn, demoBtn, testForceBtn].forEach(b => {
            if (b) b.classList.add('pf-v6-c-button', 'pf-m-small');
        });

        toggleBtn.addEventListener('click', () => {
            this.toggleMapLayer();
        });
        
        // Center map button
        centerBtn && centerBtn.addEventListener('click', () => {
            this.centerMap();
        });
        
        // Test force graphs button
        testForceBtn && testForceBtn.addEventListener('click', () => {
            console.log('Testing force graphs...');
            this.testForceGraphs();
        });

        // VM list filter controls
        const vmFilterMode = document.getElementById('vm-filter-mode');
        const vmHideInactive = document.getElementById('vm-hide-inactive');
        const vmNameFilter = document.getElementById('vm-name-filter');
        
        if (vmFilterMode) {
            vmFilterMode.addEventListener('change', () => {
                localStorage.setItem('vmFilterMode', vmFilterMode.value);
                this.renderGlobalVMList();
            });
        }
        if (vmHideInactive) {
            vmHideInactive.addEventListener('change', () => {
                localStorage.setItem('vmHideInactive', vmHideInactive.checked ? 'true' : 'false');
                this.renderGlobalVMList();
            });
        }
        if (vmNameFilter) {
            // Add debounced input event listener for better performance
            let debounceTimer;
            vmNameFilter.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    localStorage.setItem('vmNameFilter', vmNameFilter.value);
                    this.renderGlobalVMList();
                }, 300); // 300ms delay
            });
            
            // Also handle Enter key for immediate search
            vmNameFilter.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    clearTimeout(debounceTimer);
                    localStorage.setItem('vmNameFilter', vmNameFilter.value);
                    this.renderGlobalVMList();
                }
            });
        }

        // Migration controls
        this.setupMigrationControls();

        // Collapsible sidebar panels
        this.setupCollapsiblePanels();

        // Add test function to window for demo purposes
        const self = this;
        window.testMigrationNotification = function() {
            const mockVM = { 
                name: 'testarne', 
                vmId: 'testarne',
                id: 'testarne',
                migrationStatus: 'migrating'
            };
            const fromDC = { 
                name: 'Stockholm Solna DC', 
                id: 'dc-solna',
                coordinates: [59.38162465568805, 17.98030981149373]
            };
            const toDC = { 
                name: 'Stockholm Sollentuna DC', 
                id: 'dc-sollentuna',
                coordinates: [59.41966666666667, 17.94661111111111]
            };
            
            console.log('Testing migration with mock VM:', mockVM.name, 'from', fromDC.name, 'to', toDC.name);
            self.drawMigrationLine(fromDC, toDC, mockVM);
            console.log('Migration notification and line test triggered!');
        };

        window.clearMigrationLines = function() {
            if (self.migrationLines) {
                self.migrationLines.forEach((lineData, key) => {
                    self.removeMigrationLine(lineData.from, lineData.to, lineData.vm.id);
                });
            }
            console.log('All migration lines cleared!');
        };

        window.testMigrationCompletion = function() {
            // Simulate migration completion by removing migration line for testarne
            self.removeMigrationLineForVM('testarne');
            console.log('Migration completion test: Removed migration lines for VM testarne');
        };

        window.testForceGraphs = function() {
            console.log('Force Graph Status:');
            console.log(`- D3.js available: ${typeof d3 !== 'undefined'}`);
            console.log(`- Total datacenters: ${self.datacenters.length}`);
            console.log(`- Force graphs created: ${self.forceGraphs.size}`);
            
            // Check SVG elements
            const svg = d3.select(self.map.getPanes().overlayPane).select('svg');
            console.log(`- SVG overlay exists: ${!svg.empty()}`);
            if (!svg.empty()) {
                const g = svg.select('g');
                console.log(`- SVG group exists: ${!g.empty()}`);
                console.log(`- SVG element count: ${g.selectAll('*').size()}`);
            }
            
            self.forceGraphs.forEach((graphData, dcId) => {
                const dc = self.datacenters.find(d => d.id === dcId);
                console.log(`- ${dc?.name || dcId}:`, {
                    nodes: graphData.nodes.length,
                    simulationActive: graphData.simulation.alpha() > 0,
                    nodeElements: graphData.elements.node.size(),
                    linkElements: graphData.elements.link.size(),
                    labelElements: graphData.elements.label.size()
                });
            });
            
            if (self.forceGraphs.size === 0) {
                console.log('No force graphs found. Checking datacenters:');
                self.datacenters.forEach(dc => {
                    console.log(`- ${dc.name}: ${dc.vms ? dc.vms.length : 0} VMs`);
                });
            }
        };
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
    
    
    updateStats() {
        console.log('updateStats called, datacenters:', this.datacenters);
        const totalVMs = this.datacenters.reduce((sum, dc) => {
            const vmsList = dc.vms || dc.VMs || [];
            return sum + vmsList.length;
        }, 0);
        const activeDatacenters = this.datacenters.length; // All datacenters are considered active in the new API
        
        console.log('Total VMs calculated:', totalVMs, 'Active datacenters:', activeDatacenters);
        
        // Update stats display if elements exist (stats overlay was removed)
        const totalVMsElement = document.getElementById('total-vms');
        const activeDatacentersElement = document.getElementById('active-datacenters');
        if (totalVMsElement) totalVMsElement.textContent = totalVMs;
        if (activeDatacentersElement) activeDatacentersElement.textContent = activeDatacenters;

        // refresh global VM list since counts may have changed
        this.renderGlobalVMList();
        this.renderDatacenterView(this.currentPopupDcId);
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
                const vmsList = datacenter.vms || datacenter.VMs || [];
                if (vmsList.length > 0) {
                    this.addVMActivityVisualization(datacenter);
                }
            });
        }, 3000); // Show activity every 3 seconds
    }

    // Migration-related methods

    async loadMigrations() {
        try {
            const response = await fetch('/api/v1/migrations');
            const data = await response.json();
            this.migrations = Array.isArray(data) ? data : [];
            console.log('Loaded migrations from API:', this.migrations);
        } catch (error) {
            console.error('Error loading migrations from API:', error);
            this.migrations = [];
        }
    }

    async loadActiveMigrations() {
        try {
            // Fallback: use all migrations endpoint and filter active ones
            const response = await fetch('/api/v1/migrations');
            const data = await response.json();
            const allMigrations = Array.isArray(data) ? data : [];
            
            // Filter to get active migrations (not completed)
            const activeMigrations = allMigrations.filter(migration => !migration.completed);
            console.log('[DEBUG] Loaded', activeMigrations.length, 'active migrations out of', allMigrations.length, 'total');
            return activeMigrations;
        } catch (error) {
            console.error('Error loading active migrations from API:', error);
            return [];
        }
    }

    renderMigrationList() {
        const migrationContainer = document.getElementById('migration-list-rows');
        if (!migrationContainer) {
            console.warn('Migration container not found');
            return;
        }

        const filterMode = document.getElementById('migration-filter-mode')?.value || 'active';
        
        let filteredMigrations = [];
        if (filterMode === 'active') {
            filteredMigrations = this.migrations.filter(m => !m.completed);
        } else if (filterMode === 'completed') {
            filteredMigrations = this.migrations.filter(m => m.completed && m.phase === 'Succeeded');
        } else {
            filteredMigrations = this.migrations;
        }

        // Sort by most recent first
        filteredMigrations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        if (filteredMigrations.length === 0) {
            migrationContainer.innerHTML = `
                <div class="empty-state">
                    <p style="font-size:12px; color:#666; text-align:center; padding:10px;">
                        ${filterMode === 'active' ? 'No active migrations' : 'No migrations found'}
                    </p>
                </div>
            `;
            return;
        }

        const migrationRows = filteredMigrations.map(migration => {
            const duration = this.calculateMigrationDuration(migration);
            const timeAgo = this.formatTimeAgo(migration.createdAt);
            
            return `
                <div class="migration-item" onclick="app.showMigrationDetails('${migration.id}')">
                    <div class="migration-header">
                        <span class="migration-vm-name">${migration.vmName}</span>
                        <span class="migration-phase ${migration.phase.toLowerCase()}">${migration.phase}</span>
                    </div>
                    <div class="migration-nodes">
                        <span>${migration.sourceNode || 'Unknown'}</span>
                        <span class="migration-arrow">→</span>
                        <span>${migration.targetNode || 'Unknown'}</span>
                    </div>
                    <div class="migration-time">${timeAgo}</div>
                    ${duration ? `<div class="migration-duration">${duration}</div>` : ''}
                </div>
            `;
        }).join('');

        migrationContainer.innerHTML = migrationRows;

        // Update migration count badge
        this.updateMigrationCountBadge(filteredMigrations.length, this.migrations.length);
    }

    updateVMCountBadge(displayedCount, totalCount) {
        const badge = document.getElementById('vm-count-badge');
        if (badge) {
            badge.textContent = displayedCount;
            badge.setAttribute('data-count', displayedCount);
            badge.title = `Showing ${displayedCount} VMs`;
            
            // Update badge color based on filter status
            if (displayedCount < totalCount) {
                badge.style.background = 'var(--pf-v6-global--warning-color--100)';
                badge.title = `Showing ${displayedCount} of ${totalCount} VMs (filtered)`;
            } else {
                badge.style.background = 'var(--pf-v6-global--primary-color--100)';
            }
        }
    }

    updateMigrationCountBadge(displayedCount, totalCount) {
        const badge = document.getElementById('migration-count-badge');
        if (badge) {
            badge.textContent = displayedCount;
            badge.setAttribute('data-count', displayedCount);
            badge.title = `Showing ${displayedCount} migrations`;
            
            // Update badge color based on filter status
            if (displayedCount < totalCount) {
                badge.style.background = 'var(--pf-v6-global--warning-color--100)';
                badge.title = `Showing ${displayedCount} of ${totalCount} migrations (filtered)`;
            } else {
                badge.style.background = 'var(--pf-v6-global--primary-color--100)';
            }
        }
    }

    calculateMigrationDuration(migration) {
        if (!migration.startTime) return null;
        
        const start = new Date(migration.startTime);
        const end = migration.endTime ? new Date(migration.endTime) : new Date();
        const diffMs = end - start;
        
        if (diffMs < 0) return null;
        
        const minutes = Math.floor(diffMs / 60000);
        const seconds = Math.floor((diffMs % 60000) / 1000);
        
        if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
    }

    formatTimeAgo(dateString) {
        const now = new Date();
        const date = new Date(dateString);
        const diffMs = now - date;
        
        const minutes = Math.floor(diffMs / 60000);
        const hours = Math.floor(diffMs / 3600000);
        const days = Math.floor(diffMs / 86400000);
        
        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'Just now';
    }

    showMigrationDetails(migrationId) {
        const migration = this.migrations.find(m => m.id === migrationId);
        if (!migration) {
            console.warn('Migration not found:', migrationId);
            return;
        }

        // Create a detailed popup or modal
        let details = `Migration Details for ${migration.vmName}\n\n`;
        details += `ID: ${migration.id}\n`;
        details += `Phase: ${migration.phase}\n`;
        details += `Cluster: ${migration.cluster}\n`;
        details += `Namespace: ${migration.namespace}\n`;
        details += `Source Node: ${migration.sourceNode || 'Unknown'}\n`;
        details += `Target Node: ${migration.targetNode || 'Unknown'}\n`;
        details += `Created: ${new Date(migration.createdAt).toLocaleString()}\n`;
        
        if (migration.startTime) {
            details += `Started: ${new Date(migration.startTime).toLocaleString()}\n`;
        }
        
        if (migration.endTime) {
            details += `Ended: ${new Date(migration.endTime).toLocaleString()}\n`;
        }

        if (migration.phaseTransitions && migration.phaseTransitions.length > 0) {
            details += `\nPhase Transitions:\n`;
            migration.phaseTransitions.forEach(transition => {
                details += `- ${transition.phase}: ${new Date(transition.timestamp).toLocaleString()}\n`;
            });
        }

        alert(details); // Simple alert for now - could be enhanced with a modal
    }

    setupMigrationControls() {
        // Migration filter change handler
        const migrationFilter = document.getElementById('migration-filter-mode');
        if (migrationFilter) {
            migrationFilter.addEventListener('change', () => {
                this.renderMigrationList();
            });
        }

        // Refresh migrations button
        const refreshBtn = document.getElementById('refresh-migrations');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                // Store original content to restore later
                const originalHTML = refreshBtn.innerHTML;
                
                // Show loading state while preserving icon
                const icon = refreshBtn.querySelector('i');
                if (icon) {
                    icon.className = 'fas fa-spinner fa-spin';
                }
                refreshBtn.classList.add('refreshing');
                refreshBtn.disabled = true;
                
                try {
                    await this.loadMigrations();
                    this.renderMigrationList();
                    await this.updateMigrationOverlays();
                } catch (error) {
                    console.error('Error refreshing migrations:', error);
                }
                
                // Restore original state
                refreshBtn.innerHTML = originalHTML;
                refreshBtn.classList.remove('refreshing');
                refreshBtn.disabled = false;
            });
        }
    }

    setupCollapsiblePanels() {
        console.log('[DEBUG] Setting up collapsible panels...');
        
        // Get all collapsible headers
        const collapsibleHeaders = document.querySelectorAll('.collapsible-header');
        console.log(`[DEBUG] Found ${collapsibleHeaders.length} collapsible headers`);
        
        // Load saved collapse states from localStorage
        const savedStates = JSON.parse(localStorage.getItem('collapsiblePanelStates') || '{}');
        console.log('[DEBUG] Saved states:', savedStates);
        
        collapsibleHeaders.forEach((header, index) => {
            const target = header.getAttribute('data-target');
            const content = document.querySelector(`[data-section="${target}"]`);
            const toggle = header.querySelector('.collapse-toggle');
            
            console.log(`[DEBUG] Panel ${index}: target="${target}", content=${!!content}, toggle=${!!toggle}`);
            
            if (!content || !toggle) {
                console.warn(`[DEBUG] Missing elements for panel ${target}:`, { content: !!content, toggle: !!toggle });
                return;
            }
            
            // Apply saved state or default behavior:
            // - datacenter-overview: expanded by default (for backward compatibility)
            // - other panels: can be collapsed
            const defaultCollapsed = target !== 'datacenter-overview' ? false : false; // All expanded by default
            const isCollapsed = savedStates.hasOwnProperty(target) ? savedStates[target] : defaultCollapsed;
            
            if (isCollapsed) {
                header.classList.add('collapsed');
                content.classList.add('collapsed');
                // Apply collapsed styling - completely hide
                content.style.setProperty('border', 'none', 'important');
                content.style.setProperty('padding', '0', 'important');
                content.style.setProperty('margin', '0', 'important');
                content.style.setProperty('opacity', '0', 'important');
                content.style.setProperty('visibility', 'hidden', 'important');
                content.style.setProperty('box-shadow', 'none', 'important');
            }
            
            // Add click handler
            console.log(`[DEBUG] Adding click handler to panel ${target}`);
            header.addEventListener('click', (e) => {
                console.log(`[DEBUG] Panel ${target} clicked!`);
                e.preventDefault();
                e.stopPropagation();
                
                const isCurrentlyCollapsed = header.classList.contains('collapsed');
                console.log(`[DEBUG] Panel ${target} isCurrentlyCollapsed: ${isCurrentlyCollapsed}`);
                
                if (isCurrentlyCollapsed) {
                    // Expand
                    console.log(`[DEBUG] Expanding panel ${target}`);
                    header.classList.remove('collapsed');
                    content.classList.remove('collapsed');
                    savedStates[target] = false;
                    // Restore content properties when expanded - remove only the forced collapsed styles
                    content.style.removeProperty('border');
                    content.style.removeProperty('padding');
                    content.style.removeProperty('margin');
                    
                    // Special handling for Active VMs panel - preserve height constraints
                    if (target === 'active-vms') {
                        // Don't remove max-height and overflow for Active VMs to prevent overlap
                        console.log(`[DEBUG] Preserving height constraints for ${target}`);
                    } else {
                        content.style.removeProperty('max-height');
                        content.style.removeProperty('overflow');
                    }
                    
                    content.style.removeProperty('opacity');
                    content.style.removeProperty('visibility');
                    content.style.removeProperty('box-shadow');
                    content.style.removeProperty('background');
                } else {
                    // Collapse
                    console.log(`[DEBUG] Collapsing panel ${target}`);
                    header.classList.add('collapsed');
                    content.classList.add('collapsed');
                    savedStates[target] = true;
                    // Apply collapsed styling - completely hide
                    content.style.setProperty('border', 'none', 'important');
                    content.style.setProperty('padding', '0', 'important');
                    content.style.setProperty('margin', '0', 'important');
                    content.style.setProperty('opacity', '0', 'important');
                    content.style.setProperty('visibility', 'hidden', 'important');
                    content.style.setProperty('box-shadow', 'none', 'important');
                }
                
                // Save state to localStorage
                localStorage.setItem('collapsiblePanelStates', JSON.stringify(savedStates));
            });
        });
    }

}

// Global variable for popup button access
let app;

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    app = new StockholmDatacentersMap();
    
    // Make app globally accessible
    window.app = app;
    
    // Handle window resize with debounce: invalidate Leaflet size and update overlays
    (function() {
        let resizeTimer = null;
        const onResizeDone = () => {
            if (!app || !app.map) return;
            try {
                // Force Leaflet to recalculate sizes and redraw tiles
                app.map.invalidateSize(true);
            } catch (e) {
                console.warn('map.invalidateSize failed:', e);
            }

            // Update force-directed graph positions and other overlays to align with new map projection
            try {
                if (app.datacenters && app.datacenters.length) {
                    app.datacenters.forEach(dc => {
                        try { app.updateForceGraphPosition(dc.id); } catch (e) {/* ignore per-dc errors */}
                    });
                }
            } catch (e) {
                console.warn('Failed to update force graph positions after resize:', e);
            }
        };

        window.addEventListener('resize', () => {
            if (resizeTimer) clearTimeout(resizeTimer);
            // wait until resize stops (200ms) before recalculating map overlays
            resizeTimer = setTimeout(() => {
                onResizeDone();
                // Also force correct styling on resize
                if (window.app && window.app.forceCorrectStyling) {
                    window.app.forceCorrectStyling();
                }
            }, 200);
        });
    })();
});