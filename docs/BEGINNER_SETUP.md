# VRAAYU — Beginner setup (about 45 minutes)

Do the steps in order. After **every** step, check that the site still opens. You can stop after Step 3 and still have a working demo.

## Step 1 — Put the new code on GitHub
1. Unzip the new project folder on your Mac.
2. Open your repository on github.com → click **Add file → Upload files**.
3. Drag the **contents** of the unzipped folder (not the folder itself) into the page. Tick that files with the same name are replaced.
4. Write the message `Upgrade: real AI, WhatsApp alerts, family dashboard` → **Commit changes**.
5. Vercel redeploys automatically (watch the Deployments tab until it shows a green tick).

## Step 2 — Gemini key (this fixes the repeating sentence)
1. Open https://aistudio.google.com and sign in with Google.
2. Click **Get API key → Create API key**. Copy it.
3. Open https://vercel.com → your project → **Settings → Environment Variables**.
4. Add: **Name** `GEMINI_API_KEY`, **Value** (paste the key), tick all environments → **Save**.
5. **Deployments → ⋯ on the latest → Redeploy.** (Variables only apply after a redeploy.)
6. Open your site → **Settings → System status → Run check**. You want to see `Gemini AI: working with model …`.

## Step 2b — Free backup AI (Groq, recommended)
1. Open https://console.groq.com and sign in (free).
2. **API Keys → Create API Key**, copy it.
3. In Vercel add `GROQ_API_KEY` and **Redeploy**. If Gemini is ever slow or rate-limited, VRAAYU answers through Groq automatically (the tag under the reply says “Groq AI (free backup)”).

## Step 3 — Save your family's phone numbers
In the app open **Live Connect**, type each number with country code, e.g. `+919175590920`. Tapping the green phone icon now opens a real call.

## Step 4 — WhatsApp alerts (free Twilio sandbox)
1. Sign up at https://www.twilio.com (free trial) and verify your phone number.
2. Console → **Messaging → Try it out → Send a WhatsApp message**. It shows a sandbox number and a join code like `join apple-tiger`.
3. On every phone that should receive alerts, send that `join …` text to the sandbox number on WhatsApp once.
4. From the Twilio Console home copy **Account SID** and **Auth Token**.
5. In Vercel add: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_WHATSAPP_FROM` = `whatsapp:+14155238886` (use the sandbox number Twilio shows). Redeploy.
6. Test: Live Connect → tap the chat icon next to a contact. The message arrives in WhatsApp.

Optional automatic phone call on SOS: in Twilio get a trial phone number and add it as `TWILIO_PHONE_NUMBER` (trial accounts can only call numbers you verified in Twilio).

## Step 5 — Permanent family data (Supabase, optional)
1. https://supabase.com → **New project** (free).
2. **SQL Editor → New query**, paste the contents of `supabase/schema.sql` → **Run**.
3. **Project Settings → API**: copy the **Project URL** and the **service_role** key.
4. In Vercel add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Redeploy.
5. Never put the service_role key in code or in chat.

Skip this and the family dashboard still works for your demo (data is held in server memory).

## Step 6 — Family dashboard
In the app: **Settings → Family dashboard → Copy link**. Open that link on another device (or tab). Press the SOS button on the elder device: the alert appears on the family page within seconds.

## Step 7 — Face unlock
**Settings → Face unlock → Set up**, allow the camera, look straight ahead. Next time the app opens, it unlocks when it recognises you. The default backup PIN is `1234` (change it in Settings).

## If something does not work
| Problem | Fix |
|---|---|
| Still repeating one sentence | Settings → System status. If `Gemini key: MISSING`, redo Step 2 and **redeploy**. |
| Mic does nothing | Use Chrome or Edge; allow the microphone. |
| No WhatsApp message | The receiver must have sent the `join …` message to the sandbox number (Step 4.3). |
| Family page says “No data yet” | Open VRAAYU on the elder device once, wait 2 seconds, retry. |
