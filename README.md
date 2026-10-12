# StudySphere Next — Class 11 & 12 learning platform

A responsive, static-first educational website for students across boards. It includes chapter summaries, practice quizzes, local progress charts, revision notes, a PYQ library interface, in-page tutor UI, bookmarks, search and light/dark themes. The board selector records a student's preference; it does **not** magically convert the included sample content to every board.

## Run locally
Open `index.html` or use VS Code Live Server. No build process is required. Cloud authentication needs an internet connection and your own Supabase project.

## Publish free with GitHub Pages
1. Create a public repository on GitHub.
2. Upload the contents of this folder into the repository root (not the ZIP itself).
3. Repository → **Settings → Pages** → deploy from branch `main`, folder `/(root)`.
4. Your site appears at `https://YOUR-USERNAME.github.io/REPOSITORY/`.

## Enable free-tier account sign-in and cloud sync (Supabase)
GitHub Pages cannot run a database or securely store AI secrets. Supabase has a free tier subject to current limits and terms.

1. Create a project at https://supabase.com/ and open **Project Settings → API**.
2. Copy the Project URL and the public anon/publishable key into `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `config.js`. These are intended for browser use only when Row Level Security (RLS) is correctly enabled. **Never use a service-role key in the website.**
3. In Supabase SQL Editor, run:

```sql
create table if not exists public.study_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.study_progress enable row level security;
create policy "Students can read their own progress"
  on public.study_progress for select to authenticated
  using (auth.uid() = user_id);
create policy "Students can insert their own progress"
  on public.study_progress for insert to authenticated
  with check (auth.uid() = user_id);
create policy "Students can update their own progress"
  on public.study_progress for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```
4. In Authentication settings, configure email confirmation and your deployed site's allowed redirect URLs. Test account creation, email confirmation, sign-in, sign-out, and sync.
5. Add rate limits and a privacy policy before inviting real users. Avoid collecting unnecessary personal information.

Cloud sync saves the current progress state as one JSON document per authenticated user. Local browser storage continues to work without an account. If you have important existing local progress and sign in to a brand-new cloud account, test carefully first: the initial cloud record may be empty, so make a backup/export before relying on sync.

## Real AI tutor without redirecting students
The tutor stays inside the website UI. For actual generated answers, deploy a serverless backend that accepts `{ "message": "...", "class": "11" }` and returns `{ "answer": "..." }`, then set `AI_ENDPOINT` in `config.js`. A backend can call an AI provider with a free tier where available. Free quotas and model access change. Put the provider's secret in backend environment variables only, never in `config.js`, `app.js`, or GitHub. Add rate limiting, request size limits, abuse prevention and usage caps. The site falls back to demo responses when no endpoint is configured.

## Content and accuracy notes
- This is a starter with sample chapters/questions, not a complete multi-board textbook database. The board preference is a filter/profile preference only at this stage. Expand `data.js` with board-, class-, subject- and chapter-specific material verified against official syllabus documents.
- PYQ entries are placeholders unless explicitly sourced and verified. Do not label examples as real previous-year questions. Respect copyright and upload only papers you have permission to distribute.
- AI-generated explanations may be wrong; encourage students to verify important answers with their textbook/teacher.

## Ads and earning
GitHub Pages does not automatically insert ads or pay you. You can apply to an ad network after building substantial original content and meeting its policies; approval and revenue are not guaranteed. Check the network's current age, privacy, consent, tax and payment rules. If you are under the required age, a parent/guardian may need to handle the account. Never click your own ads or encourage invalid clicks.

## Separate pages for easy navigation
Each main section has its own URL/file, while sharing the same navigation, theme, and locally saved progress:
- `index.html` — Home dashboard
- `chapters.html` — Chapters and subjects
- `quizzes.html` — Practice quizzes
- `pyqs.html` — Previous-year question library
- `notes.html` — Notes and revision
- `tutor.html` — Personal AI tutor
- `progress.html` — Progress tracking
- `saved.html` — Saved items
- `settings.html` — Settings and AI setup

## Files
- `index.html` — Home page and sign-in modal
- `styles.css` — responsive visual system and themes
- `app.js` — interactions, quiz, notes, tutor, local storage and optional cloud sync
- `data.js` — sample learning content
- `config.js` — public site configuration; no private keys
- `LICENSE` — project license

## License
See `LICENSE`.
