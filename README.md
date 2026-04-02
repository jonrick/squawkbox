# 📡 SquawkBox

**SquawkBox** is a self-hostable "Social Gateway" for Meshtastic, bridging web-authenticated users to a shared LoRa node over TCP. Built with a premium, glassmorphic feed, real-time threaded replies, and native mesh telemetry support.

![SquawkBox UI](screenshot.png)

---

## ✨ Features

- **Physical Hardware Integration:** Native TCP connection to Meshtastic LoRa nodes using official `@meshtastic/core`.
- **Social Feed:** A premium, real-time "Twitter-style" feed for mesh traffic.
- **Native Meshtastic Threading:** Replies are sent as native protobuf packets, visible as organized threads on official Meshtastic mobile apps.
- **Hardened Authentication:** Production-grade HTTP-only cookie-based authentication with admin-controlled user approvals.
- **Live Mesh Telemetry:** Real-time SNR, RSSI, and Hop counts for every incoming message.
- **Identity Synthesis:** Automatic translation of hexadecimal Node IDs into human-readable Long Names.

---

## 🚀 Quick Start (Docker Compose)

No need to clone the full repository. SquawkBox ships pre-built Docker images for both AMD64 and ARM64. All you need are two files.

### 1. Download the Files

Grab the two files you need directly:

```bash
curl -O https://raw.githubusercontent.com/jonrick/squawkbox/main/docker-compose.yml
curl -O https://raw.githubusercontent.com/jonrick/squawkbox/main/.env.example
```

Or manually download them from the [GitHub repository](https://github.com/jonrick/squawkbox).

### 2. Configure Your Environment

Rename `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```bash
# --- MESHTASTIC CONNECTION ---
MESHTASTIC_IP=192.168.1.100        # IP of your Meshtastic node
MESHTASTIC_PORT=4403               # Typically 4403 for TCP
GATEWAY_NODE_ID=!a1b2c3d4          # Your Gateway Node's hex ID
MESHTASTIC_CHANNEL=0               # Channel index (0 = Primary)

# --- SECURITY ---
JWT_SECRET=your_super_secret_key   # Change this to something random!

# --- FRONTEND ---
# The IP/hostname of your server as seen by the browser
API_URL=http://192.168.1.50:3001
```

> **Important:** Set `API_URL` to your **server's actual IP address** (not `localhost`), otherwise the browser won't be able to reach the backend.

### 3. Launch

```bash
docker-compose up -d
```

SquawkBox will be available at `http://your-server-ip:3000`.

The **first user to register** is automatically granted admin

## 🚀 Getting Started

SquawkBox is split into a **Frontend** and an **API Gateway**. To launch the entire system at once, you can use the newly created PowerShell script:

```powershell
.\start.ps1
```

This will automatically:
1. Clean up any existing stale Node processes.
2. Synchronize the Prisma database and regenerate the client.
3. Launch both the Dashboard (Port 3000) and the API (Port 3001) in separate windows.

---

## 🛠️ Local Development (Manual Setup)

### Backend (Fastify + Prisma)
```bash
cd backend
npm install
npx prisma db push
npm run dev
```

### Frontend (Next.js + Tailwind)
```bash
cd frontend
npm install
npm run dev
```

---

## 🤝 Contributing

We love contributions! SquawkBox is built with:
- **Frontend:** Next.js 14, Tailwind CSS, Lucide Icons, Socket.io-client.
- **Backend:** Fastify, Prisma (SQLite), @meshtastic/core, Socket.io.

### How to Contribute
1. **Fork** the repository.
2. **Commit** your changes ("Add cool feature").
3. **Push** to the branch.
4. **Open a Pull Request**.

---

## 📜 License
GNU GPL v3. Created by [jonrick](https://github.com/jonrick), assisted by [Antigravity](https://antigravity.google/).
