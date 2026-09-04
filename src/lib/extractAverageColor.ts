// Phase 57 — lightweight average-color sampler for the "Featured Today" hero
// backdrop, used to tint the page's ambient background to match whichever
// movie is currently featured.
//
// Draws a small (24×24) downscaled copy of the backdrop onto an off-screen
// canvas and averages the pixel data. The sample is tiny on purpose — this
// runs on the main thread and must stay well under a millisecond regardless
// of device.
//
// Known limitation: TMDB's image CDN does not consistently send
// Access-Control-Allow-Origin on every image (confirmed via TMDB's own
// support forum — this has changed over time and varies by asset), so
// `crossOrigin = "anonymous"` does not guarantee a readable canvas. When the
// canvas is tainted, `getImageData()` throws a SecurityError; this resolves
// to `null` in that case (and on load failure) rather than throwing, so
// callers should always have a static fallback color ready.
export function extractAverageColor(url: string): Promise<[number, number, number] | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";

    img.onload = () => {
      try {
        const SAMPLE = 24;
        const canvas = document.createElement("canvas");
        canvas.width = SAMPLE;
        canvas.height = SAMPLE;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
        const { data } = ctx.getImageData(0, 0, SAMPLE, SAMPLE);

        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
        if (count === 0) {
          resolve(null);
          return;
        }
        resolve([Math.round(r / count), Math.round(g / count), Math.round(b / count)]);
      } catch {
        // Canvas tainted by a cross-origin image served without CORS headers.
        resolve(null);
      }
    };

    img.onerror = () => resolve(null);
    img.src = url;
  });
}