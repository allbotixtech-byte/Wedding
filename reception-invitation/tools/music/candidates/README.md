# How the soundtrack was chosen

Three original scores were written for the film, each from a different angle. Three judges then rated each one
independently, each with a different focus.

| Score | Angle | Idiom judge | Melody judge | Orchestration judge | Total |
|---|---|---|---|---|---|
| S1 “Saanjh Ki Baansuri” (C major) | flute-led filmi romance | 42.5 | 41.5 | 46.0 | 130.0 |
| S2 “Roshan Shaam” (D → E major) | grand, string-led | 39.5 | 39.0 | 39.0 | 117.5 |
| **S3 “Saanjh Ki Dor” (D major)** | raga-rooted (Khamaj, Charukeshi) | **47.5** | **46.5** | 44.5 | **138.5** |

Each judge scored six criteria from 1 to 10, so each judge's column is out of 60:

* melody
* development
* Bollywood idiom
* emotional arc and cues
* orchestration
* harmony

S3 won with two of the three judges and the highest total. It was then revised bar by bar from all three judges'
notes, and the revision was checked by two further reviewers, one technical and one musical. The revised version
is `../score.json`.

The originals are kept here so they can be heard with the same instruments:

```
node tools/music/render.mjs tools/music/candidates/S1-saanjh-ki-baansuri.score.json s1.wav
```
