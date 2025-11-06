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
const UPDATE_INTERVAL = 100; // ms - smoother updates
let routeLayerGroup = null;

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
    preferCanvas: true, // Performance boost
    renderer: L.canvas({ tolerance: 5 })
  }).setView([12.6409, 77.4412], 16);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 20,
    attribution: 'OpenStreetMap contributors',
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
    document.getElementById('swapBtn-desktop').onclick = () => {
      const f = selFromDesktop.value;
      selFromDesktop.value = selToDesktop.value;
      selToDesktop.value = f;
    };
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
    document.getElementById('swapBtn-mobile').onclick = () => {
      const f = selFromMobile.value;
      selFromMobile.value = selToMobile.value;
      selToMobile.value = f;
    };
    document.getElementById('routeBtn-mobile').onclick = routeMobile;
  }

  // UI toggles
  document.getElementById('creditsToggle')?.addEventListener('click', function () {
    const teamList = document.getElementById('teamList');
    const icon = this.querySelector('.toggle-icon');
    teamList.classList.toggle('open');
    icon.textContent = teamList.classList.contains('open') ? '▴' : '▾';
  });
  document.getElementById('mobileInfoBtn')?.addEventListener('click', () => {
    document.getElementById('teamModal').classList.remove('hidden');
  });
  document.getElementById('modalClose')?.addEventListener('click', () => {
    document.getElementById('teamModal').classList.add('hidden');
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

  // Navigation buttons
  document.getElementById('startNavBtn-mobile')?.addEventListener('click', startNavigation);
  document.getElementById('stopNavBtn-mobile')?.addEventListener('click', stopNavigation);
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

  // Only clear route polylines when NOT in navigation mode
  if (!navigationMode) {
    // Clear previous route layers efficiently
    if (routeLayerGroup) {
      map.removeLayer(routeLayerGroup);
      routeLayerGroup = null;
    }
    if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
    for (const l of altLayers) map.removeLayer(l);
    altLayers = [];

    // Use LayerGroup for better performance
    const layers = [];

    // Render alternatives
    results.forEach((res, idx) => {
      const latlngs = res.path.map(i => [nodeList[i].lat, nodeList[i].lng]);
      if (idx !== selectedIndex) {
        const altBorder = L.polyline(latlngs, { 
          color: '#ffffff', 
          weight: 8, 
          opacity: 0.6, 
          lineCap: 'round', 
          lineJoin: 'round',
          smoothFactor: 1.0
        });
        const alt = L.polyline(latlngs, { 
          color: '#5b9aff', 
          weight: 5, 
          opacity: 0.5, 
          lineCap: 'round', 
          lineJoin: 'round',
          smoothFactor: 1.0
        });
        alt.on('click', () => renderSelectedRoute(idx));
        alt.on('mouseover', function(){ this.setStyle({weight:6, opacity:0.7}); });
        alt.on('mouseout', function(){ this.setStyle({weight:5, opacity:0.5}); });
        layers.push(altBorder, alt);
        altLayers.push(altBorder, alt);
      }
    });

    // Render selected route bold
    const selectedLatlngs = results[selectedIndex].path.map(i => [nodeList[i].lat, nodeList[i].lng]);
    const selectedBorder = L.polyline(selectedLatlngs, { 
      color: '#ffffff', 
      weight: 10, 
      opacity: 0.8, 
      lineCap: 'round', 
      lineJoin: 'round',
      smoothFactor: 1.0
    });
    routeLayer = L.polyline(selectedLatlngs, { 
      color: '#0d47a1', 
      weight: 6, 
      opacity: 1, 
      lineCap: 'round', 
      lineJoin: 'round',
      smoothFactor: 1.0
    });
    
    layers.push(selectedBorder, routeLayer);
    altLayers.push(selectedBorder);

    // Add all layers at once for better performance
    routeLayerGroup = L.layerGroup(layers).addTo(map);

    if (routeLayer) {
      requestAnimationFrame(() => {
        map.fitBounds(routeLayer.getBounds().pad(0.2));
      });
    }
  }

  // Store current route
  currentRoute = results[selectedIndex].path;

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

  startMarker = L.circleMarker([A.lat, A.lng], {
    radius: 8, fillColor: '#4285f4', color: '#fff', weight: 2, opacity: 1, fillOpacity: 1
  }).addTo(map).bindPopup(A.name);

  endMarker = L.circleMarker([B.lat, B.lng], {
    radius: 8, fillColor: '#EA4335', color: '#fff', weight: 2, opacity: 1, fillOpacity: 1
  }).addTo(map).bindPopup(B.name);
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
    // Mobile: skip first route from alternatives list since it's displayed in header
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
  
  // Show mobile route card and open EXPANDED view by default so alternatives are visible
  document.getElementById('mobile-route-card').classList.remove('hidden');
  document.getElementById('collapsed-view').classList.add('hidden');
  document.getElementById('expanded-view').classList.remove('hidden');

  // Populate alternatives for mobile
  populateAlternativesUI(results, 'mobile');

  // Show start button, hide stop button
  document.getElementById('startNavBtn-mobile').classList.remove('hidden');
  document.getElementById('stopNavBtn-mobile').classList.add('hidden');
}

/* ---------------- NAVIGATION ---------------- */

function startNavigation() {
  if (!currentRoute || currentRoute.length === 0) { alert('Please select a route first'); return; }
  navigationMode = true;
  completedSegments = new Set();
  destinationReached = false;

  // Hide alternatives and non-selected routes during navigation
  if (routeLayerGroup) { map.removeLayer(routeLayerGroup); routeLayerGroup = null; }
  if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
  for (const l of altLayers) { map.removeLayer(l); }
  altLayers = [];

  // Hide start button, show stop button
  document.getElementById('startNavBtn-mobile').classList.add('hidden');
  document.getElementById('stopNavBtn-mobile').classList.remove('hidden');

  // Begin location tracking with optimized settings
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

  // Clear throttle
  if (updateThrottle) {
    clearTimeout(updateThrottle);
    updateThrottle = null;
  }

  // Re-render the originally selected route and alternatives
  if (lastResults && lastResults.length) renderSelectedRoute(selectedRouteIndex);

  // Show start button again
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
  
  // Throttle updates for smooth performance
  if (now - lastUpdateTime < UPDATE_INTERVAL) {
    return;
  }
  lastUpdateTime = now;

  const newPos = { lat: position.coords.latitude, lng: position.coords.longitude };
  currentPosition = newPos;

  // Determine heading
  let heading = typeof position.coords.heading === 'number' && !isNaN(position.coords.heading) ? position.coords.heading : null;
  if (heading == null && lastFix) {
    const bearing = computeBearing(lastFix, newPos);
    if (!isNaN(bearing)) heading = bearing;
  }
  if (heading == null) heading = lastHeading; else lastHeading = heading;
  lastFix = newPos;

  // Use requestAnimationFrame for smooth updates
  requestAnimationFrame(() => {
    updateUserMarker(position, heading);
    ensureConnectorToStart();
    updateNavigationRoute();
  });

  // Destination check
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
      color: '#4285f4', 
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
    if (sMobile) sMobile.textContent = `${mins} min • ${km} km • Rerouted`;
    if (sColl) sColl.textContent = `${mins} min • ${km} km • Rerouted`;
  }
}

