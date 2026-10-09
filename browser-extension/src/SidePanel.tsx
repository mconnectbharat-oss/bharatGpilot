import React, { useEffect, useRef, useState } from "react";
import {
  Sparkles, Languages, FileText, ChevronDown, Coins, Zap, Play,
  X, Send, Plus, ShieldCheck, AlertCircle, Copy, Check, Settings2
} from "lucide-react";

type Role = "user" | "assistant";
interface Message {
  id: string;
  role: Role;
  content: string;
  modelUsed?: string;
  artifactCode?: string;
}
type ProviderOption = { value: string; label: string; description: string };

const API_BASE = (import.meta.env.VITE_BGP_API_BASE || "https://bharatgpilot.com").replace(/\/$/, "");
const PROVIDERS: ProviderOption[] = [
  { value: "auto", label: "Auto route", description: "Let BharatGPilot choose" },
  { value: "openrouter", label: "OpenRouter", description: "Configured hosted models" },
  { value: "gemini", label: "Gemini", description: "Google models, if configured" },
  { value: "groq", label: "Groq", description: "Fast inference, if configured" },
  { value: "mistral", label: "Mistral", description: "Mistral models, if configured" }
];

function getArtifact(text: string): { cleanText: string; code?: string } {
  const match = text.match(/```html\s*([\s\S]*?)```/i);
  if (!match?.[1]) return { cleanText: text };
  return {
    cleanText: text.replace(match[0], "Interactive artifact generated. Open Preview to inspect it in the isolated sandbox."),
    code: match[1].trim()
  };
}

function parseStreamChunk(raw: string): string {
  const lines = raw.split(/\r?\n/);
  let output = "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(":") || trimmed === "data: [DONE]") continue;
    const data = trimmed.startsWith("data:") ? trimmed.slice(5).trim() : trimmed;
    try {
      const parsed = JSON.parse(data);
      const delta = parsed.delta ?? parsed.content ?? parsed.token ?? parsed.text ??
        parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.text;
      if (typeof delta === "string") output += delta;
      else if (typeof parsed.answer === "string") output += parsed.answer;
    } catch {
      if (trimmed.startsWith("data:")) output += data;
    }
  }
  return output;
}

async function readSessionToken(): Promise<string | null> {
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      const values = await chrome.storage.local.get("bgp_token");
      return typeof values.bgp_token === "string" ? values.bgp_token : null;
    }
  } catch (error) {
    console.warn("Could not read extension session storage:", error);
  }
  return null;
}

