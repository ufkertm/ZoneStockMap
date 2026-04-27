// State
let appState = {
    mode: 'view',
    floors: [], // Array of { id, name, image, imageWidth, imageHeight, zones: [] }
    currentFloorId: null,
    currentParentId: null, // For nested zones
    currentDrawingPoints: [],
    selectedZoneId: null,
    zoom: 1,
    pan: {x: 0, y: 0}
};

// Pan State
let isPanning = false;
let startPanX = 0;
let startPanY = 0;

// Colors
const ZONE_COLORS = [
    'rgba(233, 30, 99, 0.4)', 'rgba(156, 39, 176, 0.4)', 'rgba(63, 81, 181, 0.4)',
    'rgba(33, 150, 243, 0.4)', 'rgba(0, 150, 136, 0.4)', 'rgba(76, 175, 80, 0.4)',
    'rgba(255, 152, 0, 0.4)', 'rgba(255, 87, 34, 0.4)'
];

// DOM Elements
const sidebar = document.getElementById('sidebar');
const openSidebarBtn = document.getElementById('open-sidebar-btn');
const closeSidebarBtn = document.getElementById('close-sidebar-btn');

const krokiUpload = document.getElementById('kroki-upload');
const floorList = document.getElementById('floor-list');
const noImageText = document.getElementById('no-image-text');
const drawingArea = document.getElementById('drawing-area');
const krokiWrapper = document.getElementById('kroki-wrapper');
const krokiContainer = document.getElementById('kroki-container');
const backToParentBtn = document.getElementById('back-to-parent-btn');

const zoomInBtn = document.getElementById('zoom-in-btn');
const zoomOutBtn = document.getElementById('zoom-out-btn');
const zoomResetBtn = document.getElementById('zoom-reset-btn');

const modeViewBtn = document.getElementById('mode-view');
const modeDrawBtn = document.getElementById('mode-draw');
const drawInstructions = document.getElementById('draw-instructions');

const page2 = document.getElementById('page2');
const closePage2Btn = document.getElementById('close-page2-btn');
const zoneNameInput = document.getElementById('zone-name');
const saveZoneBtn = document.getElementById('save-zone-btn');
const deleteZoneBtn = document.getElementById('delete-zone-btn');
const clearDataBtn = document.getElementById('clear-data-btn');

