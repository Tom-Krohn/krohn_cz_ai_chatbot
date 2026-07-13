import { useState, useEffect, type ReactElement } from 'react';
import { 
	Database, 
	Settings, 
	History, 
	Code, 
	Play, 
	RefreshCw, 
	MessageSquare, 
	Shield, 
	Server, 
	Check, 
	Copy, 
	Info,
	Cpu,
	Users,
	FileText,
	Trash2,
	Upload,
	AlertTriangle
} from 'lucide-react';

type Provider = 'openai' | 'gemini' | 'claude';

type Tab = 'dashboard' | 'settings' | 'ingestion' | 'history' | 'sandbox' | 'widget';

type Session = {
	id: string;
	channel: string;
	createdAt: string;
	messageCount: number;
};

type Message = {
	role: 'user' | 'assistant' | string;
	content: string;
	createdAt: string;
};

type LlmInfo = {
	provider: Provider;
	model: string;
	apiKeyAlias: string;
};

const DEFAULT_LLM_INFO: LlmInfo = {
	provider: 'openai',
	model: 'gpt-4o-mini',
	apiKeyAlias: 'default-key',
};

function defaultModelForProvider(provider: Provider): string {
	switch (provider) {
		case 'gemini':
			return 'gemini-2.5-flash';
		case 'claude':
			return 'claude-3-5-sonnet-20240620';
		case 'openai':
		default:
			return 'gpt-4o-mini';
	}
}

function normalizeLlmInfo(input: unknown): LlmInfo {
	if (!input || typeof input !== 'object') {
		return DEFAULT_LLM_INFO;
	}

	const raw = input as Record<string, unknown>;
	const provider = raw.provider;
	const model = raw.model;
	const apiKeyAlias = raw.apiKeyAlias;
	const normalizedProvider = provider === 'openai' || provider === 'gemini' || provider === 'claude' ? provider : DEFAULT_LLM_INFO.provider;
	const requestedModel = typeof model === 'string' ? model.trim() : '';
	const normalizedModel = requestedModel.length >= 2
		? (normalizedProvider === 'gemini' && (requestedModel === 'gemini-1.5-flash' || requestedModel === 'gemini-1.5-pro')
			? defaultModelForProvider('gemini')
			: requestedModel)
		: defaultModelForProvider(normalizedProvider);

	return {
		provider: normalizedProvider,
		model: normalizedModel,
		apiKeyAlias: typeof apiKeyAlias === 'string' && apiKeyAlias.trim().length >= 3 ? apiKeyAlias.trim() : DEFAULT_LLM_INFO.apiKeyAlias,
	};
}