export default function SidePanel() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedProvider, setSelectedProvider] = useState("auto");
  const [userCredits] = useState(1250);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeArtifact, setActiveArtifact] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [apiBase, setApiBase] = useState(API_BASE);
  const [apiBaseDraft, setApiBaseDraft] = useState(API_BASE);
  const [sessionState, setSessionState] = useState<"checking" | "signed-in" | "guest">("checking");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    let alive = true;
    readSessionToken().then((token) => {
      if (alive) setSessionState(token ? "signed-in" : "guest");
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const resetChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setInput("");
    setErrorMessage("");
    setActiveArtifact(null);
    setIsStreaming(false);
  };

  const triggerAIStream = async (overridePrompt?: string) => {
    const prompt = (overridePrompt ?? input).trim();
    if (!prompt || isStreaming) return;

    setErrorMessage("");
    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content: prompt };
    const assistantId = crypto.randomUUID();
    const providerLabel = PROVIDERS.find((item) => item.value === selectedProvider)?.label ?? selectedProvider;
    setMessages((previous) => [
      ...previous,
      userMessage,
      { id: assistantId, role: "assistant", content: "", modelUsed: providerLabel }
    ]);
    setInput("");
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const token = await readSessionToken();
      const headers: Record<string, string> = { "Content-Type": "application/json", "Accept": "text/event-stream, application/json, text/plain" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const history = [...messages, userMessage].slice(-30).map(({ role, content }) => ({ role, content }));
      const response = await fetch(`${apiBase}/api/pilot/stream`, {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({ provider: selectedProvider, messages: history })
      });

      if (!response.ok) {
        let detail = `Request failed (${response.status})`;
        try {
          const body = await response.json();
          if (typeof body.error === "string") detail = body.error;
        } catch { /* response body was not JSON */ }
        throw new Error(detail);
      }
      if (!response.body) throw new Error("The server did not provide a response stream.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let rawBuffer = "";
      let fullOutput = "";
      let pendingText = "";
      const isEventStream = (response.headers.get("content-type") || "").includes("text/event-stream");

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunkText = decoder.decode(value, { stream: true });
        if (isEventStream) {
          rawBuffer += chunkText;
          const frames = rawBuffer.split(/\r?\n\r?\n/);
          rawBuffer = frames.pop() ?? "";
          for (const frame of frames) pendingText += parseStreamChunk(frame);
        } else {
          pendingText += chunkText;
        }
        if (pendingText) {
          fullOutput += pendingText;
          pendingText = "";
          const artifact = getArtifact(fullOutput);
          setMessages((previous) => previous.map((message) =>
            message.id === assistantId
              ? { ...message, content: artifact.cleanText, artifactCode: artifact.code }
              : message
          ));
        }
      }
      if (rawBuffer && isEventStream) {
        fullOutput += parseStreamChunk(rawBuffer);
      }
      fullOutput += decoder.decode();
      if (!fullOutput.trim()) throw new Error("The server returned an empty response. Check the API stream format.");
      const artifact = getArtifact(fullOutput);
      setMessages((previous) => previous.map((message) =>
        message.id === assistantId
          ? { ...message, content: artifact.cleanText, artifactCode: artifact.code }
          : message
      ));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const message = error instanceof Error ? error.message : "An unexpected connection error occurred.";
      setErrorMessage(`${message}. Confirm the API is online and permits the browser-extension origin.`);
      setMessages((previous) => previous.filter((item) => item.id !== assistantId));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsStreaming(false);
    }
  };

  const copyMessage = async (message: Message) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId((current) => current === message.id ? null : current), 1500);
    } catch {
      setErrorMessage("Clipboard access was blocked by the browser.");
    }
  };

  const shortcutPrompt = (kind: "translate" | "summarize") => {
    const instruction = kind === "translate"
      ? "Translate the following webpage text into Hindi. If I have not provided the webpage text, ask me to paste it. Preserve links, names, and technical terms.\n\n[Paste webpage text here]"
      : "Summarize the following webpage text into a concise TL;DR with key points and action items. If I have not provided the webpage text, ask me to paste it.\n\n[Paste webpage text here]";
    setInput(instruction);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#080c14] text-slate-100">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 bg-[#090d16] px-3 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="rounded-xl bg-[#e05a2b] p-1.5 text-white"><Sparkles size={16} /></div>
          <div className="min-w-0">
            <div className="truncate text-sm font-extrabold tracking-tight">Bharat<span className="text-[#e05a2b]">G</span>pilot</div>
            <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">AI copilot · evidence first</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="relative">
            <select
              aria-label="Choose AI provider"
              value={selectedProvider}
              onChange={(event) => setSelectedProvider(event.target.value)}
              className="max-w-[118px] appearance-none rounded-full border border-slate-700 bg-slate-900 py-1.5 pl-2.5 pr-7 text-[10px] font-semibold outline-none hover:border-slate-500"
            >
              {PROVIDERS.map((provider) => <option key={provider.value} value={provider.value}>{provider.label}</option>)}
            </select>
            <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-500" />
          </div>
          <div title="Local demo balance — not synced to your account" className="flex items-center gap-1 rounded-full border border-amber-900/60 bg-amber-950/30 px-2 py-1.5 text-[10px] font-bold text-amber-300">
            <Coins size={12} /><span>{userCredits.toLocaleString("en-IN")}</span>
          </div>
          <button onClick={() => setShowSettings((value) => !value)} title="API settings" aria-label="API settings" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"><Settings2 size={15} /></button>
        </div>
      </header>

      {showSettings && (
        <section className="shrink-0 border-b border-slate-800 bg-slate-900/80 p-3">
          <label htmlFor="api-base" className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">API base URL</label>
          <div className="flex gap-2">
            <input id="api-base" value={apiBaseDraft} onChange={(event) => setApiBaseDraft(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-xs outline-none focus:border-[#e05a2b]" />
            <button onClick={() => { try { const url = new URL(apiBaseDraft); if (!["https:", "http:"].includes(url.protocol)) throw new Error(); setApiBase(url.origin); setApiBaseDraft(url.origin); setShowSettings(false); setErrorMessage(""); } catch { setErrorMessage("Enter a valid HTTP(S) API origin."); } }} className="rounded-lg bg-[#e05a2b] px-3 text-xs font-bold text-white">Save</button>
          </div>
          <p className="mt-1 text-[10px] text-slate-500">No API key is stored in the extension. A session token is read from extension storage.</p>
        </section>
      )}

      <main className="relative flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-3">
          {messages.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center px-4 text-center">
              <div className="mb-4 rounded-2xl border border-orange-900/60 bg-orange-950/30 p-3 text-[#f28b65]"><Zap size={25} /></div>
              <h1 className="text-lg font-bold tracking-tight">What can I help you build?</h1>
              <p className="mt-2 max-w-[260px] text-xs leading-5 text-slate-400">Explore ideas, understand code, and turn your workflow into a plan. Evidence over guesses.</p>
              <div className="mt-6 grid w-full max-w-sm gap-2">
                {[
                  ["Explain a repository", "Explain what mconnectbharat-oss/bharatGpilot does and cite the available evidence."],
                  ["Build a small tool", "Help me design a small HTML tool. Return a complete runnable HTML artifact in a fenced html code block."],
                  ["Debug an issue", "Help me debug this issue. Ask for the error and relevant code if I haven't provided them."]
                ].map(([label, prompt]) => (
                  <button key={label} onClick={() => setInput(prompt)} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-3 text-left text-xs font-semibold hover:border-slate-600 hover:bg-slate-900">
                    <span>{label}</span><span className="text-slate-500">↗</span>
                  </button>
                ))}
              </div>
            </div>
          ) : messages.map((message) => (
            <article key={message.id} className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"}`}>
              <div className={`max-w-[95%] rounded-2xl px-3 py-2.5 text-xs leading-5 shadow-sm ${message.role === "user" ? "rounded-br-sm bg-[#e05a2b] text-white" : "rounded-bl-sm border border-slate-800 bg-[#0d1420] text-slate-200"}`}>
                <p className="whitespace-pre-wrap break-words">{message.content || (isStreaming ? "Thinking…" : "")}</p>
                {message.artifactCode && (
                  <button onClick={() => setActiveArtifact(message.artifactCode ?? null)} className="mt-3 flex items-center gap-2 rounded-lg bg-orange-950/50 px-3 py-2 text-[11px] font-bold text-orange-300 hover:bg-orange-900/60">
                    <Play size={12} fill="currentColor" /> Launch live preview
                  </button>
                )}
                {message.role === "assistant" && message.content && (
                  <button onClick={() => void copyMessage(message)} className="mt-2 inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-200">
                    {copiedId === message.id ? <Check size={11} /> : <Copy size={11} />}
                    {copiedId === message.id ? "Copied" : "Copy"}
                  </button>
                )}
              </div>
              {message.modelUsed && <span className="mt-1 px-1 text-[9px] font-semibold uppercase tracking-wider text-slate-500">via {message.modelUsed}</span>}
            </article>
          ))}
          {errorMessage && <div role="alert" className="flex gap-2 rounded-xl border border-red-900/70 bg-red-950/30 p-3 text-[11px] leading-4 text-red-200"><AlertCircle size={14} className="mt-0.5 shrink-0" /><span>{errorMessage}</span><button aria-label="Dismiss error" onClick={() => setErrorMessage("")}><X size={13} /></button></div>}
          <div ref={chatEndRef} />
        </div>

        {activeArtifact && (
          <section className="absolute inset-0 z-20 flex animate-slide-up flex-col border-t-2 border-[#e05a2b] bg-[#080c14] shadow-2xl">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2">
              <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-300"><ShieldCheck size={14} className="text-emerald-400" /> Isolated artifact preview</span>
              <button onClick={() => setActiveArtifact(null)} className="flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-[10px] font-bold hover:bg-slate-700"><X size={12} /> Exit preview</button>
            </div>
            <iframe title="Sandboxed artifact preview" srcDoc={activeArtifact} sandbox="allow-scripts" referrerPolicy="no-referrer" className="artifact-frame" />
            <p className="shrink-0 border-t border-slate-800 px-3 py-2 text-[9px] text-slate-500">Preview runs in a sandbox without same-origin access. Avoid entering secrets into generated content.</p>
          </section>
        )}
      </main>

      <footer className="shrink-0 border-t border-slate-800 bg-[#090d16] p-3">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <button onClick={() => shortcutPrompt("translate")} className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-[10px] font-semibold text-slate-300 hover:border-slate-600"><Languages size={12} /> Translate text</button>
          <button onClick={() => shortcutPrompt("summarize")} className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-[10px] font-semibold text-slate-300 hover:border-slate-600"><FileText size={12} /> TL;DR summarize</button>
          <button onClick={resetChat} className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-800 hover:text-slate-200"><Plus size={12} /> New chat</button>
        </div>
        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-2 focus-within:border-[#e05a2b]">
          <textarea
            aria-label="Message BharatGPilot"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void triggerAIStream(); } }}
            placeholder="Ask BharatGPilot anything…"
            rows={3}
            className="max-h-36 min-h-[60px] w-full resize-y bg-transparent px-1 py-1 text-xs leading-5 text-slate-100 outline-none placeholder:text-slate-600"
          />
          <div className="flex items-center justify-between border-t border-slate-800 pt-2">
            <div className="flex items-center gap-1.5 text-[9px] text-slate-500"><span className={`h-1.5 w-1.5 rounded-full ${sessionState === "signed-in" ? "bg-emerald-400" : sessionState === "guest" ? "bg-amber-400" : "bg-slate-500"}`} />{sessionState === "signed-in" ? "Session token found" : sessionState === "guest" ? "Guest mode · sign-in may be required" : "Checking session"}</div>
            <button onClick={() => void triggerAIStream()} disabled={!input.trim() || isStreaming} aria-label={isStreaming ? "Generating response" : "Send message"} className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#e05a2b] text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-40">
              {isStreaming ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Send size={14} />}
            </button>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-[9px] text-slate-600"><span>AI can make mistakes. Verify important claims.</span><span className="flex items-center gap-1"><ShieldCheck size={10} /> Private by design</span></div>
      </footer>
    </div>
  );
}
