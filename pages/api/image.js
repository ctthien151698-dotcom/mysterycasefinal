// pages/api/image.js — Pollinations turbo (best cartoon style)
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { prompt, index } = req.body;

  // Pollinations with turbo model follows cartoon style much better than Gemini Imagen
  const q = encodeURIComponent(prompt);
  const url = `https://image.pollinations.ai/prompt/${q}?width=720&height=1280&seed=${(index||0)*37+13}&nologo=true&enhance=false&model=turbo`;

  try {
    const r = await fetch(url);
    if (!r.ok) return res.status(500).json({ error: `Image error ${r.status}` });
    const base64 = Buffer.from(await r.arrayBuffer()).toString("base64");
    return res.status(200).json({ base64, mimeType: "image/jpeg" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
