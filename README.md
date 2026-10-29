# Registry Website

A very basic static website: some colors, some text, and a button that changes the page colors and counts your presses.

## Structure

Everything that gets published lives in `public/` — nothing else is deployed.

```
public/
  index.html
  styles.css
  script.js
```

## Run it locally

Serve the `public` folder (opening `index.html` directly from disk also works):

```powershell
python -m http.server 8000 --directory public
```

Then visit <http://localhost:8000>.

## Deploy on Cloudflare Pages

This is a plain static site with **no build step**. When connecting the repo in
Cloudflare (Workers & Pages → Create → Pages → Connect to Git), use:

| Setting | Value |
| --- | --- |
| Framework preset | `None` |
| Build command | *(empty)* |
| Build output directory | `public` |
| Root directory | *(empty)* |
| Production branch | `main` |

Do not use the "Workers → Connect to Git" flow for this repo. It runs
`wrangler deploy` and, with no Worker config present, treats the whole checkout
(including `.git/`) as static assets.
