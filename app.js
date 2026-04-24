// State
let appState = {
    mode: 'view', // 'view' or 'draw'
    krokiImage: null, // base64 image
    imageWidth: 0, // Intrinsic width
    imageHeight: 0, // Intrinsic height
    zones: [], // Array of { id, parentId, points, name, items: [], color }
    currentDrawingPoints: [],
    selectedZoneId: null,
    currentParentId: null // null means top-level
};

// Colors for zones to make them distinct
const ZONE_COLORS = [
    'rgba(233, 30, 99, 0.4)', // Pink
    'rgba(156, 39, 176, 0.4)', // Purple
    'rgba(63, 81, 181, 0.4)', // Indigo
    'rgba(33, 150, 243, 0.4)', // Blue
    'rgba(0, 150, 136, 0.4)', // Teal
    'rgba(76, 175, 80, 0.4)', // Green
    'rgba(255, 152, 0, 0.4)', // Orange
    'rgba(255, 87, 34, 0.4)'  // Deep Orange
];

// DOM Elements
const sidebar = document.getElementById('sidebar');
const openSidebarBtn = document.getElementById('open-sidebar-btn');
const closeSidebarBtn = document.getElementById('close-sidebar-btn');

const krokiUpload = document.getElementById('kroki-upload');
const noImageText = document.getElementById('no-image-text');
const drawingArea = document.getElementById('drawing-area');
const krokiWrapper = document.getElementById('kroki-wrapper');
const zoomOutBtn = document.getElementById('zoom-out-btn'); // Eklendi

const modeViewBtn = document.getElementById('mode-view');
const modeDrawBtn = document.getElementById('mode-draw');
const drawInstructions = document.getElementById('draw-instructions');

const page2 = document.getElementById('page2');
const closePage2Btn = document.getElementById('close-page2-btn');
const zoneNameInput = document.getElementById('zone-name');
const saveZoneBtn = document.getElementById('save-zone-btn');
const deleteZoneBtn = document.getElementById('delete-zone-btn');
const clearDataBtn = document.getElementById('clear-data-btn');

// New Detail Page Elements
const editZoneBtn = document.getElementById('edit-zone-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const zoneInfoView = document.getElementById('zone-info-view');
const zoneEditForm = document.getElementById('zone-edit-form');
const displayZoneName = document.getElementById('display-zone-name');
const displayZoneItems = document.getElementById('display-zone-items'); // Değişti
const enterZoneBtn = document.getElementById('enter-zone-btn'); // Eklendi
const drawSubzoneBtn = document.getElementById('draw-subzone-btn'); // Eklendi
const dynamicItemsContainer = document.getElementById('dynamic-items-container'); // Eklendi
const addItemBtn = document.getElementById('add-item-btn'); // Eklendi

// Initialization
function init() {
    loadData();
    setupEventListeners();
    renderKroki();
    renderZones();

    // Harita boyutu (paneller açılıp kapandıkça) değiştiğinde çizimleri senkronize tut
    const resizeObserver = new ResizeObserver(() => {
        if (appState.krokiImage && krokiImg.clientWidth > 0) {
            matchSvgToImage();
            renderZones();
        }
    });
    resizeObserver.observe(krokiImg);
}

// Load Data from LocalStorage
function loadData() {
    const savedImg = localStorage.getItem('krokiImage');
    if (savedImg) {
        appState.krokiImage = savedImg;
        appState.imageWidth = parseInt(localStorage.getItem('krokiWidth')) || 1000;
        appState.imageHeight = parseInt(localStorage.getItem('krokiHeight')) || 1000;
    }

    const savedZones = localStorage.getItem('krokiZones');
    if (savedZones) {
        try {
            appState.zones = JSON.parse(savedZones);
            // Migrate old data
            appState.zones.forEach(z => {
                if (z.parentId === undefined) z.parentId = null;
                if (z.items === undefined) {
                    z.items = [];
                    if (z.stock) {
                        z.items.push({ name: 'Stok', value: z.stock });
                        delete z.stock;
                    }
                }
            });
        } catch (e) {
            console.error("Error parsing zones", e);
            appState.zones = [];
        }
    }
}

// Save Data to LocalStorage
function saveData() {
    if (appState.krokiImage) {
        localStorage.setItem('krokiImage', appState.krokiImage);
        localStorage.setItem('krokiWidth', appState.imageWidth);
        localStorage.setItem('krokiHeight', appState.imageHeight);
    }
    localStorage.setItem('krokiZones', JSON.stringify(appState.zones));
}

// Event Listeners
function setupEventListeners() {
    // Sidebar
    openSidebarBtn.addEventListener('click', () => sidebar.classList.add('open'));
    closeSidebarBtn.addEventListener('click', () => sidebar.classList.remove('open'));

    // Image Upload
    krokiUpload.addEventListener('change', handleImageUpload);

    // Modes
    modeViewBtn.addEventListener('click', () => setMode('view'));
    modeDrawBtn.addEventListener('click', () => setMode('draw'));

    // Drawing Area
    drawingArea.addEventListener('click', handleDrawingAreaClick);
    drawingArea.addEventListener('mousemove', handleDrawingMouseMove);

    // Page 2
    closePage2Btn.addEventListener('click', closePage2);
    saveZoneBtn.addEventListener('click', saveZoneData);
    deleteZoneBtn.addEventListener('click', deleteCurrentZone);
    
    if (addItemBtn) addItemBtn.addEventListener('click', () => addDynamicItemRow());

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
            zoomIntoZone(appState.selectedZoneId); // Ensure we are zoomed in
            setMode('draw');
        }
    });

    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => {
        zoomOutToMain();
    });

    // Clear Data
    clearDataBtn.addEventListener('click', () => {
        if (confirm("Tüm kroki ve veriler silinecek. Emin misiniz?")) {
            localStorage.removeItem('krokiImage');
            localStorage.removeItem('krokiZones');
            location.reload();
        }
    });

    // Resize SVG on window resize
    window.addEventListener('resize', () => {
        // No longer needed! viewBox handles resizing perfectly.
    });
}

