
# BharatGPilot

### Designed by Mohit Saha

**BharatGPilot** is a general-purpose AI assistant platform designed to support conversations, coding, research, writing, learning, and application development.

The project aims to build a flexible AI ecosystem that can connect multiple AI providers, open-weight models, and free-tier AI services.

---

## 🚀 Project Vision

Build BharatGPilot into a complete AI assistant experience inspired by modern AI platforms such as Claude and ChatGPT.

### Core objectives

- General-purpose AI conversations.
- Multi-provider AI model integration.
- Coding and debugging assistance.
- Research and writing assistance.
- Document and file analysis.
- Streaming AI responses.
- Conversation history.
- Responsive web interface.
- Future support for AI agents and app building.
- Flexible model routing with cost-aware provider selection.

---

## ✨ Current Features

- Modern dark-mode chat interface.
- Responsive frontend for desktop and mobile.
- New conversation controls.
- Conversation history in the browser session.
- AI model selection interface.
- File upload controls.
- Backend API integration.
- OpenRouter integration.
- Configurable AI models.
- Express.js backend.
- Vercel and Railway deployment entry points.

Some interface features are placeholders until their supporting backend functionality is implemented.

---

## 🧠 AI Model Ecosystem

BharatGPilot is designed to support multiple AI models and providers.

Potential integrations include:

| Provider | Planned integration |
|---|---|
| OpenRouter | Initial model gateway |
| Anthropic Claude | Through OpenRouter or direct API |
| OpenAI | API integration |
| Google Gemini | API integration |
| DeepSeek | API integration |
| Qwen | API integration |
| Meta Llama | Hosted or local inference |
| Hugging Face | Hosted model inference |
| Local models | Future local inference support |

Provider availability, pricing, rate limits, and free-tier access depend on the respective services.

---

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| HTML | Frontend structure |
| CSS | Interface styling |
| JavaScript | Frontend interactions |
| Node.js | Runtime |
| Express.js | Backend API |
| OpenRouter | Initial AI model gateway |
| Multer | File upload handling |
| dotenv | Environment configuration |
| Vercel | Serverless deployment |
| Railway | Persistent server deployment |

---

## 📁 Project Structure

```text
bharatGpilot/
│
├── public/
│   └── index.html
│
├── server.js
├── railway-function.js
├── package.json
├── vercel.json
├── .env.example
├── .gitignore
└── README.md
```

---

## ⚙️ Installation

### Requirements

- Node.js 20 or later
- npm
- An OpenRouter API key
- Git (optional)

### Step 1: Clone the repository

```bash
git clone https://github.com/mconnectbharat-oss/bharatGpilot.git
cd bharatGpilot
```

### Step 2: Install dependencies

```bash
npm install
```

### Step 3: Configure environment variables

Create a `.env` file in the project root.

```env
PORT=3000

OPENROUTER_API_KEY=your_openrouter_api_key

OPENROUTER_MODEL=openai/gpt-4o-mini

CLAUDE_MODEL=anthropic/claude-sonnet-4

APP_URL=http://localhost:3000

CORS_ORIGIN=
```

Replace the placeholder with your own API key.

**Never commit `.env` or expose private API keys in frontend code.**

### Step 4: Start the server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## 🔌 API Endpoints

### Health check

```http
GET /api/health
```

Returns server status and provider configuration information.

### AI chat

```http
POST /api/pilot/chat
```

Accepts multipart form data.

| Field | Description |
|---|---|
| `message` | User's message |
| `model` | Model selection |
| `history` | Previous conversation messages |
| `files` | Optional uploaded files |

Example response:

```json
{
  "reply": "Hello! How can I help you?",
  "model": "openai/gpt-4o-mini",
  "provider": "OpenRouter"
}
```

### Streaming chat

```http
POST /api/pilot/stream
```

Provides streaming output from the configured model provider.

The current frontend uses the regular chat endpoint. Streaming frontend integration is a future improvement.

---

## 🚂 Railway Deployment

Railway can host BharatGPilot as a persistent Node.js service.

### Start command

```bash
node railway-function.js
```

### Environment variables

Configure these in Railway:

```env
OPENROUTER_API_KEY=your_api_key
OPENROUTER_MODEL=openai/gpt-4o-mini
CLAUDE_MODEL=anthropic/claude-sonnet-4
APP_URL=https://your-domain.example
RAILWAY_ENTRY=true
```

Set the required environment variables in Railway's project settings.

Deploy the repository and use the generated Railway domain to access the application.

---

## ▲ Vercel Deployment

BharatGPilot can also be deployed on Vercel.

### Configuration

The project includes a `vercel.json` file and an Express application entry point.

Configure the following environment variables in Vercel:

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `CLAUDE_MODEL`
- `APP_URL`

Deploy the repository through the Vercel dashboard or CLI.

Verify that static assets and API routes work correctly after deployment.

---

## 🔐 Security and Privacy

Security is an essential part of BharatGPilot.

Current and planned safeguards include:

- Keep API keys on the server.
- Validate user inputs.
- Limit uploaded file sizes.
- Restrict supported file types.
- Add user authentication.
- Introduce request rate limits.
- Protect conversation data.
- Add configurable data retention.
- Provide transparent file-upload behavior.
- Never access private user files, gallery, camera, or media without explicit user action and appropriate permissions.

The current implementation is an early-stage backend. Production use requires additional security review and safeguards.

---

## 📂 File Upload Support

The initial backend extracts text from supported formats:

- TXT
- Markdown
- CSV
- JSON
- JavaScript
- TypeScript
- Python
- HTML
- CSS

The current backend does not perform full PDF or image understanding.

Future improvements may include:

- PDF text extraction.
- Image understanding through vision models.
- Larger document processing.
- Multiple-file context.
- Document search and retrieval.
- User-controlled file storage.

---

## 🗺️ Development Roadmap

### Phase 1 — Core AI assistant

- [x] Initial chat interface
- [x] Express backend
- [x] OpenRouter integration
- [x] Basic conversation history in frontend
- [x] File upload endpoint
- [x] Vercel configuration
- [x] Railway entry point

### Phase 2 — Multi-model ecosystem

- [ ] Provider registry
- [ ] Automatic model routing
- [ ] Free-tier model discovery
- [ ] Provider fallback
- [ ] Model capability metadata
- [ ] Usage and cost tracking

### Phase 3 — Advanced AI workspace

- [ ] Persistent chat history
- [ ] User authentication
- [ ] Streaming frontend
- [ ] PDF and image analysis
- [ ] Web research tools
- [ ] Code execution sandbox
- [ ] Project workspaces
- [ ] Custom AI agents

### Phase 4 — BharatGPilot platform

- [ ] AI application builder
- [ ] Database integration
- [ ] API generation
- [ ] Website deployment workflows
- [ ] Team collaboration
- [ ] Multilingual assistant experience
- [ ] Advanced memory and retrieval

---

## 🌐 Project Repository

GitHub:

https://github.com/mconnectbharat-oss/bharatGpilot

---

## 👨‍💻 Creator

**BharatGPilot**

Designed by **Mohit Saha**

Powered by configurable AI providers.

---

## 📜 License

The project is currently under development.

Choose and add an explicit open-source or proprietary license before distributing the project.
