# i-Report Admin System

administrative dashboard, security proxy gateway, and telemetry backend for the **i-Report** incident management platform.

## System Architecture

- **Primary Backend & Database:** PocketBase (`pocketbase.exe` - Port 8090)
  - Core BaaS managing SQLite database collections (`incidents`, `users`, `admins`, `sos_reports`) and real-time WebSocket streams.
- **Security Proxy & API Gateway:** Node.js (`server.js` - Port 5001)
  - Handles unified admin authentication, secure user verification, and strict HTTP security header enforcement (`X-Frame-Options`, `CSP`, `nosniff`).
- **Email Telemetry Microservice:** Node.js (`email_server/server.js` - Port 5002)
  - Isolated worker for asynchronous notification dispatches without blocking primary database operations.
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

# 2. Install frontend dependencies
cd admin-dashboard && npm install

# 3. Install email microservice dependencies
cd ../email_server && npm install
cd ..