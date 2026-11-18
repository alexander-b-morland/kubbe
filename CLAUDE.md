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

Approved 2026-11-15.

- Next.js 16 (App Router, Turbopack) with TypeScript, deployed on Vercel
- Tailwind CSS 4
- Neon Postgres, connected through the Vercel Marketplace integration. The app uses the pooled WebSocket driver so it can run real transactions.
- Drizzle ORM. Schema in `src/db/schema.ts`, SQL migrations in `drizzle/`.
- Better Auth (email and password for now), storing users and sessions in the same database. Config in `src/lib/auth.ts`.
- Zod for input validation
- Anthropic SDK (`@anthropic-ai/sdk`) for dinner help from Claude: ideas for a dinner, and what a dish needs. The model is Claude Sonnet 5.5 (`claude-sonnet-5-5`), the owner's choice. Optional: without `ANTHROPIC_API_KEY` the answers come from a built-in cookbook.
- Vitest for unit tests (`src/**/*.test.ts`), Playwright for end-to-end tests (`e2e/`), driving the Edge that ships with Windows
- Animation is plain CSS so far. Motion is agreed for later if CSS is not enough; it is not installed.

Next.js 16 differs from older versions. Follow @AGENTS.md: read the matching guide in `node_modules/next/dist/docs/` before writing Next.js code.

## Commands

Package manager is npm. Keep this list current as scripts are added.

