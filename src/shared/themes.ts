import type { ThemeKey } from "./season";

export const THEMES: Record<ThemeKey, { en: string; es: string; guide: string }> = {
  names: {
    en: "Names of Jesus",
    es: "Los nombres de Jesús",
    guide:
      "Each night centers on one name or title the Bible gives Jesus (for example Wonderful Counselor, Prince of Peace, Immanuel, Light of the World, Good Shepherd, Savior). Help families wonder what each name tells us about who Jesus is.",
  },
  prophecy: {
    en: "From Prophecy to Manger",
    es: "De la profecía al pesebre",
    guide:
      "Walk from the promises in the prophets (Isaiah, Micah, Malachi) through the announcements in Matthew and Luke to the birth in Bethlehem. Help families notice that God keeps his promises, even when the waiting is long.",
  },
  luke: {
    en: "Luke 1–2 slowly",
    es: "Lucas 1–2 despacio",
    guide:
      "Read Luke chapters 1 and 2 in order, a few verses each night, so the whole Christmas story unfolds across Advent: Zechariah, Gabriel and Mary, Mary and Elizabeth, John's birth, the journey to Bethlehem, the shepherds, Simeon and Anna.",
  },
  light: {
    en: "Light in the Darkness",
    es: "Luz en la oscuridad",
    guide:
      "Follow the thread of light through Scripture: people walking in darkness see a great light, the dawn from on high, the Word who is the light of all people. Help families talk honestly about dark and hard things and the hope that Jesus brings.",
  },
};

export const ALLOWED_BOOKS_TEXT = "Isaiah, Micah, Malachi, Psalms, Matthew, Luke, John, Galatians";
