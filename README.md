
#THIS WORKS!!!!!!!!!!!!!!!!!!! IT ACTUALLY WORKS!!!!!!!
# 📻 Twitter Radio

Personalized audio news from **your own Twitter home feed**. The VPS reads
your feed twice a day and prepares topics — each with a short **summary** and a
full **deep dive** (so you never have to scroll Twitter) — as text + MP3s. Your
phone downloads the whole briefing at once and plays it like an analog radio:
**Next** skips to the next topic, **Back** re-opens the previous topic's deep
dive, **Expand** dives into the current one — all instant, no lag, and the text
is always on screen in case audio isn't working. An **optional** ESP32 with two
dials and two buttons works as a physical remote; everything works fully
without it.

Audio always comes out of the **phone** (its speaker or a Bluetooth speaker),
never the ESP32. The screen stays awake while playing so audio and BLE never
drop. Old briefings are kept on the VPS for a week; audio is cleaned off the
phone automatically.

```
Twitter feed ──> VPS ($1/mo RackNerd)          ──> Android app ──> speaker / BT speaker
                 cookies → topics → Claude          text + audio      ▲
                 summaries + deep dives → TTS       downloaded        │ BLE (optional)
                 REST API, 7-day history            up front       ESP32 remote
```

## The 3 steps

| Step | What | Guide |
|---|---|---|
| 1 | VPS server — scrape, summarize (Claude), TTS (OpenAI), serve | [server/README.md](server/README.md) |
| 2 | Android app — playback, controls, onboarding, settings | [app/README.md](app/README.md) |
| 3 | ESP32 remote — dials + buttons over BLE (**optional**) | [esp32/README.md](esp32/README.md) |

## Testing order

1. **VPS alone:** `cd server && npm i && node test.js` — runs the full pipeline
   on mock tweets and writes MP3s. Then `node test.js --feed` to check your
   Twitter cookies, and `node test.js --live` for the real thing.
2. **App + VPS:** install the APK → onboarding → Settings → **Test mode** —
   plays a mock briefing through the whole VPS → download → audio path.
3. **ESP32 alone:** flash it, open Serial Monitor (115200), twist the dials —
   signals print in test mode.
4. **End to end:** tap the `○ remote` badge in the app to connect over BLE —
   dials and buttons now drive playback.

## Design choices (why this differs from the original spec)

- **No Playwright/Chrome.** The feed is fetched with plain HTTPS using your
  exported session cookies (`auth_token` + `ct0`) — a real browser needs more
  RAM than a $1 VPS has.
- **No audio streaming.** Everything (text + audio) is pre-generated on the VPS
  and downloaded by the phone in one go — that's what makes Next/Back/Expand
  instant, and it keeps playing through network dead spots.
- **Swappable LLM.** `LLM_PROVIDER=anthropic|openai|deepseek` in `server/.env`.
