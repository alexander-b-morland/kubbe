# Kubbe

Kubbe is a mobile-first web app for roommates to share bathroom and laundry time and keep a cleaning rotation.

## Reference project: read, never copy

`../../kubbe-knut/kubbe` (absolute: `C:\dev\kubbe-knut\kubbe`) is an older app built with a friend. It is **reference only**.

- Never copy code, styles, or assets from it into this repo.
- It may be read for ideas and flows. Anything taken from it is rewritten from scratch here.
- This repo is public. The old app contains names, a home address, and fallback secrets. None of that may appear here.

## What the app is

- A user creates an account. One person creates a household and gets a join code. Roommates join with the code. Everything happens inside a household, and no data crosses households.
- The person who creates the household is its admin. Admins configure the rules; members book and do chores.

### MVP

1. **Shower booking.** The admin sets the slot length. A user cannot book two slots back to back, and there is a per-day cap (default 3). Both rules are admin settings.
2. **Laundry booking.** Washer and dryer are separate bookable resources. The dryer is optional per household. Same rule engine as the shower, with its own settings.
3. **Cleaning schedule.** The admin adds rooms, how often each is cleaned, and a rough time estimate. Turns rotate between members.

### Later add-ons (per household, off by default, not in the MVP)

- Shared shopping list
- Dinner suggestions that roommates vote on, which generate a shopping list and assign who is responsible

## Stack

> Status: **proposed, awaiting approval.** Update this section once the stack is confirmed.

- Next.js (App Router) with TypeScript, deployed on Vercel
- Neon Postgres, connected through the Vercel Marketplace integration
- Drizzle ORM and SQL migrations
- Better Auth, storing users and sessions in the same Postgres database
- Tailwind CSS, with Motion for animation
- Zod for input validation
- Vitest for unit tests, Playwright for end-to-end tests

## Commands

> Nothing is scaffolded yet. Fill these in as they come to exist, and keep them current.

- Install: _tbd_
- Dev server: _tbd_
- Build: _tbd_
- Lint and typecheck: _tbd_
- Unit tests: _tbd_
- End-to-end tests: _tbd_
- Database migrate: _tbd_

## Rules that must hold

- **Tenancy.** Every query is scoped to the caller's household on the server. Never trust a household id sent by the client.
- **Booking rules live on the server.** Slot length, no back-to-back, and the daily cap are enforced in one module inside a transaction. The UI may mirror them for hints, but the server decides.
- **No double booking.** The database rejects overlapping bookings for the same resource with a constraint, as the last line of defence.
- **Time.** Store timestamps in UTC. Each household has a time zone, and all slot maths happens in that zone.
- **Secrets.** Never commit `.env` files, keys, or tokens. No fallback secrets in code: a missing secret is a startup error. Only `.env.example` with empty values is committed.

## Design

Mobile first: design every screen for a phone, then widen.

> Status: **direction proposed, awaiting approval.** Record the approved tokens here.

- Bold, modern, simple. It must not look like a template.
- Line-drawing animation (SVG strokes that draw themselves) is the signature. Use it in the logo, empty states, and confirmations only. Motion elsewhere stays minimal.
- Respect `prefers-reduced-motion`: show the finished drawing with no animation.

## Working agreements

- Small commits with clear messages, one concern each.
- Plan first for anything bigger than a small change, and get approval before writing app code.
- Sentence case in the UI. Write errors as what happened and what to do next.
