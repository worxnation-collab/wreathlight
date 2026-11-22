// Canonical 66-book list. code = 3-letter id used in our dataset.
// en = English display name, es = Spanish display name, alt = extra accepted spellings.
export interface Book { code: string; en: string; es: string; alt?: string[] }

export const BOOKS: Book[] = [
  { code: "GEN", en: "Genesis", es: "Génesis", alt: ["Gen", "Gn"] },
  { code: "EXO", en: "Exodus", es: "Éxodo", alt: ["Exod", "Ex"] },
  { code: "LEV", en: "Leviticus", es: "Levítico", alt: ["Lev"] },
  { code: "NUM", en: "Numbers", es: "Números", alt: ["Num"] },
  { code: "DEU", en: "Deuteronomy", es: "Deuteronomio", alt: ["Deut", "Dt"] },
  { code: "JOS", en: "Joshua", es: "Josué", alt: ["Josh"] },
  { code: "JDG", en: "Judges", es: "Jueces", alt: ["Judg"] },
  { code: "RUT", en: "Ruth", es: "Rut" },
  { code: "1SA", en: "1 Samuel", es: "1 Samuel", alt: ["1 Sam"] },
  { code: "2SA", en: "2 Samuel", es: "2 Samuel", alt: ["2 Sam"] },
  { code: "1KI", en: "1 Kings", es: "1 Reyes", alt: ["1 Kgs"] },
  { code: "2KI", en: "2 Kings", es: "2 Reyes", alt: ["2 Kgs"] },
  { code: "1CH", en: "1 Chronicles", es: "1 Crónicas", alt: ["1 Chr"] },
  { code: "2CH", en: "2 Chronicles", es: "2 Crónicas", alt: ["2 Chr"] },
  { code: "EZR", en: "Ezra", es: "Esdras" },
  { code: "NEH", en: "Nehemiah", es: "Nehemías", alt: ["Neh"] },
  { code: "EST", en: "Esther", es: "Ester", alt: ["Esth"] },
  { code: "JOB", en: "Job", es: "Job" },
  { code: "PSA", en: "Psalm", es: "Salmos", alt: ["Psalms", "Ps", "Psa", "Salmo"] },
  { code: "PRO", en: "Proverbs", es: "Proverbios", alt: ["Prov"] },
  { code: "ECC", en: "Ecclesiastes", es: "Eclesiastés", alt: ["Eccl"] },
  { code: "SOL", en: "Song of Solomon", es: "Cantares", alt: ["Song of Songs", "Song"] },
  { code: "ISA", en: "Isaiah", es: "Isaías", alt: ["Isa"] },
  { code: "JER", en: "Jeremiah", es: "Jeremías", alt: ["Jer"] },
  { code: "LAM", en: "Lamentations", es: "Lamentaciones", alt: ["Lam"] },
  { code: "EZE", en: "Ezekiel", es: "Ezequiel", alt: ["Ezek"] },
  { code: "DAN", en: "Daniel", es: "Daniel", alt: ["Dan"] },
  { code: "HOS", en: "Hosea", es: "Oseas", alt: ["Hos"] },
  { code: "JOE", en: "Joel", es: "Joel" },
  { code: "AMO", en: "Amos", es: "Amós" },
  { code: "OBA", en: "Obadiah", es: "Abdías", alt: ["Obad"] },
  { code: "JON", en: "Jonah", es: "Jonás" },
  { code: "MIC", en: "Micah", es: "Miqueas", alt: ["Mic"] },
  { code: "NAH", en: "Nahum", es: "Nahúm" },
  { code: "HAB", en: "Habakkuk", es: "Habacuc", alt: ["Hab"] },
  { code: "ZEP", en: "Zephaniah", es: "Sofonías", alt: ["Zeph"] },
  { code: "HAG", en: "Haggai", es: "Hageo", alt: ["Hag"] },
  { code: "ZEC", en: "Zechariah", es: "Zacarías", alt: ["Zech"] },
  { code: "MAL", en: "Malachi", es: "Malaquías", alt: ["Mal"] },
  { code: "MAT", en: "Matthew", es: "Mateo", alt: ["Matt", "Mt"] },
  { code: "MAR", en: "Mark", es: "Marcos", alt: ["Mk"] },
  { code: "LUK", en: "Luke", es: "Lucas", alt: ["Lk"] },
  { code: "JOH", en: "John", es: "Juan", alt: ["Jn"] },
  { code: "ACT", en: "Acts", es: "Hechos" },
  { code: "ROM", en: "Romans", es: "Romanos", alt: ["Rom"] },
  { code: "1CO", en: "1 Corinthians", es: "1 Corintios", alt: ["1 Cor"] },
  { code: "2CO", en: "2 Corinthians", es: "2 Corintios", alt: ["2 Cor"] },
  { code: "GAL", en: "Galatians", es: "Gálatas", alt: ["Gal"] },
  { code: "EPH", en: "Ephesians", es: "Efesios", alt: ["Eph"] },
  { code: "PHI", en: "Philippians", es: "Filipenses", alt: ["Phil"] },
  { code: "COL", en: "Colossians", es: "Colosenses", alt: ["Col"] },
  { code: "1TH", en: "1 Thessalonians", es: "1 Tesalonicenses", alt: ["1 Thess"] },
  { code: "2TH", en: "2 Thessalonians", es: "2 Tesalonicenses", alt: ["2 Thess"] },
  { code: "1TI", en: "1 Timothy", es: "1 Timoteo", alt: ["1 Tim"] },
  { code: "2TI", en: "2 Timothy", es: "2 Timoteo", alt: ["2 Tim"] },
  { code: "TIT", en: "Titus", es: "Tito" },
  { code: "PHM", en: "Philemon", es: "Filemón", alt: ["Phlm"] },
  { code: "HEB", en: "Hebrews", es: "Hebreos", alt: ["Heb"] },
  { code: "JAM", en: "James", es: "Santiago", alt: ["Jas"] },
  { code: "1PE", en: "1 Peter", es: "1 Pedro", alt: ["1 Pet"] },
  { code: "2PE", en: "2 Peter", es: "2 Pedro", alt: ["2 Pet"] },
  { code: "1JO", en: "1 John", es: "1 Juan", alt: ["1 Jn"] },
  { code: "2JO", en: "2 John", es: "2 Juan", alt: ["2 Jn"] },
  { code: "3JO", en: "3 John", es: "3 Juan", alt: ["3 Jn"] },
  { code: "JUD", en: "Jude", es: "Judas" },
  { code: "REV", en: "Revelation", es: "Apocalipsis", alt: ["Rev"] },
];

// Books whose verse text ships with the Worker (Advent themes). Others: existence index only.
export const TEXT_BOOKS = ["ISA", "MIC", "MAL", "PSA", "MAT", "LUK", "JOH", "GAL"] as const;

const norm = (s: string) => s.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
const LOOKUP = new Map<string, string>();
for (const b of BOOKS) {
  for (const n of [b.code, b.en, b.es, ...(b.alt ?? [])]) LOOKUP.set(norm(n), b.code);
}
export function bookCode(name: string): string | undefined {
  return LOOKUP.get(norm(name));
}
export function bookByCode(code: string): Book | undefined {
  return BOOKS.find((b) => b.code === code);
}
