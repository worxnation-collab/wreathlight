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
