<p align="center">
  <img src="docs/logo.png" alt="Kubbe logo: a carved wooden hand holding a trout" width="200">
</p>

# Kubbe

Take back your shower time, your slot with the washing machine, and make your roommates clean up the common areas.

Kubbe is a small web app for people who share a home. You book the shower and the laundry in time slots, a cleaning rota goes round by itself, and the rest of flat life has a place too: dinners, a shopping list, expenses, things to do together and a noticeboard. It is built for phones, and it can be added to the home screen like an app.

**Live:** https://kubbe-zeta.vercel.app

![Four screens: the home dashboard, booking the shower, laundry with a dryer suggestion, and the cleaning rota](docs/screens.png)

## What it does

**Households.** You create an account, then start a household or join one. Whoever starts it is the admin and gets a six-character code and an invite link to share. Someone opening the link sees which household they are invited to before being asked for anything. Everything happens inside one household, and nothing is shared between households.

**Shower.** A household can have one shower or several. The day is cut into slots. You tap Book, and your time gets circled like on a paper sign-up sheet. You see who has which slot, and the headline tells you who is in there now or how long it is free.

**Laundry.** Washing machines and dryers are booked the same way, however many there are. The dryer is optional, since not every home has one. When you book a wash, Kubbe offers you the dryer slot that follows it.

**Fair by rule, not by argument.** The admin sets, for each of shower, washer and dryer:

- how long a slot is, and between which hours it can be booked
- how many slots one person may take in a day
- whether two slots in a row are allowed (off by default, so nobody camps in the bathroom)
- how many days ahead you can book

The server enforces all of it. If two people press Book on the same slot at the same moment, exactly one gets it and the other is told who did. A slot that cannot be booked says why, and what to do instead.

**Cleaning.** The admin adds rooms and chores (the bathroom, but also emptying the dishwasher or taking out the trash), how often each is due and roughly how long it takes. Turns rotate between roommates in the order they joined, and each room starts one person further along so nobody gets everything in the same week. You mark your turn done, take over someone else's, or hand one back. When someone moves in or out, the turns already under way stay with whoever has them, and the new rotation starts with the next round. A tally shows who has done how many turns in the last eight weeks, and an admin can deal the turns out again.

**Home.** Your own dashboard. "Yours to do" gathers everything with your name on it: cleaning turns, dinners you cook or clean up after, what you said you would buy, to-dos given to you, plans you have not answered and money you owe. Below it, the house right now: whether a shower is free and when your next slot is.

**Flat.** The fifth tab holds the rest. A household switches each part on or off.

- **Dinner.** Plan a dinner on a day, or pick fixed dinner days. Everyone is in unless they say they are out. Anyone suggests dishes with their ingredients and votes for what they would eat. Someone volunteers to cook, someone to clean up. Going with a dish puts what needs buying on the shopping list, and each ingredient is either "we have it" or taken by someone who will buy it.
- **Dinner ideas.** "Out of ideas?" suggests three dishes that fit who is coming and what they do not eat, and avoids what was cooked lately. With an Anthropic API key the ideas come from Claude; without one they come from a built-in cookbook, so nothing depends on the key.
- **Shopping.** One list for the flat. Say "I'll buy it", tick things off in the shop, then enter what you paid: it becomes an expense split between the people you choose.
- **Expenses.** Who paid for what, who owes whom, and a short list of payments that makes everyone square.
- **Happenings.** Suggest something to do together with a time and place. Roommates answer "I'm in" or "Can't make it".
- **Noticeboard.** A shared whiteboard. A note can be a to-do, for one person or for anyone, and is ticked off when done.
- **Profiles.** A drawn avatar, a bio, a few questions, and what you do not eat.

**Household.** Admins rename the household, set its time zone, add and remove showers and machines, replace the join code, make others admin and remove people who moved out (which also replaces the code, since they knew it). Everyone can change their name and colour, or leave. Anything that removes something asks first, and a household always keeps at least one admin.

## How it is built