- Install: `npm install`
- Dev server: `npm run dev` (http://localhost:3000)
- Build: `npm run build`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Regenerate the logo: `node design/logo/generate.mjs` (add `--preview` for PNGs, `--icons` for the app icons)
- Unit tests: `npm test`
- End-to-end tests: `npm run test:e2e` (starts the dev server if it is not running)
- After changing `src/db/schema.ts`: `npm run db:generate`, review the SQL in `drizzle/`, then `npm run db:migrate`
- Browse the database: `npm run db:studio`
- Fetch database settings from Vercel: `npx vercel env pull .env.local` (the CLI then appends `.env*` to `.gitignore`, which would hide `.env.example`: undo that with `git checkout -- .gitignore`)

## Environment

- `.env.local` is written by `vercel env pull` and holds the database settings. It is overwritten on every pull.
- `.env.development.local` and `.env.production.local` hold the local auth secret. They survive a pull.
- `.env.example` lists every variable the app needs, with empty values. `src/lib/env.ts` checks them at startup.
- `ANTHROPIC_API_KEY` is the one optional variable. The owner adds it himself with `npx vercel env add ANTHROPIC_API_KEY`; it is never pasted into chat or committed.
- There is one database for local work, previews and production. End-to-end tests therefore run against it: they only create accounts ending in `@kubbe.test` and delete them afterwards. Move local work to its own Neon branch before real users arrive.

## Where things live

- `src/app`: screens. `(auth)` is sign in and sign up, `onboarding` is create or join, `join/[code]` is the invite link. `(app)` holds the signed-in screens, which share the navigation. Its four tabs are `home` (the dashboard), `calendar`, `settings` (shown as "Household", with `settings/rules` for the booking rules and `people/[id]` for a roommate) and `profile` (shown as "You"). The eight areas open from tiles on Home: `shower`, `laundry`, `cleaning`, `dinner` (and `dinner/[id]`), `shopping`, `expenses`, `happenings`, `board`.
- `src/lib/session.ts`: `requireUser()` and `requireHousehold()`. Every screen and action that touches household data starts with `requireHousehold()` and uses the household id it returns. It re-reads the membership from the database on every request.
- `src/lib/households.ts`, `src/lib/settings.ts`: creating, joining, listing, and what the Household screen changes. Database rules live here, not in the screens.
- `src/lib/booking`: `rules.ts` (pure rules), `service.ts` (database), `actions.ts` (server actions), `status.ts` ("Free until 07:30"), `defaults.ts`.
- `src/lib/cleaning`: `rota.ts` (pure rota maths), `service.ts` (database). Turns are computed, never stored; only "done" and "taken over" are stored.
- `src/components/booking`: `BookingScreen` and `SlotList`, shared by shower and laundry. A new bookable thing should reuse them.
- `src/components/ui`: `Field`, `SubmitButton`, `FormError`, `ActionButton`, `SavableForm` (a Save button only once something changed). Forms post to server actions and get errors back through `useActionState`.
- `src/lib/extras.ts`, `src/lib/extras-guard.ts`: the parts under Flat. Their screens and actions start with `requireExtra(key)`, which is `requireHousehold()` plus a check that the household has that part switched on.
- `src/lib/dinner`: `plan.ts` (pure rules), `service.ts` (database), `ideas.ts` (Claude, falling back to `cookbook.ts`).
- `src/lib/shopping.ts` (list and expenses), `src/lib/money.ts` (pure: split, balances, settle up), `src/lib/board.ts`, `src/lib/happenings.ts`, `src/lib/profile.ts`.
- `src/lib/dashboard.ts`: `buildToDos`, the pure function behind "Yours to do" on Home. A new part of the app that gives people something to do adds its lines there.
- `src/lib/areas.ts`: the eight areas, each with its name, address, drawing and colour. Anything that lists or colours areas reads from here.
- `src/components/area/area-header.tsx`: `AreaPage` and `AreaHeader`, the coloured band at the top of every area's screen, and `BackLink`, the way back that every screen below a tab starts with.
- `src/components/app-nav.tsx`: the navigation, a bar at the bottom on a phone and a column on the left from `lg` up.
- `src/lib/calendar.ts` (pure: what each day holds, month sheets), `src/lib/calendar-service.ts` (loads a stretch of days), `src/components/calendar/agenda.tsx` (`AgendaItem`, and `AnswerButtons` for "I'm in" and "Can't").
- `src/components/avatar`: the drawn avatars, and `Person` and `Faces` for showing who something belongs to. `src/components/board/sticky.tsx`: a note on the whiteboard. `src/components/ui/strike.tsx`: `Struck`, the pen line through something done.
- `design/logo/generate.mjs`: source of the logo, the logo data file and the app icons.

## Rules that must hold

- **Tenancy.** Every query is scoped to the caller's household on the server. Never trust a household id sent by the client.
- **Booking rules live on the server.** Slot length, no back-to-back, and the daily cap are enforced in one module inside a transaction. The UI may mirror them for hints, but the server decides.
- **No double booking.** The database rejects overlapping bookings for the same resource with a constraint, as the last line of defence.
- **Time.** Store timestamps in UTC. Each household has a time zone, and all slot maths happens in that zone.
- **Secrets.** Never commit `.env` files, keys, or tokens. No fallback secrets in code: a missing secret is a startup error. Only `.env.example` with empty values is committed.
- **Who lives where changes under a lock.** Joining, leaving, removing someone and changing a role each start with `lockHousehold(tx, id)` inside one transaction. Without it, two people pressing at once can both pass a check only one should (the last two admins both leaving).
- **Removing someone replaces the join code.** They know the old one.
- **Cleaning turns under way do not move.** Before anything that shifts the rotation (someone joins or leaves, a room is removed), call `pinCurrentTurns(tx, householdId, today)` in the same transaction.
- **An action applies to what was on screen.** Cleaning actions carry the period the person was looking at and do nothing if a new one has started. Booking actions carry the exact slot start.
- **Guessable things are rate limited.** Sign-in, sign-up, join attempts and invite-link lookups go through `allowAttempt` in `src/lib/rate-limit.ts`. The limits are active in production only.
- **Redirects after signing in go through `safeNextPath`,** which accepts only an invite link. Never redirect to a path taken from the URL any other way.
- **There is no public auth route.** All sign-in and sign-up goes through server actions, which validate and rate limit. Google sign-in will need `/api/auth` back: when adding it, also add name validation in the auth library's database hooks and database-backed rate limiting there.
- **The shopping list follows the dinner.** Every change to a dinner, its dishes or ingredients ends with `syncShopping` in the same transaction. Do not insert or delete a dinner's shopping items anywhere else.
- **Nobody is in for a dinner until they say so.** Whoever plans one chooses whether they are in themselves; everyone else answers (`dinner_reply`). Cooking or cleaning up makes you in; saying no releases both.
- **Dinner ideas never send names.** `ideas.ts` gets a head count, the "I don't eat" texts and dish names. What comes back is cut to size and shown; it is stored only when someone puts it to the vote. Asking is rate limited per person, per household and for the whole app, and `max_tokens` is kept low, because each answer costs money.
- **Paying back applies to what was on screen.** `addSettlement` locks the household, works the balances out again and records the payment only while that much is still owed between those two. Do not add a way to record a repayment that skips it.
- **Ticks and claims belong to whoever made them.** `setBought` and `setClaim` never overwrite another person's tick or claim.
- **Someone who leaves is released.** `removeMember` calls `releaseDinnerDuties` so they no longer cook, clean up or hold a shopping claim.
- **Server actions validate every argument,** including ones bound on the server such as a member id or a role. They arrive from the browser like any other input.

## Design

Mobile first: design every screen for a phone, then widen.

Approved 2026-11-15, except the logo, which is still being drawn. Reworked 2026-11-18 after the owner found the app bland and hard to find his way in: every area has a colour now, and Home holds everything. Tokens live in `src/app/globals.css`.

**Colour means area.** Muted colours taken from painted wooden houses. Bright, saturated or neon colours were rejected as AI-looking; do not drift back to them. But colourless is wrong too: the owner asked for more colour, and for the extras to have colours and drawings like the rooms.

| Token | Hex | Use |
|---|---|---|
| `paper` | `#F5F4EF` | Background |
| `ink` | `#1E2A44` | Text and drawn lines (never pure black) |
| `ink-soft` | `#6B7385` | Secondary text |
| `fjord` | `#2E5270` | Shower |
| `ochre` | `#D2A24C` | Laundry |
| `spruce` | `#476B52` | Cleaning |
| `barn` | `#A6402F` | Happening right now, warnings |
| `salmon` | `#E3A583` | Dinner |
| `sage` | `#A9C4A2` | Shopping |
| `heather` | `#B8A9D4` | Expenses |
| `blush` | `#E2A5B8` | Happenings, and a to-do on the whiteboard |
| `sky` | `#A3C6DA` | Noticeboard |
| `note` | `#F1DF9A` | A note on the whiteboard |

On `fjord` and `spruce` use `paper` for text and lines; on every other area colour use `ink`. Inside an area, panels use a wash of its colour (`bg-salmon/30`). The classes for each area come from `src/lib/areas.ts`.

**Finding your way.** Decided 2026-11-18, replacing the five tabs the owner said made no sense.

- Four tabs: Home, Calendar, Household, You. Shower, laundry and cleaning are not tabs: they are areas like dinner and shopping, and all eight are tiles on Home.
- Every screen below a tab starts with `BackLink`, top left, saying where it leads. The owner got stuck on screens without one.
- Home is the one dashboard: what is yours to do (with the answer buttons for invitations right there), money both ways, a tile per area saying what matters now, the week ahead, and the notes on the board.
- What an admin can change is reachable from where it is used: "Change the rules" on the shower and laundry screens.
- From `lg` up the navigation is a column on the left, Home and Calendar use two columns, and other screens widen to `max-w-3xl`.
- People show as their drawn avatar on their colour wherever something is theirs: who is in, who cooks, who is buying, whose note.

**Type.** Times and headlines use the `type-display` utility (Archivo, condensed, weight 800). Everything else is Schibsted Grotesk.

**Drawing.** Illustrations are hand-drawn line art with round caps and slightly uneven strokes, one per room (shower head, washing machine, broom), and they draw themselves once when they appear.

The three room drawings are the `RoomArt` component (`src/components/illustrations/room-art.tsx`). Lines use the current text colour.

**Booking a slot** looks like signing a paper sheet: tapping a free slot draws a pen circle around the time, then a squiggle under your name. Cancelling runs it backwards.

**Free slots must look tappable.** A free slot shows a filled `ink` "Book" button. That is enough: no dotted or dashed outline around the time before booking (tried and rejected). The pen circle appears only when the slot is booked. Never rely on the word "Free" alone.

**Logo.** The house mascot: a carved wooden hand holding a trout. It must read clearly as a wooden hand and feel real and three-dimensional, not stiff or flat. Two earlier attempts built from simple geometric blocks were rejected for exactly that.

- Approved 2026-11-15. It is an ink line drawing with overlapping forms, hatching on shadow faces, fingernails, wood tones on the hand and fjord tones on the fish. It draws itself stroke by stroke, then the colour fades in.
- Source of truth is `design/logo/generate.mjs`. It writes the SVGs in `design/logo/` and the data file `src/components/logo/logo-data.ts`. Never edit the data file by hand. Use the `KubbeLogo` component in the app.
- Every detail line (hatching, grain, fin rays, spots) is clipped to the shape it belongs to, and hatching also to the single face it shades. Lines that spill over an edge or into a neighbouring face were the one thing rejected in the approved draft; keep it that way when adding detail.
- Proportions were traced by eye from a photo of the real carving. The photo itself stays out of this repo.
- A simplified cut is still needed for sizes under about 64 px.

**Check drawings by looking at them.** Never present an illustration or a screen without rendering it and viewing the result first. Render SVG to PNG (for example with `sharp`), and screenshot real pages and animation frames with headless Edge: `msedge --headless=new --window-size=500,900 --virtual-time-budget=<ms> --screenshot=<file> <url>` (Edge will not go narrower than about 500 px).

**Screens that read the session.** Cache Components is on, so anything that reads cookies must sit inside a Suspense boundary (the root layout has one). Each such page also sets `export const instant = false`, which tells Next.js the page is allowed to wait for the server. Without it the dev server reports an error on every load.

**Do not stack conflicting Tailwind classes.** `text-lg text-3xl` does not resolve to the last one; the order in the built CSS decides, and it put `text-lg` last. Give a component a named look to choose between instead (see `Field`).

**The previous screen stays in the page, hidden.** Next.js keeps the screen you navigated from mounted but hidden. Tests must therefore look only at visible elements (`.filter({ visible: true })`), and wait for a navigation to really finish (for example the day link getting `aria-current`) before pressing anything on the new screen.

**Never swap a button's type in place.** A button that turns from "ask" into "confirm" must be two elements with different `key`s. Reusing one element makes the first press also submit the form. See `ActionButton`.

**Forms after saving.** The browser resets a form to its old defaults after a server action, and selects and checkboxes do not pick up new ones. Give the form a `key` made of the saved values.

**Screenshots.** The browser tests save phone-sized screenshots of every screen to `test-shots/` (ignored by git). Look at them after changing a screen.

**People have their own colours.** `MEMBER_COLOURS` never contains an area colour or `barn`, so a dot beside a name never reads as an area. People's colours are deep, the newer area colours are light. Every one of them carries paper-coloured text at readable contrast; a unit test checks both.

**Contrast and focus.** Secondary text is `ink-soft` (#586072), chosen to pass 4.5:1 on paper and on the tinted rows. Focus rings are solid `ring-fjord` (or `ring-ink` on a coloured band), never a faint tint.

**Wording that is settled.** "Two in a row" (not "back to back"). Slot lengths through `describeSlotLength`: "20-minute slots", "2-hour slots". A blocked slot says "Leave a gap next to your slot". Buttons that save say "Save". The sentence on the front page is the owner's own wording: do not rewrite it.

**Confirming.** Anything that removes or replaces goes through `ActionButton` with `confirm` worded as what will happen ("Remove Knut and cancel their bookings?"). It shows a "Keep as it is" button beside the question.

**No CSS Modules.** The Tailwind rule in `next.config.ts` treats every `.css` file as global, so `*.module.css` imports come back empty and the styles silently do not apply. Use Tailwind utilities, or a plain `.css` file with prefixed class names (see `src/components/logo/kubbe-logo.css`).

**Stroke-drawing gotcha.** A path with round caps that is fully dashed out still shows a dot at its start. Keep each stroke invisible (`stroke-opacity: 0`) until its own animation begins.

Standing brief:

- Bold, modern, simple. It must not look like a template.
- Line-drawing animation (SVG strokes that draw themselves) is the signature. Use it in the logo, empty states, and confirmations only. Motion elsewhere stays minimal.
- Respect `prefers-reduced-motion`: show the finished drawing with no animation.

## Working agreements

- Small commits with clear messages, one concern each.
- Plan first for anything bigger than a small change, and get approval before writing app code.
- Sentence case in the UI. Write errors as what happened and what to do next.

## Second round of features (agreed 2026-11-16)

The owner asked for these after the MVP. Tick each off here as it ships; the answers below are his.

- [x] **Several showers, washers and dryers.** An admin adds and removes them; booking screens get a switcher.
- [x] **Navigation.** Tabs become Home, Shower, Laundry, Cleaning, Flat. "Flat" is a hub for everything else (dinner, happenings, shopping, expenses, noticeboard, people and settings).
- [x] **Noticeboard**, "like a virtual whiteboard": anyone writes a note. A note can also be a to-do, assigned to a person or to nobody, and ticked off.
- [x] **Shopping list** for the flat. Dinner ingredients that need buying land here.
- [x] **Expenses**, only if the link to shopping is truly logical: tick off what you bought, enter what you paid, and it becomes an expense split between people. Balances show who owes whom. Drop it rather than ship something confusing.
- [x] **Happenings.** Suggest something social with a time and place; roommates answer "I'm in" or not. Idea from the older project's calendar.
- [x] **Dinners.** Common dinners on fixed weekdays and one-off dates, with the roommates taking part. The dish is chosen by **suggest and vote**. Cooking is **volunteered each time**, not rotated. Each ingredient is either "we have it" or claimed by someone who will buy it. Someone can also volunteer to clean up after.
- [x] **AI dinner ideas with Claude.** Needs `ANTHROPIC_API_KEY`, which the owner adds himself. Without the key the app falls back to a built-in list of dishes, so nothing depends on it.
- [x] **Profiles.** A drawn avatar picked from a set (no photo upload, it fits the drawing style and needs no file storage), a bio, a few fun questions, and what the person does not eat (used for dinner ideas). Roommates can view each other's profile.
- [x] **Personal dashboard.** Home shows what you, specifically, need to do: your bookings, cleaning turns, dinner duties, to-dos assigned to you, unanswered happenings, money owed.
- [x] **Cleaning covers chores, not only rooms** (emptying the dishwasher, taking out the trash). The rota already allows any name and a daily rhythm; the wording and suggestions should say so.

Already true: several admins are possible ("Make admin" under Household).

Design for all of it: simple, animated, drawn. New areas get a drawing of their own and reuse the pen strokes (tick, strike, circle). They were first built on paper with ink only; the owner found that bland, and each has its own colour since 2026-11-18.

## Third round (the owner's feedback of 2026-11-18)

He tested the second round and sent one long message. Tick each off as it ships.

- [x] **Colour everywhere**, with the drawings, for the extras too.
- [x] **Navigation that makes sense**, and a way back from every screen.
- [x] **One dashboard** with everything: to-dos, invitations to answer, the board's notes, money owed both ways.
- [x] **A shared calendar** with people and their colours and who is in charge, as in the older project.
- [x] **Dinner:** only whoever plans it is in, with a toggle. Suggestions for what a dish needs as it is typed. Clear about whether a dish is decided. Avatars on it.
- [x] **Shopping:** who is buying each thing, shown with their avatar; the pen line through all of what was bought.
- [x] **Expenses:** uneven splits, and changing an expense.
- [x] **Noticeboard as a whiteboard,** with its notes on Home.
- [x] **Profiles that are fun to read.**
- [x] **Booking rules:** easy to find, a new shower or machine copies the settings of the one there is.
- [x] **Cleaning:** pick the day a rota starts.
- [x] **Wide screens** use the space.
- [x] **Claude Sonnet 5.5** as the model. His limits stand: 20 a day per person, 40 per household, 300 for the app.
- [ ] **Ten test roommates** in two flats of five, as sub-agents on Claude Opus 5.5, using the app and reporting through their two admins. Then fix everything they find.
- [ ] **Norwegian:** one switch for the whole app, and Claude's ideas in Norwegian too.
- [ ] **Reminders.** He asked how; web push needs no domain. Not built yet.

## Open items

Agreed or suggested, not done yet. Remove each when it ships.

Needs the owner:

- `ANTHROPIC_API_KEY` is in Vercel for Production since 2026-11-18. It is not set for Development, so locally the cookbook answers; check Claude on the live site.
- Google sign-in. He wants to be walked through the Google Cloud setup step by step. Before turning it on, check how the auth library links a Google login to an existing password account whose email was never verified.
- A domain, then email sending. Password reset and verified addresses depend on it. Until then a forgotten password cannot be recovered, and sign-up tells you whether an email already has an account.
- A separate Neon branch for local work and tests. The browser tests run against the live database. The database is in US East while the users are in Norway; an EU region would also make local work much faster.

Can be built any time:

- Reminders (web push), repeating bookings, Norwegian.
- A security and correctness review of the extras was done 2026-11-16 and its findings fixed, except one:
  - Deleting a user account would cascade away the expenses they paid and unbalance the books. No screen deletes accounts yet: change those foreign keys to `restrict` before adding one.
- Dinners: a different time per fixed day (the table allows it, the form sets one time for all), removing a single ingredient, and a note on a dinner ("bring a friend").
- The `dinner_absence` table is no longer used; drop it in a later migration.
- "I'll buy everything left" on a dinner, for whoever does the whole shop.
- An admin cancelling someone else's booking, for the roommate who booked and left town.
- Telling a removed person why they landed on the start screen (leaving on your own already says so).
- A squiggle under "You" on a booked slot, from the first design sketch.
- Longer or expiring join codes, and a content security policy beyond `frame-ancestors`.
- Refusing duplicate room names. Keeping the eight-week cleaning tally when a room's rhythm changes.
- Clock-change days are only verified for Europe/Oslo with the default hours. Zones that change at midnight, and households open before 03:00, have known rough edges on those two days.

Live site: https://kubbe-zeta.vercel.app