export function App(): ReactElement {
	const [activeTab, setActiveTab] = useState<Tab>('dashboard');
	const [platform, setPlatform] = useState('custom-feed');
	const [feedUrl, setFeedUrl] = useState('');
	const [apiUrl, setApiUrl] = useState('');
	const [shoptetPremium, setShoptetPremium] = useState(false);
	
	// Settings & Status from Backend
	const [llmInfo, setLlmInfo] = useState<LlmInfo>(DEFAULT_LLM_INFO);
	const [abuseProtection, setAbuseProtection] = useState(true);
	
	// Sync state
	const [syncing, setSyncing] = useState(false);
	const [syncResult, setSyncResult] = useState<{ success: boolean; message: string; stats?: { totalParsed: number; totalEmbedded: number } } | null>(null);

	// Knowledge Base (RAG) Text Ingestion
	const [textInput, setTextInput] = useState('');
	const [textSourceName, setTextSourceName] = useState('');
	const [textIngesting, setTextIngesting] = useState(false);
	const [textIngestResult, setTextIngestResult] = useState<{ success: boolean; message: string } | null>(null);

	// Knowledge Base (RAG) File Ingestion
	const [fileInput, setFileInput] = useState<File | null>(null);
	const [fileSourceName, setFileSourceName] = useState('');
	const [fileIngesting, setFileIngesting] = useState(false);
	const [fileIngestResult, setFileIngestResult] = useState<{ success: boolean; message: string } | null>(null);

	// Danger Zone: Delete Memory
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [deleteConfirmText, setDeleteConfirmText] = useState('');
	const [deleting, setDeleting] = useState(false);
	const [deleteResult, setDeleteResult] = useState<{ success: boolean; message: string } | null>(null);
	
	// Sandbox state
	const [previewInput, setPreviewInput] = useState('Doporuč mi nějaké běžecké boty');
	const [previewMessages, setPreviewMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
		{ role: 'assistant', content: 'Ahoj! Jsem tvůj nákupní poradce. Zeptej se mě na cokoliv ohledně našich produktů.' }
	]);
	const [previewLoading, setPreviewLoading] = useState(false);
	
	// History state
	const [sessions, setSessions] = useState<Session[]>([]);
	const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
	const [sessionMessages, setSessionMessages] = useState<Message[]>([]);
	const [loadingSessions, setLoadingSessions] = useState(false);
	const [loadingMessages, setLoadingMessages] = useState(false);

	// General states
	const [saveState, setSaveState] = useState('');
	const [copied, setCopied] = useState(false);

	const apiBaseUrl = 'http://localhost:8787';
	const tenantId = 'da8b817d-2b47-4cf0-880c-25d258b38343'; // Standardized UUID for the default demo tenant
	const tenantHeader = { 'x-tenant-id': tenantId };

	const embedSnippet = `<script async src="${apiBaseUrl}/chat-agent-loader.js"></script>
<script>
  window.ChatAgentWidget.mount({ 
    tenantId: "${tenantId}",
    apiBaseUrl: "${apiBaseUrl}",
    brandName: "AI Asistent"
  });
</script>`;

	// Load Settings & Sessions
	useEffect(() => {
		fetchSettings();
		fetchSessions();
	}, []);

	async function fetchSettings(): Promise<void> {
		try {
			const res = await fetch(`${apiBaseUrl}/api/admin/settings`, { headers: tenantHeader });
			if (res.ok) {
				const data = await res.json();
				if (data.settings) {
					setPlatform(data.settings.connector?.platform || 'custom-feed');
					setFeedUrl(data.settings.connector?.productFeedUrl || '');
					setApiUrl(data.settings.connector?.productApiUrl || '');
					setShoptetPremium(data.settings.connector?.shoptetPremium || false);
					setLlmInfo(normalizeLlmInfo(data.settings.llm));
					setAbuseProtection(data.settings.abuseProtectionEnabled ?? true);
				}
			}
		} catch (e) {
			console.error('Failed to fetch settings', e);
		}
	}

	async function fetchSessions(): Promise<void> {
		setLoadingSessions(true);
		try {
			const res = await fetch(`${apiBaseUrl}/api/admin/sessions`, { headers: tenantHeader });
			if (res.ok) {
				const data = await res.json();
				setSessions(data.sessions || []);
			}
		} catch (e) {
			console.error('Failed to fetch sessions', e);
		} finally {
			setLoadingSessions(false);
		}
	}

	async function loadSessionMessages(id: string): Promise<void> {
		setSelectedSessionId(id);
		setLoadingMessages(true);
		try {
			const res = await fetch(`${apiBaseUrl}/api/admin/sessions/${id}/messages`, { headers: tenantHeader });
			if (res.ok) {
				const data = await res.json();
				setSessionMessages(data.messages || []);
			}
		} catch (e) {
			console.error('Failed to load messages', e);
		} finally {
			setLoadingMessages(false);
		}
	}

	async function saveSettings(): Promise<void> {
		setSaveState('Ukládám...');
		const normalizedLlmInfo = normalizeLlmInfo(llmInfo);
		const trimmedFeedUrl = feedUrl.trim();
		const trimmedApiUrl = apiUrl.trim();
		try {
			const response = await fetch(`${apiBaseUrl}/api/admin/settings`, {
				body: JSON.stringify({
					abuseProtectionEnabled: abuseProtection,
					connector: {
						platform,
						productApiUrl: trimmedApiUrl || undefined,
						productFeedUrl: trimmedFeedUrl || undefined,
						shoptetPremium,
					},
					llm: normalizedLlmInfo,
				}),
				headers: {
					...tenantHeader,
					'content-type': 'application/json',
				},
				method: 'PUT',
			});

			if (response.ok) {
				setLlmInfo(normalizedLlmInfo);
				setSaveState('Nastavení úspěšně uloženo.');
				setTimeout(() => setSaveState(''), 3000);
			} else {
				let detail = '';
				try {
					const errorBody = await response.json();
					if (errorBody?.error?.message) {
						detail = ` ${errorBody.error.message}`;
					}
				} catch {
					// Keep generic message if response body is not JSON.
				}
				setSaveState(`Uložení selhalo.${detail}`.trim());
			}
		} catch (e) {
			setSaveState('Uložení selhalo.');
		}
	}

	async function triggerSync(): Promise<void> {
		setSyncing(true);
		setSyncResult(null);
		try {
			const response = await fetch(`${apiBaseUrl}/api/admin/connector/sync`, {
				headers: tenantHeader,
				method: 'POST',
			});
			const data = await response.json();
			setSyncResult(data);
		} catch (e) {
			setSyncResult({ success: false, message: 'Spojení se serverem selhalo.' });
		} finally {
			setSyncing(false);
		}
	}

	async function ingestText(): Promise<void> {
		if (!textInput.trim() || textIngesting) return;
		setTextIngesting(true);
		setTextIngestResult(null);
		try {
			const response = await fetch(`${apiBaseUrl}/api/admin/knowledge/text`, {
				method: 'POST',
				headers: {
					...tenantHeader,
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					text: textInput,
					sourceName: textSourceName || undefined,
				}),
			});
			const data = await response.json();
			if (response.ok && data.success) {
				setTextIngestResult({ success: true, message: data.message });
				setTextInput('');
				setTextSourceName('');
			} else {
				setTextIngestResult({ success: false, message: data.error?.message || 'Uložení selhalo.' });
			}
		} catch (e) {
			setTextIngestResult({ success: false, message: 'Spojení se serverem selhalo.' });
		} finally {
			setTextIngesting(false);
		}
	}

	async function ingestFile(e: React.FormEvent): Promise<void> {
		e.preventDefault();
		if (!fileInput || fileIngesting) return;
		setFileIngesting(true);
		setFileIngestResult(null);

		const formData = new FormData();
		formData.append('file', fileInput);
		formData.append('sourceName', fileSourceName);

		try {
			const response = await fetch(`${apiBaseUrl}/api/admin/knowledge/file`, {
				method: 'POST',
				headers: tenantHeader,
				body: formData,
			});
			const data = await response.json();
			if (response.ok && data.success) {
				setFileIngestResult({ success: true, message: data.message });
				setFileInput(null);
				setFileSourceName('');
			} else {
				setFileIngestResult({ success: false, message: data.error?.message || 'Nahrání souboru selhalo.' });
			}
		} catch (e) {
			setFileIngestResult({ success: false, message: 'Spojení se serverem selhalo.' });
		} finally {
			setFileIngesting(false);
		}
	}

	async function deleteMemory(): Promise<void> {
		if (deleteConfirmText !== 'SMAZAT PAMĚŤ' || deleting) return;
		setDeleting(true);
		setDeleteResult(null);
		try {
			const response = await fetch(`${apiBaseUrl}/api/admin/memory`, {
				method: 'DELETE',
				headers: tenantHeader,
			});
			const data = await response.json();
			if (response.ok && data.success) {
				setDeleteResult({ success: true, message: data.message });
				setShowDeleteModal(false);
				setDeleteConfirmText('');
				setSyncResult(null);
			} else {
				setDeleteResult({ success: false, message: data.message || 'Smazání selhalo.' });
			}
		} catch (e) {
			setDeleteResult({ success: false, message: 'Spojení se serverem selhalo.' });
		} finally {
			setDeleting(false);
		}
	}

	async function sendPreviewMessage(): Promise<void> {
		if (!previewInput.trim() || previewLoading) return;
		const userMsg = previewInput;
		setPreviewMessages(prev => [...prev, { role: 'user', content: userMsg }]);
		setPreviewInput('');
		setPreviewLoading(true);

		try {
			const response = await fetch(`${apiBaseUrl}/api/admin/chat-preview`, {
				body: JSON.stringify({ message: userMsg }),
				headers: {
					...tenantHeader,
					'content-type': 'application/json',
				},
				method: 'POST',
			});

			if (response.ok) {
				const data = await response.json();
				setPreviewMessages(prev => [...prev, { role: 'assistant', content: data.preview?.message || 'Bez odpovědi.' }]);
			} else {
				let detail = '';
				try {
					const errorBody = await response.json();
					if (errorBody?.error?.message) {
						detail = ` (${errorBody.error.message})`;
					}
				} catch {
					// Keep generic message when response body is not JSON.
				}
				setPreviewMessages(prev => [...prev, { role: 'assistant', content: `Chyba: Nepodařilo se kontaktovat asistenta.${detail}` }]);
			}
		} catch (e) {
			setPreviewMessages(prev => [...prev, { role: 'assistant', content: 'Chyba sítě.' }]);
		} finally {
			setPreviewLoading(false);
		}
	}

	function copyToClipboard(): void {
		navigator.clipboard.writeText(embedSnippet);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	return (
		<div className="min-h-screen bg-[#070514] text-slate-100 flex font-sans antialiased selection:bg-purple-600 selection:text-white">
			
			{/* Jellyfin Side Navigation */}
			<aside className="w-64 bg-[#0c0a1e] border-r border-[#1e1a3d] flex flex-col justify-between flex-shrink-0">
				<div>
					{/* Logo */}
					<div className="flex items-center gap-3 px-6 py-6 border-b border-[#1e1a3d]">
						<div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
							<Server className="h-5 w-5 text-white" />
						</div>
						<div>
							<h1 className="font-bold text-lg leading-tight tracking-wide bg-gradient-to-r from-white via-indigo-200 to-purple-400 bg-clip-text text-transparent">
								CartFlow AI
							</h1>
							<span className="text-xs text-indigo-400 font-medium tracking-wider">by Kröhn Labs</span>
						</div>
					</div>

					{/* Navigation Links */}
					<nav className="mt-6 px-4 space-y-1">
						<button
							onClick={() => setActiveTab('dashboard')}
							className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
								activeTab === 'dashboard'
									? 'bg-gradient-to-r from-violet-900/60 to-indigo-950/40 text-white border-l-4 border-violet-500 shadow-md shadow-violet-500/5'
									: 'text-slate-400 hover:bg-[#13102d] hover:text-slate-200'
							}`}
						>
							<Cpu className="h-4 w-4" />
							Přehled (Dashboard)
						</button>
						<button
							onClick={() => setActiveTab('settings')}
							className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
								activeTab === 'settings'
									? 'bg-gradient-to-r from-violet-900/60 to-indigo-950/40 text-white border-l-4 border-violet-500 shadow-md shadow-violet-500/5'
									: 'text-slate-400 hover:bg-[#13102d] hover:text-slate-200'
							}`}
						>
							<Settings className="h-4 w-4" />
							Konektory & Nastavení
						</button>
						<button
							onClick={() => setActiveTab('ingestion')}
							className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
								activeTab === 'ingestion'
									? 'bg-gradient-to-r from-violet-900/60 to-indigo-950/40 text-white border-l-4 border-violet-500 shadow-md shadow-violet-500/5'
									: 'text-slate-400 hover:bg-[#13102d] hover:text-slate-200'
							}`}
						>
							<Database className="h-4 w-4" />
							Znalostní báze
						</button>
						<button
							onClick={() => setActiveTab('history')}
							className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
								activeTab === 'history'
									? 'bg-gradient-to-r from-violet-900/60 to-indigo-950/40 text-white border-l-4 border-violet-500 shadow-md shadow-violet-500/5'
									: 'text-slate-400 hover:bg-[#13102d] hover:text-slate-200'
							}`}
						>
							<History className="h-4 w-4" />
							Historie konverzací
						</button>
						<button
							onClick={() => setActiveTab('sandbox')}
							className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
								activeTab === 'sandbox'
									? 'bg-gradient-to-r from-violet-900/60 to-indigo-950/40 text-white border-l-4 border-violet-500 shadow-md shadow-violet-500/5'
									: 'text-slate-400 hover:bg-[#13102d] hover:text-slate-200'
							}`}
						>
							<Play className="h-4 w-4" />
							Chat Sandbox
						</button>
						<button
							onClick={() => setActiveTab('widget')}
							className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
								activeTab === 'widget'
									? 'bg-gradient-to-r from-violet-900/60 to-indigo-950/40 text-white border-l-4 border-violet-500 shadow-md shadow-violet-500/5'
									: 'text-slate-400 hover:bg-[#13102d] hover:text-slate-200'
							}`}
						>
							<Code className="h-4 w-4" />
							Widget integrace
						</button>
					</nav>
				</div>

				{/* Footer Info */}
				<div className="p-4 border-t border-[#1e1a3d] text-center text-xs text-slate-500">
					<div>Verze 0.2.0 Beta</div>
					<div className="mt-1 flex items-center justify-center gap-1.5 text-indigo-400 font-medium">
						<span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
						Připojeno k DB
					</div>
				</div>
			</aside>

			{/* Main Layout Area */}
			<div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
				{/* Top Bar */}
				<header className="h-16 border-b border-[#1e1a3d] bg-[#09071c] flex items-center justify-between px-8">
					<div className="flex items-center gap-3">
						<span className="text-sm text-slate-400 font-medium">Tenant ID:</span>
						<code className="text-xs bg-[#171337] px-3 py-1.5 rounded-lg border border-[#2b255c] text-indigo-300 font-mono select-all">
							{tenantId}
						</code>
					</div>
					<div className="flex items-center gap-4">
						<div className="text-right text-xs">
							<div className="font-semibold text-slate-300">Aktivní model tenantu:</div>
							<div className="text-indigo-400 font-mono">{llmInfo.model}</div>
						</div>
						<div className="h-8 w-px bg-[#1e1a3d]"></div>
						<div className="w-8 h-8 rounded-full bg-[#201b4c] flex items-center justify-center text-xs font-bold text-indigo-300 ring-2 ring-[#3b328a]">
							TK
						</div>
					</div>
				</header>

				{/* Tab Contents */}
				<main className="flex-1 p-8 max-w-6xl w-full mx-auto">
					{activeTab === 'dashboard' && (
						<div className="space-y-6">
							{/* Welcome banner */}
							<div className="rounded-2xl bg-gradient-to-r from-violet-900/40 via-indigo-950/20 to-purple-900/30 border border-[#2b255c] p-6 shadow-xl relative overflow-hidden">
								<div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial-gradient from-violet-600/10 to-transparent pointer-events-none"></div>
								<h2 className="text-2xl font-bold text-white tracking-wide">
									AI Shopping Agent Control Center
								</h2>
								<p className="text-slate-400 text-sm mt-1.5 max-w-xl">
									Beta verze pro autonomní doporučování produktů. Nastavte si e-shopové XML feedy, testujte v preview sandboxu a prohlížejte historii chatů s klienty.
								</p>
							</div>

							{/* Stats Grid */}
							<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
								<div className="bg-[#0c0a1e]/60 border border-[#1e1a3d] rounded-2xl p-5 shadow-lg flex items-center gap-4">
									<div className="w-12 h-12 rounded-xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center">
										<FileText className="h-6 w-6 text-violet-400" />
									</div>
									<div>
										<h3 className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Nastavení platformy</h3>
										<p className="text-lg font-bold text-white mt-0.5 capitalize">{platform === 'custom-feed' ? 'XML Feed' : platform}</p>
									</div>
								</div>
								
								<div className="bg-[#0c0a1e]/60 border border-[#1e1a3d] rounded-2xl p-5 shadow-lg flex items-center gap-4">
									<div className="w-12 h-12 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center">
										<Users className="h-6 w-6 text-indigo-400" />
									</div>
									<div>
										<h3 className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Uložené konverzace</h3>
										<p className="text-lg font-bold text-white mt-0.5">{sessions.length} relací</p>
									</div>
								</div>
								
								<div className="bg-[#0c0a1e]/60 border border-[#1e1a3d] rounded-2xl p-5 shadow-lg flex items-center gap-4">
									<div className="w-12 h-12 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center">
										<Shield className="h-6 w-6 text-purple-400" />
									</div>
									<div>
										<h3 className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Abuse Ochrana</h3>
										<p className="text-lg font-bold text-white mt-0.5">{abuseProtection ? 'Aktivní' : 'Vypnutá'}</p>
									</div>
								</div>
							</div>

							{/* Quick Info & Action Center */}
							<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
								<div className="bg-[#0c0a1e]/40 border border-[#1e1a3d] rounded-2xl p-6 shadow-md">
									<h3 className="text-sm font-semibold tracking-wider text-slate-300 uppercase flex items-center gap-2 mb-4">
										<Info className="h-4 w-4 text-indigo-400" />
										Aktivní LLM konfigurace tenantu
									</h3>
									<div className="space-y-3 text-sm">
										<div className="flex justify-between py-2 border-b border-[#1a163a]">
											<span className="text-slate-400">AI Poskytovatel:</span>
											<span className="font-semibold text-white capitalize">{llmInfo.provider}</span>
										</div>
										<div className="flex justify-between py-2 border-b border-[#1a163a]">
											<span className="text-slate-400">Doporučovací Model:</span>
											<span className="font-semibold text-white font-mono text-xs">{llmInfo.model}</span>
										</div>
										<div className="flex justify-between py-2">
											<span className="text-slate-400">Status API Klíče:</span>
											<span className="text-emerald-400 font-semibold flex items-center gap-1.5">
												<span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
												Použije se klíč z .env dle providera
											</span>
										</div>
									</div>
								</div>

								<div className="bg-[#0c0a1e]/40 border border-[#1e1a3d] rounded-2xl p-6 shadow-md flex flex-col justify-between">
									<div>
										<h3 className="text-sm font-semibold tracking-wider text-slate-300 uppercase flex items-center gap-2 mb-2">
											<Database className="h-4 w-4 text-purple-400" />
											Produktová Paměť (RAG)
										</h3>
										<p className="text-xs text-slate-400">
											Nahrajte XML feed s Heureka/Zboží standardem pro natrénování chatbota. Po spuštění synchronizace bude asistent odpovídat na základě vašich reálných produktů.
										</p>
									</div>
									<div className="mt-4 flex gap-3">
										<button 
											onClick={() => setActiveTab('ingestion')}
											className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl py-2.5 px-4 text-sm font-medium shadow-lg shadow-violet-600/10 transition duration-200 flex items-center justify-center gap-2"
										>
											<RefreshCw className="h-3.5 w-3.5" />
											Spravovat Feed
										</button>
										<button 
											onClick={() => setActiveTab('sandbox')}
											className="flex-1 bg-[#1a153d] hover:bg-[#231d52] border border-[#3b328a] text-slate-200 hover:text-white rounded-xl py-2.5 px-4 text-sm font-medium transition duration-200 flex items-center justify-center gap-2"
										>
											<Play className="h-3.5 w-3.5" />
											Vyzkoušet Chat
										</button>
									</div>
								</div>
							</div>
						</div>
					)}

					{activeTab === 'settings' && (
						<div className="bg-[#0c0a1e]/60 border border-[#1e1a3d] rounded-2xl p-6 shadow-lg space-y-6">
							<div>
								<h2 className="text-lg font-bold text-white tracking-wide">Konektory & Nastavení</h2>
								<p className="text-xs text-slate-400 mt-0.5">Nakonfigurujte e-shop propojení. API klíče zůstávají v .env, ale provider/model lze přepínat per tenant.</p>
							</div>

							<div className="space-y-4">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<label className="flex flex-col gap-1.5 text-xs text-slate-400">
										<span className="font-semibold uppercase tracking-wider text-slate-500">Platforma</span>
										<select 
											className="bg-[#120f2d] border border-[#2b255c] rounded-xl px-3 py-2 text-sm text-slate-200 outline-none focus:border-violet-500 transition-colors"
											value={platform} 
											onChange={(e) => setPlatform(e.target.value)}
										>
											<option value="custom-feed">Zboží XML / Heureka XML feed</option>
											<option value="prestashop">PrestaShop 8.2.0 (Plugin)</option>
											<option value="shoptet">Shoptet (Cart API)</option>
											<option value="woocommerce">WooCommerce (Store API)</option>
											<option value="shopify">Shopify (Storefront API)</option>
										</select>
									</label>

									<label className="flex flex-col gap-1.5 text-xs text-slate-400">
										<span className="font-semibold uppercase tracking-wider text-slate-500">Product Feed URL (XML)</span>
										<input 
											type="text"
											className="bg-[#120f2d] border border-[#2b255c] rounded-xl px-3 py-2 text-sm text-slate-200 outline-none focus:border-violet-500 transition-colors placeholder:text-slate-600"
											placeholder="https://example.com/heureka.xml nebo lokální soubor" 
											value={feedUrl} 
											onChange={(e) => setFeedUrl(e.target.value)}
										/>
									</label>
								</div>

								{platform !== 'custom-feed' && (
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
										<label className="flex flex-col gap-1.5 text-xs text-slate-400">
											<span className="font-semibold uppercase tracking-wider text-slate-500">Platform API URL</span>
											<input 
												type="text"
												className="bg-[#120f2d] border border-[#2b255c] rounded-xl px-3 py-2 text-sm text-slate-200 outline-none focus:border-violet-500 transition-colors"
												placeholder="https://example.com/api" 
												value={apiUrl} 
												onChange={(e) => setApiUrl(e.target.value)}
											/>
										</label>

										{platform === 'shoptet' && (
											<label className="flex items-center gap-3 mt-6">
												<input 
													type="checkbox" 
													className="w-4 h-4 rounded accent-violet-600 bg-[#120f2d] border-[#2b255c]"
													checked={shoptetPremium} 
													onChange={(e) => setShoptetPremium(e.target.checked)}
												/>
												<span className="text-sm text-slate-300">Shoptet Premium (přímý přístup)</span>
											</label>
										)}
									</div>
								)}

								<div className="border-t border-[#1e1a3d] pt-4 mt-6">
									<h3 className="text-xs font-semibold tracking-wider text-slate-500 uppercase mb-3">LLM Nastavení tenantu</h3>
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#09071c] p-4 rounded-xl border border-[#1c183a] text-xs">
										<label className="flex flex-col gap-1.5 text-xs text-slate-400">
											<span className="font-semibold uppercase tracking-wider text-slate-500">Provider</span>
											<select
												className="bg-[#120f2d] border border-[#2b255c] rounded-xl px-3 py-2 text-sm text-slate-200 outline-none focus:border-violet-500 transition-colors"
												value={llmInfo.provider}
												onChange={(e) => {
													const nextProvider = e.target.value as Provider;
													setLlmInfo((prev) => ({
														...prev,
														provider: nextProvider,
														model: defaultModelForProvider(nextProvider),
													}));
												}}
											>
												<option value="openai">OpenAI</option>
												<option value="gemini">Gemini</option>
												<option value="claude">Claude</option>
											</select>
										</label>

										<label className="flex flex-col gap-1.5 text-xs text-slate-400">
											<span className="font-semibold uppercase tracking-wider text-slate-500">Model</span>
											<input
												type="text"
												className="bg-[#120f2d] border border-[#2b255c] rounded-xl px-3 py-2 text-sm text-slate-200 outline-none focus:border-violet-500 transition-colors"
												placeholder={defaultModelForProvider(llmInfo.provider)}
												value={llmInfo.model}
												onChange={(e) => setLlmInfo((prev) => ({ ...prev, model: e.target.value }))}
											/>
										</label>
									</div>
									<p className="text-[11px] text-slate-500 mt-2">Použije se API klíč z .env podle vybraného providera (OPENAI_API_KEY / GEMINI_API_KEY / ANTHROPIC_API_KEY).</p>
								</div>

								<div className="flex items-center gap-3 pt-4">
									<input 
										type="checkbox" 
										id="abuse-policy-cb"
										className="w-4 h-4 rounded accent-violet-600 bg-[#120f2d] border-[#2b255c]"
										checked={abuseProtection} 
										onChange={(e) => setAbuseProtection(e.target.checked)}
									/>
									<label htmlFor="abuse-policy-cb" className="text-sm text-slate-300 cursor-pointer">Aktivovat ochranu proti zneužití (Rate Limity a Token Budgets)</label>
								</div>
							</div>

							<div className="flex items-center gap-4 border-t border-[#1e1a3d] pt-4">
								<button 
									onClick={saveSettings}
									className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl py-2.5 px-6 text-sm font-semibold shadow-lg shadow-violet-600/10 transition duration-200"
								>
									Uložit nastavení
								</button>
								<span className="text-sm text-indigo-400 font-medium">{saveState}</span>
							</div>
						</div>
					)}

					{activeTab === 'ingestion' && (
						<div className="space-y-6">
							{/* Feed Ingestion */}
							<div className="bg-[#0c0a1e]/60 border border-[#1e1a3d] rounded-2xl p-6 shadow-lg space-y-4">
								<div>
									<h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
										<RefreshCw className="h-5 w-5 text-indigo-400" />
										Synchronizace XML Feedů
									</h2>
									<p className="text-xs text-slate-400 mt-0.5">
										Spusťte stahování a vektorový ingest Heureka/Zboží XML produktového feedu. Synchronizace nepřepisuje ručně přidané dokumenty.
									</p>
								</div>

								<div className="bg-[#120f2d] border border-[#2b255c] p-4 rounded-xl flex items-center justify-between">
									<div className="flex items-center gap-3">
										<div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
											<Database className="h-4 w-4 text-indigo-400" />
										</div>
										<div className="text-xs">
											<span className="text-slate-500 uppercase tracking-wider block">Aktuálně nakonfigurovaný feed</span>
											<span className="font-semibold text-slate-200 font-mono select-all block mt-0.5">
												{feedUrl || 'Nakonfigurujte URL v Nastavení'}
											</span>
										</div>
									</div>

									<button 
										onClick={triggerSync}
										disabled={syncing || !feedUrl}
										className={`rounded-xl py-2.5 px-6 text-sm font-semibold shadow-md flex items-center gap-2 transition duration-200 ${
											syncing || !feedUrl
												? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
												: 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white'
										}`}
									>
										<RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
										{syncing ? 'Synchronizuji...' : 'Spustit synchronizaci'}
									</button>
								</div>

								{syncResult && (
									<div className={`p-4 rounded-xl border text-xs flex gap-3 ${
										syncResult.success 
											? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-300' 
											: 'bg-rose-950/20 border-rose-500/20 text-rose-300'
									}`}>
										<Info className="h-5 w-5 flex-shrink-0" />
										<div>
											<p className="font-bold text-sm">{syncResult.success ? 'Synchronizace úspěšná' : 'Chyba synchronizace'}</p>
											<p className="mt-1 opacity-90">{syncResult.message}</p>
											{syncResult.stats && (
												<div className="mt-3 flex gap-6 bg-[#000]/10 p-2.5 rounded-lg w-max border border-white/5 font-mono text-[11px]">
													<div>
														<span className="opacity-60 block">Nalezeno produktů:</span>
														<span className="font-bold text-sm text-white">{syncResult.stats.totalParsed}</span>
													</div>
													<div>
														<span className="opacity-60 block">Uloženo s embeddingy:</span>
														<span className="font-bold text-sm text-white">{syncResult.stats.totalEmbedded}</span>
													</div>
												</div>
											)}
										</div>
									</div>
								)}
							</div>

							{/* Custom Text Ingestion */}
							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
								<div className="bg-[#0c0a1e]/60 border border-[#1e1a3d] rounded-2xl p-6 shadow-lg space-y-4">
									<div>
										<h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
											<FileText className="h-5 w-5 text-purple-400" />
											Vložit text nebo poznámku
										</h2>
										<p className="text-xs text-slate-400 mt-0.5">
											Zadejte textové informace přímo (např. otevírací doba, ceníky, informace o firmě).
										</p>
									</div>

									<div className="space-y-3">
										<label className="flex flex-col gap-1 text-xs text-slate-400">
											<span className="font-semibold uppercase tracking-wider text-slate-500">Název zdroje (např. Otevírací doba)</span>
											<input 
												type="text"
												className="bg-[#120f2d] border border-[#2b255c] rounded-xl px-3 py-2 text-sm text-slate-200 outline-none focus:border-violet-500 transition-colors"
												placeholder="Moje poznámka" 
												value={textSourceName}
												onChange={(e) => setTextSourceName(e.target.value)}
											/>
										</label>

										<label className="flex flex-col gap-1 text-xs text-slate-400">
											<span className="font-semibold uppercase tracking-wider text-slate-500">Obsah textu (min. 10 znaků)</span>
											<textarea 
												rows={6}
												className="bg-[#120f2d] border border-[#2b255c] rounded-xl px-3 py-2 text-sm text-slate-200 outline-none focus:border-violet-500 transition-colors resize-none placeholder:text-slate-600 font-sans"
												placeholder="Zde vložte libovolný text, který se má agent naučit..." 
												value={textInput}
												onChange={(e) => setTextInput(e.target.value)}
											/>
										</label>

										<button 
											onClick={ingestText}
											disabled={textIngesting || !textInput.trim()}
											className={`w-full rounded-xl py-2.5 px-4 text-sm font-semibold shadow-md flex items-center justify-center gap-2 transition duration-200 ${
												textIngesting || !textInput.trim()
													? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
													: 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white'
											}`}
										>
											{textIngesting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
											{textIngesting ? 'Ukládám do paměti...' : 'Uložit do paměti'}
										</button>

										{textIngestResult && (
											<div className={`p-3 rounded-xl border text-[11px] ${
												textIngestResult.success 
													? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-300' 
													: 'bg-rose-950/20 border-rose-500/20 text-rose-300'
											}`}>
												{textIngestResult.message}
											</div>
										)}
									</div>
								</div>

								{/* File Upload Ingestion */}
								<div className="bg-[#0c0a1e]/60 border border-[#1e1a3d] rounded-2xl p-6 shadow-lg space-y-4">
									<div>
										<h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
											<Upload className="h-5 w-5 text-indigo-400" />
											Nahrát dokument (TXT, MD, CSV)
										</h2>
										<p className="text-xs text-slate-400 mt-0.5">
											Nahrajte soubory, které obsahují strukturované nebo nestrukturované informace.
										</p>
									</div>

									<form onSubmit={ingestFile} className="space-y-3">
										<label className="flex flex-col gap-1 text-xs text-slate-400">
											<span className="font-semibold uppercase tracking-wider text-slate-500">Název zdroje (volitelné)</span>
											<input 
												type="text"
												className="bg-[#120f2d] border border-[#2b255c] rounded-xl px-3 py-2 text-sm text-slate-200 outline-none focus:border-violet-500 transition-colors"
												placeholder="Název souboru / dokumentu" 
												value={fileSourceName}
												onChange={(e) => setFileSourceName(e.target.value)}
											/>
										</label>

										<div className="flex flex-col gap-1 text-xs text-slate-400">
											<span className="font-semibold uppercase tracking-wider text-slate-500">Výběr souboru</span>
											<div className="bg-[#120f2d] border border-dashed border-[#2b255c] hover:border-indigo-500 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors relative">
												<input 
													type="file"
													accept=".txt,.md,.csv,.markdown"
													className="absolute inset-0 opacity-0 cursor-pointer"
													onChange={(e) => setFileInput(e.target.files?.[0] || null)}
												/>
												<Upload className="h-8 w-8 text-indigo-400/60 mb-2" />
												<span className="text-xs font-semibold text-slate-300">
													{fileInput ? fileInput.name : 'Vyberte soubor (TXT, MD, CSV)'}
												</span>
												{fileInput && (
													<span className="text-[10px] text-slate-500 mt-1">
														Velikost: {(fileInput.size / 1024).toFixed(1)} KB
													</span>
												)}
											</div>
										</div>

										<button 
											type="submit"
											disabled={fileIngesting || !fileInput}
											className={`w-full rounded-xl py-2.5 px-4 text-sm font-semibold shadow-md flex items-center justify-center gap-2 transition duration-200 ${
												fileIngesting || !fileInput
													? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
													: 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white'
											}`}
										>
											{fileIngesting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
											{fileIngesting ? 'Nahrávám a indexuji...' : 'Nahrát a indexovat'}
										</button>

										{fileIngestResult && (
											<div className={`p-3 rounded-xl border text-[11px] ${
												fileIngestResult.success 
													? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-300' 
													: 'bg-rose-950/20 border-rose-500/20 text-rose-300'
											}`}>
												{fileIngestResult.message}
											</div>
										)}
									</form>
								</div>
							</div>

							{/* Danger Zone */}
							<div className="bg-[#170c1e]/40 border border-[#ff3b3b]/20 rounded-2xl p-6 shadow-lg space-y-4">
								<div>
									<h2 className="text-lg font-bold text-red-400 tracking-wide flex items-center gap-2">
										<Trash2 className="h-5 w-5 text-red-500" />
										Nebezpečná zóna
									</h2>
									<p className="text-xs text-slate-400 mt-0.5">
										Následující akce jsou destruktivní a nelze je vzít zpět.
									</p>
								</div>

								<div className="bg-[#120914] border border-[#ff3b3b]/10 p-4 rounded-xl flex items-center justify-between">
									<div>
										<span className="font-bold text-sm text-slate-200 block">Smazat veškerou paměť RAG</span>
										<span className="text-xs text-slate-500">
											Odstraní všechny synchronizované produkty i ručně nahrané dokumenty.
										</span>
									</div>

									<button 
										onClick={() => { setShowDeleteModal(true); setDeleteResult(null); }}
										className="bg-red-950/40 hover:bg-red-900/60 border border-red-700/30 hover:border-red-500 text-red-300 hover:text-white rounded-xl py-2 px-6 text-sm font-semibold transition duration-200"
									>
										Smazat paměť RAG
									</button>
								</div>

								{deleteResult && (
									<div className={`p-3 rounded-xl border text-[11px] ${
										deleteResult.success 
											? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-300' 
											: 'bg-rose-950/20 border-rose-500/20 text-rose-300'
									}`}>
										{deleteResult.message}
									</div>
								)}
							</div>
						</div>
					)}

					{activeTab === 'history' && (
						<div className="bg-[#0c0a1e]/60 border border-[#1e1a3d] rounded-2xl overflow-hidden shadow-lg h-[580px] flex">
							{/* Left sidebar - Sessions list */}
							<div className="w-80 border-r border-[#1e1a3d] bg-[#09071c] flex flex-col">
								<div className="p-4 border-b border-[#1e1a3d] flex justify-between items-center">
									<h2 className="text-sm font-bold text-white uppercase tracking-wider">Konverzace</h2>
									<button 
										onClick={fetchSessions}
										className="p-1.5 hover:bg-[#19153a] text-slate-400 hover:text-white rounded-lg transition-colors"
										title="Obnovit seznam"
									>
										<RefreshCw className={`h-4 w-4 ${loadingSessions ? 'animate-spin' : ''}`} />
									</button>
								</div>
								
								<div className="flex-1 overflow-y-auto divide-y divide-[#1e1a3d]">
									{loadingSessions ? (
										<div className="p-8 text-center text-xs text-slate-500">Načítám konverzace...</div>
									) : sessions.length === 0 ? (
										<div className="p-8 text-center text-xs text-slate-500">Žádné chat relace nebyly nalezeny.</div>
									) : (
										sessions.map(session => (
											<button
												key={session.id}
												onClick={() => loadSessionMessages(session.id)}
												className={`w-full text-left p-4 transition-all duration-150 block relative ${
													selectedSessionId === session.id 
														? 'bg-[#18133b]/50 border-l-4 border-violet-500' 
														: 'hover:bg-[#100c2a]'
												}`}
											>
												<div className="flex justify-between items-start">
													<span className="text-xs font-mono text-indigo-400 truncate max-w-[170px]">{session.id}</span>
													<span className="text-[10px] text-slate-500">{new Date(session.createdAt).toLocaleDateString()}</span>
												</div>
												<div className="flex justify-between items-center mt-2">
													<span className="text-[10px] bg-[#1a163a] px-2 py-0.5 border border-[#2e2661] text-indigo-300 rounded uppercase tracking-wider">{session.channel}</span>
													<span className="text-xs text-slate-400 flex items-center gap-1 font-medium">
														<MessageSquare className="h-3 w-3 opacity-60" />
														{session.messageCount} zpráv
													</span>
												</div>
											</button>
										))
									)}
								</div>
							</div>

							{/* Right side - Message logs viewer */}
							<div className="flex-1 flex flex-col bg-[#0b0921]/20">
								{selectedSessionId ? (
									<>
										{/* Chat Header */}
										<div className="p-4 border-b border-[#1e1a3d] bg-[#09071c] flex items-center justify-between">
											<div>
												<span className="text-[10px] text-slate-500 uppercase font-semibold">Relace ID</span>
												<h3 className="text-xs font-mono text-indigo-300 mt-0.5 select-all">{selectedSessionId}</h3>
											</div>
										</div>

										{/* Message Log */}
										<div className="flex-1 overflow-y-auto p-6 space-y-4">
											{loadingMessages ? (
												<div className="text-center py-12 text-xs text-slate-500">Načítám zprávy...</div>
											) : sessionMessages.length === 0 ? (
												<div className="text-center py-12 text-xs text-slate-500">Tato relace nemá žádné zprávy.</div>
											) : (
												sessionMessages.map((msg, idx) => (
													<div 
														key={idx} 
														className={`flex flex-col max-w-[80%] ${
															msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
														}`}
													>
														<div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
															msg.role === 'user'
																? 'bg-[#150d3c] text-indigo-100 border border-[#2b1f69] rounded-br-none'
																: 'bg-[#1b1736]/60 text-slate-200 border border-[#2d2561] rounded-bl-none'
														}`}>
															{msg.content}
														</div>
														<span className="text-[9px] text-slate-500 mt-1">
															{msg.role === 'user' ? 'Zákazník' : 'AI Asistent'} • {new Date(msg.createdAt).toLocaleTimeString()}
														</span>
													</div>
												))
											)}
										</div>
									</>
								) : (
									<div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
										<MessageSquare className="h-10 w-10 opacity-20 mb-3 text-indigo-400" />
										<p className="text-sm font-semibold">Vyberte konverzaci z levého panelu</p>
										<p className="text-xs opacity-75 mt-1 max-w-xs">Zobrazíte tak kompletní přepis zpráv mezi zákazníkem a AI nákupním asistentem.</p>
									</div>
								)}
							</div>
						</div>
					)}

					{activeTab === 'sandbox' && (
						<div className="bg-[#0c0a1e]/60 border border-[#1e1a3d] rounded-2xl overflow-hidden shadow-lg h-[580px] flex">
							{/* Simulator explanation panel */}
							<div className="w-80 border-r border-[#1e1a3d] bg-[#09071c] p-6 flex flex-col justify-between">
								<div className="space-y-4">
									<h2 className="text-sm font-bold text-white uppercase tracking-wider">Chat Sandbox</h2>
									<p className="text-xs text-slate-400 leading-relaxed">
										Tento panel simuluje chatbota přímo s aktivní pamětí RAG, kterou jste nahráli z XML feedu.
									</p>
									<div className="p-3 bg-[#110e2f]/80 border border-[#27215c] rounded-xl text-[11px] text-indigo-300 leading-normal">
										<span className="font-semibold block mb-1">Jak to funguje:</span>
										Zde odeslané zprávy projdou generátorem dotazů, vyhledají relevantní produkty a odpoví na ně v reálném čase.
									</div>
								</div>
								
								<button 
									onClick={() => setPreviewMessages([{ role: 'assistant', content: 'Konverzace byla restartována. Můžeš se mě znovu zeptat na produkty.' }])}
									className="w-full bg-[#1b153f] hover:bg-[#251c56] border border-[#3b328a] text-slate-300 hover:text-white rounded-xl py-2 px-4 text-xs font-semibold transition duration-200"
								>
									Restartovat konverzaci
								</button>
							</div>

							{/* Active Phone Simulator Chat UI */}
							<div className="flex-1 flex flex-col bg-[#08061a]">
								{/* Simulator Header */}
								<div className="px-6 py-4 bg-[#0c0a1e] border-b border-[#1e1a3d] flex items-center gap-3">
									<span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
									<h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Live AI Simulator</h3>
								</div>

								{/* Messages Area */}
								<div className="flex-1 overflow-y-auto p-6 space-y-4">
									{previewMessages.map((msg, idx) => (
										<div 
											key={idx} 
											className={`flex flex-col max-w-[80%] ${
												msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
											}`}
										>
											<div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
												msg.role === 'user'
													? 'bg-[#2b1660] text-indigo-50 border border-[#4d2d9b] rounded-br-none'
													: 'bg-[#181532] text-slate-200 border border-[#2c265e] rounded-bl-none'
											}`}>
												{msg.content}
											</div>
											<span className="text-[9px] text-slate-500 mt-1">
												{msg.role === 'user' ? 'Vy' : 'AI Asistent'}
											</span>
										</div>
									))}
									{previewLoading && (
										<div className="flex items-center gap-2 mr-auto bg-[#181532]/40 border border-[#2c265e]/40 px-4 py-3 rounded-2xl rounded-bl-none text-xs text-indigo-300">
											<RefreshCw className="h-3.5 w-3.5 animate-spin" />
											Asistent přemýšlí a vyhledává produkty...
										</div>
									)}
								</div>

								{/* Simulator Input Box */}
								<form 
									onSubmit={(e) => { e.preventDefault(); sendPreviewMessage(); }}
									className="p-4 bg-[#0c0a1e] border-t border-[#1e1a3d] flex gap-3"
								>
									<input 
										type="text"
										className="flex-1 bg-[#120f2d] border border-[#2b255c] rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-violet-500 transition-colors"
										placeholder="Zeptejte se na doporučení produktu..."
										value={previewInput}
										onChange={(e) => setPreviewInput(e.target.value)}
										disabled={previewLoading}
									/>
									<button 
										type="submit"
										disabled={previewLoading || !previewInput.trim()}
										className={`rounded-xl px-5 py-3 text-sm font-semibold flex items-center justify-center transition duration-200 ${
											previewLoading || !previewInput.trim()
												? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
												: 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white'
										}`}
									>
										Odeslat
									</button>
								</form>
							</div>
						</div>
					)}

					{activeTab === 'widget' && (
						<div className="bg-[#0c0a1e]/60 border border-[#1e1a3d] rounded-2xl p-6 shadow-lg space-y-6">
							<div>
								<h2 className="text-lg font-bold text-white tracking-wide">Widget integrace</h2>
								<p className="text-xs text-slate-400 mt-0.5">Vložte tento JavaScript snippet na váš web k vykreslení autonomního chatbota.</p>
							</div>

							<div className="bg-[#08061a] border border-[#231b53] rounded-xl p-4 relative">
								<button 
									onClick={copyToClipboard}
									className="absolute right-4 top-4 bg-[#1b153f] hover:bg-[#251c56] border border-[#3b328a] text-xs text-slate-300 hover:text-white rounded-lg py-1.5 px-3 font-semibold transition duration-150 flex items-center gap-1.5"
								>
									{copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
									{copied ? 'Zkopírováno' : 'Kopírovat'}
								</button>
								<pre className="text-xs font-mono text-indigo-300 leading-6 overflow-x-auto select-all pr-24">
									{embedSnippet}
								</pre>
							</div>

							<div className="bg-indigo-950/10 border border-indigo-500/20 p-4 rounded-xl text-xs text-indigo-300 leading-relaxed flex gap-3">
								<Info className="h-5 w-5 flex-shrink-0 text-indigo-400" />
								<div>
									<span className="font-semibold block mb-1">Cross-Domain Vkládání</span>
									Tento snippet je plně asynchronní a načítá se z hostovaného API portu. Můžete ho bez problémů vložit na jakoukoliv externí doménu. Widget se vykreslí v uzavřeném Shadow DOMu, takže nedojde k žádnému úniku nebo přemazání CSS stylů hostitelského webu.
								</div>
							</div>
						</div>
					)}
				</main>
			</div>

			{showDeleteModal && (
				<div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-200">
					<div className="bg-[#0c0a1e] border border-red-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
						<div className="flex items-center gap-3 text-red-400">
							<AlertTriangle className="h-6 w-6 flex-shrink-0" />
							<h3 className="font-bold text-lg">Opravdu smazat veškerou paměť?</h3>
						</div>
						<p className="text-xs text-slate-400 leading-relaxed">
							Tato akce trvale vymaže všechny produkty z XML feedu i všechny ručně nahrané dokumenty a texty z paměti RAG. Asistent nebude mít žádné znalosti.
						</p>
						<div className="bg-[#1c121e] border border-red-500/20 rounded-xl p-3 text-[11px] text-red-300 leading-normal">
							Pro potvrzení napište <strong className="font-bold text-white select-all">SMAZAT PAMĚŤ</strong> do pole níže.
						</div>
						<input
							type="text"
							className="w-full bg-[#120f2d] border border-red-500/30 rounded-xl px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-red-500 transition-colors"
							placeholder="SMAZAT PAMĚŤ"
							value={deleteConfirmText}
							onChange={(e) => setDeleteConfirmText(e.target.value)}
						/>
						<div className="flex gap-3 pt-2">
							<button
								onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }}
								className="flex-1 bg-[#1a153d] hover:bg-[#231d52] border border-[#3b328a] text-slate-200 rounded-xl py-2.5 px-4 text-xs font-semibold transition duration-200"
							>
								Zrušit
							</button>
							<button
								onClick={deleteMemory}
								disabled={deleteConfirmText !== 'SMAZAT PAMĚŤ' || deleting}
								className={`flex-1 rounded-xl py-2.5 px-4 text-xs font-semibold transition duration-200 flex items-center justify-center gap-1.5 ${
									deleteConfirmText === 'SMAZAT PAMĚŤ' && !deleting
										? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20'
										: 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
								}`}
							>
								{deleting ? 'Mažu...' : 'Trvale smazat'}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
