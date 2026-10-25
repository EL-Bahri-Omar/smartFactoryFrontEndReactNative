# SmartFactory Frontend — Complete Walkthrough

> **Last updated:** October 2026  
> **Stack:** React Native 0.86 · Expo SDK 57 · Expo Router · Redux Toolkit · NativeWind (Tailwind) · @stomp/stompjs  
> **Targets:** Web (React Native Web) + Android (React Native) — single codebase

---

## Table of Contents

1. [Why React Native with Expo?](#1-why-react-native-with-expo)
2. [Project Root Files](#2-project-root-files)
3. [Directory Structure Overview](#3-directory-structure-overview)
4. [The `app/` Directory — Expo Router (File-Based Routing)](#4-the-app-directory--expo-router)
5. [The `src/` Directory — Business Logic](#5-the-src-directory--business-logic)
6. [State Management (Redux Toolkit)](#6-state-management-redux-toolkit)
7. [Data Loading Pattern](#7-data-loading-pattern)
8. [Authentication & Token Storage](#8-authentication--token-storage)
9. [Permissions & Role-Based Access](#9-permissions--role-based-access)
10. [Real-Time Data (WebSocket / STOMP)](#10-real-time-data-websocket--stomp)
11. [Styling (NativeWind / Tailwind CSS)](#11-styling-nativewind--tailwind-css)
12. [Push Notifications (FCM)](#12-push-notifications-fcm)
13. [Best Practices Used](#13-best-practices-used)
14. [Coding Rules & Conventions](#14-coding-rules--conventions)

---

## 1. Why React Native with Expo?

| Decision | Why |
|---|---|
| **React Native** | Single codebase for Web + Android. The app runs identically in a browser (via `react-native-web`) and on a physical Android device. No code duplication. |
| **Expo SDK 57** | Managed workflow with zero native build config. `expo start --web` serves the app in the browser; `expo run:android` builds an APK. OTA updates, push notification support, and a rich plugin ecosystem out of the box. |
| **Expo Router** | File-based routing (like Next.js). Every `.jsx` file in `app/` becomes a route. Route groups `(auth)` and `(app)` split authenticated from unauthenticated screens. Deep linking works for free. |
| **Redux Toolkit** | Predictable global state for 19 domain slices (auth, machines, alerts, notifications, maintenance, etc.). `createAsyncThunk` handles async API calls with loading/error/success states. Optimistic updates for snappy UX. |
| **NativeWind** | Tailwind CSS classes that compile to React Native `StyleSheet` objects at build time. Same utility classes on web and native — no separate CSS files for mobile. Dark mode via `useDark()` hook. |
| **Axios** | HTTP client with request/response interceptors for token injection, 401 force-logout, and unified error normalisation. |
| **@stomp/stompjs** | STOMP-over-WebSocket for real-time sensor readings, alerts, and notification feeds. The backend publishes to STOMP topics; the frontend subscribes and updates Redux in real time. |

---

## 2. Project Root Files

| File | Purpose |
|---|---|
| `app.config.js` / `app.json` | Expo configuration — app name, bundle IDs, splash screen, Android permissions, EAS build profiles. |
| `package.json` | Dependencies and scripts (`start`, `android`, `web`). |
| `tailwind.config.js` | Design system tokens — colours (`primary`, `danger`, `darkcard`, etc.), font family (Inter), border radii (`card`, `btn`, `chip`), spacing scale. |
| `global.css` | Tailwind base/components/utilities directives, imported once in `app/_layout.jsx`. |
| `babel.config.js` | Expo preset + NativeWind babel plugin. |
| `metro.config.js` | Metro bundler config with NativeWind CSS support. |
| `.env` | Environment variables: `EXPO_PUBLIC_API_URL` (REST base), `EXPO_PUBLIC_WS_URL` (WebSocket endpoint). |
| `eas.json` | EAS Build profiles (development, preview, production). |
| `google-services.json` | Firebase project config for Android push notifications (FCM). |

---

## 3. Directory Structure Overview

```
frontend/
├── app/                    # Expo Router — every file = a route
│   ├── _layout.jsx         # Root layout (Provider, SafeArea, auth bootstrap)
│   ├── index.jsx           # Entry redirect (→ login or dashboard)
│   ├── (auth)/             # Unauthenticated route group
│   │   ├── _layout.jsx     #   Slot wrapper
│   │   ├── login.jsx       #   Login screen
│   │   ├── register.jsx    #   Registration + email OTP
│   │   ├── verify-account.jsx
│   │   ├── forgot-password.jsx
│   │   ├── reset-password-verify.jsx
│   │   └── reset-password.jsx
│   └── (app)/              # Authenticated route group
│       ├── _layout.jsx     #   NotificationBridge (global STOMP listener)
│       ├── dashboard.jsx   #   KPI dashboard
│       ├── machines/       #   Machine list + detail (dynamic [id])
│       ├── maintenance/    #   Intervention list + detail (dynamic [id])
│       ├── groups/         #   Group management
│       ├── alerts.jsx      #   Alert feed
│       ├── notifications.jsx
│       ├── history.jsx     #   Sensor history + analytics
│       ├── map.jsx         #   Factory map & zones
│       ├── users.jsx       #   User management (ADMIN)
│       ├── roles.jsx       #   Role & permission management
│       ├── settings.jsx    #   App settings (dark mode, notifications)
│       ├── profile.jsx     #   Self-service profile
│       ├── my-group.jsx    #   Operator's own group
│       ├── reports.jsx     #   Reports (placeholder)
│       └── ai.jsx          #   AI analytics (placeholder)
│
├── src/                    # Non-route business logic
│   ├── components/         # Reusable UI components
│   │   ├── charts/         #   LineChart, SensorChart, HealthGauge, ChartLegend
│   │   ├── dialog/         #   DialogContext (confirm/alert modals)
│   │   ├── AppShell.jsx    #   Page wrapper (Sidebar + TopBar + BottomTabs)
│   │   ├── Sidebar.jsx     #   Desktop nav + mobile drawer
│   │   ├── TopBar.jsx      #   Header bar (search, theme, alerts, avatar)
│   │   ├── BottomTabs.jsx  #   Mobile bottom navigation
│   │   ├── Card.jsx        #   Surface card (dark/light aware)
│   │   ├── Button.jsx      #   Primary/outline/ghost buttons
│   │   ├── Input.jsx       #   Text input (dark/light)
│   │   ├── Select.jsx      #   Dropdown select (web & native)
│   │   ├── MultiSelect.jsx #   Multi-select with checkboxes
│   │   ├── BottomSheet.jsx #   Slide-up action sheet
│   │   ├── InterventionModal.jsx  # Create intervention form
│   │   └── ... (37 components total)
│   │
│   ├── constants/          # Static configuration
│   │   ├── api.js          #   All REST endpoint paths (CONFIRMED vs ASSUMED)
│   │   ├── roles.js        #   Role string constants
│   │   ├── permissions.js  #   Permission codes + helper functions
│   │   ├── colors.js       #   Color palette map
│   │   └── terms.js        #   Static terms/conditions text
│   │
│   ├── hooks/              # Custom React hooks
│   │   ├── useAppDispatch.js   # Typed Redux dispatch
│   │   ├── useAppSelector.js   # Typed Redux selector
│   │   ├── useAuth.js          # Auth state + redirect guard
│   │   ├── useBreakpoint.js    # Responsive (mobile/tablet/desktop)
│   │   ├── useDark.js          # Dark mode detection
│   │   ├── useLiveTopic.js     # Subscribe to STOMP topic
│   │   ├── useRole.js          # Role + permission gating
│   │   ├── useSearch.js        # Debounced search with loading
│   │   └── useTechnicians.js   # Fetch technician list (cached)
│   │
│   ├── lib/                # Low-level utilities
│   │   ├── axios.js        #   Shared Axios instance + interceptors
│   │   ├── storage.js      #   Cross-platform token storage
│   │   ├── status.js       #   Status/priority labels + colours
│   │   ├── time.js         #   Date formatting + relative time
│   │   ├── validators.js   #   Email/password validation
│   │   ├── alertText.js    #   Notification title/message formatting
│   │   ├── sensorAlerts.js #   Alert deduplication + live dot logic
│   │   └── stompPolyfill.js#   TextEncoder/TextDecoder for React Native
│   │
│   ├── store/              # Redux state management
│   │   ├── index.js        #   Store creation + middleware + wiring
│   │   ├── initAuth.js     #   Bootstrap auth on app start
│   │   ├── slices/         #   19 Redux slices (one per domain)
│   │   └── services/       #   API service modules (one per domain)
│   │
│   └── utils/              # Domain-specific helpers
│       ├── analyticsCalc.js    # Health score, anomaly, uptime calculations
│       ├── readingSeries.js    # Time-series data processing
│       ├── alertHelper.js      # Alert severity sorting
│       └── formatHelper.js     # Number/unit formatting
```

---

## 4. The `app/` Directory — Expo Router

### How Routing Works

Expo Router uses **file-system routing**. Every `.jsx` file inside `app/` automatically becomes a navigable route:

| File path | Route URL | Purpose |
|---|---|---|
| `app/index.jsx` | `/` | Entry point — redirects to login or dashboard |
| `app/(auth)/login.jsx` | `/login` | Login screen |
| `app/(auth)/register.jsx` | `/register` | Registration screen |
| `app/(app)/dashboard.jsx` | `/dashboard` | Main dashboard |
| `app/(app)/machines/index.jsx` | `/machines` | Machine list |
| `app/(app)/machines/[id].jsx` | `/machines/:id` | Machine detail (dynamic) |
| `app/(app)/maintenance/[id].jsx` | `/maintenance/:id` | Intervention detail |

### Route Groups `(auth)` and `(app)`

Route groups (parenthesised folders) **do not affect the URL** but let you apply different layouts:

- **`(auth)/`** — Unauthenticated screens. No sidebar, no top bar. Just the auth form.
- **`(app)/`** — Authenticated screens. Wrapped in `AppShell` (Sidebar + TopBar + BottomTabs). The `_layout.jsx` here mounts `NotificationBridge` for global STOMP listeners.

### `_layout.jsx` Files

Every `_layout.jsx` wraps its sibling routes:

```
app/_layout.jsx          → Root: <Provider store={store}> + <SafeAreaProvider> + <Stack>
app/(auth)/_layout.jsx   → <Slot /> (pass-through)
app/(app)/_layout.jsx    → <NotificationBridge /> + <Slot />
```

### Dynamic Routes `[id].jsx`

Files named `[id].jsx` create parameterised routes. The `id` is accessed via:

```jsx
const { id } = useLocalSearchParams();
```

Used in `machines/[id].jsx` (machine detail) and `maintenance/[id].jsx` (intervention detail).

### Screen Structure Pattern

Every screen follows the same structure:

```jsx
export default function SomethingScreen() {
  const dispatch = useAppDispatch();
  const dark = useDark();
  const { role, canAccess, hasPermission } = useRole();
  const breakpoint = useBreakpoint();

  // 1. Fetch data on mount
  useEffect(() => { dispatch(fetchSomething()); }, [dispatch]);

  // 2. Select state from Redux
  const { list, status, error } = useAppSelector((s) => s.something);

  // 3. Render with AppShell wrapper
  return (
    <AppShell>
      <ScrollView>
        {status === "loading" && <Skeleton />}
        {status === "error" && <EmptyState />}
        {list.map(item => <Card key={item.id}>...</Card>)}
      </ScrollView>
    </AppShell>
  );
}
```

---

## 5. The `src/` Directory — Business Logic

### `src/components/` — Reusable UI

Every component is a **single `.jsx` file** (no folders per component). Components are:

- **Dark-mode aware**: They read `useDark()` and apply conditional classes.
- **Responsive**: They read `useBreakpoint()` and switch layouts (e.g., desktop table → mobile card list).
- **Self-contained**: No external CSS. All styling via NativeWind classes or inline `style`.

**Key components:**

| Component | Responsibility |
|---|---|
| `AppShell.jsx` | Wraps every screen. Desktop: Sidebar + TopBar. Mobile: TopBar + BottomTabs + drawer. |
| `Card.jsx` | Rounded surface card with dark/light background, border, shadow. |
| `Button.jsx` | `primary` / `outline` / `ghost` variants, loading state. |
| `Input.jsx` | Text input with dark/light theming, placeholder, password toggle. |
| `Select.jsx` | Cross-platform dropdown (HTML `<select>` on web, custom picker on native). |
| `BottomSheet.jsx` | Slide-up action sheet for forms (assign technician, add diagnosis, etc.). |
| `Sidebar.jsx` | Navy sidebar with collapsible nav groups, role-filtered menu items. |
| `TopBar.jsx` | Header: back button, theme toggle, alert bell, notification badge, user avatar. |
| `BottomTabs.jsx` | Mobile bottom bar: Map, Maintenance, Notifications, Settings. Role-filtered. |
| `InterventionModal.jsx` | Full create-intervention form (machine, type, priority, team, schedule). |
| `FactoryMap.jsx` | SVG factory floor map with zone overlays and machine markers. |

**`charts/` subdirectory:**

| Component | Purpose |
|---|---|
| `LineChart.jsx` | SVG-based line chart (no heavy chart library). Draws polylines, threshold lines, axes. |
| `SensorChart.jsx` | Wraps LineChart with sensor-specific logic (threshold colouring, live dot). |
| `HealthGauge.jsx` | Circular health score gauge (SVG arc). |
| `ChartLegend.jsx` | Colour-coded legend for chart series. |

### `src/constants/` — Static Configuration

| File | What It Contains |
|---|---|
| `api.js` | **Every REST endpoint** in the app as string constants. Each one is annotated `CONFIRMED` (verified against backend) or `ASSUMED`. A `buildUrl()` helper replaces `:param` placeholders. |
| `roles.js` | Role string constants: `ADMIN`, `RESPONSABLE_INDUSTRIEL`, `TECHNICIAN`, `OPERATOR`. |
| `permissions.js` | 40+ granular permission codes (`MACHINE_READ`, `ALERT_WRITE`, `USER_PERMISSIONS_MANAGE`, etc.), plus `hasPermission()` and `hasAnyPermission()` helpers. |
| `colors.js` | Colour palette map used by status badges, severity indicators, charts. |
| `terms.js` | Static terms & conditions text displayed during registration. |

**Best practice — why constants?**  
No screen ever hardcodes an API path or role string. If the backend changes an endpoint from `/api/machines` to `/api/v2/machines`, you change ONE line in `api.js`.

### `src/hooks/` — Custom Hooks

| Hook | Purpose | Why It Exists |
|---|---|---|
| `useAppDispatch` | `useDispatch()` with type safety | Avoids importing `useDispatch` from `react-redux` everywhere |
| `useAppSelector` | `useSelector()` with type safety | Same — central import |
| `useAuth` | Returns `{ isAuthenticated, user }` + redirect guard | Screens that need auth check without full role logic |
| `useBreakpoint` | Returns `"mobile"` / `"tablet"` / `"desktop"` | Responsive layouts — breakpoints at 768px and 1024px |
| `useDark` | Returns `true` / `false` | Reads `settings.darkMode` from Redux. Every component uses this for theming. |
| `useLiveTopic` | Subscribes to a STOMP topic, returns latest payload | Screens subscribe to live sensor readings or alerts without touching the WebSocket API directly |
| `useRole` | Returns `{ role, user, can(), canAccess(), hasPermission() }` | All UI gating flows through this. Memoised to prevent infinite re-renders. |
| `useSearch` | Debounced search input (300ms) with loading state | User list, machine list, group list — consistent search UX |
| `useTechnicians` | Fetches technician list once (cached in Redux) | Maintenance assignment dropdown needs the tech list — fetched once, reused everywhere |

### `src/lib/` — Low-Level Utilities

| File | Responsibility | Best Practice |
|---|---|---|
| `axios.js` | Shared Axios instance. Request interceptor injects Bearer token. Response interceptor catches 401 → force logout. All errors normalised to `{ status, code, message, details }`. | **Single HTTP client** — no direct `axios` imports anywhere else. |
| `storage.js` | Cross-platform token/user storage. Native: AsyncStorage. Web: sessionStorage (per-tab isolation). Memory layer for non-remembered sessions. | **Platform abstraction** — the rest of the app never branches on `Platform.OS` for storage. |
| `status.js` | Maps status/priority enums to `{ label, color }`. Used by every badge/chip in the app. | **Single source of truth** for visual mapping. |
| `time.js` | `formatDate()`, `formatDateTime()`, `relativeTime()`. | **Consistent date display** across all screens. |
| `validators.js` | Email regex, password strength rules. | **Shared validation** between login, register, and profile screens. |
| `alertText.js` | `formatNotificationTitle()`, `parseAssignmentMessage()`. Extracts machine/type/priority from backend notification strings. | **Backend message parsing** isolated from UI rendering. |
| `sensorAlerts.js` | Alert deduplication logic. Builds `sensorStates` map for live dots. `liveDotFor()` determines if the green/red dot shows on a notification row. | **Complex alert logic** kept out of the screen component. |
| `stompPolyfill.js` | Polyfills `TextEncoder` / `TextDecoder` for React Native (Hermes engine). Without this, `@stomp/stompjs` throws on the very first CONNECT frame. | **Platform gap fix** — imported before `@stomp/stompjs`. |

### `src/utils/` — Domain Helpers

| File | Purpose |
|---|---|
| `analyticsCalc.js` | `computeHealthScore()`, `detectAnomalies()`, `computeUptime()` — pure functions that process sensor readings into KPIs. |
| `readingSeries.js` | `groupBySensorType()`, `toChartPoints()` — transforms raw reading arrays into chart-ready data. |
| `alertHelper.js` | `sortBySeverity()`, `severityRank()` — sorts alerts CRITICAL > HIGH > WARNING > INFO. |
| `formatHelper.js` | `formatSensorValue()`, `formatUnit()` — "45.123456" → "45.12 °C". |

---

## 6. State Management (Redux Toolkit)

### Architecture

```
Screen (dispatch thunk) → Slice (createAsyncThunk) → Service (axios call) → Backend
       ↑                          ↓
       └── useAppSelector ← state update (pending/fulfilled/rejected)
```

### The 19 Slices

| Slice | State Shape | Key Thunks |
|---|---|---|
| `authSlice` | `{ user, token, status, error, remember }` | `loginThunk`, `registerThunk`, `meThunk`, `refreshSession`, `forceLogout` |
| `machineSlice` | `{ list, status, current }` | `fetchMachines`, `fetchMachineById`, `createMachine`, `updateMachine` |
| `sensorSlice` | `{ sensors, status }` | `fetchSensors` (per machine) |
| `readingSlice` | `{ readings, status, pagination }` | `fetchReadings` (auto-paginates all pages) |
| `alertSlice` | `{ list, status, filters, pagination }` | `fetchAlerts`, `acknowledgeAlert`, `resolveAlert` |
| `notificationSlice` | `{ list, unread, type, pagination }` | `fetchNotifications`, `markNotificationRead`, `markAllNotificationsRead`, `pollNotifications` |
| `interventionSlice` | `{ list, current, mutating, filters }` | `fetchInterventions`, `createIntervention`, `assignIntervention`, `addInterventionDiagnosis`, `addInterventionAction`, `closeIntervention` |
| `dashboardSlice` | `{ machines, alerts, overview }` | `fetchDashboardData` (parallel fetches) |
| `groupSlice` | `{ list, current, members }` | `fetchGroups`, `createGroup`, `addMember`, `removeMember`, `setSupervisor` |
| `userSlice` | `{ list, current, permissions }` | `fetchUsers`, `createUser`, `updateUser`, `updateUserPermissions` |
| `roleSlice` | `{ list, catalog }` | `fetchRoles`, `createRole`, `updateRole`, `fetchPrivilegesCatalog` |
| `zoneSlice` | `{ list }` | `fetchZones` |
| `thresholdSlice` | `{ thresholds }` | `fetchThresholds`, `upsertThreshold` |
| `liveSlice` | `{ connected, messages }` | (sync reducers: `setConnected`, `pushMessage`) |
| `settingsSlice` | `{ darkMode, notifications }` | `loadSettings`, `saveSetting` |
| `analyticsSlice` | `{ trends, status }` | `fetchTrends` |
| `eventSlice`, `reportSlice`, `aiSlice` | Placeholders | Future sprints |

### Thunk Pattern

Every async thunk follows the same pattern:

```jsx
// In the slice:
export const fetchMachines = createAsyncThunk(
  "machine/fetchAll",
  async (params, { rejectWithValue }) => {
    try {
      return await machineService.getAll(params);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

// In extraReducers:
builder
  .addCase(fetchMachines.pending, (state) => { state.status = "loading"; })
  .addCase(fetchMachines.fulfilled, (state, action) => {
    state.status = "succeeded";
    state.list = action.payload;
  })
  .addCase(fetchMachines.rejected, (state, action) => {
    state.status = "error";
    state.error = action.payload;
  });
```

### Optimistic Updates

Mutation thunks (assign, status change) optimistically update the state in `pending` and revert on `rejected`:

```jsx
.addCase(assignIntervention.pending, (state, action) => {
  state.mutating = "loading";
  // Optimistic: update the assignment immediately
  const target = state.list.find(t => t.id === action.meta.arg.id);
  if (target && target.status === "PENDING") target.status = "ASSIGNED";
})
```

---

## 7. Data Loading Pattern

### Service Layer

Every slice has a matching service file. Services are **pure async functions** that call `axios` and normalise the response:

```
Screen dispatches → Slice thunk → Service function → lib/axios → Backend
                                        ↓
                                  Normalise response (normalizeIntervention, etc.)
```

**Example: `interventionService.js`**

```jsx
export async function getAll({ machineId, status, page, size } = {}) {
  const response = await api.get(ENDPOINTS.INTERVENTIONS, {
    params: { machineId, status, page, size },
  });
  const data = response.data || {};
  const list = normalizeInterventions(data);
  return { list, page: data.number, totalPages: data.totalPages };
}
```

### Normalisation

Every service has a `normalize*()` function that converts the backend's raw JSON into a predictable shape. This protects screens from backend schema changes:

```jsx
export function normalizeIntervention(row) {
  return {
    id: row.id ?? row.interventionId,
    title: row.title || "Intervention",
    status: row.status || "PENDING",
    priority: row.priority || "MEDIUM",
    technicianIds: Array.isArray(row.technicianIds) ? row.technicianIds : [],
    // ... 20+ fields normalised
  };
}
```

### Auto-Pagination

Some endpoints (readings) return paginated data. The `readingSlice` auto-fetches ALL pages:

```jsx
// Fetch page 0, then if totalPages > 1, fetch remaining pages in parallel
const first = await readingService.getReadings({ machineId, page: 0 });
if (first.totalPages > 1) {
  const remaining = await Promise.all(
    Array.from({ length: first.totalPages - 1 }, (_, i) =>
      readingService.getReadings({ machineId, page: i + 1 })
    )
  );
  // Merge all pages
}
```

---

## 8. Authentication & Token Storage

### Flow

```
1. User submits login form
2. POST /api/auth/login → { token, user }
3. Token saved to storage (memory + persistent if "remember me")
4. Redux state: auth.status = "authenticated"
5. Root layout detects auth → redirects to dashboard
6. Every subsequent API call: axios interceptor attaches "Bearer {token}"
7. On 401: interceptor calls forceLogout() → clear storage → redirect to login
```

### Token Storage Strategy (`src/lib/storage.js`)

```
┌─────────────────────────────────────────────────────────┐
│                    storage.js                           │
├──────────────┬──────────────┬───────────────────────────┤
│   Memory     │   Native     │   Web                     │
│ (module var) │ AsyncStorage │ sessionStorage (per tab)  │
├──────────────┼──────────────┼───────────────────────────┤
│ Always set   │ Set only if  │ Set only if               │
│ on login     │ remember=true│ remember=true             │
├──────────────┼──────────────┼───────────────────────────┤
│ Lost on      │ Persists     │ Persists within tab       │
│ reload       │ across app   │ (survives refresh,        │
│              │ restarts     │ not new tabs)             │
└──────────────┴──────────────┴───────────────────────────┘
```

**Why sessionStorage over localStorage on web?**  
Tab isolation: each browser tab can hold a different account. Logging out in one tab doesn't affect another.

### Session Refresh

The root layout polls `GET /api/auth/me` every 60 seconds + on every app foreground event. This keeps the user's role/permissions/status fresh without requiring a page reload. If the token has expired, the 401 interceptor forces logout.

### Bootstrap on App Start (`initAuth.js`)

```
1. Check storage for existing token
2. If token exists → GET /api/auth/me
3. If /me succeeds → user is authenticated (no login screen)
4. If /me fails (expired token) → clear storage, show login
5. If no token → show login (no error)
```

---

## 9. Permissions & Role-Based Access

### Two-Layer Gating

| Layer | Mechanism | Source |
|---|---|---|
| **Roles** (legacy) | `can("ADMIN", "RESPONSABLE_INDUSTRIEL")` | `user.role` string |
| **Permissions** (granular) | `hasPermission("MACHINE_READ")` | `user.effectivePermissions` array |

### Role Hierarchy

```
ADMIN                    → Full access to everything
RESPONSABLE_INDUSTRIEL   → Dashboard, machines, alerts, maintenance (create/assign/close)
TECHNICIAN               → Maintenance (execute: diagnoses/actions), alerts (view)
OPERATOR                 → Map, their own group only
```

### Page Access (`useRole.js`)

```jsx
const ACCESS = {
  dashboard: ["ADMIN", "RESPONSABLE_INDUSTRIEL"],
  machines:  ["ADMIN", "RESPONSABLE_INDUSTRIEL"],
  alerts:    ["ADMIN", "RESPONSABLE_INDUSTRIEL", "TECHNICIAN"],
  maintenance: ["ADMIN", "RESPONSABLE_INDUSTRIEL", "TECHNICIAN"],
  users:     ["ADMIN"],
  groups:    ["ADMIN"],
};
```

Screens call `canAccess("machines")` to show/hide menu items. The `Sidebar` and `BottomTabs` both filter their items through this.

### Feature-Level Gating (Intervention Detail)

```jsx
const canAssign       = isResponsable || role === "ADMIN";
const canDiagnose     = isTechnician && canWorkOnIt;
const canClose        = isResponsable || (isTechnician && canWorkOnIt);
const canChangeStatus = isResponsable || (isTechnician && canWorkOnIt);
```

**Important:** UI gating is cosmetic only — the backend enforces every permission server-side with 403 responses.

---

## 10. Real-Time Data (WebSocket / STOMP)

### Architecture

```
Backend (Spring Boot)
  └── STOMP broker
        ├── /topic/machines/{code}/readings   → live sensor values
        ├── /topic/alerts                     → new alerts
        ├── /topic/users/{id}/notifications   → per-user notifications
        └── /topic/users/{id}/unread-count    → badge count

Frontend
  └── liveService.js (STOMP client)
        ├── Registry of subscriptions (survives reconnects)
        ├── connect() / subscribe() / disconnect()
        └── Pushes to liveSlice via dispatch
```

### Connection Lifecycle

```
1. App starts → store/index.js calls configureLiveService()
2. Auth succeeds → screen calls liveService.connect()
3. STOMP CONNECTED → attachAll() re-subscribes everything in registry
4. WebSocket drops → detachAll() + setConnected(false) + auto-reconnect (5s)
5. Reconnect succeeds → onConnect → attachAll() again
6. App closes → liveService.disconnect()
```

### React Native Fixes

Two critical fixes for React Native's WebSocket implementation:

```jsx
// 1. React Native chops messages at NULL bytes → STOMP frames truncated
appendMissingNULLonIncoming: true,  // re-appends the chopped NULL
forceBinaryWSFrames: true,          // forces binary mode (avoids chop)

// 2. React Native (Hermes) has no TextEncoder/TextDecoder
import "../../lib/stompPolyfill";   // must be imported FIRST
```

### Using Live Data in Screens

```jsx
// Subscribe to a topic:
const latestReading = useLiveTopic(`/topic/machines/${machineCode}/readings`);

// latestReading updates whenever a new message arrives on the topic.
// The hook reads from liveSlice.messages[topic] in Redux.
```

---

## 11. Styling (NativeWind / Tailwind CSS)

### How It Works

NativeWind compiles Tailwind CSS utility classes into React Native `StyleSheet` objects at build time. You write:

```jsx
<View className="flex-row items-center gap-2 p-4 bg-surface rounded-card">
```

And it becomes React Native-compatible styles on both web and native.

### Design System Tokens (`tailwind.config.js`)

```
Colours:
  bg: #F6F8FB          (page background, light mode)
  surface: #FFFFFF      (card background, light mode)
  darkcard: #1E293B     (card background, dark mode)
  primary: #2563EB      (buttons, links, active states)
  success: #16A34A      (health OK, confirmations)
  warning: #F59E0B      (alert warnings)
  danger: #DC2626       (critical alerts, errors)
  text: #0F172A         (body text, light mode)
  text-muted: #64748B   (secondary text)
  sidebar: #0B1D3A      (sidebar background)

Typography:
  font-inter: ["Inter", "system-ui", "sans-serif"]

Border Radii:
  card: 12px    (Card component)
  btn: 8px      (Button component)
  chip: 9999px  (pill/chip badges)
```

### Dark Mode

Dark mode is a Redux setting (`settingsSlice.darkMode`). Every component reads it via `useDark()`:

```jsx
const dark = useDark();
return (
  <View className={`p-4 ${dark ? "bg-darkcard" : "bg-surface"}`}>
    <Text className={dark ? "text-white" : "text-text"}>Hello</Text>
  </View>
);
```

### Responsive Design

`useBreakpoint()` returns `"mobile"` (< 768px), `"tablet"` (768-1023px), or `"desktop"` (>= 1024px):

```jsx
const isDesktop = useBreakpoint() === "desktop";
return (
  <View className={isDesktop ? "flex-row gap-4" : "gap-3"}>
    {/* Desktop: side by side. Mobile: stacked. */}
  </View>
);
```

---

## 12. Push Notifications (FCM)

### How It Works

1. **Native only** — `expo-notifications` + `expo-device` + Firebase Cloud Messaging.
2. On login, `initPush()` requests permission and gets an FCM token.
3. Token is sent to `POST /api/notifications/tokens` so the backend can push.
4. When a notification arrives while the app is **closed**, FCM shows a system notification.
5. Tapping the notification opens the app and navigates to the relevant screen (alert detail, intervention detail, etc.) via `handleNotificationResponse()`.
6. When the app is **open**, STOMP delivers the notification in real time (no FCM needed).

### Web

Push notifications are not supported on web — STOMP + polling (`pollNotifications()` every 12s) handle real-time updates in the browser.

---

## 13. Best Practices Used

### 1. Separation of Concerns

```
Screen (UI + layout)
  → Hook (data access, role check)
    → Slice (state + async thunks)
      → Service (API call + normalisation)
        → lib/axios (HTTP + auth)
```

No screen ever calls `axios.get()` directly. No service ever imports Redux.

### 2. Single Source of Truth

- **Endpoints:** All in `constants/api.js` — never hardcoded in services.
- **Roles:** All in `constants/roles.js` — never string-compared inline.
- **Permissions:** All in `constants/permissions.js` — never scattered.
- **Status/Priority labels & colours:** All in `lib/status.js`.

### 3. Normalisation Layer

Every API response is normalised in the service before reaching Redux. This:
- Protects against backend schema changes.
- Provides default values (`status || "PENDING"`).
- Handles both old and new field names (`row.id ?? row.interventionId`).

### 4. Optimistic Updates

Assignment, status changes, and close operations update Redux immediately in the `pending` case and revert on `rejected`. The user sees an instant response.

### 5. Reconnection Resilience

The STOMP client maintains a **registry** of subscriptions. When the WebSocket drops and reconnects, `onConnect` re-attaches every subscription automatically. Components never need to re-subscribe.

### 6. Polling Safety Net

Even with WebSocket, a 12-second polling interval (`pollNotifications`) catches anything the STOMP bridge missed (sleeping laptop, flaky network). The badge and list stay fresh.

### 7. Cross-Platform Abstraction

- `storage.js` — abstracts AsyncStorage (native) vs sessionStorage (web).
- `stompPolyfill.js` — polyfills TextEncoder/TextDecoder for React Native.
- `Select.jsx` — renders `<select>` on web, custom picker on native.
- `DateTimeInput.jsx` — renders `<input type="datetime-local">` on web, DateTimePicker on native.

### 8. Memoisation

`useRole()` memoises its return value with `useMemo(() => ..., [user])`. Without this, every render creates new `can()` / `canAccess()` functions, causing `useEffect` dependencies to trigger infinite re-render loops.

### 9. Error Boundaries

- Axios interceptor normalises ALL errors to `{ status, code, message, details }`.
- Every thunk wraps in `try/catch` with `rejectWithValue(error)`.
- Every screen handles `loading`, `error`, and `empty` states.

### 10. Debounced Search

`useSearch()` debounces input by 300ms to avoid flooding the backend with requests on every keystroke.

---

## 14. Coding Rules & Conventions

### File Naming

| Type | Convention | Example |
|---|---|---|
| Screen | `kebab-case.jsx` | `forgot-password.jsx` |
| Component | `PascalCase.jsx` | `InterventionModal.jsx` |
| Hook | `camelCase.js` (use prefix) | `useBreakpoint.js` |
| Slice | `camelCaseSlice.js` | `interventionSlice.js` |
| Service | `camelCaseService.js` | `interventionService.js` |
| Constant | `camelCase.js` | `permissions.js` |
| Utility | `camelCase.js` | `analyticsCalc.js` |

### Import Order

```jsx
// 1. React / React Native
import { useEffect, useState } from "react";
import { View, Text, ScrollView } from "react-native";

// 2. Expo / Navigation
import { useRouter, useLocalSearchParams } from "expo-router";

// 3. Components
import AppShell from "../../../src/components/AppShell";
import Card from "../../../src/components/Card";

// 4. Hooks
import { useDark } from "../../../src/hooks/useDark";
import { useRole } from "../../../src/hooks/useRole";

// 5. Store (slices, selectors)
import { fetchMachines } from "../../../src/store/slices/machineSlice";

// 6. Lib / Utils / Constants
import { formatDateTime } from "../../../src/lib/time";
```

### State Conventions

| Redux state key | Meaning |
|---|---|
| `status` | Fetch state: `"idle"` → `"loading"` → `"succeeded"` / `"error"` |
| `mutating` | Mutation state: `"idle"` → `"loading"` → `"succeeded"` / `"error"` |
| `list` | Array of normalised entities |
| `current` | Single entity (detail view) |
| `filters` | Current filter values (status, type, search) |
| `pagination` | `{ page, size, totalElements, totalPages }` |

### JSX Rules

1. **Wrap text in `<Text>`** — React Native crashes on bare strings inside `<View>`.
2. **Use `{" "}` or `{"string"}` for string literals** — avoids "Unexpected text node" errors.
3. **Boolean guards must be explicit** — `{count > 0 && <Badge />}` not `{count && <Badge />}` (0 renders as text).
4. **Style objects outside render** — heavy style objects should be constants or memoised.

### Comments

Every file starts with a header comment explaining:
- What the file does
- Which backend endpoints it consumes (with CONFIRMED/ASSUMED status)
- Which user stories it implements
- Any known caveats or TODOs

```jsx
// app/(app)/maintenance/[id].jsx
//
// Sprint 6 — Intervention detail (CONFIRMED backend MaintenanceController).
//   GET   /api/maintenance/:id                    full entity
//   PUT   /api/maintenance/:id/assign             technician assignment (US43)
//   POST  /api/maintenance/:id/diagnoses          probable cause (US45)
// ...
```

---

> **This document is a living reference.** Update it as new screens, slices, or patterns are added to the codebase.
