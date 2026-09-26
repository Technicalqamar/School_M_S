# Project Audit Report — Authentication, Loader & Global Architecture

> **Date:** 2026-07-16
> **Scope:** Full-stack audit of Authentication, Role System, Global Architecture & Shared Components
> **Mode:** Read-only — no code was modified during this audit

---

## Table of Contents

1. [Authentication Audit](#1-authentication-audit)
2. [Role System Audit](#2-role-system-audit)
3. [Auto Login Behaviour Audit](#3-auto-login-behaviour-audit)
4. [Global Loader Audit](#4-global-loader-audit)
5. [Toast Notification Audit](#5-toast-notification-audit)
6. [Global Context Audit](#6-global-context-audit)
7. [Shared Components Audit](#7-shared-components-audit)
8. [Hardcoded Values Audit](#8-hardcoded-values-audit)
9. [Project Architecture Audit](#9-project-architecture-audit)
10. [Recommended Improvements Before Next Module](#10-recommended-improvements-before-next-module)

---

## 1. Authentication Audit

### Flow Overview

Authentication is managed by three layers:

1. **`AuthContext`** (`frontend/src/contexts/AuthContext.jsx`) — React Context that holds `user`, `role`, and `loading` state.
2. **`auth.service.js`** (`frontend/src/services/auth.service.js`) — API client for all auth endpoints.
3. **`axios.js` interceptor** (`frontend/src/api/axios.js`) — Automatic token attachment and refresh logic.

### Login Flow

1. User submits credentials on `Login.jsx`.
2. `authService.adminLogin()` / `teacherLogin()` / `studentLogin()` POSTs to `/auth/{role}/login`.
3. Backend returns `{ user, accessToken, refreshToken }`.
4. `AuthContext.login()` is called with all three values.
5. Data is saved to **localStorage** under these keys:
   - `accessToken` — JWT access token (short-lived)
   - `refreshToken` — JWT refresh token (long-lived)
   - `user` — Full user object (JSON stringified)
   - `role` — User role string (`'admin' | 'teacher' | 'student'`)

### Token Refresh Flow (axios interceptor)

- Every API request checks localStorage for `accessToken` and attaches it as `Authorization: Bearer <token>`.
- On 401 response (token expired), the interceptor:
  1. Reads `refreshToken` from localStorage.
  2. POSTs to `/auth/refresh-token` with the refresh token.
  3. Saves new `accessToken` (and optionally new `refreshToken`) to localStorage.
  4. Retries the original request with new token.
- If refresh fails, clears all tokens and redirects to `/login`.

### Logout Flow

- `AuthContext.logout()` calls `authService.logout()` which POSTs to `/auth/logout` with the refresh token.
- On success or failure, clears all state and calls `localStorage.clear()`.

### Storage Summary

| Storage | Key | Data | Duration |
|---------|-----|------|----------|
| localStorage | `accessToken` | JWT string | Until expiry or logout |
| localStorage | `refreshToken` | JWT string | Until logout |
| localStorage | `user` | JSON user object | Until logout |
| localStorage | `role` | String `'admin'/'teacher'/'student'` | Until logout |
| React State (AuthContext) | `user`, `role`, `loading` | Runtime objects | Until page refresh (re-initialized from localStorage) |
| Backend DB | `refreshToken` model | Stored refresh tokens | Until expiry or deletion |

### Security Observations

- Tokens stored in localStorage — accessible to any JavaScript on the same origin (vulnerable to XSS).
- No HttpOnly cookies used.
- No token expiry checking on frontend before API calls (relies on 401 interceptor).
- `localStorage.clear()` on logout removes everything including any non-auth data other modules might have stored.

---

## 2. Role System Audit

### How Roles Are Handled

- **Storage:** Role is stored in both `AuthContext` state (`role`) and `localStorage` key `'role'`.
- **Source of truth:** Backend returns `user.role` during login and on `/auth/me` endpoint.
- **Role values:** `'admin'`, `'teacher'`, `'student'`.

### Dashboard Routing

Routing is handled in `App.jsx` via `ProtectedRoute` component:

| Route | Component | Allowed Role |
|-------|-----------|-------------|
| `/login` | `LoginPage` | Public |
| `/admin/forgot-password` | `ForgotPasswordPage` | Public |
| `/admin/*` | AdminLayout with nested routes | `admin` |
| `/teacher/dashboard` | `TeacherDashboard` | `teacher` |
| `/student/dashboard` | `StudentDashboard` | `student` |
| `/` | Redirects to `/login` | Public fallback |
| `*` | Redirects to `/login` | Public fallback |

### ProtectedRoute Logic

File: `frontend/src/components/ProtectedRoute.jsx`

- If `loading` → shows full-screen spinner.
- If `!user` → redirects to `/login`.
- If `allowedRoles` and role not included → redirects to `/`.
- Otherwise → renders `<Outlet />` with child routes.

### Unauthorized Access Assessment

- Routes are protected by `ProtectedRoute` which checks both authentication and role.
- The axios interceptor handles token expiry globally.
- If a user manually changes their role in localStorage, the next `/auth/me` call will fail and they'll be logged out.
- **Backend enforcement:** All backend routes have middleware that verifies JWT and checks role. Frontend role checks are a UX convenience, not a security boundary.

---

## 3. Auto Login Behaviour Audit

### Current Behaviour

On app load:

1. `main.jsx` renders `<BrowserRouter>` → `<App />`.
2. `App.jsx` renders `<AuthProvider>` → `<SchoolConfigProvider>`.
3. `AuthProvider` mounts → runs `useEffect` `initAuth()`.
4. `initAuth()` checks localStorage for `accessToken`:
   - **Found:** Calls `authService.getMe()` (GET `/auth/me`) to validate the token and fetch current user data. If successful, sets `user` and `role` in context. If fails, calls `logout()`.
   - **Not found:** Sets `loading = false`.
5. `SchoolConfigProvider` mounts → fetches school settings from API.
6. Once `loading = false` (from AuthContext), `ProtectedRoute` renders either the protected content or redirects to `/login`.

### Result

- ✅ **Auto-login works.** If a user has a valid `accessToken` in localStorage, they are automatically authenticated on page refresh.
- ✅ The token is validated against the backend (`/auth/me`), so expired/invalid tokens result in automatic logout.
- ❌ **Problem:** There is a brief flash of the login page while loading is true. The ProtectedRoute shows a spinner during this time for protected routes, but since the root `/` route redirects to `/login`, users visiting `/` may briefly see the login page before being redirected.

### Flow Summary

```
App Load → AuthProvider init → Check localStorage accessToken
  ├── Has token → GET /auth/me → Valid → Set user/role → Dashboard renders
  │                            → Invalid → Clear state → Login page
  └── No token → loading=false → ProtectedRoute redirects to /login
```

---

## 4. Global Loader Audit

### Global Page Loader

**Status: ❌ Does NOT exist as a dedicated global component.**

There is no `Loader.jsx` or `Spinner.jsx` component in the project.

### Current Loader Implementations

| Location | Type | How It Works |
|----------|------|-------------|
| `ProtectedRoute.jsx` | Inline full-screen spinner | `<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600">` — shown during auth loading state |
| `Button.jsx` | Inline button spinner | SVG spinner shown inside button when `loading={true}` prop is passed |
| `ConfirmationModal.jsx` | Inline button spinner | Same SVG spinner inline inside confirm button when loading |
| Various components (Student, Teacher, Class, Attendance, etc.) | Per-component loading states | Each component manages its own loading UI using `loading` state |

### Button Loader Assessment

- ✅ **Button.jsx** provides a reusable button with built-in spinner — used consistently across the app.
- ❌ `ConfirmationModal.jsx` duplicates the same spinner SVG inline instead of using Button component.
- ❌ No dedicated reusable spinner/loader component exists.

---

## 5. Toast Notification Audit

### Current Implementation

- **Library:** `react-hot-toast` (imported in `App.jsx` line 2: `import { Toaster } from 'react-hot-toast'`).
- **Placement:** `<Toaster />` is rendered once in `App.jsx` at the top level, inside both providers.
- **Configuration:** `position="top-right"`, `reverseOrder={false}`.

### How It's Used

- Imported directly from the library in any component that needs notifications:
  - `import { toast } from 'react-hot-toast'`
  - Usage: `toast.success('message')`, `toast.error('message')`
- Consistent across all modules — no custom toast component wrapper.

### Assessment

- ✅ Global single instance — correctly placed in App.jsx.
- ✅ Consistent usage pattern across all modules.
- ✅ No duplicate toast implementations.
- ⚠️ No custom toast component wrapper — if toast styling needs to change, it must be done in each call site or by configuring the `<Toaster>` props.

---

## 6. Global Context Audit

### Contexts Present

| Context | File | Purpose | Used By |
|---------|------|---------|---------|
| `AuthContext` | `frontend/src/contexts/AuthContext.jsx` | Authentication state (`user`, `role`, `loading`), login/logout functions | `ProtectedRoute.jsx`, `Login.jsx`, `AdminDropdown.jsx`, `TeacherDashboard.jsx`, `StudentDashboard.jsx`, `App.jsx` |
| `SchoolConfigContext` | `frontend/src/contexts/SchoolConfigContext.jsx` | Global school configuration (`schoolInfo`, `academic`, `branding`, `preferences`), `refresh()` | `QRCodeManagement.jsx`, `TimetableDesigner.jsx`, `SchoolSettings.jsx`, `App.jsx` |

### Observations

- Only 2 React Contexts — clean and minimal.
- Both are provided at the App root level in `App.jsx` (`AuthProvider` wraps `SchoolConfigProvider`).
- `useSchoolBranding` hook (`frontend/src/hooks/useSchoolBranding.js`) is a standalone caching hook, not a context — it calls the API independently and caches in a module-level variable.
- No Theme Context exists — dark/light mode is handled by `ThemeToggle.jsx` using `localStorage` + Tailwind `dark:` class on `<html>`.

### Context Provider Nesting Order

```
AuthProvider
  └── SchoolConfigProvider
       └── Toaster
       └── Routes (Router)
```

---

## 7. Shared Components Audit

### Common Components (`frontend/src/components/common/`)

| Component | File | Reusable? | Notes |
|-----------|------|-----------|-------|
| Button | `Button.jsx` | ✅ Yes | Variants: primary, secondary, danger, outline. Built-in loading spinner. |
| Input | `Input.jsx` | ✅ Yes | Supports label, icon, error, password toggle. |
| SelectInput | `SelectInput.jsx` | ✅ Yes | Dropdown with label, placeholder, disabled state. |
| DateInput | `DateInput.jsx` | ✅ Yes | Date picker with label. |
| SearchInput | `SearchInput.jsx` | ✅ Yes | Search field with magnifying glass icon. |
| Modal | `Modal.jsx` | ✅ Yes | Generic modal with title, close button, backdrop. |
| ConfirmationModal | `ConfirmationModal.jsx` | ✅ Yes | Extends Modal with confirm/cancel buttons. Has inline spinner (duplicates Button). |
| Alert | `Alert.jsx` | ✅ Yes | Types: success, error, warning, info. |
| Table | `Table.jsx` | ✅ Yes | Generic table with columns, data, custom row renderer. |
| StatCard | `StatCard.jsx` | ✅ Yes | Stats display card with icon and color variants. |
| CardSection | `CardSection.jsx` | ⚠️ Partial | Generic section wrapper with title and border. |
| StatusBadge | `StatusBadge.jsx` | ⚠️ Partial | Only handles 'Active' and 'Promoted' statuses — tightly coupled. |
| ActionButtons | `ActionButtons.jsx` | ✅ Yes | View/Edit/Delete action buttons. |
| ViewToggle | `ViewToggle.jsx` | ✅ Yes | Card/Table view toggle. |
| FilterDropdown | `FilterDropdown.jsx` | ⚠️ Partial | Generic dropdown but duplicates SelectInput functionality. |
| OtpInput | `OtpInput.jsx` | ✅ Yes | 6-digit OTP input with paste support. |
| StudentCard | `StudentCard.jsx` | ❌ No | Tightly coupled to student data shape. |
| TeacherCard | `TeacherCard.jsx` | ❌ No | Tightly coupled to teacher data shape. |
| SubjectCard | `SubjectCard.jsx` | ❌ No | Tightly coupled to subject data shape. |
| ClassCard | `ClassCard.jsx` | ❌ No | Tightly coupled to class data shape. |
| StudentViewModal | `StudentViewModal.jsx` | ❌ No | Module-specific. |
| TeacherViewModal | `TeacherViewModal.jsx` | ❌ No | Module-specific. |
| SubjectViewModal | `SubjectViewModal.jsx` | ❌ No | Module-specific. |
| EditStudentModal | `EditStudentModal.jsx` | ❌ No | Module-specific. |
| EditTeacherModal | `EditTeacherModal.jsx` | ❌ No | Module-specific. |

### Issues Found

1. **FilterDropdown duplicates SelectInput** — same dropdown behavior, different styling.
2. **ConfirmationModal duplicates Button spinner** — inline SVG spinner instead of using the Button component.
3. **Card components (StudentCard, TeacherCard, SubjectCard, ClassCard)** — highly redundant, could be a single generic Card component with props, but they are genuinely different enough in layout that a generic component may not be cleaner.
4. **No global Loader/Spinner component** — each module creates its own loading indicator.

---

## 8. Hardcoded Values Audit

### Remaining Hardcoded Values

#### Placeholders / UI Hints (Acceptable)
| File | Value | Context |
|------|-------|---------|
| `SchoolInformation.jsx` | `placeholder="e.g. IQRA"` | Input placeholder for short name — UI hint, not school identity |
| `NotificationBell.jsx` | Hardcoded mock notifications | Demo data — will be replaced when real notification system is built |

#### Constants in Backend (Out of Scope)
| File | Value |
|------|-------|
| `backend/src/validations/student.validation.js` | `ALLOWED_CLASSES` |
| `backend/src/validations/studentPromotion.validation.js` | `ALLOWED_CLASSES` |
| `backend/src/controllers/schoolSettings.controller.js` | Default principal name |

#### Previously Cleaned (Verified — No Longer Present)
- ✅ No `IQRA` or `Iqra Anwar Ul Quran` school name hardcoded in frontend JS/JSX (except as mock student name "Iqra Aziz" which is a person's name, not school identity)
- ✅ No `123 Education Street` address
- ✅ No `+92-300-1234567` contact
- ✅ No `Dr. Abdul Rahman` principal name
- ✅ No `SchoolConfigContext` duplicate — all school info reads from context
- ✅ No `SCHOOL_INFO` object — reads from `useSchoolConfig()`
- ✅ No `2025-26` academic year format — single-year format `'2025'` used consistently

---

## 9. Project Architecture Audit

### Folder Structure

```
frontend/src/
├── api/                    # Axios instance and interceptors
├── assets/                 # Static assets
├── components/
│   ├── attendance/         # Attendance-specific components (tabs, templates, data)
│   ├── class/              # Class management components (tabs)
│   ├── common/             # Shared/reusable components (25 files)
│   ├── layout/             # Layout components (Header, Sidebar, etc.)
│   ├── settings/           # Settings-specific components (tabs)
│   ├── student/            # Student management components (tabs)
│   ├── subject/            # Subject management components (tabs)
│   ├── teacher/            # Teacher management components (tabs)
│   ├── timetable/          # Timetable management components (tabs)
│   └── ProtectedRoute.jsx # Route guard component
├── contexts/               # React Contexts (AuthContext, SchoolConfigContext)
├── hooks/                  # Custom hooks (useSchoolBranding)
├── layouts/                # Page layouts (AdminLayout)
├── pages/
│   ├── admin/              # Admin page shells (10 files)
│   ├── auth/               # Login and ForgotPassword
│   ├── student/            # Student dashboard
│   └── teacher/            # Teacher dashboard
├── services/               # API service modules (14 files)
└── utils/                  # Utility modules (4 files)
```

### Strengths

- ✅ Clear separation between pages (shells) and components (implementation).
- ✅ Services layer cleanly separates API calls from UI logic.
- ✅ Common components directory for shared UI.
- ✅ Context providers at root level.
- ✅ Consistent file naming conventions (`*.jsx` for components, `*.js` for services/utils).

### Issues

1. **Duplication between `components/` and `pages/`:** Each module (student, teacher, class, etc.) has a page shell in `pages/admin/` and component tabs in `components/{module}/`. The page files are thin wrappers that import from the component directory. While this separation is intentional, it adds indirection without much benefit for single-module pages.

2. **`pages/admin/AdminDashboard.jsx` is empty placeholder** — waiting for final-phase development.

3. **Notification system** (`NotificationBell.jsx`) has hardcoded mock data and no API integration.

4. **`useSchoolBranding` hook** (`hooks/useSchoolBranding.js`) duplicates the same API call that `SchoolConfigContext` makes. Both independently fetch school settings. This should be consolidated.

5. **Timetable constants duplication:** `utils/timetableConstants.js` defines `GROUPS` with class lists that overlap with `utils/classNames.js`'s `CLASS_NAMES`. Not exact duplicates, but the class names are repeated.

### Future Scaling Concerns

1. **No global error boundary** — uncaught React errors will crash the UI.
2. **No global API error handler** — each component manually catches and handles errors.
3. **No token expiry UX** — when token expires mid-session, the interceptor silently refreshes. If refresh fails, user is hard-redirected to `/login` with `window.location.replace()`.
4. **No persistent role-based routing** — if a user's role changes on the backend, the frontend won't know until the next app refresh (or `/auth/me` call).

---

## 10. Recommended Improvements Before Next Module

### P1 — High Priority (Should Fix Before Adding New Modules)

1. **Create a reusable `Loader/Spinner` component**
   - File: `frontend/src/components/common/Loader.jsx`
   - Variants: full-screen, inline, button-sized
   - Replace all inline spinners in `ProtectedRoute.jsx`, `ConfirmationModal.jsx`, and individual module loading states.

2. **Consolidate `useSchoolBranding` hook into `SchoolConfigContext`**
   - Update `Header.jsx` and `Sidebar.jsx` to use `useSchoolConfig()` instead of `useSchoolBranding()`.
   - Remove the standalone hook and its duplicate API call.

3. **Add token expiry UX**
   - Instead of `window.location.replace('/login')` on refresh failure, show a "Session Expired" toast and redirect gracefully.
   - Consider adding a session expiry countdown or warning.

4. **Move tokens to HTTP-only cookies (Security)**
   - Mitigates XSS risk from localStorage-based token storage.
   - Alternative: keep localStorage but add XSS protection headers and Content Security Policy.

### P2 — Medium Priority

5. **Global Error Boundary**
   - Wrap the app in an ErrorBoundary component that catches uncaught errors and shows a fallback UI.

6. **Global API Error Handler Enhancement**
   - Add centralized error handling in the axios interceptor for non-401 errors (network errors, 500s) with user-friendly toast messages.

7. **Auto-login loading flash fix**
   - Add a splash/loading screen that shows on initial app load while `AuthContext.loading` is true, preventing the brief redirect to `/login`.

8. **Consolidate `FilterDropdown` into `SelectInput`**
   - `FilterDropdown` is a duplicate of `SelectInput` with slightly different styling.
   - Either remove FilterDropdown and use SelectInput everywhere, or merge them.

9. **Remove inline spinner from `ConfirmationModal.jsx`**
   - Reuse `Button` component instead of duplicating the spinner SVG.

### P3 — Low Priority

10. **Notification system API integration**
    - Replace mock data in `NotificationBell.jsx` with real API calls.

11. **Scaffold Dashboard for final-phase development**
    - Prepare the dashboard structure, router, and placeholder components.

12. **Standardize date/time handling**
    - Consider adding a date utility library (date-fns/luxon) and centralizing format functions.

13. **Add TypeScript** (long-term)
    - For better type safety across the shared components and contexts.

---

## Summary

| Area | Status |
|------|--------|
| Authentication | ✅ Working with JWT + refresh tokens via localStorage |
| Auto-login | ✅ Working but has brief flash of login page on fresh load |
| Role System | ✅ 3 roles (admin/teacher/student) with ProtectedRoute guards |
| Global Loader | ❌ No dedicated Loader component — inline spinners everywhere |
| Toast System | ✅ Global react-hot-toast instance — consistent usage |
| Global Contexts | ✅ 2 contexts (Auth, SchoolConfig) — clean minimal architecture |
| Shared Components | ✅ 25 reusable components with some duplication issues |
| Hardcoded Values | ✅ Mostly cleaned — only acceptable UI hints remain |
| Folder Structure | ✅ Clean separation of concerns — some duplication between pages/ and components/ |
| SchoolConfig Integration | ✅ Single source of truth — all module constants centralized |
