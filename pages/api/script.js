// pages/api/script.js — OpenRouter (FREE, no billing needed)
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { topic } = req.body;

  const PROMPT = `You are a horror YouTube Shorts content creator for "MysteryCase".
Respond ONLY with a valid JSON object. No markdown, no backticks, no explanation.
{
  "title": "one shocking clickbait title under 60 chars",
  "script": "voiceover script 60-80 words, no stage directions, natural spoken sentences",
  "imagePrompts": ["prompt1","prompt2","prompt3","prompt4","prompt5","prompt6","prompt7","prompt8","prompt9","prompt10"]
}
Rules:
- Each imagePrompt: describe a unique horror scene, dark cinematic style, vertical portrait
- Keep characters visually consistent across all prompts
- Story set in USA, realistic, shocking twist ending
- Output ONLY the JSON object

Topic: ${topic}`;

  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + process.env.OPENROUTER_API_KEY,
        "HTTP-Referer": "https://mysterycase.vercel.app",
        "X-Title": "MysteryCase Video Tool",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-exp:free",
        messages: [{ role: "user", content: PROMPT }],
        max_tokens: 1200,
        temperature: 0.9,
      }),
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.error?.message || "OpenRouter error" });

    const text = data.choices?.[0]?.message?.content || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    if (!parsed.title || !parsed.script || !Array.isArray(parsed.imagePrompts)) {
      return res.status(500).json({ error: "Invalid JSON from model" });
    }
    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: "Script error: " + e.message });
  }
}
