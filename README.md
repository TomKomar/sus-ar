# 🧱 AR Static Viewer — Dockerised 3D/AR Web App

This project serves interactive 3D/AR product views through a lightweight web stack.  
It combines a static AR frontend (`model-viewer`) with FastAPI servers behind Nginx, all containerised via Docker Compose.

---

## 📁 Project Structure

```

ar/
├── app/
│   ├── Dockerfile
│   ├── main.py              # FastAPI app serving static assets + correct MIME types
│   └── public/
│       ├── index.html       # Entry page embedding <model-viewer>
│       ├── views.js         # Frontend camera/orbit UI for model-viewer
│       ├── views.json       # Camera presets and view definitions
│       ├── model.glb        # Binary glTF 3D model
│       ├── model.usdz       # iOS-compatible USDZ version
│       ├── poster.webp      # Poster/thumbnail (optional)
│       └── ...
│
├── nginx/
│   └── nginx.conf           # Reverse proxy + caching + load balancing
│
└── docker-compose.yml       # Multi-service setup for Nginx + app containers

```

---

## 🧩 Architecture Overview

### Components

| Layer | Technology                           | Role |
|-------|--------------------------------------|------|
| **Frontend** | HTML / JS (`index.html`, `views.js`) | Renders AR/3D content using [`<model-viewer>`](https://modelviewer.dev/). Provides camera control UI and view presets. |
| **App Service** | FastAPI (Python)                     | Serves static assets from `/public`, enforces MIME types for `.glb`, `.usdz`, `.webp`, and adds proper caching headers. Includes `/healthz` endpoint for probes. |
| **Reverse Proxy** | Nginx                                | Fronts the app replicas, handles gzip, caching, and headers. Balances requests to multiple app instances. |
| **Container Orchestration** | Docker Compose                       | Builds, links, and scales services. You can scale horizontally via `--scale app=N`. |

### Request Flow

```

Browser → Nginx (port 8080) → app (FastAPI/Express) → /public assets

````

- Nginx dynamically resolves all `app` replicas (via Docker DNS).
- It proxies and caches heavy binary assets (like `.glb` / `.usdz`).
- Light HTML and JSON responses are not cached (`Cache-Control: no-cache`).

---

## ⚙️ Functionality

### Frontend (`index.html` + `views.js`)

- Uses `<model-viewer>` from Google to render 3D/AR models (GLB + USDZ).
- Provides camera/orbit/FOV adjustment UI (`views.js`).
- Can export current camera configuration to JSON for reuse (`views.json`).
- Supports fullscreen "collapse" mode for clean AR presentation.

### Backend

#### `main.py` (FastAPI)
- Equivalent functionality to `server.js`.
- Includes `StaticFiles` and custom middleware to inject caching headers.
- `/healthz` endpoint for readiness/liveness checks.

---

## 🧱 Nginx Reverse Proxy

Defined in [`nginx/nginx.conf`](nginx/nginx.conf):

- Load balances between all `app` containers using:
  ```nginx
  resolver 127.0.0.11;
  upstream app_upstream {
      least_conn;
      server app:8000 resolve;
  }


* Adds gzip, security headers, and caching rules for heavy assets.
* Serves as a single public entrypoint (`localhost:8080`).

---

## 🐳 Deployment with Docker Compose

### 1. Build and start

```bash
cd sus-ar
docker compose up -d --build
```

### 2. Scale app replicas

```bash
docker compose up -d --scale app=2
```

Compose automatically starts multiple instances of the app service and Nginx balances traffic among them.

### 3. Access the app

Open your browser at:

```
http://localhost:8080
```

You’ll see the 3D viewer (`model-viewer`) with interactive controls and AR support.

---

## 🧠 Key Features

* ✅ Dynamic scaling (`docker compose --scale app=N`)
* ✅ Static + AR viewer frontend (Google `<model-viewer>`)
* ✅ Proper MIME and caching for `.glb`, `.usdz`, `.webp`
* ✅ Nginx load balancing + gzip + cache
* ✅ Health checks (`/healthz`)
* ✅ Fully containerized (works on any Docker host)

---

## 🧰 Development Tips

| Task                   | Command / Info                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| Rebuild app only       | `docker compose build app`                                                                |
| View logs              | `docker compose logs -f`                                                                  |
| Stop all               | `docker compose down`                                                                     |
| Hot-reload local edits | Mount volumes in `docker-compose.yml` (e.g., `./app/public:/app/public:ro`)               |
| Test health            | `curl http://localhost:8080/healthz` or `curl http://localhost:8000/healthz` (direct app) |

---

## 📜 License

MIT

---

## 🖼️ Preview

Once running, open:

```
http://localhost:8080
```

You’ll see a product viewer like this:

```
<3d Model Viewer>
[3D model rendered via model-viewer]
[View in AR] button
```

Use the UI controls from `views.js` to explore and save camera views.

☁️ Deploying on AWS Lightsail

This project can be hosted seamlessly on an AWS Lightsail Container Service, allowing for simple scaling and global access without managing infrastructure manually.

🏗️ 1. Build Docker Images

From the project root, build both the app and Nginx images:
```
docker build -t sus-ar-app ./app
docker build -t sus-ar-nginx ./nginx
```
🚀 2. Create the Lightsail Container Service

Provision a new Lightsail container service (you can adjust --power and --scale as needed):
```
aws lightsail create-container-service \
  --service-name sus-ar-service \
  --power nano \
  --scale 1
```
📦 3. Push Images to Lightsail

Push both containers to your Lightsail service.
The image labels (:app and :nginx) will be used later in the deployment definition:
```
aws lightsail push-container-image \
  --service-name sus-ar-service \
  --label app \
  --image sus-ar-app

aws lightsail push-container-image \
  --service-name sus-ar-service \
  --label nginx \
  --image sus-ar-nginx
```
⚙️ 4. Deploy to Lightsail

Once both images are uploaded, deploy them using your Lightsail configuration file (e.g., deployment.json):
```
aws lightsail create-container-service-deployment \
  --service-name sus-ar-service \
  --cli-input-json file://deployment.json
```

This command will replace any existing deployment (for instance, collaborative-map) with your new AR Static Viewer setup.

🌐 Accessing Your App

After deployment, Lightsail will provide a public endpoint URL — visit it in your browser to view the live 3D/AR viewer.

You’ll see your interactive <model-viewer> interface, complete with camera controls and AR capabilities.

✅ Done!
Your Dockerised AR viewer is now live on AWS Lightsail — scalable, lightweight, and fully self-contained.