function updateUserMarker(position, headingDeg) {
  const size = 30;
  const arrowIcon = L.divIcon({
    className: 'user-location-marker',
    html: `
      <div style="transform: rotate(${headingDeg||0}deg); width:${size}px; height:${size}px;">
        <svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="#4285f4" stroke="#ffffff" stroke-width="1.2">
          <path d="M12 2 L4 20 L12 14 L20 20 Z"></path>
        </svg>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2]
  });

  if (!userMarker) {
    userMarker = L.marker([currentPosition.lat, currentPosition.lng], { icon: arrowIcon, zIndexOffset: 1000 }).addTo(map);
  } else {
    userMarker.setLatLng([currentPosition.lat, currentPosition.lng]);
    userMarker.setIcon(arrowIcon);
  }
  
  // Smooth pan instead of setView
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

  // Efficiently update polylines
  if (routePolylines.completed) { 
    map.removeLayer(routePolylines.completed); 
    routePolylines.completed = null; 
  }
  if (routePolylines.remaining) { 
    map.removeLayer(routePolylines.remaining); 
    routePolylines.remaining = null; 
  }

  // Remove old alt layers
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
      color: '#90caf9', 
      weight: 6, 
      opacity: 0.8, 
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
      weight: 10, 
      opacity: 0.8, 
      lineCap: 'round', 
      lineJoin: 'round',
      smoothFactor: 1.0
    }).addTo(map);
    altLayers.push(remainingBorder);

    routePolylines.remaining = L.polyline(remainingCoords, {
      color: '#0d47a1', 
      weight: 6, 
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
