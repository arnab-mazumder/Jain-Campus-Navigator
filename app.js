let map, places = [];
let graph = { nodes: [], edges: [] };
let nodeIndex = new Map();
let nodeList = [];
let routeLayer = null;
let startMarker = null;
let endMarker = null;

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

  // Generate circle polygon
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

  places.forEach(p => {
    const entId = 'ENT_' + p.id;
    const entNode = { id: entId, lat: p.lat, lng: p.lng };
    graph.nodes.push(entNode);

    if (p.accessNode) {
      graph.edges.push([p.accessNode, entId]);
    } else {
      let best = 0, bd = Infinity;
      for (let i = 0; i < graph.nodes.length - 1; i++) {
        const d = hav(p, graph.nodes[i]);
        if (d < bd) { bd = d; best = i; }
      }
      const accessId = graph.nodes[best].id;
      graph.edges.push([accessId, entId]);
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
}

function hav(a, b) {
  const R = 6371000, toR = x => x * Math.PI / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const s = Math.sin(dLat/2)**2 + Math.cos(toR(a.lat))*Math.cos(toR(b.lat))*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function buildAdj() {
  const adj = Array(nodeList.length).fill(0).map(() => []);
  for (const [aiId, biId] of graph.edges) {
    const ai = nodeIndex.get(aiId), bi = nodeIndex.get(biId);
    if (ai == null || bi == null) continue;
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
    for (const { i: v, w } of adj[u]) if (!used[v] && dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; pq.push({ d: dist[v], i: v }); }
  }
  const path = []; let u = dst; if (prev[u] !== -1 || u === src) { while (u !== -1) { path.push(u); u = prev[u]; } path.reverse(); }
  return { path, distance: dist[dst] };
}

async function route() {
  if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
  if (startMarker) { map.removeLayer(startMarker); startMarker = null; }
  if (endMarker) { map.removeLayer(endMarker); endMarker = null; }

  const A = places.find(p => p.id === document.getElementById('from-desktop').value);
  const B = places.find(p => p.id === document.getElementById('to-desktop').value);
  if (!A || !B) return;

  const adj = buildAdj();
  const si = nodeIndex.get('ENT_' + A.id);
  const ti = nodeIndex.get('ENT_' + B.id);

  const res = dijkstra(adj, si, ti);
  if (!res.path.length || !isFinite(res.distance)) {
    alert('No path found.');
    return;
  }

  const latlngs = res.path.map(i => [nodeList[i].lat, nodeList[i].lng]);
  routeLayer = L.polyline(latlngs, { color: '#4285f4', weight: 6 }).addTo(map);
  map.fitBounds(routeLayer.getBounds().pad(0.2));

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

  const meters = res.distance, mins = Math.round((meters / 1.4) / 60);
  document.getElementById('summary-desktop').textContent = `${mins} min (${(meters / 1000).toFixed(2)} km)`;
  
  document.getElementById('route-info-desktop').classList.remove('hidden');
}

async function routeMobile() {
  if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
  if (startMarker) { map.removeLayer(startMarker); startMarker = null; }
  if (endMarker) { map.removeLayer(endMarker); endMarker = null; }

  const A = places.find(p => p.id === document.getElementById('from-mobile').value);
  const B = places.find(p => p.id === document.getElementById('to-mobile').value);
  if (!A || !B) return;

  const adj = buildAdj();
  const si = nodeIndex.get('ENT_' + A.id);
  const ti = nodeIndex.get('ENT_' + B.id);

  const res = dijkstra(adj, si, ti);
  if (!res.path.length || !isFinite(res.distance)) {
    alert('No path found.');
    return;
  }

  const latlngs = res.path.map(i => [nodeList[i].lat, nodeList[i].lng]);
  routeLayer = L.polyline(latlngs, { color: '#4285f4', weight: 6 }).addTo(map);
  map.fitBounds(routeLayer.getBounds().pad(0.2));

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

  const meters = res.distance, mins = Math.round((meters / 1.4) / 60);
  document.getElementById('summary-mobile').textContent = `${mins} min (${(meters / 1000).toFixed(2)} km)`;
  
  document.getElementById('mobile-route-card').classList.remove('hidden');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMap);
} else {
  initMap();
}