const editZoneBtn = document.getElementById('edit-zone-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const zoneInfoView = document.getElementById('zone-info-view');
const zoneEditForm = document.getElementById('zone-edit-form');
const displayZoneName = document.getElementById('display-zone-name');
const displayZoneItems = document.getElementById('display-zone-items');
const enterZoneBtn = document.getElementById('enter-zone-btn');
const drawSubzoneBtn = document.getElementById('draw-subzone-btn');
const dynamicItemsContainer = document.getElementById('dynamic-items-container');
const addItemBtn = document.getElementById('add-item-btn');

const exportJsonBtn = document.getElementById('export-json-btn');
const importJsonUpload = document.getElementById('import-json-upload');
const exportCsvBtn = document.getElementById('export-csv-btn');
const searchInput = document.getElementById('search-input');
const zoneTooltip = document.getElementById('zone-tooltip');
const tooltipName = document.getElementById('tooltip-name');
const tooltipItems = document.getElementById('tooltip-items');

let currentSearchTerm = '';

function getCurrentFloor() {
    return appState.floors.find(f => f.id === appState.currentFloorId);
}

function init() {
    loadData();
    setupEventListeners();
    setMode('view');
    renderFloorList();
    renderKroki();
    renderZones();
    applyTransform();
}

function loadData() {
    const savedFloors = localStorage.getItem('krokiFloors');
    if (savedFloors) {
        try {
            appState.floors = JSON.parse(savedFloors);
            // Migration for older zones formats
            appState.floors.forEach(f => {
                if (f.zones) {
                    f.zones.forEach(z => {
                        if (z.parentId === undefined) z.parentId = null;
                        if (z.items === undefined) {
                            z.items = [];
                            if (z.stock) {
                                z.items.push({ name: 'Stok', value: z.stock });
                                delete z.stock;
                            }
                        }
                    });
                }
            });
            if (appState.floors.length > 0) {
                appState.currentFloorId = localStorage.getItem('currentFloorId') || appState.floors[0].id;
            }
        } catch (e) {
            console.error("Error parsing floors", e);
            appState.floors = [];
        }
    } else {
        // Migration from old app version
        const savedImg = localStorage.getItem('krokiImage');
        if (savedImg) {
            let oldZones = [];
            try {
                oldZones = JSON.parse(localStorage.getItem('krokiZones') || '[]');
                oldZones.forEach(z => {
                    if (z.parentId === undefined) z.parentId = null;
                    if (z.items === undefined) {
                        z.items = [];
                        if (z.stock) {
                            z.items.push({ name: 'Stok', value: z.stock });
                            delete z.stock;
                        }
                    }
                });
            } catch(e) {}
            
            const defaultFloor = {
                id: 'floor_' + Date.now(),
                name: 'Varsayılan Kat',
                image: savedImg,
                imageWidth: parseInt(localStorage.getItem('krokiWidth')) || 1000,
                imageHeight: parseInt(localStorage.getItem('krokiHeight')) || 1000,
                zones: oldZones
            };
            appState.floors = [defaultFloor];
            appState.currentFloorId = defaultFloor.id;
            saveData();
        }
    }
}

function saveData() {
    localStorage.setItem('krokiFloors', JSON.stringify(appState.floors));
    if (appState.currentFloorId) {
        localStorage.setItem('currentFloorId', appState.currentFloorId);
    }
}

function setupEventListeners() {
    openSidebarBtn.addEventListener('click', () => sidebar.classList.add('open'));
    closeSidebarBtn.addEventListener('click', () => sidebar.classList.remove('open'));
    
    krokiUpload.addEventListener('change', handleImageUpload);
    
    modeViewBtn.addEventListener('click', () => setMode('view'));
    modeDrawBtn.addEventListener('click', () => setMode('draw'));
    
    drawingArea.addEventListener('click', handleDrawingAreaClick);
    drawingArea.addEventListener('mousemove', handleDrawingMouseMove);
    
    closePage2Btn.addEventListener('click', closePage2);
    saveZoneBtn.addEventListener('click', saveZoneData);
    deleteZoneBtn.addEventListener('click', deleteCurrentZone);
    
    if (addItemBtn) addItemBtn.addEventListener('click', () => addDynamicItemRow());

    if (exportJsonBtn) exportJsonBtn.addEventListener('click', handleExportJSON);
    if (importJsonUpload) importJsonUpload.addEventListener('change', handleImportJSON);
    if (exportCsvBtn) exportCsvBtn.addEventListener('click', handleExportCSV);
    if (searchInput) searchInput.addEventListener('input', handleSearch);

    if (editZoneBtn) editZoneBtn.addEventListener('click', () => {
        zoneInfoView.classList.add('hidden');
        zoneEditForm.classList.remove('hidden');
    });
    
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', () => {
        zoneEditForm.classList.add('hidden');
        zoneInfoView.classList.remove('hidden');
    });

    if (enterZoneBtn) enterZoneBtn.addEventListener('click', () => {
        if (appState.selectedZoneId) {
            zoomIntoZone(appState.selectedZoneId);
        }
    });

    if (drawSubzoneBtn) drawSubzoneBtn.addEventListener('click', () => {
        if (appState.selectedZoneId) {
            zoomIntoZone(appState.selectedZoneId);
            setMode('draw');
        }
    });

    if (backToParentBtn) backToParentBtn.addEventListener('click', () => {
        zoomOutToMain();
    });
    
    clearDataBtn.addEventListener('click', () => {
        if(confirm("Tüm kroki ve veriler silinecek. Emin misiniz?")) {
            localStorage.clear();
            location.reload();
        }
    });

    zoomInBtn.addEventListener('click', () => setZoom(appState.zoom + 0.2));
    zoomOutBtn.addEventListener('click', () => setZoom(appState.zoom - 0.2));
    zoomResetBtn.addEventListener('click', () => {
        appState.zoom = 1;
        appState.pan = { x: 0, y: 0 };
        applyTransform(true);
    });

    krokiContainer.addEventListener('wheel', handleWheelZoom, { passive: false });
    
    krokiContainer.addEventListener('pointerdown', handlePanStart);
    window.addEventListener('pointermove', handlePanMove);
    window.addEventListener('pointerup', handlePanEnd);
}

