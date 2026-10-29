# Registry Website

A small private event page for friends.

- **Site**: static files in `public/`, published to GitHub Pages.
- **Access**: invite codes, verified in Postgres. The codes are never in this repo.
- **Comments**: stored in Supabase, readable only by people who redeemed a code.

The repo is safe to be public: the only credential that ships to the browser is
the Supabase **anon** key, which is designed to be public and is constrained by
Row Level Security.

## How it works

1. The browser signs in anonymously with Supabase, getting a session but no data.
2. The user types an invite code. `redeem_invite()` hashes it and compares against
   `invites.code_hash` (SHA-256). Each invite carries the guest's name, so a
   match creates a `members` row that is already identified — no name to type.
3. Every table is protected by RLS policies that require a `members` row for
   `auth.uid()`. Without one you can read nothing — not the event, not comments.

## Setup (one time)

### 1. Database

Supabase → **SQL Editor** → paste `supabase/schema.sql` → **Run**.

### 2. Anonymous sign-ins

Supabase → **Authentication** → **Sign In / Providers** → enable
**Allow anonymous sign-ins**.

### 3. Invite codes

One call per person, with their name:

```sql
select public.create_invite('Mikkel');
```

It prints a code like `K7QM-2X9T` **once**. Only the hash is stored, so write it
down — it cannot be recovered. The name passed here is what guests will post
under; they never type a name themselves.

To print a whole sheet for mailing, generate a batch in one go:

```sql
select t.name, c.code
from (values ('Mikkel'), ('Anna'), ('Bo')) as t(name)
cross join lateral (select public.create_invite(t.name) as code) c;
```

Codes are 8 characters from a 32-character alphabet (`2-9`, `A-Z` without `I`
and `O`) — no ambiguous characters, case-insensitive, dashes optional.

Revoke someone with:

```sql
update public.invites set revoked = true where label = 'Mikkel';
```

Revoking stops *new* logins. Someone already inside keeps their `members` row
until you delete it:

```sql
delete from public.members where display_name = 'Mikkel';
```

### 4. Keys

Copy **Project URL** and the **anon public** key from Supabase → Settings → API
into `public/config.js`. Never put the `service_role` key there.

### 5. Publishing

Settings → Pages → Source: **GitHub Actions**. Pushes to `main` publish `public/`.

## Local preview

```powershell
python -m http.server 8000 --directory public
```

Then open <http://localhost:8000>.

## Editing the event details

Supabase → **Table editor** → `event_info` → edit the single row.

## Limits worth knowing

- An invite code can be shared by the person you gave it to, and it signs in as
  whoever it was issued to. Codes are soft gating, not proof of identity.
- Codes are 8 characters ≈ 40 bits, which is only safe because failed attempts
  are counted server-side: 8 wrong guesses in 10 minutes locks that session for
  15 minutes. Anonymous sign-ins are also rate-limited per IP by Supabase, so
  cycling sessions does not give an attacker unlimited guesses.
- There is no admin UI; adding people and editing the event is done in the
  Supabase dashboard.
