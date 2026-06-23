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

## Real Email Delivery

Local development defaults to `EMAIL_PROVIDER="console"`, which keeps verification and reset links in terminal logs and `/auth/dev-emails`.

To send to the user's real email inbox, configure SMTP in `backend/.env` and restart the backend:

```env
EMAIL_PROVIDER="smtp"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER="your-gmail-address@gmail.com"
SMTP_PASS="your-16-character-google-app-password"
SMTP_FROM="your-gmail-address@gmail.com"
FRONTEND_URL="http://localhost:5173"
```

For Gmail, `SMTP_PASS` must be an App Password, not your normal Google password. The verification email is sent to the email address entered during registration.

For local demos without email delivery, you can return the password reset link directly in the app:

```env
DEV_INLINE_PASSWORD_RESET_LINK=true
```

This mode only works outside production and should not be enabled for deployed environments.

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

Wallet linking uses Freighter message signing. `wallets.service.ts` verifies the nonce-bound message with Stellar SDK `Keypair.fromPublicKey(...).verify(...)` before marking a wallet as verified.
