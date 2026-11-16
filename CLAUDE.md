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

Approved 2026-11-15. Items marked "not installed yet" are agreed but have not been added.

- Next.js 16 (App Router, Turbopack) with TypeScript, deployed on Vercel
- Tailwind CSS 4
- Neon Postgres, connected through the Vercel Marketplace integration (not installed yet)
- Drizzle ORM and SQL migrations (not installed yet)
- Better Auth, storing users and sessions in the same Postgres database (not installed yet)
- Motion for animation (not installed yet)
- Zod for input validation (not installed yet)
- Vitest for unit tests, Playwright for end-to-end tests (not installed yet)

Next.js 16 differs from older versions. Follow @AGENTS.md: read the matching guide in `node_modules/next/dist/docs/` before writing Next.js code.

## Commands

Package manager is npm. Keep this list current as scripts are added.

- Install: `npm install`
- Dev server: `npm run dev` (http://localhost:3000)
- Build: `npm run build`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Unit tests: _not set up yet_
- End-to-end tests: _not set up yet_
- Database migrate: _not set up yet_

## Rules that must hold

- **Tenancy.** Every query is scoped to the caller's household on the server. Never trust a household id sent by the client.
- **Booking rules live on the server.** Slot length, no back-to-back, and the daily cap are enforced in one module inside a transaction. The UI may mirror them for hints, but the server decides.
- **No double booking.** The database rejects overlapping bookings for the same resource with a constraint, as the last line of defence.
- **Time.** Store timestamps in UTC. Each household has a time zone, and all slot maths happens in that zone.
- **Secrets.** Never commit `.env` files, keys, or tokens. No fallback secrets in code: a missing secret is a startup error. Only `.env.example` with empty values is committed.

## Design

Mobile first: design every screen for a phone, then widen.

Approved 2026-11-15, except the logo, which is still being drawn. Tokens live in `src/app/globals.css`.

**Colour means room.** Muted colours taken from Norwegian house paint. Bright, saturated or neon colours were rejected as AI-looking; do not drift back to them.

| Token | Hex | Use |
|---|---|---|
| `paper` | `#F5F4EF` | Background |
| `ink` | `#1E2A44` | Text and drawn lines (never pure black) |
| `ink-soft` | `#6B7385` | Secondary text |
| `fjord` | `#2E5270` | Shower |
| `ochre` | `#D2A24C` | Laundry |
| `spruce` | `#476B52` | Cleaning |
| `barn` | `#A6402F` | Happening right now, warnings |

On `fjord` and `spruce` use `paper` for text and lines; on `ochre` use `ink`.

**Type.** Times and headlines use the `type-display` utility (Archivo, condensed, weight 800). Everything else is Schibsted Grotesk.

**Drawing.** Illustrations are hand-drawn line art with round caps and slightly uneven strokes, one per room (shower head, washing machine, broom), and they draw themselves once when they appear.

**Booking a slot** looks like signing a paper sheet: tapping a free slot draws a pen circle around the time, then a squiggle under your name. Cancelling runs it backwards.

**Free slots must look tappable.** A free slot shows a filled `ink` "Book" button. That is enough: no dotted or dashed outline around the time before booking (tried and rejected). The pen circle appears only when the slot is booked. Never rely on the word "Free" alone.

**Logo.** The house mascot: a carved wooden hand holding a trout. It must read clearly as a wooden hand and feel real and three-dimensional, not stiff or flat. Two earlier attempts built from simple geometric blocks were rejected for exactly that.

- Current draft (awaiting approval) is in `design/logo-draft/`. It is an ink line drawing with overlapping forms, hatching on shadow faces, fingernails, wood tones on the hand and fjord tones on the fish. It draws itself stroke by stroke, then the colour fades in.
- Proportions were traced by eye from a photo of the real carving. The photo itself stays out of this repo.
- A simplified cut is still needed for sizes under about 64 px.

**Check drawings by looking at them.** Never present an illustration without rendering it and viewing the result first. Render SVG to PNG (for example with `sharp`) and capture animation frames with a headless browser.

**Stroke-drawing gotcha.** A path with round caps that is fully dashed out still shows a dot at its start. Keep each stroke invisible (`stroke-opacity: 0`) until its own animation begins.

Standing brief:

- Bold, modern, simple. It must not look like a template.
- Line-drawing animation (SVG strokes that draw themselves) is the signature. Use it in the logo, empty states, and confirmations only. Motion elsewhere stays minimal.
- Respect `prefers-reduced-motion`: show the finished drawing with no animation.

## Working agreements

- Small commits with clear messages, one concern each.
- Plan first for anything bigger than a small change, and get approval before writing app code.
- Sentence case in the UI. Write errors as what happened and what to do next.
