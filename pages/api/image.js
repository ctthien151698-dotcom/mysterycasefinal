// pages/api/image.js — Gemini Imagen 3, dùng thẳng prompt từ model
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { prompt, index } = req.body;

  // Dùng thẳng prompt — model đã format đúng style rồi
  // Chỉ thêm negative hint ở cuối
  const fullPrompt = `${prompt} Art style: flat 2D cartoon illustration, thick black outlines, simple flat color fills, NOT photorealistic, NOT painterly, NOT semi-realistic.`;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt: fullPrompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: "9:16",
            safetyFilterLevel: "block_only_high",
            personGeneration: "allow_adult",
          },
        }),
      }
    );

    const data = await r.json();
    if (!r.ok || !data.predictions?.[0]?.bytesBase64Encoded) {
      console.error("Gemini failed:", data.error?.message);
      return fallbackPollinations(res, prompt, index);
    }

    return res.status(200).json({
      base64: data.predictions[0].bytesBase64Encoded,
      mimeType: "image/png",
    });
  } catch (e) {
    return fallbackPollinations(res, prompt, index);
  }
}

async function fallbackPollinations(res, prompt, index) {
  try {
    const q = encodeURIComponent(`${prompt} 2D cartoon style, flat shading, thick outlines`);
    const url = `https://image.pollinations.ai/prompt/${q}?width=720&height=1280&seed=${(index||0)*37+13}&nologo=true&model=flux`;
    const r = await fetch(url);
    if (!r.ok) return res.status(500).json({ error: `Pollinations ${r.status}` });
    const base64 = Buffer.from(await r.arrayBuffer()).toString("base64");
    return res.status(200).json({ base64, mimeType: "image/jpeg" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
