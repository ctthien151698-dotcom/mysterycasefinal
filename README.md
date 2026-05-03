# MysteryCase Video Tool

Auto-generate horror YouTube Shorts. Hoàn toàn miễn phí.

## Stack
| Bước | Service | Key |
|------|---------|-----|
| 📝 Script | OpenRouter (Gemini Flash free) | `OPENROUTER_API_KEY` |
| 🖼️ Image | Pollinations.ai (Flux) | Không cần key |
| 🎙️ Audio | ElevenLabs | `ELEVENLABS_API_KEY` |

## Deploy Vercel

### 1. Upload GitHub
github.com → New repo → tên `mysterycase` → upload file trong ZIP

### 2. Deploy Vercel
vercel.com → Add New Project → import repo → Deploy

### 3. Thêm 2 Environment Variables
Vercel → Settings → Environment Variables:

| Key | Lấy ở đâu |
|-----|-----------|
| `OPENROUTER_API_KEY` | openrouter.ai → Keys → Create (FREE, không cần thẻ) |
| `ELEVENLABS_API_KEY` | elevenlabs.io → Profile → API Key (FREE 10k ký tự/tháng) |

### 4. Redeploy
Deployments → "..." → Redeploy
