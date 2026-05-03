export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { topic } = req.body;

  const PROMPT = `You create viral horror YouTube Shorts packages in the style of MysteryCase channel.

Topic: ${topic}

Create a complete horror short video package. Output ONLY valid JSON, no markdown, no backticks:
{
  "title": "shocking clickbait title that sounds like a true story, under 65 chars, use '...' for suspense",
  "titleAlts": ["alternative title 2", "alternative title 3"],
  "script": "voiceover script exactly 30 seconds at 1.15x speed. Short punchy sentences. Use dashes for pauses. Start with date and location. Build dread. Shocking twist ending. 70-90 words.",
  "description": "YouTube description with emojis like the example: date+location intro, then 4-6 story bullet points with emojis revealing the plot step by step, then separator line, subscribe CTA for @MysteryCase, then 3 related video placeholder links, then separator, then 15-20 relevant hashtags",
  "tags": "comma-separated YouTube tags: mix of broad horror tags and specific story tags, 20-25 tags total",
  "characters": "CHARACTER GUIDE: describe 2-3 main characters with consistent visual details (name, age, hair, clothing, expression progression). Also describe any monster/figure/entity appearance.",
  "imagePrompts": [
    "prompt1", "prompt2", "prompt3", "prompt4", "prompt5",
    "prompt6", "prompt7", "prompt8", "prompt9", "prompt10"
  ]
}

Rules for imagePrompts — FOLLOW EXACTLY:
- Every prompt MUST start with: "Draw a 2D cartoon horror illustration, vertical 9:16 format."
- Every prompt MUST end with: "2D cartoon horror style, flat shading, thick black outlines, 9:16."
- Keep ALL characters visually identical across all 10 images — describe SAME hair color, clothing, face features every time
- Each prompt = ONE specific cinematic moment: describe exact character position, facial expression, body language, what they hold, lighting direction, background details
- At least 3 prompts include a speech bubble with exact dialogue text in quotes
- Horror entity (shadow/figure/ghost) appears subtly in background of early scenes, dominates later scenes
- Final prompt: twist scene — character says something innocent that recontextualizes the horror
- Be SPECIFIC and DETAILED — bad example: "man looks scared in room" — good example: "Dark-haired man in grey t-shirt sits at kitchen table, hunched over glowing phone screen, face pale with terror, coffee gone cold beside him, clock on wall shows 3AM, shadows deep in corners"

Story must be set in USA, sound like a real case, have a shocking twist.`;

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
        model: "openrouter/free",
        messages: [{ role: "user", content: PROMPT }],
        max_tokens: 2000,
        temperature: 1.0,
      }),
    });

    const data = await r.json();
    if (!r.ok || data.error) {
      return res.status(r.status || 500).json({ error: data.error?.message || "OpenRouter error" });
    }

    const text = data.choices?.[0]?.message?.content || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: "Model did not return valid JSON. Try again." });

    const parsed = JSON.parse(match[0]);
    if (!parsed.title || !parsed.script || !Array.isArray(parsed.imagePrompts)) {
      return res.status(500).json({ error: "Invalid JSON structure. Try again." });
    }
    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: "Script error: " + e.message });
  }
}
