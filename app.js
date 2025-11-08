let map, places;
let graph = { nodes: [], edges: [] };
let nodeIndex = new Map();
let nodeList;

let routeLayer = null;
let altLayers = [];
let startMarker = null;
let endMarker = null;
let lastResults;
let KROUTES = 5;

// Navigation state
let navigationMode = false;
let currentPosition = null;
let userMarker = null;
let selectedRouteIndex = 0;
let completedSegments = new Set();
let watchId = null;
let destinationReached = false;
let currentRoute = null;

// Live polylines for navigation state
let routePolylines = { completed: null, remaining: null };
let connectorLine = null;
let lastHeading = 0;
let lastFix = null;

// Performance optimizations
let updateThrottle = null;
let lastUpdateTime = 0;
const UPDATE_INTERVAL = 100;
let routeLayerGroup = null;

// Landmark markers layer
let landmarkMarkersLayer = null;
let landmarksVisible = true; // Track visibility state

// Custom icon definitions for different landmark types
const iconCategories = {
  academic: ['aero', 'nonit', 'fet'],
  auditorium: ['colosseum'],
  sports: ['golf', 'football', 'cricket', 'swimming'],
  residential: ['purvanchal', 'karakoram', 'himalaya'],
  dining: ['canteen', 'cothas'],
  transport: ['busstop', 'parking'],
  facilities: ['forging', 'watertreatment'],
  religious: ['temple', 'sridatta'],
  school: ['jirs']
};

