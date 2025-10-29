# GitTask Development Setup

## 🚀 Quick Start (Single Command)

### Windows (PowerShell):
```powershell
.\dev.ps1
```

### Windows (Command Prompt):
```cmd
dev.bat
```

### Cross-platform (npm):
```bash
npm install      # Install concurrently
npm run dev      # Start all services
```

---

## 📦 What Gets Started:

1. **API (NestJS)** - `http://localhost:5000`
2. **Client (Next.js)** - `http://localhost:3000`
3. **Redis** - `localhost:6379`

---

## 🛠️ Prerequisites

### Required:
- **Node.js** (v18 or higher)
- **Redis** - [Download](https://github.com/microsoftarchive/redis/releases)

### Optional (for webhooks):
- **ngrok** - [Download](https://ngrok.com/download)

---

## 📋 Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all services (API + Client + Redis) |
| `npm run dev:api` | Start only API |
| `npm run dev:client` | Start only Client |
| `npm run dev:redis` | Start only Redis |
| `npm run install:all` | Install all dependencies |
| `npm run build` | Build API and Client for production |

---

## 🔧 Manual Setup (if needed)

### 1. Install Dependencies:
```bash
npm run install:all
```

### 2. Setup Environment Variables:

#### API (.env):
```bash
cd api
cp .env.example .env
# Edit .env with your values
```

#### Client (.env.local):
```bash
cd client
cp .env.example .env.local
# Edit .env.local with your values
```

### 3. Run Database Migrations:
```bash
cd api
npm run migration:run
```

### 4. Start Development:
```bash
# From root
npm run dev
```

---

## 🌐 Setup ngrok (for GitHub Webhooks)

1. Start ngrok:
   ```bash
   ngrok http 5000
   ```

2. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

3. Update GitHub App webhook URL to:
   ```
   https://abc123.ngrok.io/webhooks/github
   ```

---

## 🐛 Troubleshooting

### Redis not starting?
- **Windows**: Download from [here](https://github.com/microsoftarchive/redis/releases)
- **Mac**: `brew install redis`
- **Linux**: `sudo apt-get install redis-server`

### Port already in use?
- API (5000): Change `PORT` in `api/.env`
- Client (3000): Change in `client/package.json` dev script
- Redis (6379): Change `REDIS_PORT` in `api/.env`

### Concurrently not found?
```bash
npm install
```

---

## 📁 Project Structure

```
git-task-main/
├── api/              # NestJS backend
├── client/           # Next.js frontend
├── package.json      # Root package (runs all services)
├── dev.ps1          # PowerShell startup script
├── dev.bat          # Batch startup script
└── DEV-SETUP.md     # This file
```

---

## 👥 Team Collaboration

### First Time Setup:
```bash
git clone <repo-url>
cd git-task-main
npm install          # Install concurrently
npm run install:all  # Install API and Client dependencies
npm run dev          # Start everything
```

### Daily Development:
```bash
git pull
npm run dev
```

---

## 🚢 Production Build

```bash
npm run build
```

This builds both API and Client for production deployment.
