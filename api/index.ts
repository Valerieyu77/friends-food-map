import { createAppFromEnvironment } from "../server/config.js";

// The built page is the same until the next deploy, so it is fetched once per running function.
let indexHtml: Promise<string> | undefined;

function loadIndexHtml(origin: string): Promise<string> {
  indexHtml ??= fetch(`${origin}/index.html`).then((response) => {
    if (!response.ok) throw new Error(`The page answered ${response.status}`);
    return response.text();
  });
  // A failed fetch is not kept, so the next invite tries again.
  indexHtml.catch(() => {
    indexHtml = undefined;
  });
  return indexHtml;
}

// On Vercel, every /api request and every invite link (/join/...) is sent to this one function (see vercel.json).
export default createAppFromEnvironment(loadIndexHtml);
