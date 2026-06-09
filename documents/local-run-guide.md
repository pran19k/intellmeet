# Local Run Guide

## Prerequisites

- Node.js 20+
- npm 10+

## Environment Setup

Copy `.env.example` to `.env` at the workspace root and fill in the required values before starting the API or socket service.

Required backend values include:

- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `MONGODB_URI`
- `API_PORT`
- `SOCKET_PORT`

If you want to change the web API endpoint, copy `apps/web/.env.example` to `apps/web/.env` and update `VITE_API_BASE`.
The web app requires `VITE_API_BASE`; it no longer falls back to `http://localhost:4000`.

Keep the root `.env` out of git; it holds the local backend secrets and connection values.

## Install

From workspace root:

```bash
npm install
```

## Run Services

### API

```bash
npm run dev:api
```

Runs on: `http://localhost:4000`
Health check: `GET /health`

### Web

```bash
npm run dev:web
```

Runs on: `http://localhost:5173`

### Socket Placeholder

```bash
npm run dev:socket
```

Runs on: `http://localhost:4001`
Health check: `GET /health`

## Implemented Auth Endpoints

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/users/me` (Bearer token)

## Quick Manual Test

1. Signup with email/password.
2. Login and capture `accessToken` and `refreshToken`.
3. Call `/api/users/me` with `Authorization: Bearer <accessToken>`.
4. Call `/api/auth/refresh` with `refreshToken`.
