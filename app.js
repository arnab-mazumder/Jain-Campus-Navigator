let map, places = [];
let graph = { nodes: [], edges: [] };
let nodeIndex = new Map();
let nodeList = [];
let routeLayer = null;
let altLayers = [];
let startMarker = null;
let endMarker = null;
let lastResults = []; // store K routes for selection across desktop/mobile
let K_ROUTES = 5;     // configurable number of alternatives


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
    maxZoom: 19
  }).setView([12.6409, 77.4412], 16);


  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 20,
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);


  // Generate circle polygon mask
  const circlePolygon = [];
  const numPoints = 64;
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    const lat = campusCenter.lat + (campusRadius / 111320) * Math.cos(angle);
    const lng = campusCenter.lng + (campusRadius / (111320 * Math.cos(campusCenter.lat * Math.PI / 180))) * Math.sin(angle);
    circlePolygon.push([lat, lng]);
  }


  const worldBounds = [
    [-90, -180], [-90, 180], [90, 180], [90, -180], [-90, -180]
  ];


  const maskPolygon = [
    worldBounds,
    circlePolygon.slice().reverse()
  ];


  L.polygon(maskPolygon, {
    color: 'transparent',
    fillColor: '#ccc',
    fillOpacity: 0.3,
    weight: 0,
    interactive: false
  }).addTo(map);


  places = await (await fetch('data/landmarks.json')).json();
  graph  = await (await fetch('data/paths.json')).json();


  // Add entrance nodes for each place and connect to graph with edge splitting
  places.forEach(p => {
    const entId = 'ENT_' + p.id;
    const entNode = { id: entId, lat: p.lat, lng: p.lng };
    graph.nodes.push(entNode);

    if (p.accessNode) {
      // If manually specified, use it
      graph.edges.push([p.accessNode, entId]);
    } else {
      // Find nearest point on the path network
      let bestDist = Infinity;
      let bestNodeId = null;
      let bestEdge = null;
      let bestPointOnEdge = null;

      // Check distance to all existing nodes
      for (let i = 0; i < graph.nodes.length - 1; i++) {
        const d = hav(p, graph.nodes[i]);
        if (d < bestDist) {
          bestDist = d;
          bestNodeId = graph.nodes[i].id;
          bestEdge = null;
        }
      }

      // Check distance to all edges (find nearest point on each edge)
      for (const [aId, bId] of graph.edges) {
        const aIdx = graph.nodes.findIndex(n => n.id === aId);
        const bIdx = graph.nodes.findIndex(n => n.id === bId);
        if (aIdx === -1 || bIdx === -1) continue;

        const a = graph.nodes[aIdx];
        const b = graph.nodes[bIdx];

        // Find nearest point on line segment AB to point P
        const nearestPoint = nearestPointOnSegment(p, a, b);
        const d = hav(p, nearestPoint);

        if (d < bestDist) {
          bestDist = d;
          bestEdge = [aId, bId];
          bestPointOnEdge = nearestPoint;
          bestNodeId = null;
        }
      }

      if (bestEdge && bestPointOnEdge) {
        // Split the edge by inserting a new node
        const splitNodeId = 'SPLIT_' + p.id;
        const splitNode = { id: splitNodeId, lat: bestPointOnEdge.lat, lng: bestPointOnEdge.lng };
        graph.nodes.push(splitNode);

        // Remove old edge and add two new edges through split point
        const edgeIndex = graph.edges.findIndex(e => 
          (e[0] === bestEdge[0] && e[1] === bestEdge[1]) || 
          (e[0] === bestEdge[1] && e[1] === bestEdge[0])
        );
        if (edgeIndex !== -1) {
          graph.edges.splice(edgeIndex, 1);
          graph.edges.push([bestEdge[0], splitNodeId]);
          graph.edges.push([splitNodeId, bestEdge[1]]);
        }

        // Connect entrance to split node
        graph.edges.push([splitNodeId, entId]);
      } else if (bestNodeId) {
        // Connect to nearest node
        graph.edges.push([bestNodeId, entId]);
      }
    }
  });


  nodeList = graph.nodes;
  nodeIndex = new Map(nodeList.map((n, i) => [n.id, i]));


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


  // Desktop credits toggle
  document.getElementById('creditsToggle')?.addEventListener('click', function() {
    const teamList = document.getElementById('teamList');
    const icon = this.querySelector('.toggle-icon');
    teamList.classList.toggle('open');
    icon.textContent = teamList.classList.contains('open') ? '▲' : '▼';
  });


  // Mobile team modal
  document.getElementById('mobileInfoBtn')?.addEventListener('click', () => {
    document.getElementById('teamModal').classList.remove('hidden');
  });
  document.getElementById('modalClose')?.addEventListener('click', () => {
    document.getElementById('teamModal').classList.add('hidden');
  });
  
  // Mobile route card toggle functionality
  document.getElementById('collapsed-view')?.addEventListener('click', () => {
    document.getElementById('collapsed-view').classList.add('hidden');
    document.getElementById('expanded-view').classList.remove('hidden');
  });

  document.getElementById('closeCard')?.addEventListener('click', () => {
    document.getElementById('expanded-view').classList.add('hidden');
    document.getElementById('collapsed-view').classList.remove('hidden');
  });
}


