import { randomInt } from "node:crypto"
import { join } from "node:path"
import sharp from "sharp"
import svgCaptcha from "svg-captcha"

// The upstream declaration omits its callable export for rendering existing text.
const renderSvg = svgCaptcha as unknown as (
  text: string,
  options: Parameters<typeof svgCaptcha.create>[0]
) => string
svgCaptcha.loadFont(join(process.cwd(), "lib/fonts/Geist-Regular.ttf"))

/** Draw with font paths directly, avoiding a layout tree and per-node clipping masks. */
export function captchaImage(answer: string) {
  const dots = Array.from(
    { length: 36 },
    () =>
      `M ${randomInt(200)} ${randomInt(72)} m -1 0 a 1 1 0 1 0 2 0 a 1 1 0 1 0 -2 0`
  ).join(" ")
  const letters = [...answer]
    .map((letter, i) => {
      const color = ["#193b39", "#234b65", "#593554"][randomInt(3)]
      const glyph = renderSvg(letter, {
        width: 40,
        height: 72,
        fontSize: randomInt(32, 41),
        noise: 0,
        color: false,
      })
        .replace(/^<svg[^>]*>|<\/svg>$/g, "")
        .replace(/fill="#[0-9a-f]+"/g, `fill="${color}"`)
      return `<g transform="translate(${i * 40} ${randomInt(-5, 6)}) rotate(${randomInt(-17, 18)} 20 36)">${glyph}</g>`
    })
    .join("")
  const lines = Array.from(
    { length: 3 },
    () =>
      `<path d="M 0 ${randomInt(12, 60)} Q 100 ${randomInt(72)} 200 ${randomInt(12, 60)}" stroke="#788f8b" stroke-width="1.2" opacity="0.5" fill="none"/>`
  ).join("")
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="72" viewBox="0 0 200 72"><rect width="200" height="72" fill="#edf4f3"/><path d="${dots}" fill="#899b99" opacity="0.4"/>${letters}${lines}</svg>`
  // Neither the answer nor the intermediate SVG is returned to the browser.
  return sharp(Buffer.from(svg)).png({ compressionLevel: 3 }).toBuffer()
}
