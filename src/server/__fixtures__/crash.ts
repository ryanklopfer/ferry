import { bootProcess } from "../boot";

bootProcess(process.env.CRASH_KIND ?? "crash_fixture");
const [how, marker] = process.argv.slice(2);

if (how === "reject") void Promise.reject(new TypeError(`insert failed for ${marker}`));
if (how === "throw") setTimeout(() => { throw new RangeError(`bad value ${marker}`); }, 0);
if (how === "postpone") void Promise.reject({ $$typeof: Symbol.for("react.postpone"), message: marker });
if (how === "console") {
  console.error(`request failed for ${marker}`, new SyntaxError(marker));
  console.warn(`warning about ${marker}`);
}
setTimeout(() => process.stdout.write("still-running\n"), 100);