function hav(a, b) {
  const R = 6371000, toR = x => x * Math.PI / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const s = Math.sin(dLat/2)**2 + Math.cos(toR(a.lat))*Math.cos(toR(b.lat))*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(s));
}


// Find nearest point on line segment AB to point P
function nearestPointOnSegment(p, a, b) {
  // Convert to simple coordinates (treating lat/lng as x/y for calculation)
  const px = p.lng, py = p.lat;
  const ax = a.lng, ay = a.lat;
  const bx = b.lng, by = b.lat;

  const ABx = bx - ax;
  const ABy = by - ay;
  const APx = px - ax;
  const APy = py - ay;

  const AB_AB = ABx * ABx + ABy * ABy;
  const AP_AB = APx * ABx + APy * ABy;

  if (AB_AB === 0) return { lat: a.lat, lng: a.lng }; // A and B are same point

  let t = AP_AB / AB_AB;
  t = Math.max(0, Math.min(1, t)); // Clamp to [0, 1]

  return {
    lat: ay + t * ABy,
    lng: ax + t * ABx
  };
}


function buildAdj(removedEdges = new Set(), removedNodes = new Set()) {
  // Build adjacency with ability to temporarily remove edges/nodes (for Yen)
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
    adj[ai].push({ i: bi, w });
    adj[bi].push({ i: ai, w });
  }
  return adj;
}


function dijkstra(adj, src, dst) {
  const n = adj.length, dist = Array(n).fill(Infinity), prev = Array(n).fill(-1), used = Array(n).fill(false);
  dist[src] = 0; const pq = [{ d: 0, i: src }];
  const pop = () => {
    let bi = -1, bd = Infinity;
    for (let i = 0; i < pq.length; i++) if (pq[i].d < bd) { bd = pq[i].d; bi = i; }
    return bi < 0 ? null : pq.splice(bi, 1)[0];
  };
  while (pq.length) {
    const cur = pop(); if (!cur) break; const u = cur.i; if (used[u]) continue; used[u] = true; if (u === dst) break;
    for (const { i: v, w } of adj[u]) {
      if (!used[v] && dist[u] + w < dist[v]) {
        dist[v] = dist[u] + w;
        prev[v] = u;
        pq.push({ d: dist[v], i: v });
      }
    }
  }
  const path = []; let u = dst;
  if (prev[u] !== -1 || u === src) { while (u !== -1) { path.push(u); u = prev[u]; } path.reverse(); }
  return { path, distance: dist[dst] };
}


// Helper to compute distance of a path in meters
function pathDistance(indices) {
  let d = 0;
  for (let i = 0; i + 1 < indices.length; i++) {
    const a = nodeList[indices[i]], b = nodeList[indices[i+1]];
    d += hav(a, b);
  }
  return d;
}


// Yen's K-shortest simple paths (loopless) using existing Dijkstra
// Returns array of {path: [nodeIndices], distance}
function yensKShortest(si, ti, K) {
  const A = []; // accepted best paths
  const B = []; // candidate paths: {path, distance}


  // First shortest path
  const adj0 = buildAdj();
  const p0 = dijkstra(adj0, si, ti);
  if (!p0.path.length || !isFinite(p0.distance)) return A;
  A.push(p0);


  for (let k = 1; k < K; k++) {
    const prevPath = A[k - 1].path;
    for (let i = 0; i < prevPath.length - 1; i++) {
      const spurNode = prevPath[i];
      const rootPath = prevPath.slice(0, i + 1); // inclusive of spur


      // Temporarily remove edges that would recreate prior paths with same root
      const removedEdges = new Set();
      const removedNodes = new Set();


      for (const p of A) {
        const candidateRoot = p.path.slice(0, i + 1);
        if (arraysEqual(candidateRoot, rootPath) && p.path.length > i + 1) {
          const u = p.path[i], v = p.path[i + 1];
          removedEdges.add(`${u}-${v}`);
          removedEdges.add(`${v}-${u}`);
        }
      }


      // Remove all rootPath nodes except spurNode to avoid loops
      for (const rpNode of rootPath.slice(0, -1)) {
        removedNodes.add(rpNode);
      }


      const adj = buildAdj(removedEdges, removedNodes);
      const spurRes = dijkstra(adj, spurNode, ti);
      if (spurRes.path.length && isFinite(spurRes.distance)) {
        // Join root (without spur duplicate) + spur
        const totalPath = rootPath.slice(0, -1).concat(spurRes.path);
        // Deduplicate same candidate
        if (!B.some(b => arraysEqual(b.path, totalPath))) {
          const totalDist = pathDistance(totalPath);
          B.push({ path: totalPath, distance: totalDist });
        }
      }
    }


    if (B.length === 0) break;
    // Select best candidate
    B.sort((a, b) => a.distance - b.distance);
    const best = B.shift();
    A.push(best);
  }


  // Ensure strictly increasing by distance and unique paths
  const uniq = [];
  for (const p of A) {
    if (!uniq.some(q => arraysEqual(q.path, p.path))) uniq.push(p);
  }
  uniq.sort((a, b) => a.distance - b.distance);
  return uniq;
}


