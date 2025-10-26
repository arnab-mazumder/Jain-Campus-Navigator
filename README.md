<div align="center">

# 🗺️ Jain Campus Navigator

### *Smart pathfinding for Jain University campus using Dijkstra's algorithm*

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-Visit_Now-00C853?style=for-the-badge)](https://jain-campus-navigator.vercel.app)
[![GitHub](https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github)](https://github.com/arnabmazumder/jain-campus-navigator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

![Jain Campus Navigator](assets/campus-bg.jpg)

*An interactive web-based navigation system providing real-time shortest path calculations across 20+ campus locations*

[Features](#-features) • [Demo](#-live-demo) • [Technology](#-technology-stack) • [Getting Started](#-getting-started) • [Contributing](#-contributing)

</div>

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🧭 Smart Navigation
- **Dijkstra's Algorithm** for optimal routing
- **80+ node graph** with 90+ edges
- **Real-time calculations** (<50ms response)
- **20+ campus landmarks** coverage

</td>
<td width="50%">

### 🎨 Modern Interface
- **Responsive design** (mobile-first)
- **Interactive Leaflet map**
- **Google Maps-inspired UI**
- **Gradient animations**

</td>
</tr>
</table>

### 🚀 Technical Highlights

```javascript
⚡ Pure Vanilla JavaScript (ES6+)  |  No framework overhead
📍 OpenStreetMap Integration      |  High-quality map tiles
🎯 Graph-based Routing             |  Service road network
📱 Mobile Optimized                |  Touch-friendly interface
🔒 Static Deployment               |  Zero backend required
```

---

## 🌐 Live Demo

**Experience it now:** [jain-campus-navigator.vercel.app](https://jain-campus-navigator.vercel.app)

### 📸 Screenshots

<div align="center">

| Desktop View | Mobile View |
|:---:|:---:|
| ![Desktop](screenshots/desktop.png) | ![Mobile](screenshots/mobile.png) |
| Full sidebar with route details | Floating search with bottom sheet |

</div>

---

## 🛠️ Technology Stack

<div align="center">

| Technology | Purpose | Version |
|:---:|:---:|:---:|
| ![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black) | Core Logic | ES6+ |
| ![Leaflet](https://img.shields.io/badge/Leaflet-199900?style=flat-square&logo=leaflet&logoColor=white) | Interactive Maps | 1.9.4 |
| ![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white) | Structure | 5 |
| ![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white) | Styling | 3 |
| ![OpenStreetMap](https://img.shields.io/badge/OpenStreetMap-7EBC6F?style=flat-square&logo=openstreetmap&logoColor=white) | Map Tiles | Latest |

</div>

---

## 📂 Project Structure

```
jain-campus-navigator/
│
├── 📁 assets/
│   └── campus-bg.jpg          # Hero background image
│
├── 📁 data/
│   ├── landmarks.json         # 20 campus locations with coordinates
│   └── paths.json             # Graph network (80 nodes, 90+ edges)
│
├── 📁 screenshots/
│   ├── desktop.png
│   └── mobile.png
│
├── index.html                 # Main application file
├── styles.css                 # Responsive CSS (mobile-first)
├── app.js                     # Dijkstra's algorithm + map logic
├── README.md                  # You are here!
└── LICENSE                    # MIT License
```

---

## 🎯 Core Algorithm

### Dijkstra's Shortest Path Implementation

```javascript
/**
 * Computes shortest path between two nodes using Dijkstra's algorithm
 * @param {Object} graph - Adjacency list representation
 * @param {string} start - Starting node ID
 * @param {string} end - Target node ID
 * @returns {Object} { path: Array, distance: Number }
 */
function dijkstra(graph, start, end) {
    // Priority queue implementation
    // Time Complexity: O((V + E) log V)
    // Space Complexity: O(V)
    
    const distances = {};
    const previous = {};
    const pq = new PriorityQueue();
    
    // Initialize distances
    for (let node in graph) {
        distances[node] = node === start ? 0 : Infinity;
        pq.enqueue(node, distances[node]);
    }
    
    while (!pq.isEmpty()) {
        const current = pq.dequeue();
        
        if (current === end) {
            return reconstructPath(previous, start, end);
        }
        
        for (let neighbor of graph[current]) {
            const alt = distances[current] + neighbor.weight;
            if (alt < distances[neighbor.id]) {
                distances[neighbor.id] = alt;
                previous[neighbor.id] = current;
                pq.updatePriority(neighbor.id, alt);
            }
        }
    }
    
    return { path: [], distance: Infinity };
}
```

### Performance Metrics

| Metric | Value | Details |
|--------|-------|---------|
| **Route Calculation** | <50ms | Average response time |
| **Walking Speed** | 1.4 m/s | Standard pedestrian pace |
| **Graph Size** | 80 nodes | Campus road network |
| **Accuracy** | 95%+ | Service road alignment |

---

## 🚀 Getting Started

### Prerequisites

No dependencies! This is a **pure static web application**.

### Installation

1️⃣ **Clone the repository**

```bash
git clone https://github.com/arnabmazumder/jain-campus-navigator.git
cd jain-campus-navigator
```

2️⃣ **Serve locally** (choose your preferred method)

<details>
<summary><b>🐍 Using Python</b></summary>

```bash
# Python 3
python -m http.server 8000

# Then visit: http://localhost:8000
```
</details>

<details>
<summary><b>📦 Using Node.js</b></summary>

```bash
npx serve

# Then visit: http://localhost:3000
```
</details>

<details>
<summary><b>💻 Using VS Code</b></summary>

1. Install the **Live Server** extension
2. Right-click `index.html`
3. Select **"Open with Live Server"**
</details>

3️⃣ **Open in browser and start navigating!** 🎉

---

## 📊 Data Files Explained

### `data/landmarks.json` - Campus Locations

```json
[
  {
    "id": "busstop",
    "name": "Jain University Bus Stop",
    "lat": 12.642641,
    "lng": 77.439569
  },
  {
    "id": "canteen",
    "name": "Jain University Canteen Mess",
    "lat": 12.641160,
    "lng": 77.440280
  }
  // ... 18 more locations
]
```

### `data/paths.json` - Road Network Graph

```json
{
  "nodes": [
    { "id": "G1", "lat": 12.6412465, "lng": 77.4328287 }
    // ... 79 more nodes
  ],
  "edges": [
    { "from": "G1", "to": "G2", "weight": 45.3 }
    // ... 90+ edges with calculated distances
  ]
}
```

---

## 🌐 Deployment

### Deploy to Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/arnabmazumder/jain-campus-navigator)

**Or manually:**

```bash
npm install -g vercel
vercel --prod
```

### Alternative: GitHub Pages

1. Push code to GitHub
2. Go to **Settings** → **Pages**
3. Source: **Deploy from branch** → `main`
4. Visit: `https://arnabmazumder.github.io/jain-campus-navigator`

---

## 🎨 Customization Guide

### Adding New Campus Locations

Edit `data/landmarks.json`:

```json
{
  "id": "newbuilding",
  "name": "New Academic Block",
  "lat": 12.XXXXX,
  "lng": 77.XXXXX
}
```

### Modifying Road Network

Edit `data/paths.json` to add/remove nodes and edges:

```json
{
  "nodes": [
    { "id": "N100", "lat": 12.XXXXX, "lng": 77.XXXXX }
  ],
  "edges": [
    { "from": "N99", "to": "N100", "weight": 50.5 }
  ]
}
```

### Changing Theme Colors

In `styles.css`:

```css
:root {
  --primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --accent-color: #667eea;
  --text-primary: #2d3748;
}
```

---

## 🧪 Browser Compatibility

| Browser | Desktop | Mobile |
|---------|:-------:|:------:|
| Chrome | ✅ 90+ | ✅ 90+ |
| Firefox | ✅ 88+ | ✅ 88+ |
| Safari | ✅ 14+ | ✅ 14+ |
| Edge | ✅ 90+ | ✅ 90+ |

**Responsive breakpoints:**
- 📱 Mobile: 320px - 768px
- 📱 Tablet: 769px - 1024px
- 💻 Desktop: 1025px+

---

## 📈 Performance

<div align="center">

| Metric | Score | Details |
|:------:|:-----:|---------|
| **Lighthouse Performance** | 95+ | Optimized assets |
| **First Contentful Paint** | <1.5s | Fast initial load |
| **Time to Interactive** | <2.0s | Vanilla JS advantage |
| **Route Calculation** | <50ms | Efficient algorithm |

</div>

---

## 🤝 Contributing

Contributions are **welcome**! Here's how you can help:

1. 🍴 **Fork** the repository
2. 🌿 **Create** a feature branch
   ```bash
   git checkout -b feature/AmazingFeature
   ```
3. 💾 **Commit** your changes
   ```bash
   git commit -m 'Add some AmazingFeature'
   ```
4. 📤 **Push** to the branch
   ```bash
   git push origin feature/AmazingFeature
   ```
5. 🎉 **Open** a Pull Request

### Ideas for Contribution

- 🏢 Add more campus landmarks
- 🚶 Implement accessibility routes
- 🌙 Dark mode support
- 🔍 Advanced search filters
- 📱 Progressive Web App (PWA) features
- 🗣️ Multi-language support

---

## 📝 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2024 Arnab Mazumder

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files...
```

---

## 🙏 Acknowledgments

<div align="center">

Special thanks to:

🗺️ **OpenStreetMap** contributors for comprehensive map data  
📚 **Leaflet.js** team for the excellent mapping library  
🏛️ **Jain University** for campus layout information  
💡 **Google Maps** for UI/UX inspiration

</div>

---

## 📬 Contact & Connect

<div align="center">

**Arnab Mazumder**

[![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/arnab-mazumder)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/arnab-mazumder-b4a238326)
[![Email](https://img.shields.io/badge/Email-D14836?style=for-the-badge&logo=gmail&logoColor=white)](mailto:arnab.mazumder1108@gmail.com)

**Project Repository:** [github.com/arnabmazumder/jain-campus-navigator](https://github.com/arnabmazumder/jain-campus-navigator)

</div>

---

<div align="center">

### ⭐ Star this repository if you find it helpful!

Made with ❤️ and ☕ by **Arnab Mazumder**

[Jain University](https://jainuniversity.ac.in) | [Report Bug](https://github.com/arnabmazumder/jain-campus-navigator/issues) | [Request Feature](https://github.com/arnabmazumder/jain-campus-navigator/issues)

---

**🎓 Final Year Project | Computer Science Engineering | 2024**

</div>