function getIconForLandmark(landmarkId) {
  let category = 'default';
  for (const [cat, ids] of Object.entries(iconCategories)) {
    if (ids.includes(landmarkId)) {
      category = cat;
      break;
    }
  }

  const iconConfig = {
    academic: { color: '#1a73e8', icon: '🏛️', bgColor: '#e8f0fe' },
    auditorium: { color: '#9334e6', icon: '🎭', bgColor: '#f3e8fd' },
    sports: { color: '#34a853', icon: '⚽', bgColor: '#e6f4ea' },
    residential: { color: '#fbbc04', icon: '🏠', bgColor: '#fef7e0' },
    dining: { color: '#ea4335', icon: '🍴', bgColor: '#fce8e6' },
    transport: { color: '#9334e6', icon: '🚌', bgColor: '#f3e8fd' },
    facilities: { color: '#5f6368', icon: '⚙️', bgColor: '#f1f3f4' },
    religious: { color: '#ff6d00', icon: '🕉️', bgColor: '#fff3e0' },
    school: { color: '#1a73e8', icon: '🎓', bgColor: '#e8f0fe' },
    default: { color: '#5f6368', icon: '📍', bgColor: '#f1f3f4' }
  };

  const config = iconConfig[category] || iconConfig.default;

  return L.divIcon({
    className: 'custom-landmark-marker',
    html: `
      <div style="
        width: 32px;
        height: 32px;
        background: ${config.bgColor};
        border: 2px solid ${config.color};
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        cursor: pointer;
        transition: all 0.2s;
      " class="landmark-icon-inner">
        ${config.icon}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
}

// Toggle landmarks visibility
function toggleLandmarks() {
  landmarksVisible = !landmarksVisible;
  
  const toggleBtnDesktop = document.getElementById('toggleLandmarksBtn');
  const toggleBtnMobile = document.getElementById('toggleLandmarksMobile');
  
  if (landmarksVisible) {
    if (landmarkMarkersLayer) {
      map.addLayer(landmarkMarkersLayer);
    }
    toggleBtnDesktop?.classList.add('active');
    toggleBtnMobile?.classList.add('active');
  } else {
    if (landmarkMarkersLayer) {
      map.removeLayer(landmarkMarkersLayer);
    }
    toggleBtnDesktop?.classList.remove('active');
    toggleBtnMobile?.classList.remove('active');
  }
}

async function initMap() {
  const campusCenter = L.latLng(12.63992, 77.44123);
  const campusRadius = 600;

  const campusBounds = L.latLngBounds(
    L.latLng(12.6365, 77.4365),
    L.latLng(12.6440, 77.4460)
  );

  map = L.map('map', {
    maxBounds: campusBounds,
    maxBoundsViscosity: 1.0,
    minZoom: 15,
    maxZoom: 19,
    preferCanvas: true,
    renderer: L.canvas({ tolerance: 5 }),
    attributionControl: false
  }).setView([12.6409, 77.4412], 16);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 20,
    attribution: '',
    updateWhenIdle: true,
    updateWhenZooming: false,
    keepBuffer: 2
  }).addTo(map);

  // Mask outside campus
  const circlePolygon = [];
  const numPoints = 64;
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    const lat = campusCenter.lat + (campusRadius / 111320) * Math.cos(angle);
    const lng = campusCenter.lng + (campusRadius / (111320 * Math.cos(campusCenter.lat * Math.PI / 180))) * Math.sin(angle);
    circlePolygon.push([lat, lng]);
  }
  const worldBounds = [[-90,-180],[-90,180],[90,180],[90,-180],[-90,-180]];
  const maskPolygon = [worldBounds, circlePolygon.slice().reverse()];
  L.polygon(maskPolygon, { color: 'transparent', fillColor: '#ccc', fillOpacity: 0.3, weight: 0, interactive: false }).addTo(map);

  // Load data
  places = await (await fetch('data/landmarks.json')).json();
  graph = await (await fetch('data/paths.json')).json();

  // Add landmark markers to map
  landmarkMarkersLayer = L.layerGroup().addTo(map);
  places.forEach(place => {
    const icon = getIconForLandmark(place.id);
    const marker = L.marker([place.lat, place.lng], { icon: icon })
      .bindPopup(`<strong>${place.name}</strong>`)
      .addTo(landmarkMarkersLayer);
  });

  // Add entrance nodes
  places.forEach(p => {
    const entId = `ENT_${p.id}`;
    const entNode = { id: entId, lat: p.lat, lng: p.lng };
    graph.nodes.push(entNode);
    if (p.accessNode) {
      graph.edges.push([p.accessNode, entId]);
    } else {
      let bestDist = Infinity, bestNodeId = null, bestEdge = null, bestPointOnEdge = null;
      for (let i = 0; i < graph.nodes.length - 1; i++) {
        const d = hav(p, graph.nodes[i]);
        if (d < bestDist) { bestDist = d; bestNodeId = graph.nodes[i].id; bestEdge = null; }
      }
      for (const [aId,bId] of graph.edges) {
        const aIdx = graph.nodes.findIndex(n => n.id === aId);
        const bIdx = graph.nodes.findIndex(n => n.id === bId);
        if (aIdx === -1 || bIdx === -1) continue;
        const a = graph.nodes[aIdx], b = graph.nodes[bIdx];
        const nearestPoint = nearestPointOnSegment(p, a, b);
        const d = hav(p, nearestPoint);
        if (d < bestDist) { bestDist = d; bestEdge = [aId,bId]; bestPointOnEdge = nearestPoint; bestNodeId = null; }
      }
      if (bestEdge && bestPointOnEdge) {
        const splitNodeId = `SPLIT_${p.id}`;
        const splitNode = { id: splitNodeId, lat: bestPointOnEdge.lat, lng: bestPointOnEdge.lng };
        graph.nodes.push(splitNode);
        const edgeIndex = graph.edges.findIndex(e => (e[0]===bestEdge[0] && e[1]===bestEdge[1]) || (e[0]===bestEdge[1] && e[1]===bestEdge[0]));
        if (edgeIndex !== -1) graph.edges.splice(edgeIndex,1);
        graph.edges.push([bestEdge[0], splitNodeId]);
        graph.edges.push([splitNodeId, bestEdge[1]]);
        graph.edges.push([splitNodeId, entId]);
      } else if (bestNodeId) {
        graph.edges.push([bestNodeId, entId]);
      }
    }
  });

  nodeList = graph.nodes;
  nodeIndex = new Map(nodeList.map((n,i) => [n.id, i]));

  // Populate desktop selects
  const selFromDesktop = document.getElementById('from-desktop');
  const selToDesktop = document.getElementById('to-desktop');
  if (selFromDesktop && selToDesktop) {
    places.forEach(p => {
      selFromDesktop.add(new Option(p.name, p.id));
      selToDesktop.add(new Option(p.name, p.id));
    });
    selFromDesktop.value = 'busstop';
    selToDesktop.value = 'canteen';
    document.getElementById('swapBtn-desktop').onclick = swapDesktopLocations;
    document.getElementById('routeBtn-desktop').onclick = route;
  }

  // Populate mobile selects
  const selFromMobile = document.getElementById('from-mobile');
  const selToMobile = document.getElementById('to-mobile');
  if (selFromMobile && selToMobile) {
    places.forEach(p => {
      selFromMobile.add(new Option(p.name, p.id));
      selToMobile.add(new Option(p.name, p.id));
    });
    selFromMobile.value = 'busstop';
    selToMobile.value = 'canteen';
    document.getElementById('swapBtn-mobile').onclick = swapMobileLocations;
    document.getElementById('routeBtn-mobile').onclick = routeMobile;
  }

  // Toggle landmarks buttons
  document.getElementById('toggleLandmarksBtn')?.addEventListener('click', toggleLandmarks);
  document.getElementById('toggleLandmarksMobile')?.addEventListener('click', toggleLandmarks);
  
  // Set initial active state
  document.getElementById('toggleLandmarksBtn')?.classList.add('active');
  document.getElementById('toggleLandmarksMobile')?.classList.add('active');

  // UI toggles
  document.getElementById('creditsToggle')?.addEventListener('click', function () {
    const teamList = document.getElementById('teamList');
    const icon = this.querySelector('.toggle-icon');
    teamList.classList.toggle('open');
    if (teamList.classList.contains('open')) {
      icon.style.transform = 'rotate(180deg)';
    } else {
      icon.style.transform = 'rotate(0deg)';
    }
  });

  document.getElementById('mobileInfoBtn')?.addEventListener('click', () => {
    document.getElementById('teamModal').classList.remove('hidden');
  });

  document.getElementById('modalClose')?.addEventListener('click', () => {
    document.getElementById('teamModal').classList.add('hidden');
  });

  document.getElementById('teamModal')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('mobile-modal')) {
      document.getElementById('teamModal').classList.add('hidden');
    }
  });

  // Route card toggle
  document.getElementById('collapsed-view')?.addEventListener('click', () => {
    document.getElementById('collapsed-view').classList.add('hidden');
    document.getElementById('expanded-view').classList.remove('hidden');
  });

  document.getElementById('closeCard')?.addEventListener('click', () => {
    document.getElementById('expanded-view').classList.add('hidden');
    document.getElementById('collapsed-view').classList.remove('hidden');
  });

  // Navigation buttons - Desktop
  document.getElementById('startNavBtn-desktop')?.addEventListener('click', startNavigation);
  document.getElementById('stopNavBtn-desktop')?.addEventListener('click', stopNavigation);

  // Navigation buttons - Mobile
  document.getElementById('startNavBtn-mobile')?.addEventListener('click', startNavigation);
  document.getElementById('stopNavBtn-mobile')?.addEventListener('click', stopNavigation);

  // Setup drag and drop after DOM is ready and selects are populated
  setTimeout(setupDragAndDrop, 100);
}

// Swap functions
function swapDesktopLocations() {
  const fromSelect = document.getElementById('from-desktop');
  const toSelect = document.getElementById('to-desktop');
  const tempValue = fromSelect.value;
  fromSelect.value = toSelect.value;
  toSelect.value = tempValue;
}

function swapMobileLocations() {
  const fromSelect = document.getElementById('from-mobile');
  const toSelect = document.getElementById('to-mobile');
  const tempValue = fromSelect.value;
  fromSelect.value = toSelect.value;
  toSelect.value = tempValue;
}

// ============ DRAG AND DROP FUNCTIONALITY ============

function setupDragAndDrop() {
  // Desktop drag and drop
  const desktopRows = document.querySelectorAll('.sidebar .input-row');
  desktopRows.forEach(row => {
    const dragHandle = row.querySelector('.drag-handle-left');
    if (dragHandle) {
      dragHandle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        startDragDesktop(row);
      });
    }
  });

  // Mobile drag and drop - FIXED VERSION
  const mobileInputs = document.querySelectorAll('.mobile-search-bar .mobile-input');
  mobileInputs.forEach(input => {
    const dragHandle = input.querySelector('.mobile-drag-handle');
    if (dragHandle) {
      // Remove any existing listeners
      dragHandle.removeEventListener('touchstart', handleTouchStart);
      // Add new listener
      dragHandle.addEventListener('touchstart', handleTouchStart, { passive: false });
    }
  });
}

let draggedElement = null;
let dragType = null;
let dragStartY = 0;
let swapOccurred = false;

function startDragDesktop(row) {
  draggedElement = row;
  dragType = 'desktop';
  
  const ghostRow = row.cloneNode(true);
  ghostRow.style.position = 'fixed';
  ghostRow.style.pointerEvents = 'none';
  ghostRow.style.opacity = '0.8';
  ghostRow.style.zIndex = '10000';
  ghostRow.style.width = row.offsetWidth + 'px';
  ghostRow.id = 'drag-ghost';
  document.body.appendChild(ghostRow);
  
  row.style.opacity = '0.3';

  const moveHandler = (e) => {
    const ghost = document.getElementById('drag-ghost');
    if (ghost) {
      ghost.style.left = e.clientX - ghost.offsetWidth / 2 + 'px';
      ghost.style.top = e.clientY - 20 + 'px';
    }

    const rows = document.querySelectorAll('.sidebar .input-row');
    rows.forEach(r => {
      const rect = r.getBoundingClientRect();
      if (e.clientY > rect.top && e.clientY < rect.bottom && r !== row) {
        swapDesktopLocations();
      }
    });
  };

  const upHandler = () => {
    const ghost = document.getElementById('drag-ghost');
    if (ghost) ghost.remove();
    if (row) row.style.opacity = '1';
    document.removeEventListener('mousemove', moveHandler);
    document.removeEventListener('mouseup', upHandler);
    draggedElement = null;
    dragType = null;
  };

  document.addEventListener('mousemove', moveHandler);
  document.addEventListener('mouseup', upHandler);
}

function handleTouchStart(e) {
  e.preventDefault();
  e.stopPropagation();
  
  const dragHandle = e.currentTarget;
  const input = dragHandle.closest('.mobile-input');
  
  if (!input) return;
  
  draggedElement = input;
  dragType = 'mobile';
  swapOccurred = false;
  dragStartY = e.touches[0].clientY;
  
  input.style.opacity = '0.5';
  input.style.transform = 'scale(0.95)';

  const handleTouchMove = (e) => {
    if (!draggedElement) return;
    
    const touch = e.touches[0];
    const currentY = touch.clientY;
    const deltaY = Math.abs(currentY - dragStartY);
    
    // Only trigger swap if moved significantly
    if (deltaY > 30 && !swapOccurred) {
      swapOccurred = true;
      swapMobileLocations();
      
      // Visual feedback
      const inputs = document.querySelectorAll('.mobile-search-bar .mobile-input');
      inputs.forEach(inp => {
        inp.style.transition = 'transform 0.3s ease';
      });
    }
  };

  const handleTouchEnd = () => {
    if (input) {
      input.style.opacity = '1';
      input.style.transform = 'scale(1)';
      input.style.transition = 'all 0.2s ease';
    }
    
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
    draggedElement = null;
    dragType = null;
    swapOccurred = false;
  };

  document.addEventListener('touchmove', handleTouchMove, { passive: false });
  document.addEventListener('touchend', handleTouchEnd);
}

// Haversine
function hav(a, b) {
  const R = 6371000;
  const toR = x => x * Math.PI / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const s = Math.sin(dLat/2)**2 + Math.cos(toR(a.lat))*Math.cos(toR(b.lat))*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(s));
}

function nearestPointOnSegment(p, a, b) {
  const px = p.lng, py = p.lat;
  const ax = a.lng, ay = a.lat;
  const bx = b.lng, by = b.lat;
  const ABx = bx-ax, ABy = by-ay;
  const APx = px-ax, APy = py-ay;
  const ABAB = ABx*ABx + ABy*ABy;
  const APAB = APx*ABx + APy*ABy;
  if (ABAB === 0) return {lat:a.lat, lng:a.lng};
  let t = APAB / ABAB;
  t = Math.max(0, Math.min(1, t));
  return { lat: ay + t*ABy, lng: ax + t*ABx };
}

function buildAdj(removedEdges=new Set(), removedNodes=new Set()) {
  const adj = Array(nodeList.length).fill(0).map(() => []);
  for (const [aiId, biId] of graph.edges) {
    const ai = nodeIndex.get(aiId), bi = nodeIndex.get(biId);
    if (ai == null || bi == null) continue;
    if (removedNodes.has(ai) || removedNodes.has(bi)) continue;
    const keyAB = `${ai}-${bi}`;
    const keyBA = `${bi}-${ai}`;
    if (removedEdges.has(keyAB) || removedEdges.has(keyBA)) continue;
    const a = nodeList[ai], b = nodeList[bi];
    const w = hav(a, b);
    adj[ai].push([bi, w]);
    adj[bi].push([ai, w]);
  }
  return adj;
}

function dijkstra(adj, src, dst) {
  const n = adj.length, dist = Array(n).fill(Infinity), prev = Array(n).fill(-1), used = Array(n).fill(false);
  dist[src] = 0;
  const pq = [{d:0, i:src}];
  const pop = () => {
    if (!pq.length) return null;
    let bi=-1, bd=Infinity;
    for (let i=0;i<pq.length;i++){ if (pq[i].d < bd) { bd=pq[i].d; bi=i; } }
    return bi<0?null:pq.splice(bi,1)[0];
  };

  while (pq.length) {
    const cur = pop();
    if (!cur) break;
    const u = cur.i;
    if (used[u]) continue;
    used[u] = true;
    if (u === dst) break;
    for (const [v,w] of adj[u]) {
      if (!used[v] && dist[u] + w < dist[v]) {
        dist[v] = dist[u] + w;
        prev[v] = u;
        pq.push({d:dist[v], i:v});
      }
    }
  }
  const path = [];
  let u = dst;
  if (prev[u] === -1 && u !== src) return {path:[], distance:Infinity};
  while (u !== -1) { path.push(u); if (u === src) break; u = prev[u]; }
  path.reverse();
  return { path, distance: dist[dst] };
}

function pathDistance(indices) {
  let d = 0;
  for (let i=0;i+1<indices.length;i++){ d += hav(nodeList[indices[i]], nodeList[indices[i+1]]); }
  return d;
}

function yensKShortests(i, t, K) {
  const A = [];
  const B = [];
  const adj0 = buildAdj();
  const p0 = dijkstra(adj0, i, t);
  if (!p0.path.length || !isFinite(p0.distance)) return A;
  A.push(p0);

  for (let k=1;k<K;k++){
    const prevPath = A[k-1].path;
    for (let iSeg=0;iSeg<prevPath.length-1;iSeg++){
      const spurNode = prevPath[iSeg];
      const rootPath = prevPath.slice(0, iSeg+1);
      const removedEdges = new Set();
      const removedNodes = new Set();
      for (const p of A) {
        const candidateRoot = p.path.slice(0,iSeg+1);
        if (arraysEqual(candidateRoot, rootPath) && p.path.length>iSeg+1) {
          const u = p.path[iSeg], v = p.path[iSeg+1];
          removedEdges.add(`${u}-${v}`);
          removedEdges.add(`${v}-${u}`);
        }
      }
      for (const rpNode of rootPath.slice(0,-1)) { removedNodes.add(rpNode); }
      const adj = buildAdj(removedEdges, removedNodes);
      const spurRes = dijkstra(adj, spurNode, t);
      if (spurRes.path.length && isFinite(spurRes.distance)) {
        const totalPath = rootPath.slice(0,-1).concat(spurRes.path);
        const totalDist = pathDistance(totalPath);
        if (!B.some(b => arraysEqual(b.path, totalPath))) {
          B.push({ path: totalPath, distance: totalDist });
        }
      }
    }
    if (!B.length) break;
    B.sort((a,b)=>a.distance-b.distance);
    const best = B.shift();
    A.push(best);
    const uniq = [];
    for (const p of A) if (!uniq.some(q=>arraysEqual(q.path,p.path))) uniq.push(p);
    uniq.sort((a,b)=>a.distance-b.distance);
    A.splice(0,A.length,...uniq);
  }
  return A;
}

function arraysEqual(a,b){ if (a.length!==b.length) return false; for (let i=0;i<a.length;i++) if (a[i]!==b[i]) return false; return true; }

function clearRoutes() {
  if (routeLayerGroup) { 
    map.removeLayer(routeLayerGroup); 
    routeLayerGroup = null; 
  }
  if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
  for (const l of altLayers) { map.removeLayer(l); }
  altLayers = [];
  if (startMarker) { map.removeLayer(startMarker); startMarker = null; }
  if (endMarker) { map.removeLayer(endMarker); endMarker = null; }
  if (routePolylines.completed) { map.removeLayer(routePolylines.completed); routePolylines.completed = null; }
  if (routePolylines.remaining) { map.removeLayer(routePolylines.remaining); routePolylines.remaining = null; }
  if (connectorLine) { map.removeLayer(connectorLine); connectorLine = null; }
}

function renderSelectedRoute(selectedIndex) {
  const results = lastResults;
  if (!results || !results.length) return;
  selectedRouteIndex = selectedIndex;

  if (!navigationMode) {
    if (routeLayerGroup) {
      map.removeLayer(routeLayerGroup);
      routeLayerGroup = null;
    }
    if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
    for (const l of altLayers) map.removeLayer(l);
    altLayers = [];

    const layers = [];

    // Render alternatives with subtle styling - LIGHT BLUE
    results.forEach((res, idx) => {
      const latlngs = res.path.map(i => [nodeList[i].lat, nodeList[i].lng]);
      if (idx !== selectedIndex) {
        const altBorder = L.polyline(latlngs, { 
          color: '#ffffff', 
          weight: 7, 
          opacity: 0.8, 
          lineCap: 'round', 
          lineJoin: 'round',
          smoothFactor: 1.0
        });
        const alt = L.polyline(latlngs, { 
          color: '#8ab4f8', 
          weight: 4, 
          opacity: 0.7, 
          lineCap: 'round', 
          lineJoin: 'round',
          smoothFactor: 1.0
        });
        alt.on('click', () => renderSelectedRoute(idx));
        alt.on('mouseover', function(){ this.setStyle({weight:5, opacity:0.9}); });
        alt.on('mouseout', function(){ this.setStyle({weight:4, opacity:0.7}); });
        layers.push(altBorder, alt);
        altLayers.push(altBorder, alt);
      }
    });

    // Render selected route - DARK BLUE (Google Maps style)
    const selectedLatlngs = results[selectedIndex].path.map(i => [nodeList[i].lat, nodeList[i].lng]);
    const selectedBorder = L.polyline(selectedLatlngs, { 
      color: '#ffffff', 
      weight: 9, 
      opacity: 0.9, 
      lineCap: 'round', 
      lineJoin: 'round',
      smoothFactor: 1.0
    });
    routeLayer = L.polyline(selectedLatlngs, { 
      color: '#1967d2', 
      weight: 5, 
      opacity: 1, 
      lineCap: 'round', 
      lineJoin: 'round',
      smoothFactor: 1.0
    });
    
    layers.push(selectedBorder, routeLayer);
    altLayers.push(selectedBorder);

    routeLayerGroup = L.layerGroup(layers).addTo(map);

    if (routeLayer) {
      requestAnimationFrame(() => {
        map.fitBounds(routeLayer.getBounds().pad(0.2));
      });
    }
  }

  currentRoute = results[selectedIndex].path;

  const meters = results[selectedIndex].distance;
  const mins = minutesFromMeters(meters);
  const km = (meters/1000).toFixed(2);
  
  const desktopSummary = document.getElementById('summary-desktop');
  if (desktopSummary) {
    desktopSummary.textContent = `${mins} min • ${km} km`;
  }

  const mobileSummary = document.getElementById('summary-mobile');
  const collapsedSummary = document.getElementById('summary-collapsed');
  if (mobileSummary) {
    mobileSummary.textContent = `${mins} min • ${km} km`;
  }
  if (collapsedSummary) {
    collapsedSummary.textContent = `${mins} min • ${km} km`;
  }

  highlightSelectedAlt('desktop', selectedIndex);

  if (startMarker) startMarker.bringToFront();
  if (endMarker) endMarker.bringToFront();
}

function minutesFromMeters(meters) {
  const mins = Math.round((meters / 1.4) / 60);
  return mins;
}

function setStartEndMarkers(A, B) {
  if (startMarker) { map.removeLayer(startMarker); startMarker = null; }
  if (endMarker) { map.removeLayer(endMarker); endMarker = null; }

  // Start marker - Google Maps style blue dot
  startMarker = L.circleMarker([A.lat, A.lng], {
    radius: 8, 
    fillColor: '#1a73e8', 
    color: '#fff', 
    weight: 3, 
    opacity: 1, 
    fillOpacity: 1
  }).addTo(map).bindPopup(`<strong>Start:</strong> ${A.name}`);

  // End marker - Google Maps style red pin
  endMarker = L.circleMarker([B.lat, B.lng], {
    radius: 8, 
    fillColor: '#ea4335', 
    color: '#fff', 
    weight: 3, 
    opacity: 1, 
    fillOpacity: 1
  }).addTo(map).bindPopup(`<strong>Destination:</strong> ${B.name}`);
}

function populateAlternativesUI(results, context) {
  const items = results.map((r, idx) => {
    const meters = r.distance;
    const mins = minutesFromMeters(meters);
    return { idx, mins, km: (meters/1000).toFixed(2) };
  });

  if (context === 'desktop') {
    const list = document.getElementById('alts-desktop');
    list.innerHTML = '';
    items.forEach(({idx, mins, km}) => {
      const li = document.createElement('button');
      li.className = 'alt-item';
      li.innerHTML = `
        <div class="alt-line">
          <span class="alt-time">${mins} min</span>
          <span class="alt-distance">${km} km</span>
        </div>
        <div class="alt-sub">Walking</div>
      `;
      li.onclick = () => {
        renderSelectedRoute(idx);
        const meters = results[idx].distance;
        const minsSel = minutesFromMeters(meters);
        document.getElementById('summary-desktop').textContent = `${minsSel} min • ${(meters/1000).toFixed(2)} km`;
        highlightSelectedAlt('desktop', idx);
      };
      list.appendChild(li);
    });
    highlightSelectedAlt('desktop', 0);
  } else {
    const list = document.getElementById('alts-mobile');
    list.innerHTML = '';
    items.slice(1).forEach(({idx, mins, km}) => {
      const li = document.createElement('button');
      li.className = 'alt-item';
      li.innerHTML = `
        <div class="alt-line">
          <span class="alt-time">${mins} min</span>
          <span class="alt-distance">${km} km</span>
        </div>
        <div class="alt-sub">Walking</div>
      `;
      li.onclick = () => {
        renderSelectedRoute(idx);
        const meters = results[idx].distance;
        const minsSel = minutesFromMeters(meters);
        document.getElementById('summary-mobile').textContent = `${minsSel} min • ${(meters/1000).toFixed(2)} km`;
        document.getElementById('summary-collapsed').textContent = `${minsSel} min • ${(meters/1000).toFixed(2)} km`;
      };
      list.appendChild(li);
    });
  }
}

function highlightSelectedAlt(context, selectedIdx) {
  const container = (context === 'desktop') ? document.getElementById('alts-desktop') : document.getElementById('alts-mobile');
  Array.from(container.querySelectorAll('.alt-item')).forEach((btn, idx) => {
    if (idx === selectedIdx) btn.classList.add('selected'); else btn.classList.remove('selected');
  });
}

async function route() {
  clearRoutes();
  const A = places.find(p => p.id === document.getElementById('from-desktop').value);
  const B = places.find(p => p.id === document.getElementById('to-desktop').value);
  if (!A || !B) return;
  const si = nodeIndex.get(`ENT_${A.id}`);
  const ti = nodeIndex.get(`ENT_${B.id}`);
  const results = yensKShortests(si, ti, KROUTES);
  if (!results.length) { alert('No path found.'); return; }
  lastResults = results;
  setStartEndMarkers(A, B);

  const best = results[0];
  const meters = best.distance;
  const mins = minutesFromMeters(meters);
  renderSelectedRoute(0);
  document.getElementById('summary-desktop').textContent = `${mins} min • ${(meters/1000).toFixed(2)} km`;
  document.getElementById('route-info-desktop').classList.remove('hidden');
  
  // Show navigation buttons
  document.getElementById('startNavBtn-desktop').classList.remove('hidden');
  document.getElementById('stopNavBtn-desktop').classList.add('hidden');
  
  populateAlternativesUI(results, 'desktop');
}

async function routeMobile() {
  clearRoutes();
  stopNavigation();

  const A = places.find(p => p.id === document.getElementById('from-mobile').value);
  const B = places.find(p => p.id === document.getElementById('to-mobile').value);
  if (!A || !B) return;

  const si = nodeIndex.get(`ENT_${A.id}`);
  const ti = nodeIndex.get(`ENT_${B.id}`);
  const results = yensKShortests(si, ti, KROUTES);
  if (!results.length) { alert('No path found.'); return; }

  lastResults = results;
  setStartEndMarkers(A, B);

  const best = results[0];
  const meters = best.distance;
  const mins = minutesFromMeters(meters);
  renderSelectedRoute(0);

  document.getElementById('summary-mobile').textContent = `${mins} min • ${(meters/1000).toFixed(2)} km`;
  document.getElementById('summary-collapsed').textContent = `${mins} min • ${(meters/1000).toFixed(2)} km`;
  
  document.getElementById('mobile-route-card').classList.remove('hidden');
  document.getElementById('collapsed-view').classList.add('hidden');
  document.getElementById('expanded-view').classList.remove('hidden');

  populateAlternativesUI(results, 'mobile');

  document.getElementById('startNavBtn-mobile').classList.remove('hidden');
  document.getElementById('stopNavBtn-mobile').classList.add('hidden');
}

/* ---------------- NAVIGATION ---------------- */

function startNavigation() {
  if (!currentRoute || currentRoute.length === 0) { alert('Please select a route first'); return; }
  navigationMode = true;
  completedSegments = new Set();
  destinationReached = false;

  if (routeLayerGroup) { map.removeLayer(routeLayerGroup); routeLayerGroup = null; }
  if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
  for (const l of altLayers) { map.removeLayer(l); }
  altLayers = [];

  // Hide start, show stop buttons
  document.getElementById('startNavBtn-desktop')?.classList.add('hidden');
  document.getElementById('stopNavBtn-desktop')?.classList.remove('hidden');
  document.getElementById('startNavBtn-mobile')?.classList.add('hidden');
  document.getElementById('stopNavBtn-mobile')?.classList.remove('hidden');

  if (navigator.geolocation) {
    watchId = navigator.geolocation.watchPosition(updateUserPosition, handleLocationError, {
      enableHighAccuracy: true,
      maximumAge: 500,
      timeout: 5000
    });
  } else {
    alert('Geolocation is not supported by your browser');
  }
}

function stopNavigation() {
  navigationMode = false;
  destinationReached = false;
  completedSegments = new Set();

  if (watchId != null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
  if (userMarker) { map.removeLayer(userMarker); userMarker = null; }
  if (routePolylines.completed) { map.removeLayer(routePolylines.completed); routePolylines.completed = null; }
  if (routePolylines.remaining) { map.removeLayer(routePolylines.remaining); routePolylines.remaining = null; }
  if (connectorLine) { map.removeLayer(connectorLine); connectorLine = null; }

  if (updateThrottle) {
    clearTimeout(updateThrottle);
    updateThrottle = null;
  }

  if (lastResults && lastResults.length) renderSelectedRoute(selectedRouteIndex);

  // Show start buttons again
  document.getElementById('startNavBtn-desktop')?.classList.remove('hidden');
  document.getElementById('stopNavBtn-desktop')?.classList.add('hidden');
  document.getElementById('startNavBtn-mobile')?.classList.remove('hidden');
  document.getElementById('stopNavBtn-mobile')?.classList.add('hidden');
}

function handleLocationError(error) {
  console.error('Location error', error);
  let message = 'Unable to get your location.';
  switch (error.code) {
    case error.PERMISSION_DENIED: message = 'Please enable location permissions.'; break;
    case error.POSITION_UNAVAILABLE: message = 'Location information unavailable.'; break;
    case error.TIMEOUT: message = 'Location request timed out.'; break;
  }
  alert(message);
  stopNavigation();
}

function updateUserPosition(position) {
  if (!navigationMode) return;

  const now = Date.now();
  
  if (now - lastUpdateTime < UPDATE_INTERVAL) {
    return;
  }
  lastUpdateTime = now;

  const newPos = { lat: position.coords.latitude, lng: position.coords.longitude };
  currentPosition = newPos;

  let heading = typeof position.coords.heading === 'number' && !isNaN(position.coords.heading) ? position.coords.heading : null;
  if (heading == null && lastFix) {
    const bearing = computeBearing(lastFix, newPos);
    if (!isNaN(bearing)) heading = bearing;
  }
  if (heading == null) heading = lastHeading; else lastHeading = heading;
  lastFix = newPos;

  requestAnimationFrame(() => {
    updateUserMarker(position, heading);
    ensureConnectorToStart();
    updateNavigationRoute();
  });

  const destNode = currentRoute[currentRoute.length - 1];
  const destDist = hav(currentPosition, nodeList[destNode]);
  if (destDist < 10 && !destinationReached) {
    destinationReached = true;
    alert('You have reached your destination!');
    stopNavigation();
  }
}

function ensureConnectorToStart() {
  if (!currentRoute || currentRoute.length < 2 || !currentPosition) return;

  let nearestIdx = 0, minD = Infinity;
  for (let i = 0; i < currentRoute.length; i++) {
    const d = hav(currentPosition, nodeList[currentRoute[i]]);
    if (d < minD) { minD = d; nearestIdx = i; }
  }

  if (minD <= 12) {
    if (connectorLine) { map.removeLayer(connectorLine); connectorLine = null; }
    return;
  }

  const nn = nodeList[currentRoute[nearestIdx]];
  const points = [[currentPosition.lat, currentPosition.lng],[nn.lat, nn.lng]];

  if (connectorLine) {
    connectorLine.setLatLngs(points);
  } else {
    const halo = L.polyline(points, { 
      color: '#ffffff', 
      weight: 8, 
      opacity: 0.7, 
      interactive:false,
      smoothFactor: 1.0
    });
    const dotted = L.polyline(points, { 
      color: '#1a73e8', 
      weight: 4, 
      opacity: 0.9, 
      dashArray: '6,6', 
      interactive:false,
      smoothFactor: 1.0
    });
    connectorLine = L.layerGroup([halo, dotted]).addTo(map);
  }
}

function findNearestNode(pos) {
  let minDist = Infinity, nearestIdx = 0;
  for (let i=0;i<nodeList.length;i++){
    const d = hav(pos, nodeList[i]);
    if (d < minDist) { minDist = d; nearestIdx = i; }
  }
  return nearestIdx;
}

function isUserOnRoute(pos, route) {
  const threshold = 15;
  for (let i=0;i<route.length-1;i++){
    const a = nodeList[route[i]], b = nodeList[route[i+1]];
    const nearestPt = nearestPointOnSegment(pos, a, b);
    const dist = hav(pos, nearestPt);
    if (dist <= threshold) return true;
  }
  return false;
}

function rerouteFromCurrentPosition() {
  if (!currentPosition || !currentRoute) return;
  const nearestNode = findNearestNode(currentPosition);
  const destNode = currentRoute[currentRoute.length - 1];
  const adj = buildAdj();
  const newRouteResult = dijkstra(adj, nearestNode, destNode);
  if (newRouteResult.path.length && isFinite(newRouteResult.distance)) {
    currentRoute = newRouteResult.path;
    completedSegments = new Set();
    const meters = newRouteResult.distance;
    const mins = minutesFromMeters(meters);
    const km = (meters/1000).toFixed(2);
    const sMobile = document.getElementById('summary-mobile');
    const sColl = document.getElementById('summary-collapsed');
    const sDesktop = document.getElementById('summary-desktop');
    if (sMobile) sMobile.textContent = `${mins} min • ${km} km • Rerouted`;
    if (sColl) sColl.textContent = `${mins} min • ${km} km • Rerouted`;
    if (sDesktop) sDesktop.textContent = `${mins} min • ${km} km • Rerouted`;
  }
}

function updateUserMarker(position, headingDeg) {
  const size = 36;
  
  // Improved navigation arrow with white background
  const arrowIcon = L.divIcon({
    className: 'user-location-marker',
    html: `
      <div style="
        transform: rotate(${headingDeg||0}deg);
        width: ${size}px;
        height: ${size}px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg viewBox="0 0 24 24" width="${size}" height="${size}">
          <defs>
            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.4"/>
            </filter>
          </defs>
          <circle cx="12" cy="12" r="10" fill="white" filter="url(#shadow)"/>
          <path d="M12 4 L16 16 L12 13 L8 16 Z" fill="#1a73e8" stroke="white" stroke-width="0.5"/>
        </svg>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2]
  });

  if (!userMarker) {
    userMarker = L.marker([currentPosition.lat, currentPosition.lng], { 
      icon: arrowIcon, 
      zIndexOffset: 1000 
    }).addTo(map);
  } else {
    userMarker.setLatLng([currentPosition.lat, currentPosition.lng]);
    userMarker.setIcon(arrowIcon);
  }
  
  map.panTo([currentPosition.lat, currentPosition.lng], { 
    animate: true,
    duration: 0.25,
    easeLinearity: 0.25
  });
  
  if (map.getZoom() < 18) {
    map.setZoom(18);
  }
}

