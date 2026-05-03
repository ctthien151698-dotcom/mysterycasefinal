import { useState, useRef, useCallback } from "react";

const CANVAS_W = 720;
const CANVAS_H = 1280;

const VOICES = [
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam — Deep & Dark" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel — Mysterious" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh — Intense" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold — Commanding" },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

const loadImage = src => new Promise((res, rej) => {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => res(img);
  img.onerror = rej;
  img.src = src;
});

const phases = ["script", "images", "audio", "video", "done"];
const phaseLabels = { script: "📄 Script", images: "🖼️ Images", audio: "🎙️ Audio", video: "🎬 Video", done: "✅ Done" };

export default function MysteryVideoTool() {
  const [voice, setVoice] = useState(VOICES[0].id);
  const [topic, setTopic] = useState("");
  const [phase, setPhase] = useState("idle");
  const [log, setLog] = useState([]);
  const [content, setContent] = useState(null);
  const [images, setImages] = useState([]);
  const [audioUrl, setAudioUrl] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [imgProgress, setImgProgress] = useState(0);
  const [error, setError] = useState("");
  const canvasRef = useRef(null);

  const addLog = useCallback((msg, type = "info") => {
    setLog(prev => [...prev, { msg, type, t: Date.now() }]);
  }, []);

  // STEP 1: Script via Next.js API route → Claude
  const generateScript = async (topic) => {
    addLog("🤖 Claude is writing your horror story...", "info");
    const res = await fetch("/api/script", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Script error ${res.status}`);
    return data;
  };

  // STEP 2: Image via Next.js API route → Gemini Imagen 3
  const generateImage = async (prompt, index, storyTitle, scriptLine) => {
    addLog(`🖼️ Generating image ${index + 1}/10...`, "info");
    const res = await fetch("/api/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, index, title: storyTitle, scriptLine }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Image ${index + 1} failed`);
    return `data:${data.mimeType || "image/png"};base64,${data.base64}`;
  };

  // STEP 3: Audio via Next.js API route → ElevenLabs
  const generateAudio = async (script) => {
    addLog("🎙️ ElevenLabs generating voiceover...", "info");
    const res = await fetch("/api/audio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ script, voiceId: voice }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Audio failed");
    return `data:${data.mimeType};base64,${data.base64}`;
  };

  // STEP 4: Assemble video — Ken Burns + Glitch/Flicker + Auto Subtitles
  const assembleVideo = async (imgSrcs, audioSrc, title, script) => {
    addLog("🎬 Assembling video with effects...", "info");
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;

    const imgs = await Promise.all(imgSrcs.map(loadImage));
    const audio = new Audio(audioSrc);
    await new Promise(r => { audio.onloadedmetadata = r; });
    const totalDuration = audio.duration;
    const timePerImg = (totalDuration / imgs.length) * 1000;

    // Auto subtitles
    const buildSubtitles = (text, dur) => {
      const words = (text || "").split(/\s+/).filter(Boolean);
      const chunks = [];
      for (let i = 0; i < words.length; i += 5)
        chunks.push(words.slice(i, i + 5).join(" "));
      const cd = (dur * 1000) / chunks.length;
      return chunks.map((t, i) => ({ text: t, start: i * cd, end: (i + 1) * cd }));
    };
    const subtitles = buildSubtitles(script, totalDuration);

    // Ken Burns
    const kbPresets = [
      { sx: 0, sy: 0, ex: -0.04, ey: -0.04, sz: 1.10, ez: 1.05 },
      { sx: -0.04, sy: 0, ex: 0, ey: -0.04, sz: 1.08, ez: 1.13 },
      { sx: 0, sy: -0.04, ex: -0.03, ey: 0, sz: 1.12, ez: 1.07 },
      { sx: -0.05, sy: -0.05, ex: 0, ey: 0, sz: 1.14, ez: 1.09 },
      { sx: 0, sy: -0.03, ex: 0, ey: 0, sz: 1.09, ez: 1.09 },
    ];
    const kbAll = imgs.map(() => kbPresets[Math.floor(Math.random() * kbPresets.length)]);

    const drawSubtitle = (elapsed) => {
      const sub = subtitles.find(s => elapsed >= s.start && elapsed < s.end);
      if (!sub) return;
      const fs = 38;
      ctx.font = `bold ${fs}px Arial, sans-serif`;
      ctx.textAlign = "center";
      const mw = ctx.measureText(sub.text).width;
      const px = 24, py = 14;
      const bx = (CANVAS_W - mw - px * 2) / 2;
      const by = CANVAS_H - 230 - fs - py * 2;
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.fillRect(bx, by, mw + px * 2, fs + py * 2);
      ctx.strokeStyle = "#ff1111"; ctx.lineWidth = 2;
      ctx.strokeText(sub.text, CANVAS_W / 2, by + py + fs - 4);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(sub.text, CANVAS_W / 2, by + py + fs - 4);
    };

    const drawGlitch = () => {
      if (Math.random() < 0.08) {
        const shift = 3 + Math.random() * 6;
        const id = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
        const d = id.data;
        for (let y = 0; y < CANVAS_H; y++) {
          for (let x = 0; x < CANVAS_W; x++) {
            const i = (y * CANVAS_W + x) * 4;
            const ri = (y * CANVAS_W + Math.min(CANVAS_W - 1, x + Math.floor(shift))) * 4;
            const bi = (y * CANVAS_W + Math.max(0, x - Math.floor(shift / 2))) * 4;
            if (ri < d.length) d[i] = d[ri];
            if (bi + 2 < d.length) d[i + 2] = d[bi + 2];
          }
        }
        ctx.putImageData(id, 0, 0);
      }
      if (Math.random() < 0.12) {
        const nb = 1 + Math.floor(Math.random() * 3);
        for (let b = 0; b < nb; b++) {
          const by2 = Math.floor(Math.random() * CANVAS_H);
          const bh = 2 + Math.floor(Math.random() * 8);
          const ox = (Math.random() - 0.5) * 20;
          try { const strip = ctx.getImageData(0, by2, CANVAS_W, bh); ctx.putImageData(strip, ox, by2); } catch (_) {}
        }
      }
    };

    const drawFlicker = () => {
      if (Math.random() < 0.04) { ctx.fillStyle = `rgba(0,0,0,${0.3 + Math.random() * 0.5})`; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H); }
      if (Math.random() < 0.01) { ctx.fillStyle = "rgba(180,0,0,0.15)"; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H); }
    };

    const drawFrame = (img, alpha, kbProg, kb, elapsed) => {
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.globalAlpha = alpha;
      const zoom = kb.sz + (kb.ez - kb.sz) * kbProg;
      const panX = kb.sx + (kb.ex - kb.sx) * kbProg;
      const panY = kb.sy + (kb.ey - kb.sy) * kbProg;
      const scale = Math.max(CANVAS_W / img.width, CANVAS_H / img.height) * zoom;
      const w = img.width * scale, h = img.height * scale;
      ctx.drawImage(img, (CANVAS_W - w) / 2 + panX * CANVAS_W, (CANVAS_H - h) / 2 + panY * CANVAS_H, w, h);
      const grad = ctx.createRadialGradient(CANVAS_W/2, CANVAS_H/2, CANVAS_H*0.3, CANVAS_W/2, CANVAS_H/2, CANVAS_H*0.8);
      grad.addColorStop(0, "rgba(0,0,0,0)"); grad.addColorStop(1, "rgba(80,0,0,0.65)");
      ctx.globalAlpha = 1; ctx.fillStyle = grad; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      for (let y = 0; y < CANVAS_H; y += 4) ctx.fillRect(0, y, CANVAS_W, 1);
      drawGlitch(); drawFlicker();
      ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, CANVAS_H - 100, CANVAS_W, 100);
      ctx.font = "bold 26px 'Courier New', monospace"; ctx.fillStyle = "#ff3333"; ctx.textAlign = "center";
      ctx.fillText("MYSTERYCASE", CANVAS_W / 2, CANVAS_H - 62);
      ctx.font = "bold 17px Arial"; ctx.fillStyle = "#ffffff";
      ctx.fillText(title.length > 45 ? title.substring(0, 45) + "..." : title, CANVAS_W / 2, CANVAS_H - 30);
      if (elapsed !== undefined) drawSubtitle(elapsed);
    };

    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaElementSource(audio);
    const dest = audioCtx.createMediaStreamDestination();
    source.connect(dest); source.connect(audioCtx.destination);
    const videoStream = canvas.captureStream(30);
    const combined = new MediaStream([videoStream.getVideoTracks()[0], dest.stream.getAudioTracks()[0]]);
    const chunks = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm";
    const recorder = new MediaRecorder(combined, { mimeType });
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    const done = new Promise(res => { recorder.onstop = () => res(URL.createObjectURL(new Blob(chunks, { type: "video/webm" }))); });

    recorder.start(100);
    const t0 = Date.now();
    audio.play();

    for (let i = 0; i < imgs.length; i++) {
      addLog(`🎞️ Scene ${i + 1}/${imgs.length}...`, "info");
      const kb = kbAll[i];
      const fadeF = 12;
      for (let f = 0; f < fadeF; f++) { drawFrame(imgs[i], f / fadeF, 0, kb, Date.now() - t0); await sleep(16); }
      const holdMs = timePerImg - fadeF * 16 * 2;
      const hs = Date.now();
      while (Date.now() - hs < holdMs) { drawFrame(imgs[i], 1, (Date.now() - hs) / holdMs, kb, Date.now() - t0); await sleep(16); }
      if (i < imgs.length - 1) for (let f = fadeF; f >= 0; f--) { drawFrame(imgs[i], f / fadeF, 1, kb, Date.now() - t0); await sleep(16); }
    }

    await new Promise(r => { audio.onended = r; });
    await sleep(500);
    recorder.stop();
    const url = await done;
    audioCtx.close();
    return url;
  };

  // Main pipeline
  const run = useCallback(async () => {
    if (!topic.trim()) return;
    setError(""); setLog([]); setImages([]); setAudioUrl(null); setVideoUrl(null); setImgProgress(0);

    const failWith = (step, err) => {
      const raw = err?.message || String(err) || "Unknown error";
      let friendly = raw;
      if (raw.includes("429")) friendly = "Đã hết quota API (429). Đợi 1 phút rồi thử lại.";
      else if (raw.includes("401") || raw.includes("invalid")) friendly = "API Key không hợp lệ. Kiểm tra lại trong Vercel Environment Variables.";
      else if (raw.includes("overloaded") || raw.includes("529")) friendly = "API đang quá tải. Đợi vài giây rồi thử lại.";
      else if (raw.includes("fetch") || raw.includes("network")) friendly = "Lỗi kết nối. Kiểm tra internet.";
      setError(`[${step}] ${friendly}`);
      addLog(`❌ [${step}] ${friendly}`, "error");
      setPhase("idle");
    };

    try {
      setPhase("script");
      let c;
      try { c = await generateScript(topic); } catch (e) { failWith("Script", e); return; }
      setContent(c);
      addLog(`✅ Script: "${c.title}"`, "success");

      setPhase("images");
      const generatedImgs = [];
      // Split script into lines for speech bubbles per image
      const scriptSentences = (c.script || "").split(/(?<=[.!?\u2014])\s+/).filter(Boolean);
      const scriptLines = Array.from({length: 10}, (_, s) => {
        const perImg = Math.ceil(scriptSentences.length / 10);
        return scriptSentences.slice(s * perImg, (s + 1) * perImg).join(" ");
      });
      for (let i = 0; i < c.imagePrompts.length; i += 2) {
        const batch = c.imagePrompts.slice(i, i + 2);
        let results;
        try { results = await Promise.all(batch.map((p, j) => generateImage(p, i + j, c.title, scriptLines[i + j]))); }
        catch (e) { failWith(`Image ${i + 1}–${Math.min(i + 2, c.imagePrompts.length)}`, e); return; }
        generatedImgs.push(...results);
        setImages([...generatedImgs]);
        setImgProgress(generatedImgs.length);
        await sleep(300);
      }
      addLog("✅ All 10 images generated!", "success");

      setPhase("audio");
      let aUrl;
      try { aUrl = await generateAudio(c.script); } catch (e) { failWith("Audio", e); return; }
      setAudioUrl(aUrl);
      addLog("✅ Voiceover ready!", "success");

      setPhase("video");
      addLog("🎬 Building video (~30s)...", "info");
      let vUrl;
      try { vUrl = await assembleVideo(generatedImgs, aUrl, c.title, c.script); } catch (e) { failWith("Video", e); return; }
      setVideoUrl(vUrl);
      addLog("✅ VIDEO READY! Download below 👇", "success");
      setPhase("done");
    } catch (e) {
      failWith("Unknown", e);
    }
  }, [topic, voice]);

  const download = () => {
    if (!videoUrl) return;
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = `mysterycase-${Date.now()}.webm`;
    a.click();
  };

  const s = {
    page: { minHeight: "100vh", background: "#000", color: "#fff", fontFamily: "'Courier New', monospace" },
    header: { background: "#050505", borderBottom: "1px solid #1a0000", padding: "16px 28px", display: "flex", alignItems: "center", gap: 16, justifyContent: "space-between" },
    logo: { width: 44, height: 44, borderRadius: "50%", border: "2px solid #ff3333", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 },
    card: { background: "#080808", border: "1px solid #1a0000", borderRadius: 8, padding: "20px 24px", marginBottom: 20, position: "relative" },
    label: { fontSize: 10, letterSpacing: 3, color: "#ff3333", display: "block", marginBottom: 12, fontWeight: "bold" },
    input: { width: "100%", background: "#050505", border: "1px solid #1a0000", borderRadius: 4, padding: "12px 14px", color: "#ccc", fontSize: 13, fontFamily: "'Courier New', monospace", marginBottom: 16, outline: "none" },
    select: { width: "100%", background: "#050505", border: "1px solid #1a0000", borderRadius: 4, padding: "10px 14px", color: "#ccc", fontSize: 12, fontFamily: "'Courier New', monospace", marginBottom: 16, outline: "none" },
    btn: (disabled) => ({ background: disabled ? "#1a0000" : "#ff3333", border: "none", borderRadius: 4, padding: "12px 24px", color: disabled ? "#333" : "#fff", fontFamily: "'Courier New', monospace", fontSize: 11, fontWeight: "bold", letterSpacing: "2px", cursor: disabled ? "not-allowed" : "pointer", whiteSpace: "nowrap", transition: "all 0.2s" }),
  };

  const isRunning = phase !== "idle" && phase !== "done";

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={s.logo}>👁️</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: "bold", letterSpacing: 4, color: "#fff" }}>MYSTERYCASE</div>
            <div style={{ fontSize: 10, color: "#ff3333", letterSpacing: 3 }}>AUTO VIDEO GENERATOR</div>
            <div style={{ fontSize: 9, color: "#550000", letterSpacing: 2, marginTop: 2 }}>📝 SUBTITLES · ✨ GLITCH · 🔍 KEN BURNS</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select style={{ ...s.select, marginBottom: 0, width: "auto", fontSize: 10 }} value={voice} onChange={e => setVoice(e.target.value)}>
            {VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 20px" }}>

        {/* Topic + Create */}
        <div style={s.card}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg,transparent,#ff3333,transparent)" }} />
          <label style={s.label}>▸ STORY TOPIC</label>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              style={{ ...s.input, marginBottom: 0, flex: 1 }}
              value={topic}
              onChange={e => setTopic(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !isRunning && run()}
              placeholder="e.g. haunted hospital, possessed mirror, mysterious phone calls..."
              disabled={isRunning}
            />
            <button style={s.btn(isRunning || !topic.trim())} disabled={isRunning || !topic.trim()} onClick={run}>
              {isRunning ? "RUNNING..." : "▸ CREATE VIDEO"}
            </button>
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["haunted hospital", "possessed mirror", "mysterious phone call", "cursed painting", "ghost in camera"].map(t => (
              <button key={t} onClick={() => setTopic(t)} disabled={isRunning}
                style={{ background: "transparent", border: "1px solid #2a0000", borderRadius: 3, padding: "3px 8px", color: "#555", fontSize: 10, cursor: "pointer", fontFamily: "'Courier New', monospace" }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{ background: "#1a0000", border: "2px solid #ff3333", borderRadius: 8, padding: "18px 20px", marginBottom: 20, boxShadow: "0 0 24px #ff333344" }}>
            <div style={{ color: "#ff4444", fontSize: 11, letterSpacing: 2, fontWeight: "bold", marginBottom: 8 }}>⚠️ LỖI — ĐÃ ROLLBACK VỀ CREATE VIDEO</div>
            <div style={{ color: "#ff9999", fontSize: 13, lineHeight: 1.7, fontFamily: "Arial, sans-serif", marginBottom: 14, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{error}</div>
            <button onClick={() => { setError(""); setTimeout(run, 50); }} style={s.btn(false)}>▸ THỬ LẠI</button>
            <button onClick={() => setError("")} style={{ marginLeft: 10, background: "transparent", border: "1px solid #440000", borderRadius: 4, padding: "9px 16px", color: "#666", fontFamily: "'Courier New', monospace", fontSize: 11, cursor: "pointer" }}>✕ ĐÓNG</button>
          </div>
        )}

        {/* Pipeline progress */}
        {phase !== "idle" && (
          <div style={s.card}>
            <label style={s.label}>▸ PIPELINE PROGRESS</label>
            <div style={{ display: "flex", gap: 0, marginBottom: 20 }}>
              {phases.map((p, i) => {
                const isActive = p === phase;
                const isDone = phases.indexOf(phase) > i || phase === "done";
                return (
                  <div key={p} style={{ flex: 1, textAlign: "center", borderBottom: `2px solid ${isDone || isActive ? "#ff3333" : "#1a0000"}`, paddingBottom: 8, transition: "all 0.3s" }}>
                    <div style={{ fontSize: 10, color: isDone ? "#ff3333" : isActive ? "#fff" : "#333", letterSpacing: 1 }}>
                      {phaseLabels[p]}
                    </div>
                    {phase === "images" && p === "images" && (
                      <div style={{ fontSize: 9, color: "#666", marginTop: 2 }}>{imgProgress}/10</div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ background: "#050505", border: "1px solid #1a0000", borderRadius: 6, padding: 16, maxHeight: 160, overflowY: "auto" }}>
              {log.map((l, i) => (
                <div key={i} style={{ fontSize: 11, color: l.type === "success" ? "#00ff88" : l.type === "error" ? "#ff4444" : "#888", marginBottom: 4, lineHeight: 1.5 }}>
                  {l.msg}
                </div>
              ))}
              {log.length === 0 && <div style={{ fontSize: 11, color: "#333" }}>Waiting...</div>}
            </div>
          </div>
        )}

        {/* Story preview */}
        {content && (<>
          {/* Story + Script */}
          <div style={s.card}>
            <label style={s.label}>📝 STORY: {content.title}</label>
            <div style={{ fontSize: 10, color: "#555", letterSpacing: 2, marginBottom: 6 }}>🎙️ VOICEOVER SCRIPT — ElevenLabs sẽ đọc đoạn này</div>
            <div style={{ fontSize: 12, color: "#888", lineHeight: 1.9, background: "#050505", borderRadius: 6, padding: 14, border: "1px solid #2a0000", marginBottom: 10, fontFamily: "Arial", whiteSpace: "pre-wrap" }}>
              {content.script}
            </div>
            <button onClick={() => navigator.clipboard.writeText(content.script)}
              style={{ background: "#1a0000", border: "1px solid #330000", borderRadius: 4, padding: "5px 12px", color: "#ff3333", fontSize: 10, cursor: "pointer", letterSpacing: 1, marginBottom: 10 }}>
              Copy Voiceover Script
            </button>
            {content.characters && (
              <div style={{ fontSize: 11, color: "#444", lineHeight: 1.7, background: "#050505", borderRadius: 6, padding: 12, border: "1px solid #1a0000", fontFamily: "monospace" }}>
                <span style={{ color: "#ff3333", fontSize: 10, letterSpacing: 2 }}>👤 CHARACTER GUIDE</span><br/>
                {content.characters}
              </div>
            )}
          </div>

          {/* YouTube Package */}
          <div style={s.card}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg,transparent,#ff3333,transparent)" }} />
            <label style={s.label}>📦 YOUTUBE PACKAGE</label>

            {/* Titles */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: "#ff3333", letterSpacing: 2, marginBottom: 8 }}>🎯 TITLES (chọn 1)</div>
              {[content.title, ...(content.titleAlts || [])].map((t, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ fontSize: 12, color: "#ccc", background: "#050505", border: "1px solid #1a0000", borderRadius: 4, padding: "8px 12px", flex: 1, fontFamily: "Arial" }}>{t}</div>
                  <button onClick={() => navigator.clipboard.writeText(t)}
                    style={{ background: "#1a0000", border: "1px solid #330000", borderRadius: 4, padding: "6px 10px", color: "#ff3333", fontSize: 10, cursor: "pointer", whiteSpace: "nowrap" }}>
                    Copy
                  </button>
                </div>
              ))}
            </div>

            {/* Description */}
            {content.description && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: "#ff3333", letterSpacing: 2 }}>📝 DESCRIPTION</div>
                  <button onClick={() => navigator.clipboard.writeText(content.description)}
                    style={{ background: "#1a0000", border: "1px solid #330000", borderRadius: 4, padding: "5px 10px", color: "#ff3333", fontSize: 10, cursor: "pointer" }}>
                    Copy All
                  </button>
                </div>
                <div style={{ fontSize: 11, color: "#555", lineHeight: 1.9, background: "#050505", borderRadius: 6, padding: 14, border: "1px solid #1a0000", whiteSpace: "pre-wrap", fontFamily: "Arial" }}>
                  {content.description}
                </div>
              </div>
            )}

            {/* Tags */}
            {content.tags && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: "#ff3333", letterSpacing: 2 }}>🏷️ TAGS</div>
                  <button onClick={() => navigator.clipboard.writeText(content.tags)}
                    style={{ background: "#1a0000", border: "1px solid #330000", borderRadius: 4, padding: "5px 10px", color: "#ff3333", fontSize: 10, cursor: "pointer" }}>
                    Copy All
                  </button>
                </div>
                <div style={{ fontSize: 11, color: "#555", lineHeight: 1.9, background: "#050505", borderRadius: 6, padding: 14, border: "1px solid #1a0000", fontFamily: "monospace" }}>
                  {content.tags}
                </div>
              </div>
            )}
          </div>
        </>)}

        {/* Image grid */}
        {images.length > 0 && (
          <div style={s.card}>
            <label style={s.label}>🖼️ GENERATED IMAGES ({images.length}/10)</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
              {images.map((img, i) => (
                <div key={i} style={{ aspectRatio: "9/16", borderRadius: 4, overflow: "hidden", border: "1px solid #1a0000", position: "relative" }}>
                  <img src={img} alt={`Scene ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <div style={{ position: "absolute", bottom: 4, left: 4, background: "#ff3333", color: "#fff", fontSize: 9, padding: "2px 5px", borderRadius: 2, fontWeight: "bold" }}>{i + 1}</div>
                </div>
              ))}
              {Array.from({ length: 10 - images.length }).map((_, i) => (
                <div key={`e${i}`} style={{ aspectRatio: "9/16", borderRadius: 4, border: "1px solid #1a0000", background: "#050505", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ color: "#222", fontSize: 18 }}>⏳</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audio */}
        {audioUrl && (
          <div style={s.card}>
            <label style={s.label}>🎙️ VOICEOVER PREVIEW</label>
            <audio src={audioUrl} controls style={{ width: "100%", accentColor: "#ff3333" }} />
          </div>
        )}

        {/* Video output */}
        {videoUrl && (
          <div style={s.card}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg,transparent,#ff3333,transparent)" }} />
            <label style={s.label}>🎬 YOUR VIDEO IS READY</label>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <video src={videoUrl} controls style={{ maxHeight: 400, borderRadius: 8, border: "1px solid #ff3333" }} />
            </div>
            <button onClick={download} style={{ ...s.btn(false), width: "100%", fontSize: 13, padding: "14px 24px" }}>
              ⬇️ DOWNLOAD VIDEO (.webm)
            </button>
            <div style={{ marginTop: 10, fontSize: 10, color: "#444", textAlign: "center" }}>
              Convert to MP4 free at <span style={{ color: "#ff3333" }}>cloudconvert.com</span>
            </div>
          </div>
        )}

        {phase === "idle" && !videoUrl && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#222" }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>👁️</div>
            <div style={{ fontSize: 12, letterSpacing: 3, color: "#333" }}>ENTER A TOPIC TO AUTO-CREATE YOUR VIDEO</div>
            <div style={{ fontSize: 10, color: "#222", marginTop: 8 }}>Script → Images → Voiceover → Video — fully automatic</div>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} style={{ display: "none" }} />

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #000; }
        input, select { transition: border-color 0.2s; }
        input:focus, select:focus { border-color: #ff3333 !important; outline: none; }
        audio::-webkit-media-controls-panel { background: #0a0000; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #050505; }
        ::-webkit-scrollbar-thumb { background: #1a0000; border-radius: 2px; }
        input::placeholder { color: #2a2a2a; }
      `}</style>
    </div>
  );
}
