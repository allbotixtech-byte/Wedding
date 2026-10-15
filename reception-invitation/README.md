# Kenvi & Puru — Animated Reception Invitation

A hand-painted, Ghibli-inspired animated invitation to the **reception** of **Kenvi Dwivedi & Puru Tyagi**
on **Saturday, 28 November 2026** at **Hotel Royal Residency, Saharanpur**.

It comes in two forms that are generated from the *same* source, so they always match:

| | What | Where |
|---|---|---|
| **A** | Interactive animated website (tap the wax seal to open) | `index.html` — start it with `Start Invitation.bat` |
| **B** | Finished MP4 videos with music | `output/` folder |

### The commands at a glance

Open a terminal in VS Code (**Terminal → New Terminal**) and type any of these. They work both from this
`reception-invitation` folder **and** from the `Reception` folder above it, so it does not matter which of the two
you opened in VS Code.

| Command | What it does |
|---|---|
| `npm run dev` (or `npm start`) | Starts the invitation on your computer and opens it in the browser. Stop it with `Ctrl + C`. |
| `npm run build` | Collects just the website files into `dist/` and checks that nothing is missing. Takes a second. |
| `npm run preview` | Shows the built `dist/` folder in the browser. |
| `npm run render` | Renders the vertical MP4 and the WhatsApp copy (about 5 minutes). |
| `npm run render:horizontal` | Renders the horizontal MP4. |
| `npm run render:all` | Renders the vertical and the horizontal MP4. |
| `npm run verify` | Checks the rendered videos and saves contact sheets in `output/qa/`. |
| `npm run music` | Regenerates the soundtrack. |
| `npm run backgrounds` | Repaints the backgrounds and decorations. |

`npm run dev` and `npm run build` need only Node.js. The render commands also need FFmpeg and a one-time
`npm install` (section 3).

---

## 1. The finished videos (`output/`)

