# i-Report Admin System

An enterprise-grade administrative dashboard and API backend for the **i-Report** incident management platform.

## System Architecture
- **Backend:** Node.js / Express (server.js)
- **Database/Auth:** PocketBase (pocketbase.exe)
- **Frontend Dashboard:** React + Vite (/admin-dashboard)
- **Security & Testing:** Python simulation scripts (simulate_attack.py)

## Quick Start

### Prerequisites
- Node.js >= 18.x
- PocketBase Server

### Local Setup
1. Clone repository:
   git clone [https://github.com/anthony12331/i-reportAdmin.git](https://github.com/anthony12331/i-reportAdmin.git)
   cd i-reportAdmin

2. Configure Environment:
   Copy .env.example to .env and fill in your local configurations:
   cp .env.example .env

3. Install Dependencies:
   npm install
   cd admin-dashboard && npm install

4. Run Services:
   - Start PocketBase: ./pocketbase.exe serve
   - Start Backend: node server.js
