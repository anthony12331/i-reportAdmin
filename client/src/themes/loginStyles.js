const SVG_SHIELD = "data:image/svg+xml;utf8,<svg viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'><path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' fill='%232a5b8f'/><path d='M7 14l3-3 2 2 4-4' stroke='%23d4af37' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/><path d='M16 10V6h-4' stroke='%23d4af37' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/></svg>";
const SVG_MAIL = "data:image/svg+xml;utf8,<svg fill='%2364748b' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'><path d='M3 5h18c.6 0 1 .4 1 1v12c0 .6-.4 1-1 1H3c-.6 0-1-.4-1-1V6c0-.6.4-1 1-1zm9 8.5L4.5 7.5v8c0 .3.2.5.5.5h14c.3 0 .5-.2.5-.5v-8L12 13.5zM19.3 7H4.7l7.3 5.5L19.3 7z'/></svg>";
const SVG_LOCK = "data:image/svg+xml;utf8,<svg fill='%2364748b' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'><path d='M12 2C9.2 2 7 4.2 7 7v4H6c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-8c0-1.1-.9-2-2-2h-1V7c0-2.8-2.2-5-5-5zm-3 5c0-1.7 1.3-3 3-3s3 1.3 3 3v4H9V7zm3 11c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z'/></svg>";

const injectLoginGlobalStyles = () => {
  if (typeof document !== 'undefined' && !document.getElementById('login-custom-style')) {
    const style = document.createElement('style');
    style.id = 'login-custom-style';
    style.innerHTML = \
      body {
        margin: 0;
        padding: 0;
        background-color: #030612 !important;
      }
      
      /* Network lines background for body */
      body::before {
        content: "";
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        pointer-events: none;
        z-index: 0;
        background-image: 
          radial-gradient(circle at 15% 25%, rgba(0,210,255,0.2) 2px, transparent 3px),
          radial-gradient(circle at 80% 15%, rgba(255,204,0,0.2) 3px, transparent 4px),
          radial-gradient(circle at 25% 75%, rgba(0,210,255,0.15) 3px, transparent 4px),
          radial-gradient(circle at 75% 85%, rgba(255,204,0,0.15) 2px, transparent 3px),
          linear-gradient(45deg, transparent 48%, rgba(0,210,255,0.03) 49%, rgba(0,210,255,0.03) 51%, transparent 52%),
          linear-gradient(-45deg, transparent 48%, rgba(255,204,0,0.03) 49%, rgba(255,204,0,0.03) 51%, transparent 52%);
        background-size: 100vw 100vh, 100vw 100vh, 100vw 100vh, 100vw 100vh, 150px 150px, 150px 150px;
      }

      /* Floating text decorations */
      #root::before {
        content: "Secure Incident Management";
        position: absolute;
        left: 8%;
        top: 45%;
        color: rgba(255, 255, 255, 0.15);
        font-size: 14px;
        letter-spacing: 1px;
        z-index: 1;
        pointer-events: none;
      }
      #root::after {
        content: "Real-time Response";
        position: absolute;
        right: 8%;
        top: 55%;
        color: rgba(255, 255, 255, 0.15);
        font-size: 14px;
        letter-spacing: 1px;
        z-index: 1;
        pointer-events: none;
      }

      h2 {
        display: flex !important;
        align-items: center;
        justify-content: center;
        gap: 12px;
      }
      h2::before {
        content: url("\");
        display: inline-block;
        width: 32px;
        height: 32px;
      }
      p {
        white-space: pre-wrap;
      }
      p::after {
        content: "\\\\A INCIDENT REPORTING SYSTEM";
        display: block;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        color: #64748b;
        margin-top: 8px;
      }
      
      input[type="email"] {
        background-image: url("\");
        background-position: 18px center;
        background-repeat: no-repeat;
        background-size: 20px;
      }
      input[type="password"], input[type="text"] {
        background-image: url("\");
        background-position: 18px center;
        background-repeat: no-repeat;
        background-size: 20px;
      }
      
      input:focus {
        border-color: rgba(0, 210, 255, 0.5) !important;
        box-shadow: 0 0 12px rgba(0, 210, 255, 0.15) !important;
      }
    \;
    document.head.appendChild(style);
  }
};
injectLoginGlobalStyles();

export const loginStyles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "radial-gradient(ellipse at center, #0B132B 0%, #030612 100%)",
    position: "relative",
    padding: "20px",
    fontFamily: "'Inter', sans-serif",
    zIndex: 10,
  },
  card: {
    backgroundColor: "rgba(10, 15, 30, 0.6)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    background: "linear-gradient(rgba(10, 15, 30, 0.85), rgba(10, 15, 30, 0.85)) padding-box, linear-gradient(135deg, #00d2ff 0%, rgba(10,15,30,0) 40%, rgba(10,15,30,0) 60%, #ffcc00 100%) border-box",
    border: "2px solid transparent",
    padding: "50px 48px",
    borderRadius: "16px",
    boxShadow: "-10px -10px 40px -10px rgba(0, 210, 255, 0.12), 10px 10px 40px -10px rgba(255, 204, 0, 0.12), 0 25px 50px rgba(0,0,0,0.5)",
    width: "100%",
    maxWidth: "420px",
    position: "relative",
    zIndex: 20,
  },
  brandBox: { 
    textAlign: "center", 
    marginBottom: "40px" 
  },
  label: {
    display: "none", 
  },
  input: {
    width: "100%",
    padding: "16px 20px 16px 48px", 
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "99px",
    fontSize: "15px",
    outline: "none",
    boxSizing: "border-box",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    color: "#ffffff",
    fontWeight: "500",
    marginBottom: "20px",
    transition: "all 0.3s ease",
  },
  button: {
    width: "100%",
    padding: "16px 24px",
    background: "linear-gradient(to right, #b48e2d, #f9d976, #b48e2d)",
    color: "#111111",
    border: "none",
    borderRadius: "99px",
    cursor: "pointer",
    fontWeight: "800",
    fontSize: "14px",
    letterSpacing: "1.5px",
    textTransform: "uppercase",
    marginTop: "10px",
    boxShadow: "0 4px 20px rgba(249, 217, 118, 0.3)",
    transition: "all 0.3s ease",
  },
  footer: {
    textAlign: "center",
    marginTop: "35px",
    paddingTop: "20px",
  },
  link: { 
    color: "#00d2ff", 
    textDecoration: "none", 
    fontWeight: "700",
    fontSize: "14px",
  },
};