| File | Use it for |
|---|---|
| `reception-invitation-vertical-1080x1920.mp4` | **Instagram Stories / Reels, WhatsApp Status**, saving on phones. Full quality, 9:16, 30 fps, H.264 + AAC. |
| `reception-invitation-whatsapp-720x1280.mp4` | **Sending in WhatsApp chats and groups.** A smaller copy (about 13 MB, under WhatsApp's long-standing 16 MB video limit) that uploads quickly and holds up well. |
| `reception-invitation-horizontal-1920x1080.mp4` | TVs, laptops, projectors at the venue, YouTube. 16:9. |

The film is **59.5 seconds** long on purpose, so that it fits within the 60-second limit of a single Instagram story
or WhatsApp status instead of being split in two.

> Tip: WhatsApp re-compresses videos sent the normal way. To send the *full-quality* file, attach it as a
> **Document** instead of as a video.

---

## 2. Watch the website on your computer

**Easiest:** double-click **`Start Invitation.bat`**. A browser tab opens at `http://localhost:5173`.
Tap (or click) the wax seal and the invitation plays with music.

**From VS Code:** `Terminal → New Terminal`, then

```
npm run dev
```

(`npm start` does the same.) The address is printed in the terminal; if port 5173 is already taken by another
program, the next free port is used automatically.

Controls (bottom-right corner): **pause/play**, **mute music**, **replay**.
Keyboard: `Space` pause/play · `M` mute · `R` replay · `←` `→` skip 3 seconds.
When the film ends you get a final screen with the date, the venue, **Watch again**, **Directions** (Google Maps)
and **Save the date** (adds an all-day entry to the guest's calendar).

The page adapts to the screen: upright phones get the 9:16 layout, laptops and TVs get the wide layout.
(You can also just double-click `index.html`; it works without the server, minus one small light-sweep effect.)

---

## 3. One-time setup on Windows

You only need this if you want to **change something and render a new video**. Just watching needs only a browser
(double-click `index.html`); `Start Invitation.bat` and `npm run dev` additionally need Node.js.

1. **Node.js** (runs the local server and the renderer). In *PowerShell* or *Command Prompt*:
   ```
   winget install OpenJS.NodeJS.LTS
   ```
2. **Google Chrome or Microsoft Edge** — already on every Windows PC. The renderer drives it invisibly.
3. **FFmpeg** (turns the frames into an MP4):
   ```
   winget install Gyan.FFmpeg
   ```
4. Close and reopen the terminal, then open the project: **VS Code → File → Open Folder… →** choose the
   `reception-invitation` folder (the `Reception` folder above it works too).
5. In VS Code open **Terminal → New Terminal** and install the renderer (one small package, done once).
   If the terminal is in `reception-invitation`:
   ```
   npm install
   ```
   If the terminal is in the outer `Reception` folder:
   ```
   npm run setup
   ```

---

## 4. Change the names, date, venue or wording

Open **`config.js`**. Everything the guests read is there:

```js
BRIDE_NAME: 'Kenvi Dwivedi',
GROOM_NAME: 'Puru Tyagi',
EVENT_TYPE: 'Reception',
EVENT_DAY: 'Saturday',
EVENT_DATE: '28 November 2026',
VENUE_NAME: 'Hotel Royal Residency',
VENUE_ADDRESS: 'Ambala Road, Opp. Kalpana Cinema, Purani Mandi, Saharanpur, Uttar Pradesh 247001',
VENUE_ADDRESS_LINES: [ ... ],   // how the address is split into lines on the card
EVENT_TIME: '',                 // empty = not shown.  e.g. '7:00 PM onwards'
RSVP_DETAILS: '',               // empty = not shown.
TEXT: { ... }                   // the sentence shown in each scene
```

Save the file and refresh the browser. The monogram on the seal (K & P), the signature (“Kenvi & Puru”),
the card, the closing line and the final screen all update by themselves.
Empty fields are simply left out — no blank labels or placeholders ever appear.

Then make a new video: see section 7.

*Much longer names?* If a name no longer fits on one line, lower the matching size in `styles.css`
(search for `.t-name`, `.t-couple .n`, `.card-names span` — the number before `)` is the size).

---

## 5. Replace the illustrations

| File | Used in |
|---|---|
| `assets/groom.webp` | Scene 2 (groom) and scene 7 (finale) |
| `assets/bride.webp` | Scene 3 (bride) and scene 7 (finale) |
| `assets/couple.webp` | Scene 4 (the two together inside the floral ring) |

They are **cut-outs with a transparent background** (WebP or PNG both work). To swap one:

1. Remove the background from your new illustration (any “remove background” tool) and save it as PNG.
2. Put it in `assets/` and point `IMAGES` in `config.js` at it, e.g. `groom: 'assets/my-groom.png'`.
3. Refresh. If the figure sits too high/low or is too big, adjust its box in `styles.css`:
   `.actor-groom`, `.actor-bride`, `.duo` (finale) and `.cameo` (scene 4). `--h` is the height,
   `--x` the horizontal position, `--b` the distance from the bottom, `--ar` the image's width ÷ height.
4. The marble railing is lined up with the bride's hand (`.actor-bride .rail`, `.duo .rail` → `top`).

`SHOW_COUPLE_PORTRAIT: false` in `config.js` makes scene 4 show the groom and bride cut-outs side by side
instead of the couple portrait.

The originals you supplied and the lossless cut-outs are kept in `assets/source/`.

---

## 6. Music

The soundtrack is **“Saanjh Ki Dor” (The Twilight Thread)**, an original Bollywood romantic instrumental written for
this film: D major in a gentle 12/8 lilt, with Khamaj and Charukeshi colours. The bansuri gives the groom a call and the
violin gives the bride an answer. When the couple appears, the two halves meet as one melody (the *mukhda*), which then
climbs higher at the stage reveal, returns softly at half speed under the invitation card, and comes back for the finale
on a D6/9 chord with a swarmandal glissando and a santoor tremolo.

It is cut to the picture:
* the melody lands on the groom's name at 11 s and on the bride's at 17 s;
* the strings hush as the curtains close (28.5 s) and bloom when they open (30 s);
* tabla tihais land exactly on the stage reveal (30 s) and on the final chord (57 s);
* the music becomes light and readable while guests read the date and venue (39–51 s).

**How it is made.** Every note is written out in `tools/music/score.json`, and `tools/music/render.mjs` plays it with
real recorded instruments, then mixes and masters it to −16 LUFS:
* **SoundFont samples** for the bansuri (with breath, meend glides and vibrato), solo violin, sitar, piano, string section,
  harp, santoor, acoustic bass and bells;
* **real recordings** for the tabla (retuned to the song's Sa), the swarmandal glissandi, santoor tremolo rolls, shaker,
  tambourine, finger cymbals, bell tree and wind chimes.

Nothing is copied from an existing song, and every sound source allows this use (see *Credits*).

> Please do not replace it with a film song (for example from YouTube). Commercial songs are copyrighted, and because
> this invitation is published online, the site or the repository can be taken down for it.

* **Regenerate it** (about 2 minutes):
  ```
  npm run music
  ```
  The first run downloads the SoundFonts and recordings (about 93 MB) into `tools/music/sounds/` and checks each file's
  SHA-256; after that it works offline. `npm run music -- --report` also prints each instrument's level per scene.
* **Tweak it:** the notes, timing and dynamics are in `tools/music/score.json` (the format is explained at the top of
  `tools/music/score.mjs`); the balance of the instruments is the `mix` block of `tools/music/instruments.json`.
  Then run `npm run render:all` so the videos get the new music too.
* **Use your own track instead:** save it as `assets/music/reception-theme.mp3` **and** delete (or replace)
  `assets/music/reception-theme.wav` — or change `MUSIC` in `config.js`. It should be at least 60 seconds long;
  anything longer is cut at 59.5 s. Only use music you have the rights to share.

---

## 7. Render the MP4 again

**Easiest:** double-click **`Render Video.bat`**.

**From the VS Code terminal:**

```
npm run render                 # vertical 1080 x 1920  (+ the small WhatsApp copy)
npm run render:horizontal      # horizontal 1920 x 1080
npm run render:all             # both
npm run verify                 # checks the files and saves contact sheets in output/qa/
```

Each render takes about 5 minutes. The renderer opens the same web page invisibly, steps through it frame by
frame (30 per second, 1,785 frames), and FFmpeg encodes the frames together with the soundtrack.
The videos are saved in the **`output`** folder.

Useful extras: `node render/render.mjs --format=vertical --from=28 --to=34` renders just a few seconds for a
quick test; `--crf=20` makes a smaller file, `--crf=15` a larger, even cleaner one.

---

## 8. What happens when (59.5 seconds)

| Time | Scene | On screen |
|---|---|---|
| 0–3 s | Opening | A sealed blush envelope with the K & P wax seal opens |
| 3–9 s | 1 · A magical beginning | Twilight palace garden · “A Beautiful Evening Awaits...” · the floral frame grows in |
| 9–15 s | 2 · The groom | Lantern-lit palace courtyard · “Introducing the Groom — Puru Tyagi” |
| 15–21 s | 3 · The bride | Terrace above the illuminated garden · “Introducing the Bride — Kenvi Dwivedi” |
| 21–30 s | 4 · Togetherness | Floral ring in a blue-hour garden · “Two Beautiful Souls / One Special Evening / An Unforgettable Celebration” |
| 30–39 s | 5 · The invitation | Velvet curtains part on the reception stage · names · “Cordially invite you to their Reception” · message |
| 39–51 s | 6 · Date & venue | The invitation card: Reception · names · Saturday, 28 November 2026 · Hotel Royal Residency and address |
| 51–59.5 s | 7 · Finale | The couple before the illuminated stage · closing lines · “Kenvi & Puru” · fade out |

The scene times live in `script.js` (look for `const T =` and the numbered `/* ===== n · … ===== */` blocks).

---

## 9. What is in the folder

```
reception-invitation/
├─ index.html            the page
├─ styles.css            layout, typography, colours
├─ script.js             the film: one timeline that drives every scene, camera move and particle
├─ config.js             ← names, date, venue, wording, file paths (edit this)
├─ package.json          the npm commands (dev, build, preview, render, verify, music, backgrounds)
├─ Start Invitation.bat  double-click to watch
├─ Render Video.bat      double-click to make the MP4s
├─ assets/
│  ├─ groom.webp · bride.webp · couple.webp      character cut-outs
│  ├─ backgrounds/hd, md                         painted scenes, in layers for the parallax camera
│  ├─ effects/hd, md                             florals, petals, curtain, wax seal, paper, railing…
│  ├─ music/                                     reception-theme.mp3 (web) and .wav (video master)
│  ├─ fonts/                                     Great Vibes, Cormorant Garamond, Cinzel (bundled, offline)
│  └─ source/                                    your original illustrations + lossless cut-outs
├─ vendor/gsap.min.js    animation library (bundled, no internet needed)
├─ render/
│  ├─ render.mjs         website → MP4
│  └─ verify.mjs         automatic checks + contact sheets
├─ tools/
│  ├─ serve.mjs          tiny local web server (npm run dev / preview)
│  ├─ build-site.mjs     collects the website into dist/ (npm run build)
│  ├─ compose-music.mjs  writes the soundtrack (npm run music)
│  ├─ music/             its score, instrument settings, renderer and the list of sound sources
│  │                     (sounds/ is downloaded on first use and not committed)
│  ├─ paint-backgrounds.mjs + paint/   paint every background and decoration from code
│  └─ browser.mjs        finds Chrome / Edge
├─ dist/                 the website on its own, made by npm run build (safe to delete)
└─ output/               the rendered videos
```

The `Reception` folder above this one also has a small `package.json`. It only forwards the npm commands to this
folder, so that they work from there as well.

All artwork other than the three character illustrations was painted for this invitation by the code in
`tools/paint/` (`npm run backgrounds` repaints it), so there are no stock images to license.

**Putting the website online (optional):** run `npm run build` and upload everything inside the `dist/` folder to
any static host (Netlify Drop, GitHub Pages, Cloudflare Pages…). `dist/` contains only what the page needs: no
tools, no renderer, no videos, and not your original artwork.

---

## 10. Troubleshooting

| Problem | Fix |
|---|---|
| No sound | Browsers only allow sound after a tap — tap the seal. Check the mute button and the phone's silent switch. |
| `npm` or `node` “is not recognized” | Install Node.js (section 3) and reopen the terminal. |
| “FFmpeg was not found” | `winget install Gyan.FFmpeg`, then reopen the terminal. |
| “Could not find Google Chrome or Microsoft Edge” | Install either, or set `BROWSER_PATH` to the browser's `.exe`. |
| `npm error … Could not read package.json` | The terminal is in a folder without the project. Type `cd` followed by the path of the `Reception` or `reception-invitation` folder, then try again. |
| `Missing script: "…"` | Use one of the commands in the table at the top of this file. |
| Port 5173 is busy | Nothing to do: the next free port is used and printed. To pick one yourself: `npm run dev -- --port=8080` |
| A name wraps or is cut after editing | Reduce its font size in `styles.css` (section 4). |
| The page looks stale after an edit | Hard-refresh with `Ctrl + F5`. |

---

## Credits

* Character illustrations: supplied by the couple.
* Backgrounds, florals, decorations and animation: created for this invitation (code in this folder).
* Music: “Saanjh Ki Dor”, composed for this invitation (`tools/music/score.json`). Instrument sounds:
  * **GeneralUser GS** v2.0.3 by S. Christian Collins: bansuri (flute, with a soft shakuhachi breath layer), violin,
    sitar, tubular bell and tinker bell.
    GeneralUser GS License v2.0, free for music creation, private or commercial
    (`tools/music/licences/GeneralUser-GS_LICENSE.txt`).
  * **MuseScore_General** v0.2: piano, strings, harp, santoor, acoustic bass, celesta, glockenspiel and music box.
    MIT licence. FluidR3 by Frank Wen © 2000–02; FluidR3Mono by Michael Cowgill © 2014–17; adaptation for
    MuseScore_General by S. Christian Collins © 2018–19; Temple Blocks by Ethan Winer © 2002; Drumline Cymbals by
    Michael Schorsch © 2016 (`tools/music/licences/MuseScore_General_License.md`).
  * **Tabla:** single-stroke recordings from the Sonic Pi sample set, originally recorded by dio_333 on freesound.org.
    CC0 1.0 (`tools/music/licences/SonicPi_samples_README.md`).
  * **Swarmandal glissandi:** luckylittleraven, freesound.org (CC0 1.0).
  * **Santoor rolls:** batchku, freesound.org (CC0 1.0).
  * **Shaker, tambourine, finger cymbals, bell tree and mark-tree wind chimes:** Versilian Community Sample Library
    (VCSL), CC0 1.0 (`tools/music/licences/VCSL_LICENSE.txt`).
  * Every file with its source URL and SHA-256: `tools/music/sources.json`.
  * SoundFont player: spessasynth_core (Apache-2.0).
* Fonts: Great Vibes, Cormorant Garamond, Cinzel — SIL Open Font License (see `assets/fonts/LICENSE.txt`).
* Animation library: GSAP (free standard licence).
