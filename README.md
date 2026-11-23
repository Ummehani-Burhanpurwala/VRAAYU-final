# VRAAYU (वायु) — Always With You 🌿

> **A voice-controlled AI life assistant for elders who live alone.**
> Speak in English, हिंदी or मराठी. VRAAYU reminds, calls, messages family, reports the weather and news, plays bhajans, tracks medicines and raises an SOS — all by voice, with no login and no typing.

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js) ![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react) ![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript) ![Tailwind](https://img.shields.io/badge/Tailwind-v4-38B2AC?style=for-the-badge&logo=tailwind-css) ![Gemini](https://img.shields.io/badge/Google_Gemini-AI-8E75B2?style=for-the-badge&logo=google) ![Vercel AI SDK](https://img.shields.io/badge/Vercel_AI_SDK-v7-000000?style=for-the-badge&logo=vercel)

## What is real in this version

| Feature | How it works |
|---|---|
| **Real AI conversation** | `/api/gemini` sends the last 12 messages + the elder's real data (medicines, contacts, readings) to Gemini. It answers in JSON: a spoken reply **and actions** the app executes. |
| **Voice → action (tools)** | Gemini can add reminders, mark a tablet taken, log BP/sugar, call or WhatsApp a contact, start an SOS, do a check-in, open music, change font/language. |
| **Live weather & news** | Open-Meteo and Google News RSS, fetched on the server (no keys). |
| **Real phone calls** | One tap opens the phone dialer (`tel:`) to the saved family number. |
| **Family alerts on WhatsApp** | SOS (with Google-Maps location), missed medicine (20+ min late), abnormal reading and daily check-in are sent through Twilio's WhatsApp API. If Twilio is not configured, a ready-to-send `wa.me` link opens instead. |
| **Automatic SOS phone call** | Optional Twilio voice call to the first family contact. |
| **Saved data** | Medicines, readings, appointments, contacts, activity log: stored on the device (localStorage) and synced to the family dashboard (Supabase, or server memory for demos). |
| **Family dashboard** | `/family` — enter the 6-letter family code: live medicines, readings, alerts, timeline. |
| **Face unlock + PIN** | In-browser face recognition (face-api). Only a 128-number signature is stored, never a photo. Family PIN is the backup. |
| **Hands-free** | Say “Hello Vraayu” (Chrome/Edge). |
| **Reports** | Adherence, active days, family connections and trends computed from real logs. Print / save as PDF. |
| **Live conversation** | One tap and VRAAYU keeps listening after every reply, like a phone call (say “stop” to end). |
| **Yaad Rakho** | “Remember that…” saves a note; “Where did I keep…?” answers from your notes. |
| **In-app devotional music** | A free, offline tanpura-and-raga ambience generated with Web Audio. “Play a bhajan” starts it; “stop the music” ends it. |
| **Mood + breathing** | Mood check-in (family nudged if low) and a guided breathing exercise by voice. |
| **Dual free AI** | Gemini first, free Groq (Llama 3.3) as backup, offline engine as last resort. |
| **Offline brain** | If Gemini is unavailable, a data-driven fallback engine still understands calls, reminders, medicines, readings, weather and news. |

## Architecture

```
Browser (Next.js client)                    Server (Next.js route handlers)
├─ Voice orb, 6 views, face lock            ├─ /api/gemini   Gemini + tools (weather, news) + fallback engine
├─ Web Speech API  (STT en/hi/mr-IN)        ├─ /api/notify   Twilio WhatsApp + voice call (or wa.me links)
├─ SpeechSynthesis (TTS)                    ├─ /api/state    family sync  → Supabase (or memory)
├─ localStorage (app state)                 └─ /api/health   shows what is configured / working
└─ Reminder scheduler (15 s tick)
```

## Project structure

```
app/
  page.tsx                 App shell + all logic (speech, actions, SOS, reminders)
  family/page.tsx          Caregiver dashboard
  api/gemini|notify|state|health/route.ts
components/vraayu/         home, dashboard, healthcare, connect, reports, settings, face-lock
lib/
  types.ts  store.ts       Types, demo data, pure state helpers
  assistant-fallback.ts    Offline brain
  server/tools.ts          Weather + news
  server/twilio.ts         WhatsApp + voice call client
supabase/schema.sql        One table for the family dashboard
docs/                      BEGINNER_SETUP.md · STUDY_GUIDE.md
```

## Run it

```bash
npm install
cp .env.example .env.local     # then fill in GEMINI_API_KEY
npm run dev                    # http://localhost:3000
```

Use **Google Chrome** for voice input. After deploying, open **Settings → System status → Run check** to see exactly what is connected.

Step-by-step instructions for every key and service: [`docs/BEGINNER_SETUP.md`](docs/BEGINNER_SETUP.md).
Viva / presentation preparation: [`docs/STUDY_GUIDE.md`](docs/STUDY_GUIDE.md).

## Safety & privacy

- VRAAYU never diagnoses or prescribes; it gives general comfort advice and urges a doctor.
- Red-flag phrases trigger a 10-second SOS countdown (cancel with “I am okay”).
- No audio is stored. Face unlock stores numbers only; the face signature and PIN are never sent to the server.

## License
MIT — Author: Ummehani Burhanpurwala
