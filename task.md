# i-Report Admin System - Design Guidelines & Context

## Design Context

### Users
- **Primary Audience**: Barangay & Municipal Emergency Dispatchers, Super Administrators, Incident Coordinators, and LGU Officials in Barangay Lagonglong.
- **Usage Context**: Real-time monitoring, high-urgency triage, emergency dispatch operations, identity verification, and administrative security oversight.
- **Jobs to be Done**:
  1. Instantly respond to incoming citizen SOS alerts and emergency incident reports.
  2. Dispatch and coordinate response units (MDRRMO, BFP, PNP, RHU).
  3. Verify civilian resident credentials and manage account statuses.
  4. Maintain role-based access control (RBAC), administrator privileges, and audit logs.
  5. Generate comprehensive municipal emergency analytics and export official PDF incident reports.

### Brand Personality
- **Voice & Tone**: Official, authoritative, modern, and rapid-response emergency dispatch.
- **3-Word Personality**: Authoritative, Trustworthy, Rapid.
- **Emotional Goals**: Instill operational confidence, clarity in high-pressure situations, and immediate actionable awareness.

### Aesthetic Direction
- **Visual Tone**: Clean Light Mode with high-contrast emerald green primary accents (`#15803d`, `#166534`, `#14532d`), soft slate surfaces (`#f8fafc`, `#ffffff`), and crisp border definitions (`#e2e8f0`, `#d1fae5`).
- **Design References**: Modern government/emergency dispatch operations centers and premium SaaS management tables with soft shadows, dynamic initials avatars, and distinct status pills.
- **Anti-References**: Avoid cluttered spreadsheets, low-contrast grayscale UI, overly dark unreadable widgets, and tiny, unclickable buttons.
- **Typography Stack**: `'Plus Jakarta Sans'`, `'Inter'`, `-apple-system`, `sans-serif` with fluid `clamp()` responsive scaling.

### Design Principles
1. **Speed & Scannability Above All**: High-urgency data (SOS alerts, ongoing dispatches, citizen status) must be identifiable in under a second using high-contrast typography, color-coded badges, and clear iconography.
2. **Authoritative Consistency**: Maintain the solid emerald `#15803d` table headers, rounded pill search toolbars, and standardized avatar treatments across every management screen.
3. **Ergonomic Touch & Large Click Targets**: All interactive elements (buttons, inputs, status toggles) must maintain minimum 44–48px touch targets for rapid, error-free operation during emergencies.
4. **Actionable Feedback & Plain English**: Error messages, modal confirmations, and status updates must explicitly describe actions, consequences, and next steps without cryptic jargon.
5. **Fluid Cross-Device Resilience**: Ensure full usability across compact laptops, emergency command wall monitors, and mobile/tablet field screens.
