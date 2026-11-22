# Data sources and licenses

All Scripture text in Wreathlight is public domain. It is downloaded from the original publishers by
`scripts/import-bible.ts` (run on Nov 22, 2026) and normalized to `{book, chapter, verse, text}`.
The AI model never writes Scripture; code fills verse text from these files.

| Id | Translation | Source | License |
|---|---|---|---|
| bsb | Berean Standard Bible | https://bereanbible.com/bsb.txt | Public domain (dedicated to the public domain, 2023). "This text of God's Word has been dedicated to the public domain." |
| kjv | King James Version | https://ebible.org/Scriptures/eng-kjv2006_vpl.zip | Public domain (outside the United Kingdom). |
| web | World English Bible | https://ebible.org/Scriptures/engwebp_vpl.zip | Public domain. "World English Bible" is a trademark of eBible.org. |
| rv1909 | Reina-Valera 1909 | https://ebible.org/Scriptures/spaRV1909_vpl.zip | Public domain. |

Normalization: whitespace collapsed and trimmed; KJV square brackets (italic markers for supplied words) removed.
Nothing else is changed. Verse text ships only for Isaiah, Micah, Malachi, Psalms, Matthew, Luke, John and Galatians
(`content/bible/<id>.json`); `content/bible/index.json` holds verse counts for all 66 books so any reference can be
checked for existence.

Copyrighted translations (NIV, ESV, NLT, NKJV, CSB, RVR1960, NVI) are not included.

Fonts: Fraunces and Inter (SIL Open Font License 1.1), self-hosted via the `@fontsource` npm packages.

## Art (AI-generated; excluded from the MIT copyright claim)

The painted Advent wreath series, family-card illustrations, Sunday-projector candle-flame loops, and the painted app icons under `public/art/` and `public/icons/` were generated on 22 November 2026 with [Fal](https://fal.ai) and then reviewed by a person. They contain no people and no children's faces. They are not Scripture.

The favicon (`public/favicon.svg`) and the in-app wordmark built from it are a hand-traced vector of the AI-generated icon, so they are treated the same way.

| Asset | Model on Fal | Endpoint | License / terms |
|---|---|---|---|
| Wreath stills (five lighting states from one master) and week-card stills | Google Nano Banana Pro | `fal-ai/nano-banana-pro`, `fal-ai/nano-banana-pro/edit` | Listed on Fal with a **Commercial use** badge. Outputs may include an invisible SynthID watermark. |
| Projector flicker loops (Weeks 1 and 4) | Alibaba Wan 3.0 Prime (image-to-video) | `alibaba/wan-3.0-prime/image-to-video` | Listed on Fal with a **Commercial use** badge. |

Fal's terms allow commercial use of a model's output only when that model is marked for commercial use. Fal does not warrant that outputs are original or non-infringing, and the copyright status of AI-generated images is unsettled. For that reason this art is **not claimed as original copyrighted work under the MIT license** that covers the software and documentation. The MIT grant still permits redistributing the files that ship in this repository; it does not assert that we own a copyright in the pictures themselves. See also the note at the end of `LICENSE`.

A Christmas family-card draft that read as a manger or infant shape was rejected and is not in the app. The shipped Christmas card is a crop of the all-lit painted wreath.

The interactive Advent wreath (accessible names, candle state, and the ring of nightly lights) is original, hand-written SVG in `src/client/components/Wreath.tsx`. It remains in the app beside the paintings.
