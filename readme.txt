=========================================
I-REPORT ADMIN SYSTEM - DEPLOYMENT GUIDE
=========================================
GitHub Repository: https://github.com/anthony12331/i-reportAdmin

This guide outlines the general, secure deployment process for the i-Report Admin System. 
IMPORTANT: Never hardcode actual passwords, API keys, or server IP addresses in your public repository.

-----------------------------------------
1. FRONTEND DEPLOYMENT (VERCEL)
-----------------------------------------
The React/Vite admin dashboard is hosted on Vercel.

1. Connect your Vercel account to this GitHub repository.
2. Set the Framework Preset to "Vite".
3. Set the Root Directory to "client" (or leave empty if building from the root).
4. Build Command: npm run build
5. Output Directory: dist
6. Environment Variables (Add these in the Vercel Dashboard, NOT in your code):
   - VITE_POCKETBASE_URL (URL to your backend server)
   - VITE_AGORA_APP_ID (Your public Agora App ID)
7. Click "Deploy". 

Note: After deploying new updates, remind users to perform a Hard Refresh (Ctrl + Shift + R) to see the latest UI changes.

-----------------------------------------
2. BACKEND DEPLOYMENT (POCKETBASE)
-----------------------------------------
The backend is powered by PocketBase and is hosted on a secure DigitalOcean Virtual Private Server (VPS), with DNS routing managed via Hostinger.

1. Server Provisioning: We use a Linux Droplet on DigitalOcean.
2. DNS Management: Point your domain's A-records in Hostinger to the DigitalOcean Droplet's public IP.
3. Download the latest PocketBase executable for Linux on the Droplet.
4. Upload your 'pb_schema.json' to the server to structure your database tables.
5. Run PocketBase securely behind a reverse proxy (like Nginx) configured with an SSL/TLS certificate (e.g., Let's Encrypt) to ensure HTTPS encryption.
6. Command to run: ./pocketbase serve --http="127.0.0.1:8090"
7. Ensure your DigitalOcean Cloud Firewall and local UFW only expose ports 80 (HTTP) and 443 (HTTPS), blocking direct access to port 8090 from the outside.

-----------------------------------------
3. SECURITY BEST PRACTICES
-----------------------------------------
- Do not commit '.env' files. Use '.env.example' for reference.
- All sensitive credentials (SMTP passwords, JWT secrets, Admin passwords) must be set directly on the hosting server.
- The Vercel frontend is a static build; all data security and Role-Based Access Control (RBAC) are securely handled by the PocketBase backend API rules.