function renderFloorList() {
    floorList.innerHTML = '';
    appState.floors.forEach(floor => {
        const item = document.createElement('div');
        item.className = 'floor-item' + (floor.id === appState.currentFloorId ? ' active' : '');
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'floor-name';
        nameSpan.textContent = floor.name;
        
        const delBtn = document.createElement('button');
        delBtn.className = 'icon-btn delete-floor-btn';
        delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
        delBtn.onclick = (e) => {
            e.stopPropagation();
            if (confirm(`"${floor.name}" silinecek. Emin misiniz?`)) {
                deleteFloor(floor.id);
            }
        };
        
        item.onclick = () => switchFloor(floor.id);
        
        item.appendChild(nameSpan);
        item.appendChild(delBtn);
        floorList.appendChild(item);
    });
}

function switchFloor(floorId) {
    if (appState.currentFloorId === floorId) return;
    appState.currentFloorId = floorId;
    appState.currentParentId = null;
    appState.selectedZoneId = null;
    appState.currentDrawingPoints = [];
    appState.zoom = 1;
    appState.pan = {x:0, y:0};
    saveData();
    
    renderFloorList();
    renderKroki();
    renderZones();
    applyTransform(true);
    closePage2();
}

function deleteFloor(floorId) {
    appState.floors = appState.floors.filter(f => f.id !== floorId);
    if (appState.currentFloorId === floorId) {
        appState.currentFloorId = appState.floors.length > 0 ? appState.floors[0].id : null;
    }
    appState.currentParentId = null;
    saveData();
    renderFloorList();
    renderKroki();
    renderZones();
    closePage2();
}

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const floorName = prompt("Kat/Kroki adını girin (Örn: Zemin Kat):", "Yeni Kat");
    if (!floorName) {
        e.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            const newFloor = {
                id: 'floor_' + Date.now(),
                name: floorName,
                image: event.target.result,
                imageWidth: img.width || 1000,
                imageHeight: img.height || 1000,
                zones: []
            };
            
            appState.floors.push(newFloor);
            appState.currentFloorId = newFloor.id;
            appState.currentParentId = null;
            appState.zoom = 1;
            appState.pan = {x:0, y:0};
            
            saveData();
            renderFloorList();
            renderKroki();
            renderZones();
            applyTransform(true);
            e.target.value = '';
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

function renderKroki() {
    const floor = getCurrentFloor();
    if (floor && floor.image) {
        drawingArea.classList.remove('hidden');
        noImageText.classList.add('hidden');
        
        drawingArea.setAttribute('width', floor.imageWidth);
        drawingArea.setAttribute('height', floor.imageHeight);
        
        if (appState.currentParentId === null) {
            drawingArea.setAttribute('viewBox', `0 0 ${floor.imageWidth} ${floor.imageHeight}`);
            backToParentBtn.classList.add('hidden');
        } else {
            zoomIntoZone(appState.currentParentId);
        }
    } else {
        drawingArea.classList.add('hidden');
        noImageText.classList.remove('hidden');
        backToParentBtn.classList.add('hidden');
    }
}

function zoomIntoZone(zoneId) {
    const floor = getCurrentFloor();
    if (!floor) return;
    const zone = floor.zones.find(z => z.id === zoneId);
    if (!zone) return;
    
    appState.currentParentId = zoneId;
    appState.selectedZoneId = null;
    
    const iW = floor.imageWidth;
    const iH = floor.imageHeight;
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    zone.points.forEach(p => {
        const x = p.x * iW;
        const y = p.y * iH;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    });
    
    const padding = Math.max(iW, iH) * 0.05;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;
    
    const boxWidth = maxX - minX;
    const boxHeight = maxY - minY;
    
    drawingArea.setAttribute('viewBox', `${minX} ${minY} ${boxWidth} ${boxHeight}`);
    
    backToParentBtn.classList.remove('hidden');
    closePage2();
    renderZones();
}

function zoomOutToMain() {
    appState.currentParentId = null;
    appState.selectedZoneId = null;
    
    const floor = getCurrentFloor();
    if (floor) {
        drawingArea.setAttribute('viewBox', `0 0 ${floor.imageWidth} ${floor.imageHeight}`);
    }
    
    backToParentBtn.classList.add('hidden');
    closePage2();
    renderZones();
}

function setMode(mode) {
    appState.mode = mode;
    appState.currentDrawingPoints = [];
    
    if (mode === 'view') {
        modeViewBtn.classList.add('active');
        modeDrawBtn.classList.remove('active');
        krokiContainer.classList.add('mode-view');
        krokiWrapper.classList.remove('mode-drawing');
        drawInstructions.classList.add('hidden');
        sidebar.classList.remove('open');
    } else {
        modeViewBtn.classList.remove('active');
        modeDrawBtn.classList.add('active');
        krokiContainer.classList.remove('mode-view');
        krokiWrapper.classList.add('mode-drawing');
        drawInstructions.classList.remove('hidden');
        closePage2();
    }
    
    renderZones();
}

function setZoom(newZoom) {
    appState.zoom = Math.max(0.1, Math.min(newZoom, 5));
    applyTransform(true);
}

function handleWheelZoom(e) {
    e.preventDefault();
    const zoomSensitivity = 0.001;
    const delta = -e.deltaY * zoomSensitivity;
    
    const newZoom = Math.max(0.1, Math.min(appState.zoom * (1 + delta), 5));
    appState.zoom = newZoom;
    applyTransform(false);
}

function applyTransform(smooth = false) {
    if (smooth) krokiWrapper.classList.add('smooth-transform');
    else krokiWrapper.classList.remove('smooth-transform');
    
    krokiWrapper.style.transform = `translate(${appState.pan.x}px, ${appState.pan.y}px) scale(${appState.zoom})`;
}

function handlePanStart(e) {
    if (appState.mode !== 'view' && e.button !== 1) return;
    if (e.target.classList.contains('zone-polygon') && appState.mode === 'view') return;
    
    isPanning = true;
    startPanX = e.clientX - appState.pan.x;
    startPanY = e.clientY - appState.pan.y;
}

function handlePanMove(e) {
    if (!isPanning) return;
    appState.pan.x = e.clientX - startPanX;
    appState.pan.y = e.clientY - startPanY;
    applyTransform(false);
}

function handlePanEnd() {
    isPanning = false;
}

function isPointInPolygon(point, vs) {
    let x = point.x, y = point.y;
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i].x, yi = vs[i].y;
        let xj = vs[j].x, yj = vs[j].y;
        let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function handleDrawingAreaClick(e) {
    if (appState.mode !== 'draw') return;
    
    const floor = getCurrentFloor();
    if (!floor) return;

    const pt = getMousePosition(e);
    const iW = floor.imageWidth;
    const iH = floor.imageHeight;
    const relPt = { x: pt.x / iW, y: pt.y / iH };

    if (appState.currentParentId !== null) {
        const parentZone = floor.zones.find(z => z.id === appState.currentParentId);
        if (parentZone && !isPointInPolygon(relPt, parentZone.points)) return;
    }

    if (appState.currentDrawingPoints.length > 2) {
        const firstPt = appState.currentDrawingPoints[0];
        const dist = Math.hypot(pt.x - firstPt.x, pt.y - firstPt.y);
        
        if (dist < 20) {
            finishDrawing();
            return;
        }
    }
    
    appState.currentDrawingPoints.push(pt);
    renderZones();
}

function handleDrawingMouseMove(e) {
    if (appState.mode !== 'draw' || appState.currentDrawingPoints.length === 0) return;
    const pt = getMousePosition(e);
    renderZones(pt);
}

function finishDrawing() {
    if (appState.currentDrawingPoints.length < 3) {
        appState.currentDrawingPoints = [];
        return;
    }
    
    const floor = getCurrentFloor();
    if (!floor) return;

    const iW = floor.imageWidth;
    const iH = floor.imageHeight;
    
    const relativePoints = appState.currentDrawingPoints.map(p => ({
        x: p.x / iW,
        y: p.y / iH
    }));

    const isSubZone = appState.currentParentId !== null;
    let color = ZONE_COLORS[(floor.zones ? floor.zones.length : 0) % ZONE_COLORS.length];
    if (isSubZone) {
        color = color.replace('0.4', '0.7'); 
    }

    const newZone = {
        id: 'zone_' + Date.now(),
        parentId: appState.currentParentId,
        points: relativePoints,
        name: '',
        items: [],
        color: color
    };
    
    if (!floor.zones) floor.zones = [];
    floor.zones.push(newZone);
    
    appState.currentDrawingPoints = [];
    saveData();
    renderZones();
    
    setMode('view');
    openPage2(newZone.id);
}

function getMousePosition(evt) {
    const CTM = drawingArea.getScreenCTM();
    return {
        x: (evt.clientX - CTM.e) / CTM.a,
        y: (evt.clientY - CTM.f) / CTM.d
    };
}

function renderZones(currentMousePt = null) {
    drawingArea.innerHTML = '';
    
    const floor = getCurrentFloor();
    if (!floor || !floor.image) return;
    
    const iW = floor.imageWidth;
    const iH = floor.imageHeight;
    
    // Draw background image
    const imgEl = document.createElementNS("http://www.w3.org/2000/svg", "image");
    imgEl.setAttribute('href', floor.image);
    imgEl.setAttribute('width', iW);
    imgEl.setAttribute('height', iH);
    imgEl.setAttribute('x', '0');
    imgEl.setAttribute('y', '0');
    imgEl.style.pointerEvents = 'none';
    drawingArea.appendChild(imgEl);
    
    const zones = floor.zones || [];
    const visibleZones = zones.filter(z => z.parentId === appState.currentParentId);
    
    if (appState.currentParentId !== null) {
        const parentZone = zones.find(z => z.id === appState.currentParentId);
        if (parentZone) {
            const outerPath = `M0,0 L${iW},0 L${iW},${iH} L0,${iH} Z`;
            const innerPath = parentZone.points.map((p, i) => `${i===0?'M':'L'}${p.x * iW},${p.y * iH}`).join(' ') + ' Z';
            
            const maskPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
            maskPath.setAttribute("d", `${outerPath} ${innerPath}`);
            maskPath.setAttribute("fill", "rgba(0, 0, 0, 0.75)");
            maskPath.setAttribute("fill-rule", "evenodd");
            drawingArea.appendChild(maskPath);
            
            const parentPoly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
            const parentAbsPoints = parentZone.points.map(p => `${p.x * iW},${p.y * iH}`).join(' ');
            parentPoly.setAttribute("points", parentAbsPoints);
            parentPoly.setAttribute("fill", "transparent");
            parentPoly.setAttribute("stroke", "#ffffff");
            parentPoly.setAttribute("stroke-width", Math.max(3, iW * 0.003) + "px");
            parentPoly.setAttribute("stroke-dasharray", `${Math.max(5, iW * 0.005)},${Math.max(5, iW * 0.005)}`);
            drawingArea.appendChild(parentPoly);
        }
    }

    visibleZones.forEach(zone => {
        const absPoints = zone.points.map(p => `${p.x * iW},${p.y * iH}`).join(' ');
        
        const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        polygon.setAttribute("points", absPoints);
        
        const isMatch = isZoneMatchingSearch(zone, currentSearchTerm);
        let polyClass = "zone-polygon";
        if (appState.selectedZoneId === zone.id) polyClass += " selected";
        if (currentSearchTerm) {
            if (isMatch) polyClass += " zone-highlight";
            else polyClass += " zone-dimmed";
        }
        
        polygon.setAttribute("class", polyClass);
        polygon.style.fill = zone.color;
        polygon.style.strokeWidth = Math.max(2, iW * 0.002) + "px";
        
        polygon.addEventListener('pointerenter', (e) => {
            if(appState.mode === 'view') showTooltip(e, zone);
        });
        polygon.addEventListener('pointerleave', () => hideTooltip());
        polygon.addEventListener('pointermove', (e) => {
            if(appState.mode === 'view') moveTooltip(e);
        });
        
        polygon.addEventListener('pointerdown', (e) => {
            if(appState.mode === 'view') {
                e.stopPropagation();
            }
        });
        
        polygon.addEventListener('click', (e) => {
            if(appState.mode === 'view') {
                e.stopPropagation();
                openPage2(zone.id);
            }
        });
        
        if(zone.name && appState.mode === 'view') {
            const centerX = zone.points.reduce((sum, p) => sum + (p.x * iW), 0) / zone.points.length;
            const centerY = zone.points.reduce((sum, p) => sum + (p.y * iH), 0) / zone.points.length;
            
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", centerX);
            text.setAttribute("y", centerY);
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("fill", "#000");
            
            const baseFontSize = appState.currentParentId === null ? (iW * 0.015) : (iW * 0.008); 
            text.setAttribute("font-size", `${baseFontSize}px`);
            text.setAttribute("font-weight", "bold");
            text.setAttribute("style", "pointer-events:none; text-shadow: 2px 2px 4px #fff, -2px -2px 4px #fff, 2px -2px 4px #fff, -2px 2px 4px #fff;");
            text.textContent = zone.name;
            
            drawingArea.appendChild(polygon);
            drawingArea.appendChild(text);
        } else {
            drawingArea.appendChild(polygon);
        }
    });
    
    if (appState.currentDrawingPoints.length > 0 && appState.mode === 'draw') {
        let pointsStr = appState.currentDrawingPoints.map(p => `${p.x},${p.y}`).join(' ');
        if (currentMousePt) pointsStr += ` ${currentMousePt.x},${currentMousePt.y}`;
        
        const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        polyline.setAttribute("points", pointsStr);
        polyline.setAttribute("class", "drawing-line");
        polyline.setAttribute("fill", "rgba(0,0,0,0.1)");
        polyline.style.strokeWidth = Math.max(2, iW * 0.002) + "px";
        drawingArea.appendChild(polyline);
        
        appState.currentDrawingPoints.forEach((p, idx) => {
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", p.x);
            circle.setAttribute("cy", p.y);
            circle.setAttribute("r", idx === 0 ? Math.max(6, iW * 0.006) : Math.max(4, iW * 0.004));
            circle.setAttribute("class", "drawing-point");
            circle.style.strokeWidth = Math.max(2, iW * 0.002) + "px";
            drawingArea.appendChild(circle);
        });
    }
}

function openPage2(zoneId) {
    appState.selectedZoneId = zoneId;
    const floor = getCurrentFloor();
    if (!floor) return;
    const zone = (floor.zones || []).find(z => z.id === zoneId);
    
    if (zone) {
        zoneNameInput.value = zone.name || '';
        if (displayZoneName) displayZoneName.textContent = zone.name || 'İsimsiz Bölge';
        
        if (displayZoneItems) {
            displayZoneItems.innerHTML = '';
            if (zone.items && zone.items.length > 0) {
                zone.items.forEach(item => {
                    displayZoneItems.innerHTML += `
                        <div class="info-item-row">
                            <span class="info-item-name">${item.name}</span>
                            <span class="info-item-val">${item.value}</span>
                        </div>
                    `;
                });
            } else {
                displayZoneItems.innerHTML = '<p style="color: var(--text-muted); font-style: italic;">Parametre eklenmemiş.</p>';
            }
        }

        if (enterZoneBtn) {
            if (zone.parentId === null) {
                enterZoneBtn.classList.remove('hidden');
                if (drawSubzoneBtn) drawSubzoneBtn.classList.remove('hidden');
            } else {
                enterZoneBtn.classList.add('hidden');
                if (drawSubzoneBtn) drawSubzoneBtn.classList.add('hidden');
            }
        }

        if (dynamicItemsContainer) {
            dynamicItemsContainer.innerHTML = '';
            if (zone.items && zone.items.length > 0) {
                zone.items.forEach(item => addDynamicItemRow(item.name, item.value));
            } else {
                addDynamicItemRow();
            }
        }
        
        if (zoneInfoView) zoneInfoView.classList.remove('hidden');
        if (zoneEditForm) zoneEditForm.classList.add('hidden');
        
        if (!zone.name && zoneEditForm) {
            zoneInfoView.classList.add('hidden');
            zoneEditForm.classList.remove('hidden');
        }

        page2.classList.remove('hidden');
        setTimeout(() => page2.classList.add('open'), 10);
        renderZones();
    }
}

function addDynamicItemRow(name = '', value = '') {
    const row = document.createElement('div');
    row.className = 'dynamic-item-row';
    
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Örn: Mont';
    nameInput.value = name;
    nameInput.className = 'dyn-item-name';
    
    const valInput = document.createElement('input');
    valInput.type = 'text';
    valInput.placeholder = 'Değer';
    valInput.value = value;
    valInput.className = 'dyn-item-val';
    
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-item-btn';
    removeBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
    removeBtn.onclick = () => row.remove();
    
    row.appendChild(nameInput);
    row.appendChild(valInput);
    row.appendChild(removeBtn);
    
    dynamicItemsContainer.appendChild(row);
}

function closePage2() {
    page2.classList.remove('open');
    setTimeout(() => {
        page2.classList.add('hidden');
        appState.selectedZoneId = null;
        renderZones();
    }, 300);
}

function saveZoneData() {
    if (!appState.selectedZoneId) return;
    const floor = getCurrentFloor();
    if (!floor || !floor.zones) return;
    
    const zoneIndex = floor.zones.findIndex(z => z.id === appState.selectedZoneId);
    if (zoneIndex !== -1) {
        floor.zones[zoneIndex].name = zoneNameInput.value;
        
        const rows = dynamicItemsContainer.querySelectorAll('.dynamic-item-row');
        const newItems = [];
        rows.forEach(row => {
            const name = row.querySelector('.dyn-item-name').value.trim();
            const val = row.querySelector('.dyn-item-val').value.trim();
            if (name || val) {
                newItems.push({ name: name, value: val });
            }
        });
        
        floor.zones[zoneIndex].items = newItems;
        delete floor.zones[zoneIndex].stock;
        
        saveData();
        closePage2();
    }
}

function deleteCurrentZone() {
    if (!appState.selectedZoneId) return;
    const floor = getCurrentFloor();
    if (!floor || !floor.zones) return;
    
    if(confirm("Bu bölgeyi silmek istediğinize emin misiniz? (Alt bölgeler de silinecektir)")) {
        const idToDelete = appState.selectedZoneId;
        floor.zones = floor.zones.filter(z => z.id !== idToDelete && z.parentId !== idToDelete);
        saveData();
        closePage2();
    }
}

// --- NEW ADVANCED FEATURES ---

function handleSearch(e) {
    currentSearchTerm = e.target.value.toLowerCase().trim();
    renderZones();
}

function isZoneMatchingSearch(zone, term) {
    if (!term) return true;
    if (zone.name && zone.name.toLowerCase().includes(term)) return true;
    if (zone.items && zone.items.length > 0) {
        for (let item of zone.items) {
            if ((item.name && item.name.toLowerCase().includes(term)) || 
                (item.value && item.value.toLowerCase().includes(term))) {
                return true;
            }
        }
    }
    return false;
}

function showTooltip(e, zone) {
    if (!zone.name && (!zone.items || zone.items.length === 0)) return;
    if (zoneTooltip) {
        tooltipName.textContent = zone.name || 'İsimsiz Bölge';
        
        let itemsHtml = '';
        if (zone.items && zone.items.length > 0) {
            zone.items.forEach(item => {
                itemsHtml += `<div><strong style="color:var(--text-muted);">${item.name}:</strong> ${item.value}</div>`;
            });
        } else {
            itemsHtml = '<em style="color:var(--text-muted);">Parametre yok</em>';
        }
        tooltipItems.innerHTML = itemsHtml;
        
        zoneTooltip.classList.remove('hidden');
        moveTooltip(e);
    }
}

function moveTooltip(e) {
    if (zoneTooltip) {
        zoneTooltip.style.left = e.clientX + 'px';
        zoneTooltip.style.top = e.clientY + 'px';
    }
}

function hideTooltip() {
    if (zoneTooltip) zoneTooltip.classList.add('hidden');
}

function handleExportJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState.floors));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "stok_kroki_yedek.json");
    dlAnchorElem.click();
}

function handleImportJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const importedData = JSON.parse(event.target.result);
            if (Array.isArray(importedData)) {
                if (confirm("Mevcut tüm veriler silinip yedek yüklenecek. Emin misiniz?")) {
                    appState.floors = importedData;
                    appState.currentFloorId = importedData.length > 0 ? importedData[0].id : null;
                    appState.currentParentId = null;
                    appState.selectedZoneId = null;
                    saveData();
                    location.reload();
                }
            } else {
                alert("Geçersiz yedek dosyası (Liste bekleniyor)!");
            }
        } catch(err) {
            alert("Dosya okunamadı veya JSON formatı hatalı!");
        }
        e.target.value = '';
    };
    reader.readAsText(file);
}

function handleExportCSV() {
    let csvContent = "\uFEFFKat Adı,Üst Bölge,Bölge Adı,Özellik Adı,Özellik Değeri\n"; // UTF-8 BOM
    
    appState.floors.forEach(floor => {
        const fName = `"${(floor.name || '').replace(/"/g, '""')}"`;
        
        if (!floor.zones || floor.zones.length === 0) return;
        
        floor.zones.forEach(zone => {
            const zName = zone.name ? `"${zone.name.replace(/"/g, '""')}"` : '"İsimsiz Bölge"';
            
            let pName = '"-"';
            if (zone.parentId) {
                const parent = floor.zones.find(z => z.id === zone.parentId);
                if (parent && parent.name) {
                    pName = `"${parent.name.replace(/"/g, '""')}"`;
                }
            }
            
            if (zone.items && zone.items.length > 0) {
                zone.items.forEach(item => {
                    const iName = item.name ? `"${item.name.replace(/"/g, '""')}"` : '""';
                    const iVal = item.value ? `"${item.value.replace(/"/g, '""')}"` : '""';
                    csvContent += `${fName},${pName},${zName},${iName},${iVal}\n`;
                });
            } else {
                csvContent += `${fName},${pName},${zName},"",""\n`;
            }
        });
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", url);
    dlAnchorElem.setAttribute("download", "stok_raporu.csv");
    dlAnchorElem.click();
}

window.onload = init;
