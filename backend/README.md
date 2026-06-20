# BugChain Backend

NestJS backend for BugChain, a hybrid Web2/Web3 bug bounty platform. This service provides the Web2 foundation for users, JWT authentication, wallet linking, bounty management, report review, and placeholder transaction records for future Stellar/Soroban integration.

## Stack

- Node.js + TypeScript + NestJS
- PostgreSQL + Prisma ORM
- JWT authentication
- bcrypt password hashing
- class-validator DTO validation

## Setup

```bash
cd backend
npm install
cp .env.example .env
```

Update `.env` with your PostgreSQL connection string and a strong `JWT_SECRET`.

## Database

```bash
npm run prisma:generate
npm run prisma:migrate -- --name init
```

Open Prisma Studio when needed:

```bash
npm run prisma:studio
```

## Development

```bash
npm run start:dev
```

The API listens on `PORT` from `.env`, defaulting to `3000`.

## Build

```bash
npm run build
```

Run `npm run prisma:generate` after schema changes, then compile the NestJS app with `npm run build`.

## API Overview

- `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- `GET /users/me`, `PATCH /users/me`
- `POST /wallets/nonce`, `POST /wallets/link`, `GET /wallets/me`, `DELETE /wallets/:id`
- `POST /bounties`, `GET /bounties`, `GET /bounties/:id`, `PATCH /bounties/:id`, `DELETE /bounties/:id`
- `POST /bounties/:bountyId/reports`, `GET /bounties/:bountyId/reports`, `GET /reports/:id`, `PATCH /reports/:id`
- `POST /reports/:id/approve`, `POST /reports/:id/reject`
- `GET /transactions/me`, `GET /transactions/bounty/:bountyId`

Use `Authorization: Bearer <token>` for authenticated routes.

## Wallet Linking

Wallet signature verification is intentionally stubbed in `wallets.service.ts`. Replace the TODO implementation with Stellar/Freighter verification before production use.
