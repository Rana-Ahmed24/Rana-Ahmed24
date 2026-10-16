# A-Z Home Expenses

A simple household expense tracker in English, using EGP and Africa/Cairo dates.

## Pages

- View expenses: `/?mode=view` — choose a month and day to see the day's itemized expenses and total.
- Enter expenses: `/?mode=entry` — enter a date, item, price, category, and optional note.
- Home: `/` — choose either page.

The page links select which interface opens. The app has no sign-in or account permissions; anyone who can open the website can also open either page and the public API endpoints.

## Production

Production address: [expenses-gamma-seven.vercel.app](https://expenses-gamma-seven.vercel.app/).

Vercel project `expenses` in the `shipp1` team serves the production address above. Its dedicated Supabase project is `expenses` (`zmilfhtgmpvxxpueynlc`). Migration `20261016180835_create_family_expenses` is already applied; do not replay it. See `VERIFICATION.md` for release evidence.

## Local preview

```powershell
npm ci
npm run preview:local
```

Open the address saved in `.private/local-preview-link.txt`. The preview uses PGlite behind a local PostgREST contract harness with sample records persisted under `.private/preview-db/`.

## Server configuration

Copy `.env.example` to `.env.local` and set:

| Variable              | Purpose                                       |
| --------------------- | --------------------------------------------- |
| `SUPABASE_URL`        | Dedicated project's API URL                   |
| `SUPABASE_SECRET_KEY` | Server-only secret or legacy service-role key |

For a fresh database, review and apply the migration once to the intended dedicated project. Run `npm run dev` and open the normal localhost URL.

Configure the same two variables on Vercel and deploy with Next.js and Node 24. Never commit or upload `.env.local` or `.private/`. Never expose the database key through a `NEXT_PUBLIC_` variable.

## API and data

The website's expense and CSV endpoints are open without authentication. Mutations require a matching Origin, JSON bodies capped at 8 KiB, and validated input. Direct Supabase access remains blocked for the public `anon` and `authenticated` roles through RLS and revoked grants. Only the server uses the privileged database key.

| Endpoint                          | Behavior                                        |
| --------------------------------- | ----------------------------------------------- |
| `GET /api/expenses?month=YYYY-MM` | Month snapshot and totals                       |
| `POST /api/expenses`              | Create an expense using a client-generated UUID |
| `GET /api/expenses/:id`           | Latest saved expense                            |
| `PATCH /api/expenses/:id`         | Update if revision matches                      |
| `DELETE /api/expenses/:id`        | Delete if revision matches                      |
| `GET /api/export[?month=YYYY-MM]` | Monthly or all-history CSV                      |

Saving requires internet access. Income, balances, transfers, receipt uploads, and automatic reports are outside this version.
