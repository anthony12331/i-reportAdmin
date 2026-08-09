# i-Report Admin System

administrative dashboard, security proxy gateway, and telemetry backend for the **i-Report** incident management platform.

## System Architecture

- **Primary Backend & Database:** PocketBase (`pocketbase.exe` - Port 8090)
  - Core BaaS managing SQLite database collections (`incidents`, `users`, `admins`, `sos_reports`) and real-time WebSocket streams.
- **Security Proxy & API Gateway (with Telemetry):** Node.js (`server.js` - Port 5001)
  - Handles unified admin authentication, secure user verification, strict HTTP security header enforcement, and acts as an isolated worker for asynchronous email notification dispatches without blocking primary database operations.
- **Frontend Dashboard:** React + Vite (`/admin-dashboard` - Port 5173)
  - Single Page Application for incident triage, live tracking, and user administration.
- **Security & Testing:** Python scripts (`/scripts/simulate_attack.py`)
  - Automated penetration testing and vulnerability simulation suite.

## Quick Start

### Prerequisites
- **Node.js:** >= 18.x
- **Database Engine:** PocketBase (`pocketbase.exe` running on Port 8090)

### Local Setup & Installation

```bash
# 1. Install root dependencies
npm install

# 2. Start the development environment (starts both client and server)
npm run dev
```