function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}


function clearRoutes() {
  if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
  for (const l of altLayers) { map.removeLayer(l); }
  altLayers = [];
  if (startMarker) { map.removeLayer(startMarker); startMarker = null; }
  if (endMarker) { map.removeLayer(endMarker); endMarker = null; }
}


function renderSelectedRoute(selectedIndex) {
  // Draw the selected route in primary color and the others as thin alternates
  const results = lastResults;
  if (!results || !results.length) return;

  // Clear visual layers only (keep markers if needed)
  if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
  for (const l of altLayers) { map.removeLayer(l); }
  altLayers = [];

  // First, render all alternative routes (non-selected) with border effect and click handlers
  results.forEach((res, idx) => {
    const latlngs = res.path.map(i => [nodeList[i].lat, nodeList[i].lng]);
    if (idx !== selectedIndex) {
      // White border for alternative routes
      const altBorder = L.polyline(latlngs, { 
        color: '#ffffff',
        weight: 8,
        opacity: 0.6,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
      altLayers.push(altBorder);
      
      // Blue core for alternative routes with click handler
      const alt = L.polyline(latlngs, { 
        color: '#5b9aff',
        weight: 5, 
        opacity: 0.5,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
      
      // Add click handler to switch to this route
      alt.on('click', () => {
        renderSelectedRoute(idx);
        // Update summary displays
        const meters = results[idx].distance;
        const minsSel = minutesFromMeters(meters);
        const kmSel = (meters / 1000).toFixed(2);
        
        // Update desktop summary if exists
        const summaryDesktop = document.getElementById('summary-desktop');
        if (summaryDesktop) {
          summaryDesktop.textContent = `${minsSel} min (${kmSel} km)`;
        }
        
        // Update mobile summary if exists
        const summaryMobile = document.getElementById('summary-mobile');
        const summaryCollapsed = document.getElementById('summary-collapsed');
        if (summaryMobile) {
          summaryMobile.textContent = `${minsSel} min (${kmSel} km)`;
        }
        if (summaryCollapsed) {
          summaryCollapsed.textContent = `${minsSel} min (${kmSel} km)`;
        }
        
        // Update UI highlights
        highlightSelectedAlt('desktop', idx);
        highlightSelectedAlt('mobile', idx);
      });
      
      // Change cursor to pointer on hover
      alt.on('mouseover', function() {
        this.setStyle({ weight: 6, opacity: 0.7 });
      });
      alt.on('mouseout', function() {
        this.setStyle({ weight: 5, opacity: 0.5 });
      });
      
      altLayers.push(alt);
    }
  });

  // Then, render the selected route on top with border effect
  const selectedLatlngs = results[selectedIndex].path.map(i => [nodeList[i].lat, nodeList[i].lng]);
  
  // White border for selected route (renders first, appears behind)
  const selectedBorder = L.polyline(selectedLatlngs, { 
    color: '#ffffff',
    weight: 10,
    opacity: 0.8,
    lineCap: 'round',
    lineJoin: 'round'
  }).addTo(map);
  altLayers.push(selectedBorder);
  
  // Dark blue core for selected route (renders on top)
  routeLayer = L.polyline(selectedLatlngs, { 
    color: '#0d47a1',
    weight: 6, 
    opacity: 1,
    lineCap: 'round',
    lineJoin: 'round'
  }).addTo(map);

  // Bring markers to front so they appear above routes
  if (startMarker) startMarker.bringToFront();
  if (endMarker) endMarker.bringToFront();

  // Fit bounds on selected route
  if (routeLayer) map.fitBounds(routeLayer.getBounds().pad(0.2));
}


function minutesFromMeters(meters) {
  // average 1.4 m/s
  const mins = Math.round((meters / 1.4) / 60);
  return mins;
}


function setStartEndMarkers(A, B) {
  if (startMarker) { map.removeLayer(startMarker); startMarker = null; }
  if (endMarker) { map.removeLayer(endMarker); endMarker = null; }


  startMarker = L.circleMarker([A.lat, A.lng], {
    radius: 8,
    fillColor: '#4285f4',
    color: '#fff',
    weight: 2,
    opacity: 1,
    fillOpacity: 1
  }).addTo(map).bindPopup(A.name);


  endMarker = L.circleMarker([B.lat, B.lng], {
    radius: 8,
    fillColor: '#EA4335',
    color: '#fff',
    weight: 2,
    opacity: 1,
    fillOpacity: 1
  }).addTo(map).bindPopup(B.name);
}


function populateAlternativesUI(results, context) {
  // context: 'desktop' or 'mobile'
  // Build list entries with click handlers to choose a route
  const items = results.map((r, idx) => {
    const meters = r.distance;
    const mins = minutesFromMeters(meters);
    return { idx, mins, km: (meters / 1000).toFixed(2) };
  });


  if (context === 'desktop') {
    const list = document.getElementById('alts-desktop');
    list.innerHTML = '';
    items.forEach(({ idx, mins, km }) => {
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
        // Update summary to selected
        const meters = results[idx].distance;
        const minsSel = minutesFromMeters(meters);
        document.getElementById('summary-desktop').textContent = `${minsSel} min (${(meters / 1000).toFixed(2)} km)`;
        highlightSelectedAlt('desktop', idx);
      };
      list.appendChild(li);
    });
    highlightSelectedAlt('desktop', 0);
  } else {
    const list = document.getElementById('alts-mobile');
    list.innerHTML = '';
    items.forEach(({ idx, mins, km }) => {
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
        document.getElementById('summary-mobile').textContent = `${minsSel} min (${(meters / 1000).toFixed(2)} km)`;
        document.getElementById('summary-collapsed').textContent = `${minsSel} min (${(meters / 1000).toFixed(2)} km)`;
        highlightSelectedAlt('mobile', idx);
      };
      list.appendChild(li);
    });
    highlightSelectedAlt('mobile', 0);
  }
}


function highlightSelectedAlt(context, selectedIdx) {
  const container = context === 'desktop' ? document.getElementById('alts-desktop') : document.getElementById('alts-mobile');
  Array.from(container.querySelectorAll('.alt-item')).forEach((btn, idx) => {
    if (idx === selectedIdx) btn.classList.add('selected'); else btn.classList.remove('selected');
  });
}


async function route() {
  clearRoutes();


  const A = places.find(p => p.id === document.getElementById('from-desktop').value);
  const B = places.find(p => p.id === document.getElementById('to-desktop').value);
  if (!A || !B) return;


  const si = nodeIndex.get('ENT_' + A.id);
  const ti = nodeIndex.get('ENT_' + B.id);


  const results = yensKShortest(si, ti, K_ROUTES);
  if (!results.length) {
    alert('No path found.');
    return;
  }
  lastResults = results;


  // Render markers
  setStartEndMarkers(A, B);


  // Default to best route
  const best = results[0];
  const meters = best.distance;
  const mins = minutesFromMeters(meters);


  // Draw and fit
  renderSelectedRoute(0);


  // Update desktop summary and show panel
  document.getElementById('summary-desktop').textContent = `${mins} min (${(meters / 1000).toFixed(2)} km)`;
  document.getElementById('route-info-desktop').classList.remove('hidden');


  // Populate alternatives list
  populateAlternativesUI(results, 'desktop');
}


async function routeMobile() {
  clearRoutes();


  const A = places.find(p => p.id === document.getElementById('from-mobile').value);
  const B = places.find(p => p.id === document.getElementById('to-mobile').value);
  if (!A || !B) return;


  const si = nodeIndex.get('ENT_' + A.id);
  const ti = nodeIndex.get('ENT_' + B.id);


  const results = yensKShortest(si, ti, K_ROUTES);
  if (!results.length) {
    alert('No path found.');
    return;
  }
  lastResults = results;


  // Render markers
  setStartEndMarkers(A, B);


  // Default to best route
  const best = results[0];
  const meters = best.distance;
  const mins = minutesFromMeters(meters);
  const km = (meters / 1000).toFixed(2);


  // Draw and fit
  renderSelectedRoute(0);


  // Update all mobile summary displays
  document.getElementById('summary-mobile').textContent = `${mins} min (${km} km)`;
  document.getElementById('summary-collapsed').textContent = `${mins} min (${km} km)`;
  
  // Show card in collapsed state
  document.getElementById('mobile-route-card').classList.remove('hidden');
  document.getElementById('collapsed-view').classList.remove('hidden');
  document.getElementById('expanded-view').classList.add('hidden');


  // Populate alternatives list
  populateAlternativesUI(results, 'mobile');
}


if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMap);
} else {
  initMap();
}
