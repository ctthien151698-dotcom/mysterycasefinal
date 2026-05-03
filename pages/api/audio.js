// pages/api/audio.js — ElevenLabs TTS (eleven_multilingual_v2)
export const config = { api: { responseLimit: "20mb" } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { script, voiceId = "pNInz6obpgDQGcFmaJgB" } = req.body;

  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: script,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.8,
          style: 0.2,
          use_speaker_boost: true,
        },
      }),
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      const msg = err?.detail?.message || err?.detail || JSON.stringify(err) || `ElevenLabs error ${r.status}`;
      return res.status(r.status).json({ error: msg });
    }

    const arrayBuffer = await r.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return res.status(200).json({ base64, mimeType: "audio/mpeg" });
  } catch (e) {
    return res.status(500).json({ error: "Audio error: " + e.message });
  }
}
