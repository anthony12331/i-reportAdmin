# i-Report Admin System - Design Guidelines & Context

## Design Context

### Users
- **Primary Audience**: Barangay & Municipal Emergency Dispatchers, Super Administrators, Incident Coordinators, and LGU Officials in Barangay Lagonglong.
- **Usage Context**: High-urgency incident triage, real-time spatial SOS tracking, emergency dispatch operations, identity verification, and administrative security oversight.
- **Jobs to be Done**:
  1. Instantly triage and coordinate incoming citizen SOS alerts and emergency incident reports.
  2. Dispatch and monitor municipal response units (MDRRMO, BFP, PNP, RHU, Ambulance).
  3. Verify civilian resident credentials and manage account statuses.
  4. Maintain role-based access control (RBAC), administrator privileges, and central audit trails.
  5. Generate comprehensive municipal telemetry reports and export official PDF incident dossiers.

### Brand Personality
- **Voice & Tone**: Official, authoritative, rapid-response, and calm under pressure.
- **3-Word Personality**: Authoritative, Trustworthy, Rapid.
- **Emotional Goals**: Instill operational confidence, clarity in high-pressure situations, and immediate actionable awareness.

### Aesthetic Direction
- **Dual-Theme Design System**:
  - **Light Mode**: Clean slate surfaces (`#f8fafc`, `#ffffff`), deep emerald headers (`#15803d`, `#166534`, `#14532d`), and crisp border definitions (`#e2e8f0`, `#bbf7d0`).
  - **Dark Mode**: High-contrast deep slate canvas (`#090e17`), elevated card containers (`#131c2e`), interactive elements (`#172338`), vibrant emerald accents (`#4ade80`), and high-readability text (`#f8fafc`).
- **Design References**: Modern municipal command operations centers and premium SaaS management interfaces with soft elevation shadows, dynamic initials avatars, and distinct status pills.
- **Anti-References**: Avoid cluttered spreadsheets, washed-out low-contrast boxes, jarring un-themed modals, and tiny unclickable buttons.
- **Typography Stack**: `'Plus Jakarta Sans'`, `'Inter'`, `-apple-system`, `sans-serif` with fluid `clamp()` scaling.

### Design & Motion Principles
1. **Speed & Scannability Above All**: High-urgency telemetry (SOS coordinates, dispatch status, triage priority) must be identifiable in under a second using high-contrast typography, color-coded badges, and clear iconography.
2. **Authoritative Consistency**: Maintain the solid emerald table headers, rounded pill search toolbars, and standardized avatar treatments across every management screen.
3. **Purposeful Micro-Interactions (60fps)**:
   - **Feedback Layer**: Subtle active scales (`0.97`), dynamic copy checkmark confirmations, and gentle glow states.
   - **Transitions**: Smooth 180–240ms cubic-bezier easing (`cubic-bezier(0.16, 1, 0.3, 1)`), avoiding excessive bounce or layout thrashing.
   - **Accessibility**: Full compliance with `prefers-reduced-motion: reduce`.
4. **Ergonomic Touch & Large Click Targets**: All interactive elements (buttons, inputs, status toggles) must maintain minimum 44–48px touch targets for rapid, error-free operation during field and desktop dispatch.
5. **Actionable Feedback & Plain English**: Error messages, modal confirmations, and status updates must explicitly describe actions, consequences, and next steps without cryptic jargon.
6. **Fluid Cross-Device Resilience**: Ensure full usability across compact laptops, emergency command wall monitors, and mobile/tablet field screens.
