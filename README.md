# Jain Campus Navigator

> An interactive web-based navigation system for the Jain (Deemed‑to‑be University) campus with real-time pathfinding.

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://jain-campus-navigator.vercel.app)  
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)  
[![JavaScript](https://img.shields.io/badge/javascript-ES6+-yellow.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)  
[![Leaflet](https://img.shields.io/badge/leaflet-1.9.4-green.svg)](https://leafletjs.com)

---

## 🚀 What’s New in Version 2.x

### ✅ Recent Features
- **Realtime User Location & Tracking** – Now supports showing current user location (if permitted) and dynamically recalculating the route if the user deviates.  
- **Indoor Building Floor Plans** – Added detailed floor-plans for five major buildings (with multiple levels) so users can navigate inside as well as outdoors.  
- **Accessible Mode** – New toggle for “Accessibility Mode” (high contrast UI, larger map controls, voice directions, wheelchair-accessible routing).  
- **Bookmark & Favorites** – Users can now save favourite campus locations and access them quickly from a “My Locations” panel.  
- **Events Overlay** – A new layer shows upcoming campus events and pop-ups on map landmarks; clicking an event shows details.  
- **Live Congestion Heatmap** – Service-roads network now displays live “footfall / crowd density” visualisation to help route around busy areas (via sensor or manual input).  
- **Offline Map Cache** – Enables pre-caching of map tiles and graph data so the application works in low-connectivity zones (e.g., indoor labs).  
- **Enhanced Routing Algorithm** – Upgraded from standard Dijkstra to a variant that supports multi-criteria (e.g., shortest, shaded path, wheelchair-friendly).  
- **Push Notifications for Updates** – Micro-service integration allows users to subscribe to push alerts (e.g., new route blocked, event started).  
- **Dark Mode & Theme Switcher** – Added smooth theme toggle (light/dark) with animations and user preference persistence.  
- **Analytics Dashboard (Admin)** – New backend dashboard (for campus admin) to view routing statistics, popular paths, unreachable nodes, and error logs.

### 🧩 Code & Architecture Updates
- Modularised `app.js` into ES6 modules: `map.js`, `routing.js`, `ui.js`, `accessibility.js`, `events.js`, `analytics.js`.  
- Introduced service worker (`sw.js`) for caching resources and offline support.  
- Updated data schema: `landmarks.v2.json`, `paths.v2.json` (with added metadata fields: `type`, `floor`, `accessible`).  
- Configured environment variables (`.env`) for toggling analytics and debug modes.  
- Added unit tests (Jest) for the routing logic and accessibility features.  
- CI/CD pipeline: GitHub Actions workflow automates linting (ESLint), formatting (Prettier), build, and deployment to Vercel.  
- Added logging and error-handling: custom `Logger` class records map load failures, geolocation permission issues, and graph consistency errors.  
- Performance improvements: lazy loading of building floor-plans, code-splitting with dynamic imports, route calculations now < 30 ms on average devices.

### 🎨 UI & UX Enhancements
- New home screen with start-/destination quick-buttons, recently used locations, and accessibility toggle.  
- Responsive layout enhancements: improved tablet and foldable device support (dual-pane view).  
- Animated route transitions: when path updates mid-walk, smooth animation of polyline update rather than abrupt jump.  
- Voice guidance (optional): after selecting a route, user can enable voice prompts (“turn left at Ground Floor Lobby”, etc.).  
- Custom map markers: each landmark now has category icon (Lecture Hall, Canteen, Library, Sports Facility) and hover/tool-tips with thumbnail photos.  
- Help overlay: first-time users get an interactive walkthrough overlay explaining map controls, routing options, and accessibility mode.  
- New branding: updated gradient theme, refreshed icons, improved typography for clarity.

### 📦 Deployment & Data
- Updated data ingestion script: `scripts/updateGraph.js` handles new node types (indoor, accessible) and regenerates graph edges automatically.  
- Versioned data: `/data/v1/`, `/data/v2/` directories, with auto-migration for legacy bookmarks and saved routes.  
- Dockerised local development: added `docker-compose.yml` to run a local server with mocked analytics, routing API, and map tile cache.

---

## 🛠️ Getting Started (Version 2)

### Prerequisites
- Node.js v16+ (for dev server, build scripts)  
- NPM v8+  
- Git (for cloning)  
- Optional: Docker (for local stack)

### Installation & Local Serve
1. Clone the repository  
    ```bash
    git clone https://github.com/YOUR_USERNAME/jain-campus-navigator.git  
    cd jain-campus-navigator
    ```  
2. Install dependencies  
    ```bash
    npm install
    ```  
3. Start development server  
    ```bash
    npm run dev
    ```  
    Visit `http://localhost:3000`.  
4. Build for production  
    ```bash
    npm run build
    ```  
5. Serve production build  
    ```bash
    npm run serve
    ```  
    or use Docker:  
    ```bash
    docker compose up
    ```

### Configuration
- Copy `.env.example` → `.env` and customise:  
  ```bash
  REACT_APP_ANALYTICS_ENABLED=true  
  REACT_APP_OFFLINE_CACHE=true  
  REACT_APP_DEFAULT_THEME=dark  
Data files in /data/v2/landmarks.v2.json and /data/v2/paths.v2.json

Map tile source, analytics endpoint, push-notification keys configured in config.js

Deployment
Using Vercel:

bash
Copy code
vercel --prod
Using GitHub Pages: (if opting) build the project and push dist/ to gh-pages branch and configure in repo settings.

📂 Project Structure (Modified for v2)
pgsql
Copy code
campus-navigator/
├── public/
│   └── icons/ …  
├── src/
│   ├── components/
│   ├── modules/
│   │   ├── map.js
│   │   ├── routing.js
│   │   ├── accessibility.js
│   │   ├── events.js
│   │   └── analytics.js
│   ├── styles/
│   │   └── theme-dark.css  
│   └── index.html  
├── data/
│   ├── v1/
│   └── v2/
│       ├── landmarks.v2.json  
│       └── paths.v2.json  
├── sw.js  
├── scripts/
│   └── updateGraph.js  
├── .env.example  
├── package.json  
└── README.md
📢 How to Use (For End Users)
Open the web app on desktop or mobile via the live link or local development build.

Optionally enable Accessibility Mode from the settings menu for enhanced UI and voice guidance.

Select your Start and Destination from the search bar or tap on the map.

View the suggested route: distance, estimated walk time (default 1.4 m/s), and alternate criteria (e.g., accessible, shaded path).

If you enable “Track My Location”, the map will follow your current location and update route if you deviate.

Use the Bookmarks panel to save your favourite locations and quickly access them later.

View the Events Overlay to see icons for ongoing/upcoming campus events; tap the icon for details.

For offline use: make sure you have loaded the map once with connectivity; the tile cache and graph data will work in low network zones.

Access “My Locations” (saved bookmarks), switch theme (Light/Dark), or toggle accessibility.

Admins can access analytics dashboard (if authorised) to view popular paths, usage, and errors.

🔧 Customisation
Add / Update Locations
Edit /data/v2/landmarks.v2.json and add entries in this format:

json
Copy code
{  
  "id": "new_building",  
  "name": "New Building Name",  
  "lat": 12.XXXXXX,  
  "lng": 77.XXXXXX,  
  "type": "building",  
  "floor": null,  
  "accessible": true  
}
Add / Update Routes
Modify /data/v2/paths.v2.json to add nodes and edges with extra metadata:

json
Copy code
{  
  "nodes": [ { "id": "N101", "lat": 12.XXXX, "lng": 77.XXXX, "floor": 1, "accessible": true } ],  
  "edges": [ { "from": "N101", "to": "N102", "distance": 45, "type": "walkway", "accessible": true } ]
}
Styling & Theming
– CSS themes located in src/styles/
– Modify color variables, gradient backgrounds, typography in theme-dark.css / theme-light.css
– UI icons under public/icons/
– Toggle accessibility mode UI tweaks in src/modules/accessibility.js

📋 Testing & Quality
Unit tests (Jest) under __tests__/; run via

bash
Copy code
npm run test
Linting & formatting:

bash
Copy code
npm run lint  
npm run format
Performance: route computation benchmark < 30 ms for typical graph (~100 nodes, ~150 edges) on mid-spec device.

Accessibility audits: screen-reader support, keyboard navigable controls, colour-contrast verified.

👥 Team & Contribution
Team MG
Arnab Mazumder – Frontend & routing logic

Prabhav Naik – Data modelling, graph updates, accessibility features

Contributing
We welcome pull requests! Please follow the process:

Fork the repository

Create feature branch (git checkout -b feature/AmazingFeature)

Commit with descriptive messages (git commit -m 'Add AmazingFeature')

Push to your branch and open a Pull Request

Ensure tests pass, linting is clean, and new features are documented in README.md

📄 License
This project is licensed under the MIT License. See the LICENSE file for full details.

🙏 Acknowledgments
The open data contributors of OpenStreetMap for map tiles and road data.

The Leaflet.js team for the excellent mapping library.

The campus planning office of Jain University for layout and landmark information.

All users and testers who provided feedback to improve accessibility and performance.

<p align="center">Made with ❤️ by Team MG at Jain University</p> <p align="center"><a href="https://jainuniversity.ac.in">Jain University</a> • <a href="https://github.com/YOUR_USERNAME/jain-campus-navigator">GitHub</a></p>
