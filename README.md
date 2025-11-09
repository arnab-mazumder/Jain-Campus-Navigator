<div align="center">

# 🗺️ Jain Campus Navigator

### Interactive pathfinding system for Jain (Deemed-to-be University)

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-Visit_Site-2ea44f?style=for-the-badge)](https://jain-campus-navigator.vercel.app)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

*Navigate the Jain University campus with intelligent route planning and real-time directions*

[Features](#-features) • [Screenshots](#-screenshots) • [Getting Started](#-getting-started) • [Project Structure](#-project-structure) • [Team](#-team)

</div>

---

## ✨ Features

- 🎯 **Smart Pathfinding** – Find the shortest route between any two campus locations using Dijkstra's algorithm
- 📍 **Interactive Map** – Powered by Leaflet.js with OpenStreetMap tiles for accurate campus visualization
- 🏛️ **Comprehensive Landmarks** – Navigate to lecture halls, libraries, canteens, administrative buildings, and more
- 📱 **Responsive Design** – Seamless experience across desktop, tablet, and mobile devices
- 🧭 **Turn-by-Turn Directions** – Step-by-step navigation instructions with distance and time estimates
- 🎨 **Modern UI** – Clean, intuitive interface with smooth animations and visual feedback
- ⚡ **Fast & Lightweight** – Pure JavaScript implementation with no heavy frameworks
- 🌐 **Zero Dependencies** – Only uses Leaflet.js for mapping, everything else is vanilla JS

---

## 📸 Screenshots

### Desktop View
<div align="center">
<img src="assets/desktop.png" alt="Desktop Interface" width="800px">
<p><i>Full-featured desktop interface with sidebar controls and map view</i></p>
</div>

### Mobile View
<div align="center">
<img src="assets/mobile.png" alt="Mobile Interface" width="300px">
<p><i>Optimized mobile layout for on-the-go navigation</i></p>
</div>

---

## 🚀 Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge)
- Basic web server (optional for local development)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/jain-campus-navigator.git
   cd jain-campus-navigator
   ```

2. **Open locally**
   
   Simply open `index.html` in your browser, or use a local server:
   
   ```bash
   # Using Python 3
   python -m http.server 8000
   
   # Using Node.js http-server
   npx http-server
   
   # Using PHP
   php -S localhost:8000
   ```

3. **Access the application**
   
   Navigate to `http://localhost:8000` in your browser

### Usage

1. **Select Start Location** – Choose your current location from the dropdown
2. **Select Destination** – Pick where you want to go
3. **Get Directions** – Click "Find Route" to see the path highlighted on the map
4. **Follow Instructions** – View step-by-step directions with estimated walking time
5. **Explore Campus** – Click on any landmark marker to learn more about it

---

## 📂 Project Structure

```
jain-campus-navigator/
├── assets/
│   ├── campus-bg.jpg      # Campus background image
│   ├── desktop.png        # Desktop screenshot
│   ├── jain-logo.png      # University logo
│   └── mobile.png         # Mobile screenshot
├── data/
│   ├── landmarks.json     # Campus locations and landmarks
│   └── paths.json         # Walking paths and connections
├── app.js                 # Main application logic and routing
├── index.html             # Application entry point
├── styles.css             # Styling and responsive design
├── LICENSE                # MIT License
└── README.md              # Documentation
```

### Key Files

- **`app.js`** – Core application logic including:
  - Map initialization with Leaflet.js
  - Dijkstra's pathfinding algorithm
  - Graph construction from landmark and path data
  - Route visualization and turn-by-turn directions
  - UI event handlers and interactions

- **`landmarks.json`** – Contains all campus locations with:
  - Coordinates (latitude/longitude)
  - Names and categories
  - Descriptions and additional metadata

- **`paths.json`** – Defines walkable connections between locations:
  - Node-to-node connections
  - Path distances
  - Walking network topology

---

## 🛠️ Technology Stack

| Technology | Purpose |
|------------|---------|
| **HTML5** | Structure and semantic markup |
| **CSS3** | Styling, animations, and responsive design |
| **JavaScript (ES6+)** | Application logic and algorithms |
| **Leaflet.js** | Interactive map rendering |
| **OpenStreetMap** | Map tiles and geographic data |

---

## 🧮 Algorithm

The application uses **Dijkstra's algorithm** for optimal pathfinding:

```javascript
// Simplified algorithm overview
function dijkstra(graph, start, end) {
  // 1. Initialize distances (start = 0, others = ∞)
  // 2. Create priority queue with start node
  // 3. While queue is not empty:
  //    - Extract node with minimum distance
  //    - For each neighbor:
  //      - Calculate tentative distance
  //      - Update if shorter path found
  // 4. Reconstruct path from end to start
  return shortestPath;
}
```

**Time Complexity:** O((V + E) log V) where V = nodes, E = edges  
**Space Complexity:** O(V)

---

## 🎨 Customization

### Adding New Landmarks

Edit `data/landmarks.json`:

```json
{
  "id": "new_building",
  "name": "New Building Name",
  "lat": 12.XXXXXX,
  "lng": 77.XXXXXX,
  "category": "academic",
  "description": "Building description"
}
```

### Adding New Paths

Edit `data/paths.json`:

```json
{
  "from": "building_a",
  "to": "building_b",
  "distance": 150
}
```

### Styling

Modify `styles.css` to customize:
- Color scheme and themes
- Font choices and sizing
- Layout and spacing
- Animation timings
- Mobile breakpoints

---

## 👥 Team

<table align="center">
  <tr>
    <td align="center">
      <strong>Arnab Mazumder</strong><br>
      <sub>Frontend & Routing Logic</sub>
    </td>
    <td align="center">
      <strong>Prabhav Naik</strong><br>
      <sub>Data Modeling & UI/UX</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <strong>Muskan Gupta</strong><br>
      <sub>Algorithm Implementation</sub>
    </td>
    <td align="center">
      <strong>Gautam Narayan</strong><br>
      <sub>Testing & Documentation</sub>
    </td>
  </tr>
</table>

<div align="center">
<i>Computer Science & Engineering Students at Jain (Deemed-to-be University)</i>
</div>

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/AmazingFeature`)
3. **Commit** your changes (`git commit -m 'Add some AmazingFeature'`)
4. **Push** to the branch (`git push origin feature/AmazingFeature`)
5. **Open** a Pull Request

Please ensure:
- Code follows existing style conventions
- Comments explain complex logic
- Test your changes across different devices
- Update documentation as needed

---

## 📝 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **OpenStreetMap Contributors** – For providing free geographic data
- **Leaflet.js Team** – For the excellent mapping library
- **Jain University** – For campus layout and landmark information
- **Our Users** – For valuable feedback and suggestions

---

## 🔗 Links

- **Live Demo:** [jain-campus-navigator.vercel.app](https://jain-campus-navigator.vercel.app)
- **Report Issues:** [GitHub Issues](https://github.com/yourusername/jain-campus-navigator/issues)
- **Jain University:** [jainuniversity.ac.in](https://jainuniversity.ac.in)

---

<div align="center">

### 🌟 Star this repository if you find it helpful!

Made with ❤️ by Team MG at Jain (Deemed-to-be University)

**[⬆ Back to Top](#-jain-campus-navigator)**

</div>
