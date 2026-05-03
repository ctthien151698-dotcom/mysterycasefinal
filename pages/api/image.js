// pages/api/image.js — Pollinations.ai (FREE, no key needed)
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { prompt, index } = req.body;

  const fullPrompt = encodeURIComponent(
    `cinematic horror digital art, dark moody atmosphere, dramatic lighting, deep shadows, crimson and black palette, highly detailed, ${prompt}`
  );

  // Pollinations free image API — no key, no billing
  const url = `https://image.pollinations.ai/prompt/${fullPrompt}?width=720&height=1280&seed=${index || 0}&nologo=true&enhance=true&model=flux`;

  try {
    const r = await fetch(url);
    if (!r.ok) return res.status(r.status).json({ error: `Pollinations error ${r.status}` });

    const arrayBuffer = await r.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return res.status(200).json({ base64, mimeType: "image/jpeg" });
  } catch (e) {
    return res.status(500).json({ error: "Image error: " + e.message });
  }
}
