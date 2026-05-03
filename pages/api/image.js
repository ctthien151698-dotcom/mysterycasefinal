// pages/api/image.js — Gemini Imagen 3 (runs server-side, no CSP/region issues)
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { prompt, index } = req.body;

  // Prompt comes pre-formatted from script model, just enforce cartoon style
  const fullPrompt = `2D cartoon comic illustration style, similar to Kurzgesagt or Saturday morning cartoons but darker. Thick bold black outlines on everything. Flat color fills with minimal shading. Simple clean shapes. Characters have large round expressive eyes and exaggerated cartoon proportions. Muted cool color palette: gray-blue, dark green, pale skin tones. Horror elements present but drawn in cartoon style. Vertical 9:16 format. Scene: ${prompt}. Style reference: web comic illustration, flat design cartoon, NOT realistic, NOT semi-realistic, NOT detailed painterly, NOT anime, NOT manga, NOT 3D render. Must look like a cartoon comic panel.`;

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
      // Fallback to Pollinations if Gemini fails
      console.error("Gemini Imagen failed, falling back to Pollinations:", data.error?.message);
      return fallbackPollinations(req, res, prompt, index);
    }

    return res.status(200).json({
      base64: data.predictions[0].bytesBase64Encoded,
      mimeType: "image/png",
    });
  } catch (e) {
    console.error("Gemini error, falling back:", e.message);
    return fallbackPollinations(req, res, prompt, index);
  }
}

async function fallbackPollinations(req, res, prompt, index) {
  try {
    const fullPrompt = encodeURIComponent(
      `${prompt} 2D cartoon horror style, thick black outlines, flat cell shading, muted colors, vertical 9:16`
    );
    const negativePrompt = encodeURIComponent("photorealistic, 3d render, anime, watermark, blurry");
    const url = `https://image.pollinations.ai/prompt/${fullPrompt}?width=720&height=1280&seed=${(index || 0) * 37 + 13}&nologo=true&enhance=true&model=flux&negative=${negativePrompt}`;
    const r = await fetch(url);
    if (!r.ok) return res.status(500).json({ error: `Fallback Pollinations error ${r.status}` });
    const arrayBuffer = await r.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return res.status(200).json({ base64, mimeType: "image/jpeg", source: "pollinations" });
  } catch (e) {
    return res.status(500).json({ error: "Both Gemini and Pollinations failed: " + e.message });
  }
}
