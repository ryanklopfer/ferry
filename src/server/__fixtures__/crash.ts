import { bootProcess } from "../boot";

bootProcess("crash_fixture");
const [how, marker] = process.argv.slice(2);

if (how === "reject") void Promise.reject(new TypeError(`insert failed for ${marker}`));
if (how === "throw") setTimeout(() => { throw new RangeError(`bad value ${marker}`); }, 0);
if (how === "console") {
  console.error(`request failed for ${marker}`, new SyntaxError(marker));
  console.warn(`warning about ${marker}`);
}
