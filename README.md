# SmartFactory Frontend

> Cross-platform industrial supervision dashboard — **web + Android + iOS** from a single Expo codebase.

[![Expo](https://img.shields.io/badge/Expo-57-000020?logo=expo)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.86-61DAFB?logo=react)](https://reactnative.dev)
[![NativeWind](https://img.shields.io/badge/NativeWind-4.2-06B6D4?logo=tailwindcss)](https://www.nativewind.dev)

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [Screens & Routes](#screens--routes)
- [State Management](#state-management)
- [Authentication](#authentication)
- [Role-Based Access Control](#role-based-access-control)
- [Design System](#design-system)
- [Real-Time Data](#real-time-data)
- [Backend Integration](#backend-integration)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [Contributing](#contributing)

---

## Overview

SmartFactory is an industrial IoT supervision platform. This frontend provides:

- **Machine monitoring** — list, detail, status, health bars, live sensor data
- **Zone management** — factory map with color-coded zones and machine markers
- **User & Group management** — ADMIN CRUD, operator assignment, supervisor tracking
- **Full auth flow** — login, register, email OTP verification, forgot/reset password
- **Profile & Settings** — self-service profile editing, factory configuration
- **Dark mode** — toggle via TopBar or Settings (chrome-level theming)
- **Responsive** — every screen has a web (desktop) and mobile layout, built in the same file

The backend is a separate Spring Boot + MongoDB service. The frontend never talks to MQTT or the IoT simulator directly — everything goes through the REST API and (eventually) STOMP/WebSocket.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | [Expo](https://expo.dev) (React Native) | ~57.0 |
| Routing | [Expo Router](https://docs.expo.dev/router/) (file-based) | ~57.0 |
| Styling | [NativeWind](https://www.nativewind.dev) (Tailwind CSS → RN) | ^4.2 |
| State | [Redux Toolkit](https://redux-toolkit.js.org) + react-redux | ^2.13 / ^9.3 |
| HTTP | [axios](https://axios-http.com) (single shared instance) | ^1.20 |
| Live data | [@stomp/stompjs](https://stomp-js.github.io) + sockjs-client | ^7.3 / ^1.6 |
| Charts | [react-native-svg](https://github.com/software-mansion/react-native-svg) | 15.15 |
| Storage | [@react-native-async-storage/async-storage](https://react-native-async-storage.github.io) | 2.2 |
| Language | **JavaScript with JSX** (no TypeScript) | — |

---

## Prerequisites

- **Node.js** ≥ 20 (LTS)
- **npm** ≥ 10
- Backend running on `http://localhost:8080` (Spring Boot + MongoDB)
- (Optional) MQTT broker for IoT simulator integration

---

## Getting Started

```bash
# 1. Clone the frontend repo
git clone https://github.com/<your-org>/smartfactory-frontend.git
cd smartfactory-frontend

# 2. Install dependencies
npm install

# 3. Create your environment file
cp .env.example .env
# Edit .env if the backend runs on a different host/port

# 4. Start the dev server
npx expo start --web          # web only
npx expo start                # web + mobile (scan QR with Expo Go)
```

### Phone testing

For mobile devices on the same network:

1. Set `EXPO_PUBLIC_API_URL` to your PC's **LAN IP** (e.g. `http://192.168.1.50:8080`)
2. Make sure the backend port (8080) is open in your firewall
3. Connect phone and PC to the **same Wi-Fi**
4. Restart Expo (env vars bake at startup: `npx expo start -c`)

---

## Project Structure

```
frontend/
├── app/                          # Expo Router — file-based routes
│   ├── _layout.jsx               # Root layout (Redux Provider, SafeArea, DialogContext)
│   ├── index.jsx                 # Entry redirect (auth check → dashboard or login)
│   ├── (auth)/                   # Auth group (no shell)
│   │   ├── _layout.jsx
│   │   ├── login.jsx
│   │   ├── register.jsx
│   │   ├── verify-account.jsx
│   │   ├── forgot-password.jsx
│   │   ├── reset-password-verify.jsx
│   │   └── reset-password.jsx
│   └── (app)/                    # Authenticated group (AppShell: sidebar + topbar)
│       ├── _layout.jsx
│       ├── dashboard.jsx
│       ├── machines/
│       │   ├── index.jsx         # Machines list
│       │   ├── [id].jsx          # Machine detail (tabs: overview, live, history, maintenance)
│       │   └── _layout.jsx
│       ├── map.jsx               # Factory Map & Zones
│       ├── users.jsx             # User management (ADMIN)
│       ├── groups/               # Group management
│       │   ├── index.jsx
│       │   └── [id].jsx
│       ├── my-group.jsx          # Operator's own group view
│       ├── profile.jsx           # Self-service profile
│       └── settings.jsx          # Factory settings
│
├── src/
│   ├── components/               # Reusable UI primitives
│   │   ├── AppShell.jsx          # Sidebar + TopBar + BottomTabs wrapper
│   │   ├── Sidebar.jsx           # Desktop nav (navy, role-filtered)
│   │   ├── TopBar.jsx            # Search, dark mode toggle, logout, avatar
│   │   ├── BottomTabs.jsx        # Mobile nav (role-aware tabs)
│   │   ├── FactoryMap.jsx        # Reusable map (compact/full variants)
│   │   ├── Button.jsx            # Primary/outline/ghost + loading state
│   │   ├── Input.jsx, Select.jsx, Toggle.jsx, Checkbox.jsx
│   │   ├── Card.jsx, Skeleton.jsx, EmptyState.jsx
│   │   ├── StatusBadge.jsx, SeverityBadge.jsx, HealthBar.jsx
│   │   ├── AddMachineModal.jsx, UserModal.jsx, GroupModal.jsx
│   │   ├── MultiSelect.jsx      # Checkable dropdown for group members
│   │   ├── dialog/               # DialogContext + DialogOverlay (modals)
│   │   └── charts/               # LineChart and other SVG charts
│   │
│   ├── constants/
│   │   ├── api.js                # All endpoint paths (CONFIRMED / ASSUMED)
│   │   ├── colors.js             # Design tokens
│   │   ├── roles.js              # Role + status enums
│   │   └── terms.js              # Terms of Service text
│   │
│   ├── hooks/
│   │   ├── useAppDispatch.js     # Typed dispatch
│   │   ├── useAppSelector.js     # Typed selector
│   │   ├── useAuth.js            # Auth state reader
│   │   ├── useBreakpoint.js      # Responsive (desktop/tablet/mobile)
│   │   ├── useDark.js            # Dark mode state
│   │   ├── useLiveTopic.js       # STOMP subscription hook
│   │   └── useRole.js            # Role gating (isAdmin, can(), canAccess())
│   │
│   ├── lib/
│   │   ├── axios.js              # Single axios instance + interceptors
│   │   ├── storage.js            # AsyncStorage (native) / localStorage (web)
│   │   ├── status.js             # Status/severity → label + color mapping
│   │   ├── time.js               # relativeTime, formatDateTime
│   │   └── validators.js         # Email + password validation rules
│   │
│   ├── store/
│   │   ├── index.js              # configureStore (all slices registered)
│   │   ├── initAuth.js           # Hydrate token + /me on app start
│   │   ├── services/             # HTTP layer (one per resource)
│   │   │   ├── authService.js
│   │   │   ├── machineService.js
│   │   │   ├── userService.js
│   │   │   ├── zoneService.js
│   │   │   ├── groupService.js
│   │   │   ├── settingsService.js
│   │   │   ├── eventService.js
│   │   │   ├── readingService.js
│   │   │   └── liveService.js    # STOMP client (not HTTP)
│   │   └── slices/               # Redux slices (state + thunks)
│   │       ├── authSlice.js      # login, register, verify, reset, logout
│   │       ├── machineSlice.js   # CRUD + pagination + filters
│   │       ├── userSlice.js      # CRUD + profile self-update
│   │       ├── zoneSlice.js      # zones + zone machines
│   │       ├── groupSlice.js     # CRUD + operators + supervisor
│   │       ├── settingsSlice.js  # Local-only settings
│   │       ├── eventSlice.js     # Recent events
│   │       ├── readingSlice.js   # Sensor readings
│   │       └── liveSlice.js      # STOMP connection state
│   │
│   └── utils/
│       └── alertHelper.js        # Toast / confirm dialog helpers
│
├── assets/images/                # Static images (logo, factory bg)
├── global.css                    # Base CSS (navy fallback, font imports)
├── tailwind.config.js            # NativeWind theme (design tokens)
├── babel.config.js
├── metro.config.js
├── app.json                      # Expo config
├── package.json
├── .env.example
└── .gitignore
```

---

## Architecture

```
┌────────────────────────────────────────────────────┐
│                    Expo App                         │
│                                                    │
│  Screen (JSX)                                      │
│    ↓ dispatch(thunk)                               │
│  Slice (Redux Toolkit)                             │
│    ↓ calls                                         │
│  Service (async functions)                         │
│    ↓ uses                                          │
│  axios instance (src/lib/axios.js)                 │
│    ↓ HTTP                                          │
│  Spring Boot REST API (:8080)                      │
│    ↓ persists                                      │
│  MongoDB                                           │
│                                                    │
│  Live: useLiveTopic → liveService → STOMP/SockJS   │
│    ↓ connects to                                   │
│  Spring Boot WebSocket endpoint                    │
└────────────────────────────────────────────────────┘
```

**Key rules:**
1. Screens never call axios directly — they dispatch thunks
2. Thunks call services; services call the shared axios instance
3. One service + one slice per resource
4. Token management is entirely in `lib/axios.js` (interceptors)
5. STOMP is isolated in `liveService.js`; screens use `useLiveTopic()`

---

## Screens & Routes

### Auth Group `(auth)/`

| Route | Screen | Description |
|-------|--------|-------------|
| `/login` | Login | Email + password, factory bg, role-based redirect |
| `/register` | Signup | First/last/email/pwd/confirm, OTP verify redirect |
| `/verify-account` | Verify Email | 6 OTP boxes, auto-advance, 60s resend cooldown |
| `/forgot-password` | Forgot Password | Email input, always-200 (no email leak) |
| `/reset-password-verify` | Reset OTP | Verify reset code, get resetToken |
| `/reset-password` | Reset Password | New password + confirm, guarded by resetToken |

### App Group `(app)/`

| Route | Screen | Roles | Description |
|-------|--------|-------|-------------|
| `/dashboard` | Dashboard | ADMIN, RESPONSABLE | Summary KPIs (placeholder for Sprint 7) |
| `/machines` | Machines List | ADMIN, RESPONSABLE | Table/cards, status tabs, search, zone filter |
| `/machines/[id]` | Machine Detail | ADMIN, RESPONSABLE | Overview, metrics, live chart, edit/delete |
| `/map` | Map & Zones | All | Factory map with zones A–D, zone details, activity |
| `/users` | Users | ADMIN | Table/cards, role filter, CRUD modals |
| `/groups` | Groups | ADMIN (CRUD), All (view) | Group list with operator counts |
| `/groups/[id]` | Group Detail | ADMIN (edit), All (view) | Supervisor card, operator list, add/remove |
| `/my-group` | My Group | OPERATOR, supervisors | Personal group view |
| `/profile` | Profile | All | Self-edit name/email, change password |
| `/settings` | Settings | All (General), ADMIN (Users/Machines tabs) | Factory config, dark mode toggle |

---

## State Management

All state flows through **Redux Toolkit**:

```
store/
  auth        → user, token, login/register/verify/reset status
  machine     → list, current, filters, pagination, counts
  user        → list, current, profile ops
  zone        → list, machinesByZone
  group       → list, current, operators, supervisor
  settings    → general, notifications (local-only)
  event       → recent events list
  reading     → sensor readings
  live        → STOMP connection state, messagesByTopic
  (stubs)     → alert, notification, ticket, maintenance, dashboard, analytics, report, ai
```

Slices for features without a backend yet are stubs — they exist in the store so screens can import them without errors.

---

## Authentication

| Flow | Steps |
|------|-------|
| **Login** | POST `/api/auth/login` → `{ token, user }` → store token in storage → redirect to role-based home |
| **Register** | POST `/api/auth/register` → 201 → redirect to verify-account with `?email=` |
| **Verify email** | POST `/api/auth/verify-email` `{ email, otp }` → redirect to login `?verified=1` |
| **Forgot password** | POST `/api/auth/forgot-password` → always 200 → redirect to reset-password-verify |
| **Reset password** | verify-reset-otp → get resetToken → POST `/api/auth/reset-password` `{ email, resetToken, newPassword }` |

- **No refresh token.** The backend issues a stateless JWT valid for 24h. On expiry/401 → force re-login.
- Token stored via `lib/storage.js` (localStorage on web, AsyncStorage on native).
- `lib/axios.js` interceptor attaches `Authorization: Bearer <token>` to every request.

---

## Role-Based Access Control

Four roles defined in the backend:

| Role | Key Permissions |
|------|----------------|
| `ADMIN` | Full CRUD on everything (users, machines, zones, groups) |
| `OPERATOR` | Read machines/zones, view own group, profile self-edit |
| `TECHNICIAN` | Read machines, analyze anomalies (future sprints) |
| `RESPONSABLE_INDUSTRIEL` | Dashboard KPIs, machine overview, reports |

Access is enforced in two layers:
1. **Server-side** — Spring Security rules in `SecurityConfig.java`
2. **Client-side** — `useRole()` hook hides/disables UI elements (never rely on it for security)

Landing page after login: `ADMIN`/`RESPONSABLE_INDUSTRIEL` → Dashboard; others → Map & Zones.

---

## Design System

Tokens defined in `tailwind.config.js` extending NativeWind:

| Token | Value | Usage |
|-------|-------|-------|
| `bg` | `#F8FAFC` | Page background |
| `surface` | `#FFFFFF` | Cards |
| `sidebar` | `#0B1D3A` | Desktop sidebar |
| `primary` | `#2563EB` | Buttons, links, active states |
| `success` | `#16A34A` | Running status, positive |
| `warning` | `#F59E0B` | Idle, caution |
| `danger` | `#DC2626` | Failure, errors |
| `text` | `#0F172A` | Primary text |
| `text-muted` | `#64748B` | Secondary text |

All components use NativeWind classes — no inline styles except dynamic values.

---

## Real-Time Data

STOMP/WebSocket integration (prepared for Sprint 2+):

```javascript
// In a screen:
import { useLiveTopic } from '../../src/hooks/useLiveTopic';
useLiveTopic('/topic/zones');  // subscribes while component is mounted
```

The `liveService.js` manages the STOMP connection. Messages are dispatched to `liveSlice.messagesByTopic`. The connection is configured in `store/index.js` at startup.

---

## Backend Integration

The frontend integrates sprint-by-sprint:

| Sprint | Status | Features |
|--------|--------|----------|
| Sprint 1 | ✅ **CONFIRMED** | Auth (full flow), Users CRUD, Machines CRUD, Zones CRUD, Groups CRUD |
| Sprint 2 | 🔜 Upcoming | Sensors, Readings, IoT data ingestion |
| Sprint 3 | 📋 Planned | Alerts, Thresholds, Notifications |
| Sprint 4 | 📋 Planned | Maintenance tickets, records |
| Sprint 5 | 📋 Planned | Analytics, Reports |
| Sprint 6 | 📋 Planned | AI predictions, recommendations |
| Sprint 7 | 📋 Planned | Dashboard KPIs, real-time widgets |

Endpoint paths are centralized in `src/constants/api.js`. Each path is marked `CONFIRMED` or `ASSUMED`. The `docs/api-contract.md` file tracks the full contract.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `EXPO_PUBLIC_API_URL` | `http://localhost:8080` | Backend REST API base URL |
| `EXPO_PUBLIC_WS_URL` | `http://localhost:8080/ws` | STOMP/WebSocket endpoint |

⚠️ `.env` is gitignored. Copy `.env.example` and edit as needed. Expo bakes env vars at startup — restart after changes.

---

## Scripts

```bash
npm start          # Start Expo dev server (all platforms)
npm run web        # Web only
npm run android    # Android only
npm run ios        # iOS only
```

---

## Contributing

1. Pull the latest from `main`
2. Create a feature branch: `git checkout -b feature/screen-name`
3. Follow the [Frontend Rules](#architecture) in `projectInstruction.md`
4. Update `docs/api-contract.md` if you add/change API assumptions
5. Test on both web (≥1024px) and mobile (390px) viewports
6. Push and open a PR

---

## License

MIT — see [LICENSE](./LICENSE)