// Handle Image Upload
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
        const img = new Image();
        img.onload = function() {
            appState.imageWidth = img.width;
            appState.imageHeight = img.height;
            appState.krokiImage = event.target.result;
            appState.zones = []; // Reset zones when new image is uploaded
            saveData();
            renderKroki();
            renderZones();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

// Render Kroki Image
function renderKroki() {
    if (appState.krokiImage) {
        drawingArea.classList.remove('hidden');
        noImageText.classList.add('hidden');

        if (appState.currentParentId === null) {
            drawingArea.setAttribute('viewBox', `0 0 ${appState.imageWidth} ${appState.imageHeight}`);
        } else {
            zoomIntoZone(appState.currentParentId);
        }
    } else {
        drawingArea.classList.add('hidden');
        noImageText.classList.remove('hidden');
    }
}

function zoomIntoZone(zoneId) {
    const zone = appState.zones.find(z => z.id === zoneId);
    if (!zone) return;
    
    appState.currentParentId = zoneId;
    appState.selectedZoneId = null;
    
    const iW = appState.imageWidth;
    const iH = appState.imageHeight;
    
    // Calculate bounding box of the zone in pixels
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    zone.points.forEach(p => {
        const x = p.x * iW;
        const y = p.y * iH;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    });
    
    // Add some padding to the bounding box
    const padding = Math.max(iW, iH) * 0.05;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;
    
    const boxWidth = maxX - minX;
    const boxHeight = maxY - minY;
    
    // Set viewBox to zoom in
    drawingArea.setAttribute('viewBox', `${minX} ${minY} ${boxWidth} ${boxHeight}`);
    
    zoomOutBtn.classList.remove('hidden');
    closePage2();
    renderZones();
}

function zoomOutToMain() {
    appState.currentParentId = null;
    appState.selectedZoneId = null;
    
    drawingArea.setAttribute('viewBox', `0 0 ${appState.imageWidth} ${appState.imageHeight}`);
    
    zoomOutBtn.classList.add('hidden');
    closePage2();
    renderZones();
}

// Mode switching
function setMode(mode) {
    appState.mode = mode;
    appState.currentDrawingPoints = []; // Reset drawing

    if (mode === 'view') {
        modeViewBtn.classList.add('active');
        modeDrawBtn.classList.remove('active');
        krokiWrapper.classList.remove('mode-drawing');
        drawInstructions.classList.add('hidden');
        sidebar.classList.remove('open'); // Close sidebar automatically to view
    } else {
        modeViewBtn.classList.remove('active');
        modeDrawBtn.classList.add('active');
        krokiWrapper.classList.add('mode-drawing');
        drawInstructions.classList.remove('hidden');
        closePage2();
    }

    renderZones();
}

// Check if point is inside polygon
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

// Drawing Logic
function handleDrawingAreaClick(e) {
    if (appState.mode !== 'draw') return;

    // Get click coordinates relative to SVG
    const pt = getMousePosition(e);
    const iW = appState.imageWidth;
    const iH = appState.imageHeight;
    const relPt = { x: pt.x / iW, y: pt.y / iH };

    // Prevent drawing outside parent zone
    if (appState.currentParentId !== null) {
        const parentZone = appState.zones.find(z => z.id === appState.currentParentId);
        if (parentZone && !isPointInPolygon(relPt, parentZone.points)) {
            // Tıklanan yer parent poligonun dışındaysa çizime izin verme
            return;
        }
    }

    // Check if clicked near the first point to close polygon
    if (appState.currentDrawingPoints.length > 2) {
        const firstPt = appState.currentDrawingPoints[0];
        const dist = Math.hypot(pt.x - firstPt.x, pt.y - firstPt.y);

        if (dist < 20) { // Close threshold
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
    renderZones(pt); // Pass current mouse point to draw preview line
}

function finishDrawing() {
    if (appState.currentDrawingPoints.length < 3) {
        appState.currentDrawingPoints = [];
        return;
    }

    const iW = appState.imageWidth;
    const iH = appState.imageHeight;
    const relativePoints = appState.currentDrawingPoints.map(p => ({
        x: p.x / iW,
        y: p.y / iH
    }));

    // Generate color - use different base for sub-zones
    const isSubZone = appState.currentParentId !== null;
    let color = ZONE_COLORS[appState.zones.length % ZONE_COLORS.length];
    if (isSubZone) {
        color = color.replace('0.4', '0.7'); // Make subzones a bit more opaque/darker
    }

    const newZone = {
        id: 'zone_' + Date.now(),
        parentId: appState.currentParentId,
        points: relativePoints,
        name: '',
        items: [],
        color: color
    };

    appState.zones.push(newZone);
    appState.currentDrawingPoints = [];
    saveData();
    renderZones();

    // Automatically switch to view mode and open this zone's details
    setMode('view');
    openPage2(newZone.id);
}

// Map screen coordinate to SVG coordinate
function getMousePosition(evt) {
    const CTM = drawingArea.getScreenCTM();
    return {
        x: (evt.clientX - CTM.e) / CTM.a,
        y: (evt.clientY - CTM.f) / CTM.d
    };
}

// Render Zones onto SVG
function renderZones(currentMousePt = null) {
    drawingArea.innerHTML = ''; // Clear

    if (!appState.krokiImage) return;

    // 1. Draw Image Background inside SVG
    const imgEl = document.createElementNS("http://www.w3.org/2000/svg", "image");
    imgEl.setAttribute('href', appState.krokiImage);
    imgEl.setAttribute('width', appState.imageWidth);
    imgEl.setAttribute('height', appState.imageHeight);
    imgEl.setAttribute('x', '0');
    imgEl.setAttribute('y', '0');
    imgEl.style.pointerEvents = 'none';
    drawingArea.appendChild(imgEl);

    const iW = appState.imageWidth;
    const iH = appState.imageHeight;

    const visibleZones = appState.zones.filter(z => z.parentId === appState.currentParentId);

    // Ana bölge içindeysek, dışarıyı karartacak bir maske çiz
    if (appState.currentParentId !== null) {
        const parentZone = appState.zones.find(z => z.id === appState.currentParentId);
        if (parentZone) {
            const outerPath = `M0,0 L${iW},0 L${iW},${iH} L0,${iH} Z`;
            const innerPath = parentZone.points.map((p, i) => `${i===0?'M':'L'}${p.x * iW},${p.y * iH}`).join(' ') + ' Z';
            
            const maskPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
            maskPath.setAttribute("d", `${outerPath} ${innerPath}`);
            maskPath.setAttribute("fill", "rgba(0, 0, 0, 0.75)"); // Dışarıyı karart
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

    // Render existing zones
    visibleZones.forEach(zone => {
        const absPoints = zone.points.map(p => `${p.x * iW},${p.y * iH}`).join(' ');

        const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        polygon.setAttribute("points", absPoints);
        polygon.setAttribute("class", "zone-polygon" + (appState.selectedZoneId === zone.id ? " selected" : ""));
        polygon.style.fill = zone.color;
        polygon.style.strokeWidth = Math.max(2, iW * 0.002) + "px";

        polygon.addEventListener('click', (e) => {
            if (appState.mode === 'view') {
                e.stopPropagation();
                openPage2(zone.id);
            }
        });

        if (zone.name && appState.mode === 'view') {
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

    // Render active drawing
    if (appState.currentDrawingPoints.length > 0 && appState.mode === 'draw') {
        let pointsStr = appState.currentDrawingPoints.map(p => `${p.x},${p.y}`).join(' ');
        if (currentMousePt) {
            pointsStr += ` ${currentMousePt.x},${currentMousePt.y}`;
        }

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

// Page 2 Logic
function openPage2(zoneId) {
    appState.selectedZoneId = zoneId;
    const zone = appState.zones.find(z => z.id === zoneId);

    if (zone) {
        zoneNameInput.value = zone.name || '';

        if (displayZoneName) displayZoneName.textContent = zone.name || 'İsimsiz Bölge';
        
        // Populate view mode items
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
        
        // Show/hide "İçine Gir" button (only for top-level zones)
        if (enterZoneBtn) {
            if (zone.parentId === null) {
                enterZoneBtn.classList.remove('hidden');
                if (drawSubzoneBtn) drawSubzoneBtn.classList.remove('hidden');
            } else {
                enterZoneBtn.classList.add('hidden');
                if (drawSubzoneBtn) drawSubzoneBtn.classList.add('hidden');
            }
        }

        // Populate edit mode items
        if (dynamicItemsContainer) {
            dynamicItemsContainer.innerHTML = '';
            if (zone.items && zone.items.length > 0) {
                zone.items.forEach(item => addDynamicItemRow(item.name, item.value));
            } else {
                addDynamicItemRow(); // Varayılan 1 satır aç
            }
        }

        // Show info view, hide edit form initially
        if (zoneInfoView) zoneInfoView.classList.remove('hidden');
        if (zoneEditForm) zoneEditForm.classList.add('hidden');

        // If the zone has no name, auto-open edit mode
        if (!zone.name && zoneEditForm) {
            zoneInfoView.classList.add('hidden');
            zoneEditForm.classList.remove('hidden');
        }

        page2.classList.remove('hidden');
        setTimeout(() => page2.classList.add('open'), 10);
        renderZones(); // update selected state
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
    }, 300); // match css transition
}

function saveZoneData() {
    if (!appState.selectedZoneId) return;

    const zoneIndex = appState.zones.findIndex(z => z.id === appState.selectedZoneId);
    if (zoneIndex !== -1) {
        appState.zones[zoneIndex].name = zoneNameInput.value;
        
        // Collect dynamic items
        const rows = dynamicItemsContainer.querySelectorAll('.dynamic-item-row');
        const newItems = [];
        rows.forEach(row => {
            const name = row.querySelector('.dyn-item-name').value.trim();
            const val = row.querySelector('.dyn-item-val').value.trim();
            if (name || val) { // Only add if at least one is filled
                newItems.push({ name: name, value: val });
            }
        });
        
        appState.zones[zoneIndex].items = newItems;
        // Delete stock property if it exists to clean up old data
        delete appState.zones[zoneIndex].stock;
        
        saveData();
        closePage2();
    }
}

function deleteCurrentZone() {
    if (!appState.selectedZoneId) return;

    if (confirm("Bu bölgeyi silmek istediğinize emin misiniz? (Alt bölgeler de silinecektir)")) {
        const idToDelete = appState.selectedZoneId;
        appState.zones = appState.zones.filter(z => z.id !== idToDelete && z.parentId !== idToDelete);
        saveData();
        closePage2();
    }
}

// Start app
window.onload = init;
