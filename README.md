# CampusVoice 1.0 — setup guide

A React + Vite student complaint portal with Supabase email/password authentication, a signed-in public feed, and private photo storage.

## 1. Create the Supabase project

1. Go to https://supabase.com and create a project.
2. In the project dashboard, open **SQL Editor** → **New query**.
3. Open `supabase/setup.sql` from this project, copy all its contents into the SQL Editor, and click **Run**.
4. Open **Project Settings** → **API** (or **API Keys**).
5. Copy the Project URL and the **anon / publishable** key. Do not use or expose the `service_role` / secret key.

## 2. Add the two environment variables

In the root of the project, create a file named `.env` (same level as `package.json`) with:

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
```

Replace both placeholder values with your own. `.env` is ignored by Git and should not be uploaded.

## 3. Publish with GitHub + Vercel

1. Upload all project files and folders to your GitHub repository. Keep the `supabase` folder.
2. Open https://vercel.com and sign in using GitHub.
3. Click **Add New** → **Project**, import your CampusVoice repository.
4. Framework preset should be **Vite**. Build command: `npm run build`. Output directory: `dist`.
5. Before deploying, open **Environment Variables** and add:
   - `VITE_SUPABASE_URL` = your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon / publishable key
6. Click **Deploy**.

If you change environment variables later, redeploy the project.

## 4. Configure email confirmation URL

In Supabase Dashboard → **Authentication** → **URL Configuration**:
- Set **Site URL** to your Vercel website URL (for example `https://campusvoice.vercel.app`).
- Add that same URL under **Redirect URLs**.

Email confirmation may be enabled by default. Students then need to confirm their email before logging in. For a real college-wide launch, keep email confirmation enabled.

## 5. What v1 does

- Students sign up and log in with email/password.
- Only signed-in users can see the complaint feed.
- Signed-in users can submit a complaint with an optional image (maximum 5 MB).
- Complaint submitter email addresses are not shown.
- Students can read all complaints but cannot edit or delete other people's posts.
- New complaints default to **Pending**. Status changes are reserved for a future admin workflow.

## Important security notes

- Never put a Supabase `service_role` key or secret key in this frontend project or GitHub.
- The anon/publishable key is intended for browser use; Row Level Security policies in `supabase/setup.sql` protect the data.
- The photo bucket is private. Authenticated users receive temporary signed photo links.
- This starter is not yet an official college grievance system. Do not post emergency reports or sensitive personal information. Add a moderation/admin process before broad campus use.

## Local preview (optional)

Install Node.js, then run:

```bash
npm install
npm run dev
```
