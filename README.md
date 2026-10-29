# Registry Website

A private, Danish-language page for one specific event.

- **Site**: static files in `public/`, published to GitHub Pages.
- **Access**: invite codes checked in Postgres. Codes are never in this repo.
- **Data**: RSVP and "what I bring" live in Supabase, gated by RLS.

The repo is public on purpose. Nothing secret is in it: the only credential
shipped to the browser is the Supabase **publishable** key, which is designed to
be public and is constrained by Row Level Security.

## Pages

| File | What it is |
| --- | --- |
| `public/index.html` | Login — enter the code from the invitation |
| `public/hjem.html` | Landing page: banner, headline, intro, 3 buttons |
| `public/kommer.html` | "Vi kommer": RSVP + what guests bring |
| `public/info.html` | Address, contact, practical info, address image |
| `public/pjat.html` | Silly stuff (placeholder) |

All copy is Danish. Column names in the database are English.

## How access works

1. The browser signs in anonymously, getting a session but no data.
2. `redeem_invite(code)` hashes the code and compares it to `invites.code_hash`.
   On a match it creates a `members` row carrying the guest's name, so nobody
   types a name and nobody picks their own identity.
3. Every table is behind RLS that requires a `members` row for `auth.uid()`.

## Data model

| Table | Purpose |
| --- | --- |
| `invites` | Code hashes + the guest name each code belongs to |
| `members` | One row per browser that redeemed a code |
| `rsvp` | Attendance (`attending`), `adults`, `children`, ticked `categories` |
| `bring_items` | Shared list of what people bring, owned row by row |
| `event_info` | Single row: all page text, address, contact, image path |
| `redeem_attempts` | Failed guesses, for the lockout |

`bring_items` is **shared**: every member reads every row, but the delete policy
only matches `user_id = auth.uid()`, so guests can only remove their own.

## Setup (one time)

1. **Database** — Supabase → SQL Editor → paste `supabase/schema.sql` → Run.
2. **Anonymous sign-ins** — Authentication → Sign In / Providers → enable
   **Allow anonymous sign-ins**.
3. **Keys** — project URL + publishable key into `public/config.js`.
4. **Publishing** — Settings → Pages → Source: **GitHub Actions**.

## Invite codes

```sql
select public.create_invite('Mikkel');
```

Prints a code like `K7QM-2X9T` once; only the hash is stored. Codes are 8
characters from a 32-character alphabet (`2-9`, `A-Z` without `I` and `O`),
case-insensitive, dashes optional. A batch:

```sql
select t.name, c.code
from (values ('Mikkel'), ('Anna'), ('Bo')) as t(name)
cross join lateral (select public.create_invite(t.name) as code) c;
```

Revoke a code: `update public.invites set revoked = true where label = 'Mikkel';`

## Adding the private details later

Everything is a single row, so one query updates the whole site:

```sql
update public.event_info
set address = 'Vejnavn 12, 1234 By',
    contact = 'Ring på 12 34 56 78',
    info_body = 'Festen starter kl. 18. Vi spiser kl. 19.30.'
where id = 1;
```

The headline and intro on the landing page are `title` and `body`.

### The address image

Do **not** commit an image showing the address to this repo — the repo is public
and the file would be readable by anyone. Put it in a **private** Supabase
Storage bucket named `privat`, then point at it:

```sql
update public.event_info set image_path = 'adresse.png' where id = 1;
```

The page requests a short-lived signed URL for members. Until a path is set, a
neutral placeholder is shown. (The bucket and its member-only read policy still
need to be created in the dashboard.)

## Local preview

```powershell
python -m http.server 8000 --directory public
```

## Known limits

- A code can be shared, and it signs in as whoever it was issued to.
- Codes are ~40 bits, safe because failed attempts are counted server-side:
  8 wrong guesses in 10 minutes locks that session for 15 minutes.
- There is no admin UI; invites and text are edited in the Supabase dashboard.
- `comments` / `comments_with_author` are leftovers from an earlier iteration and
  are no longer used by any page.