| Part | Choice |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router), TypeScript, React 19 |
| Styling | Tailwind CSS 4, plain CSS for the drawing animations |
| Database | [Neon](https://neon.tech) Postgres, through the Vercel integration |
| Data access | [Drizzle ORM](https://orm.drizzle.team), SQL migrations in `drizzle/` |
| Accounts | [Better Auth](https://better-auth.com), email and password |
| Validation | Zod |
| Dinner ideas | [Claude](https://www.anthropic.com/claude) through the Anthropic SDK, optional |
| Tests | Vitest (rules, rota, money, dinners), Playwright (whole flows in a phone-sized browser) |
| Hosting | Vercel |

A few decisions worth knowing about:

- **Slots and cleaning turns are never stored.** They are worked out from each room's settings. Only what people do is stored: a booking, a turn marked done, a turn taken over. Changing a rule never leaves stale rows behind.
- **The database has the last word on double booking.** A Postgres exclusion constraint refuses two overlapping bookings of the same resource, whatever the application does.
- **Rules are plain functions.** `src/lib/booking/rules.ts` and `src/lib/cleaning/rota.ts` have no database or framework in them, which is what makes them easy to test, including on the days the clocks change.
- **The household comes from the session.** Every screen and action starts with `requireHousehold()`. Ids sent by the browser are looked up inside that household, so an id from another household finds nothing.
- **Times are stored in UTC and shown in the household's time zone.**
- **Guessing is slowed down.** Sign-in attempts, sign-ups and join-code tries are counted in the database and refused past a limit. After signing in, the only place the app will send you on to is an invite link.
- **The shopping list follows the dinner.** Every change to a dinner ends by making the list match it: what the chosen dish needs and nobody has at home is on the list, and nothing else from that dinner is. What is already bought stays.
- **Dinner ideas send as little as possible.** Claude is told how many are eating, what they wrote under "I don't eat" and the names of recent dishes. No names of people. Whatever comes back is cut to size and only becomes a dish when someone puts it to the vote.
- **Money is whole numbers.** Amounts are stored in the smallest unit and split so the parts always add up.
- **Changes to who lives where are atomic.** They lock the household first, so two people acting at once cannot, for example, both be the last admin to leave.

### Where things are

```
src/
  app/
    (auth)/          sign in, sign up
    onboarding/      create or join a household
    join/[code]/     the invite link
    (app)/           signed-in screens, with the tab bar
      home/          dashboard
      shower/        booking
      laundry/       booking, washer and dryer
      cleaning/      rota
      flat/          hub for everything below
      dinner/        dinners, and dinner/[id] for one dinner
      shopping/      the shopping list
      expenses/      who owes whom
      happenings/    things to do together
      board/         the noticeboard
      profile/       your own profile; people/[id] shows a roommate's
      settings/      the Household screen
  components/
    booking/         the booking screen and slot list shared by shower and laundry
    illustrations/   the room drawings
    logo/            the logo component and its generated data
    ui/              form controls and buttons
  db/                schema and connection
  lib/
    booking/         rules, service, server actions
    cleaning/        rota, service
    dinner/          plan (pure rules), service, ideas (Claude), cookbook (fallback)
    dashboard.ts     what goes in "Yours to do"
    money.ts         splitting, balances, settling up
    session.ts       who is asking, and which household they are in
    rate-limit.ts    counting attempts at things that can be guessed
design/logo/         the logo generator: the single source of the logo and app icons
drizzle/             SQL migrations
e2e/                 browser tests
```

## Running it yourself

You need Node.js 24 and a Postgres database. The easiest route is the one this project uses: a Vercel project with the Neon integration.

```bash
git clone https://github.com/alexander-b-morland/kubbe.git
cd kubbe
npm install
```

Create the environment files. `.env.example` lists what is needed.

```bash
npx vercel link
npx vercel env pull .env.local
```

Then put a secret for signing sessions in `.env.development.local` (this file is not overwritten when you pull again):

```bash
node -e "console.log('BETTER_AUTH_SECRET=' + require('crypto').randomBytes(32).toString('base64url') + '\nBETTER_AUTH_URL=http://localhost:3000')" > .env.development.local
```

Create the tables and start the app:

```bash
npm run db:migrate
npm run dev
```

Open http://localhost:3000.

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the app locally |
| `npm run build` | Build for production |
| `npm run lint` | Check code style |
| `npm run typecheck` | Check types |
| `npm test` | Unit tests for the booking rules, rota and helpers |
| `npm run test:e2e` | Browser tests of whole flows, at phone size |
| `npm run db:generate` | Write a migration after changing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:studio` | Browse the database |
| `node design/logo/generate.mjs --icons` | Rebuild the logo files and app icons |

The browser tests use the Edge that ships with Windows. They create accounts ending in `@kubbe.test` and delete them when they finish. They run against whichever database `.env.local` points at, so give local work its own Neon branch before real people depend on the data.

### Deploying

Push to `main` and Vercel builds it. The production environment needs `DATABASE_URL` (set by the Neon integration) and `BETTER_AUTH_SECRET`. `ANTHROPIC_API_KEY` is optional: with it, dinner ideas come from Claude. Run `npm run db:migrate` against the production database after a migration is added.

To run the browser tests against a deployed site instead of your machine, set `E2E_BASE_URL`, for example `E2E_BASE_URL=https://your-site.example npm run test:e2e`.

## How it was checked

- **Unit tests** cover the booking rules (the slot grid, the daily cap, two in a row, the booking horizon, both clock-change days), the cleaning rota, the status lines, splitting money and settling up, dinner days and the cookbook, the "Yours to do" list, join codes, colours and the redirect guard.
- **Browser tests** run whole stories at phone size with two or three people at once: signing up and joining by invite link, two roommates pressing Book on the same slot at the same moment, an admin changing the rules, washing then drying, the cleaning rota, removing someone, leaving, the noticeboard, shopping that turns into expenses, a happening, and a dinner from first idea to shopping list.
- **Two independent reviews**, one for security and correctness and one for the experience of using it, were done on the first version (booking and cleaning). Neither found a way for one household to see or change another's data. Most of what they did find is fixed; what is left is listed under "Not done yet".

## Design

The look is deliberate, and recorded in [CLAUDE.md](CLAUDE.md):

- **Colour means room.** Fjord blue is the shower, ochre is laundry, spruce green is cleaning. The colours are muted and taken from Norwegian house paint. Everything under Flat lives on paper with ink, each part with a drawing of its own.
- **Drawing is the signature.** The logo, the room illustrations, the circle around a booked time and the line through a finished chore are all pen strokes that draw themselves. People who prefer reduced motion see the finished drawing instead.
- **The logo** is the mascot of the flat this app was first made for: a carved wooden hand holding a trout. It is generated from `design/logo/generate.mjs`.
- **Type.** Times and headlines are set in Archivo, condensed and heavy. Everything else is Schibsted Grotesk.

## Not done yet

- **Google sign-in.** Needs credentials from a Google Cloud project.
- **Password reset and verified email addresses.** Both need the app to send email, which needs a domain. Until then a forgotten password cannot be recovered, which is why password fields have a Show button.
- **Reminders.** For example "your wash is done" or "your shower slot starts in ten minutes".
- **Repeating bookings.** For example the same shower slot every weekday.
- **A separate database for local work and tests.**
- **An admin cancelling someone else's booking,** for the roommate who booked and then left town.
- **Known limits.** Signing up tells you whether an email already has an account. Join codes are six characters and do not expire, though guessing them is rate limited and an admin can replace one at any time. Clock-change days are only verified for Europe/Oslo with the default opening hours.
- **Norwegian.** The interface is in English, with the text kept close to the screens so it can be translated.

## Background

Kubbe started as a house website that two friends built for their shared flat in Trondheim. This version is a new app written from scratch, for any shared home.

## License

[MIT](LICENSE)
