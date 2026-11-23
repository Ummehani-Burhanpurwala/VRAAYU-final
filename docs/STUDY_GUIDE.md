# VRAAYU — Study guide for your presentation

## One-line pitch
VRAAYU is a voice-controlled AI assistant that lets an elderly person living alone manage daily life — medicines, calls, reminders, news, emergencies — just by speaking, while family stay informed.

## How it works (say this in 30 seconds)
The elder speaks → the browser turns speech into text (Web Speech API) → the text and the elder's real data go to our server route `/api/gemini` → Gemini decides what to say **and which actions to run** → the app speaks the reply and performs the actions (set a reminder, call, WhatsApp the family, SOS).

## Tech stack — what each piece is and why
| Piece | What it is | Why we used it |
|---|---|---|
| Next.js 16 | React framework: pages **and** backend API routes in one project | One codebase, easy Vercel deployment |
| React 19 + TypeScript | UI library + typed JavaScript | Reusable components, fewer bugs |
| Tailwind CSS v4 + CSS | Styling | Large, high-contrast, elder-friendly design |
| Gemini + Vercel AI SDK | LLM + the library that calls it | Multilingual, natural conversation |
| Web Speech API | Browser speech-to-text / text-to-speech | Free, no audio stored |
| Twilio | WhatsApp & voice-call API | Real alerts to family |
| Supabase (Postgres) | Hosted database | Family dashboard data |
| face-api | Face recognition in the browser | Unlock without typing |
| Vercel | Hosting | Automatic deploy from GitHub |

## Unique features (mention these!)
- **Live conversation mode:** after VRAAYU speaks, it listens again by itself, like a phone call. It stops on “bas / stop / bye” or after two silences.
- **Yaad Rakho (voice memory):** “Remember that my spectacles are on the table.” Later: “Where are my spectacles?” VRAAYU answers from the saved notes.
- **Mood check-in:** one tap (😊😐😔) or by voice. If the elder feels low, family get a gentle WhatsApp nudge (once a day).
- **Guided breathing:** a calming 4-4-6 exercise with a growing circle and spoken cues, started by voice (“I feel anxious”).
- **In-app devotional music:** a live-synthesised tanpura drone with raga chimes (Web Audio API): free, offline, no ads.
- **Free dual-AI brain:** Gemini first, Groq (Llama) as a free backup, and an offline engine as the last resort. The elder is never left without an answer.

## Likely questions and answers
1. **Why voice-first?** Elders struggle with small screens, typing and menus; speech is the most natural interface, in their mother tongue.
2. **Is it only a health app?** No. Health is one skill. The same assistant handles calls, reminders, news, weather, music, company and emergencies.
3. **How does the AI actually *do* things?** Gemini returns JSON with a reply and an `actions` list. The app executes each action (see `runActions` in `app/page.tsx`). This is called tool/function calling.
4. **What if the internet or Gemini fails?** `lib/assistant-fallback.ts` is an offline brain that still handles calls, reminders, medicines, readings; the UI shows an “Offline assistant” tag.
5. **How is privacy protected?** No audio is stored; face unlock stores only a 128-number signature, never a photo, and it stays on the device; the family dashboard uses a secret 6-letter code; API keys live only in server environment variables.
6. **Is it safe medically?** It never diagnoses or prescribes; it gives general comfort advice and tells the user to consult a doctor; red-flag words start an SOS countdown.
7. **How do families get notified?** SOS, missed medicine, abnormal readings and check-ins go through the Twilio WhatsApp API (with location on SOS). If Twilio is not configured, a `wa.me` link opens.
8. **What is the database?** Elder data is saved on the device; a copy is synced to Supabase (table `vraayu_state`) so family can see it at `/family`.
9. **Limitations?** Voice input works best in Chrome/Edge; WhatsApp sandbox only reaches numbers that joined it; SOS auto-call needs a Twilio number. Future scope: wearable fall detection, scheduled server-side check-in alerts, more languages.
10. **What would you build next?** Fall detection, doctor video visits, caregiver mobile app, medicine-image recognition.

## Live demo script (4 minutes)
1. Open the site (face unlock if enabled). “No login, no typing.”
2. Tap **Start live conversation** and talk naturally: **“When is my medicine?”** → reads real data.
3. **“Remind me to drink water at 5 PM”** → appears in Dashboard.
4. **“What is the weather?”** → live data. Switch to हिंदी and ask **“मेरी दवाई कब है?”**
5. **“My BP is 150 by 95”** → saved in Healthcare.
6. **“Call my daughter”** → real dialer opens.
7. Open `/family` on a second screen. On the elder screen say **“Help me”** → 10-second countdown → WhatsApp arrives, the family page shows the SOS.
8. Reports → show adherence and the Print/PDF button.

**Backup:** record this demo as a 2-minute screen video tonight.

## Files worth knowing
- `app/page.tsx` — the brain of the UI (speech, actions, SOS, reminders)
- `app/api/gemini/route.ts` — system prompt, Gemini call, tools
- `lib/assistant-fallback.ts` — offline brain
- `lib/store.ts` — data model and demo data
- `app/api/notify/route.ts` — WhatsApp / call
