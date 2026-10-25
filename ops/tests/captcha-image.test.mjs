import assert from "node:assert/strict"
import test from "node:test"
import sharp from "sharp"

import { captchaImage } from "../lib/captcha-image.ts"

test("verification images are rasterized PNGs without SVG or answer text", async () => {
  const png = await captchaImage("QCPX7")
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a")
  const metadata = await sharp(png).metadata()
  assert.equal(metadata.format, "png")
  assert.equal(metadata.width, 200)
  assert.equal(metadata.height, 72)
  assert.equal(png.includes(Buffer.from("QCPX7")), false)
  assert.equal(png.includes(Buffer.from("<svg")), false)
})

test("every allowed character has visible ink in its image cell", async () => {
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
  for (let i = 0; i < alphabet.length; i += 5) {
    const answer = alphabet.slice(i, i + 5).padEnd(5, "2")
    const { data, info } = await sharp(await captchaImage(answer))
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    for (let cell = 0; cell < 5; cell++) {
      let ink = 0
      for (let y = 0; y < info.height; y++) {
        for (let x = cell * 40; x < (cell + 1) * 40; x++) {
          const offset = (y * info.width + x) * info.channels
          if (Math.max(data[offset], data[offset + 1], data[offset + 2]) < 150)
            ink++
        }
      }
      assert.ok(ink > 20, `${answer[cell]} must have visible ink`)
    }
  }
})

test("redrawing an answer changes its image", async () => {
  const first = await captchaImage("QCPX7")
  const second = await captchaImage("QCPX7")
  assert.notDeepEqual(first, second)
})
