## IntellMeet – AI-Powered Enterprise Meeting & Collaboration Platform

IntellMeet is a full-stack MERN application designed to improve communication and productivity in remote and hybrid teams. The platform combines real-time meetings, collaboration tools, and AI-powered meeting intelligence into a single system.

The main goal of the project is to make meetings more organized, interactive, and actionable instead of just conversations that get forgotten later.

## Features

* Secure JWT Authentication
* Real-Time Chat using Socket.io
* Meeting Room Management
* WebRTC-based Video Communication
* Team Collaboration Dashboard
* Meeting History & Participant Management
* AI Summary & Action Item Architecture (planned)

## Tech Stack

### Frontend

* React
* Vite
* Tailwind CSS

### Backend

* Node.js
* Express.js
* MongoDB

### Real-Time & Security

* Socket.io
* WebRTC
* JWT Authentication
* bcrypt

### DevOps

* Docker
* GitHub Actions
* Redis

## How It Works

Users can create accounts, join meetings, communicate in real time, and collaborate through a centralized platform. Socket.io handles instant updates and chat functionality, while WebRTC is used for browser-based video communication. MongoDB stores user and meeting data securely.

The architecture is designed to be scalable, modular, and production-ready with support for future AI integrations such as meeting transcription, summaries, and action-item extraction.

## Learning Outcomes

This project helped us gain practical experience in:

* Full-stack MERN development
* Real-time communication systems
* Authentication & authorization
* API development
* WebRTC fundamentals
* Team collaboration workflows
* Scalable backend architecture

## Team
 * Jaimin
 * Praneetha
 * Nishanthini
 * Muthupetchi
 

 ## Setup

Install dependencies:

```bash
npm install
```

Start the API and socket services together:

```bash
npm run dev
```

Or start them in separate terminals:

```bash
npm run dev:api
npm run dev:socket
```

Run the smoke checks:

```bash
npm run smoke:api
npm run smoke:socket
npm run smoke:messages
```

Optional local services:

```bash
docker compose up -d mongo redis
```

