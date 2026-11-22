// Precomputes the 10-word quotation index so the Worker never builds it at request time.
// Usage: npx tsx scripts/build-shingles.ts  (run after import-bible)
import { writeFileSync } from "node:fs";
import { buildShingleHashes, encodeShingles, decodeShingles } from "../src/shared/scripture";
const hashes = buildShingleHashes();
const bin = encodeShingles(hashes);
const back = decodeShingles(bin);
if (back.length !== hashes.length || back.some((v, i) => v !== hashes[i])) throw new Error("round-trip failed");
writeFileSync("content/bible/shingles.bin", bin);
console.log(hashes.length, "windows,", bin.length, "bytes");
