# ETEF Module 04 — Lightweight Backend & Database

This module adds a resource-conscious Node.js/Express/PostgreSQL backend foundation for the ETEF website.

## Requirements

- Node.js 18+
- PostgreSQL
- A shared host that supports a Node.js application (for production deployment)

## Local setup

```bash
cd server
npm install
```

Copy `.env.example` to `.env` and set your PostgreSQL connection string.

Create the database schema:

```bash
psql -U postgres -d etef_db -f database/schema.sql
```

Then run:

```bash
npm run dev
```

Health check:

`http://localhost:5000/api/v1/health`

## Shared-host design choices

- Small PostgreSQL pool (default maximum 5 connections)
- 1 MB JSON/request limit
- Stateless lightweight API foundation
- No Python/FastAPI
- No Redis, queues, workers, or SSR
- PostgreSQL indexes for common CMS/application queries
- No image processing pipeline in the API

## Important

This module is a backend foundation only. Authentication, authorization, production admin security, real CMS API endpoints, file-upload hardening, validation, rate limiting, audit logging, and deployment configuration are added in later modules.

Never commit `.env`, passwords, database credentials, private uploads, or production secrets.
