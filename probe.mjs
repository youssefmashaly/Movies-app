// probe.mjs
import { JSDOM } from "jsdom";

const dom = new JSDOM("", { url: "http://localhost/" });
const ls = dom.window.localStorage;

console.log("=== raw jsdom probe (no Vitest involved) ===");
console.log("typeof ls:", typeof ls);
console.log("ls constructor:", ls?.constructor?.name);
console.log("removeItem is function:", typeof ls?.removeItem === "function");
console.log("Node version:", process.version);
console.log("Platform:", process.platform);