function updateNavigationRoute() {
  if (!currentPosition || !currentRoute || currentRoute.length < 2) return;

  const onRoute = isUserOnRoute(currentPosition, currentRoute);
  const nearestNodeDist = hav(currentPosition, nodeList[findNearestNode(currentPosition)]);
  if (!onRoute && nearestNodeDist > 20) {
    rerouteFromCurrentPosition();
  }

  let closestSegmentIndex = 0, minDist = Infinity, snapPoint = null;
  for (let i=0;i<currentRoute.length-1;i++){
    const a = nodeList[currentRoute[i]], b = nodeList[currentRoute[i+1]];
    const nearestPt = nearestPointOnSegment(currentPosition, a, b);
    const dist = hav(currentPosition, nearestPt);
    if (dist < minDist) { minDist = dist; closestSegmentIndex = i; snapPoint = nearestPt; }
  }

  for (let i=0;i<closestSegmentIndex;i++){ completedSegments.add(i); }

  if (routePolylines.completed) { 
    map.removeLayer(routePolylines.completed); 
    routePolylines.completed = null; 
  }
  if (routePolylines.remaining) { 
    map.removeLayer(routePolylines.remaining); 
    routePolylines.remaining = null; 
  }

  for (const l of altLayers) { map.removeLayer(l); }
  altLayers = [];

  const completedCoords = [];
  for (const segIdx of completedSegments) {
    if (segIdx < currentRoute.length-1) {
      const a = nodeList[currentRoute[segIdx]];
      const b = nodeList[currentRoute[segIdx+1]];
      if (completedCoords.length === 0) completedCoords.push([a.lat, a.lng]);
      completedCoords.push([b.lat, b.lng]);
    }
  }
  if (completedCoords.length > 1) {
    routePolylines.completed = L.polyline(completedCoords, {
      color: '#80868b', 
      weight: 5, 
      opacity: 0.6, 
      lineCap: 'round', 
      lineJoin: 'round',
      smoothFactor: 1.0
    }).addTo(map);
  }

  const remainingCoords = [];
  if (snapPoint) remainingCoords.push([snapPoint.lat, snapPoint.lng]);
  for (let i=closestSegmentIndex+1; i<currentRoute.length; i++){
    const node = nodeList[currentRoute[i]];
    remainingCoords.push([node.lat, node.lng]);
  }
  if (remainingCoords.length > 1) {
    const remainingBorder = L.polyline(remainingCoords, {
      color: '#ffffff', 
      weight: 8, 
      opacity: 0.9, 
      lineCap: 'round', 
      lineJoin: 'round',
      smoothFactor: 1.0
    }).addTo(map);
    altLayers.push(remainingBorder);

    routePolylines.remaining = L.polyline(remainingCoords, {
      color: '#1a73e8', 
      weight: 5, 
      opacity: 1, 
      lineCap: 'round', 
      lineJoin: 'round',
      smoothFactor: 1.0
    }).addTo(map);
  }

  if (startMarker) startMarker.bringToFront();
  if (endMarker) endMarker.bringToFront();
  if (userMarker) userMarker.bringToFront();
}

function computeBearing(a, b) {
  const toR = x => x * Math.PI / 180;
  const toD = x => x * 180 / Math.PI;
  const φ1 = toR(a.lat), φ2 = toR(b.lat);
  const λ1 = toR(a.lng), λ2 = toR(b.lng);
  const y = Math.sin(λ2-λ1) * Math.cos(φ2);
  const x = Math.cos(φ1)*Math.sin(φ2) - Math.sin(φ1)*Math.cos(φ2)*Math.cos(λ2-λ1);
  let θ = Math.atan2(y, x);
  θ = (toD(θ) + 360) % 360;
  return θ;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMap);
} else {
  initMap();
}
