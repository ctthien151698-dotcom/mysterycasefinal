// pages/api/image.js — Pollinations, cartoon horror style
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { prompt, index } = req.body;

  // Prompt already comes pre-formatted from the model
  // Just append style enforcement
  const fullPrompt = encodeURIComponent(
    `${prompt} 2D cartoon horror style, thick black outlines, flat cell shading, muted desaturated colors, Kurzgesagt-dark aesthetic, characters have large expressive eyes and exaggerated emotions, clean linework, vertical 9:16 portrait`
  );

  const negativePrompt = encodeURIComponent(
    "photorealistic, 3d render, anime, chibi, bright cheerful colors, watermark, text overlay, blurry, dark moody cinematic"
  );

  const url = `https://image.pollinations.ai/prompt/${fullPrompt}?width=720&height=1280&seed=${(index || 0) * 37 + 13}&nologo=true&enhance=true&model=flux&negative=${negativePrompt}`;

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
