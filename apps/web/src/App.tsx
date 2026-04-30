import { KeyRound, Link2, MessageSquareDashed, ShieldCheck, UploadCloud } from 'lucide-react';
import { useState } from 'react';

const embedSnippet = `<script async src=\"https://cdn.example.com/chat-agent-loader.js\"></script>\n<script>window.ChatAgentWidget.mount({ tenantId: \"demo-tenant\" });</script>`;

type Provider = 'openai' | 'gemini' | 'claude';

const tenantHeader = {
	'x-tenant-id': 'demo-tenant',
};

export function App(): JSX.Element {
	const [platform, setPlatform] = useState('prestashop');
	const [prestashopApiKeyAlias, setPrestashopApiKeyAlias] = useState('prestashop-main-key');
	const [feedUrl, setFeedUrl] = useState('');
	const [apiUrl, setApiUrl] = useState('');
	const [shoptetPremium, setShoptetPremium] = useState(false);
	const [provider, setProvider] = useState<Provider>('openai');
	const [model, setModel] = useState('gpt-4o-mini');
	const [apiKeyAlias, setApiKeyAlias] = useState('default-key');
	const [previewInput, setPreviewInput] = useState('Doporuc mi produkt na odstraneni zapachu z bot');
	const [previewOutput, setPreviewOutput] = useState('');
	const [saveState, setSaveState] = useState('');

	async function saveSettings(): Promise<void> {
		setSaveState('Ukladam...');
		const response = await fetch('http://localhost:8787/api/admin/settings', {
			body: JSON.stringify({
				abuseProtectionEnabled: true,
				connector: {
					platform,
					prestashopApiKeyAlias: prestashopApiKeyAlias || undefined,
					productApiUrl: apiUrl || undefined,
					productFeedUrl: feedUrl || undefined,
					shoptetPremium,
				},
				llm: {
					apiKeyAlias,
					model,
					provider,
				},
			}),
			headers: {
				...tenantHeader,
				'content-type': 'application/json',
			},
			method: 'PUT',
		});

		setSaveState(response.ok ? 'Nastaveni ulozeno.' : 'Ulozeni selhalo.');
	}

	async function runPreview(): Promise<void> {
		setPreviewOutput('Nacitam odpoved...');
		const response = await fetch('http://localhost:8787/api/admin/chat-preview', {
			body: JSON.stringify({ message: previewInput }),
			headers: {
				...tenantHeader,
				'content-type': 'application/json',
			},
			method: 'POST',
		});

		if (!response.ok) {
			setPreviewOutput('Preview endpoint neni dostupny.');
			return;
		}

		const data = (await response.json()) as { preview?: { message?: string } };
		setPreviewOutput(data.preview?.message || 'Bez odpovedi.');
	}

	async function uploadDocumentMetadata(): Promise<void> {
		setSaveState('Odesilam metadata dokumentu...');
		const response = await fetch('http://localhost:8787/api/admin/documents', {
			body: JSON.stringify({
				contentType: 'application/pdf',
				fileName: 'knowledge-base.pdf',
				sizeBytes: 120400,
			}),
			headers: {
				...tenantHeader,
				'content-type': 'application/json',
			},
			method: 'POST',
		});

		setSaveState(response.ok ? 'Dokument fronty ingestu vytvoren.' : 'Vytvoreni dokumentu selhalo.');
	}

	return (
		<main className="mx-auto max-w-5xl px-6 py-10">
			<header className="mb-8 rounded-2xl border border-amber-200 bg-white/70 p-6 shadow-sm backdrop-blur">
				<h1 className="text-3xl font-semibold tracking-tight">AI Shopping Agent Control Room</h1>
				<p className="mt-2 text-sm text-slate-600">Project admin: dokumenty, feed/API konektory, LLM klice, model vyber, anti-abuse a chat preview.</p>
			</header>
			<section className="grid gap-4 md:grid-cols-3">
				<article className="rounded-xl border border-emerald-200 bg-white p-4">
					<KeyRound className="mb-2 h-5 w-5 text-emerald-700" />
					<h2 className="font-medium">LLM API Credentials</h2>
					<p className="mt-1 text-sm text-slate-600">Uloz alias API klice (OpenAI, Gemini, Claude) a vyber model per projekt.</p>
				</article>
				<article className="rounded-xl border border-orange-200 bg-white p-4">
					<Link2 className="mb-2 h-5 w-5 text-orange-700" />
					<h2 className="font-medium">Platform Connectors</h2>
					<p className="mt-1 text-sm text-slate-600">Prvni deployment: PrestaShop 8.2.0, s fallbackem na feed/API pro dalsi platformy.</p>
				</article>
				<article className="rounded-xl border border-cyan-200 bg-white p-4">
					<UploadCloud className="mb-2 h-5 w-5 text-cyan-700" />
					<h2 className="font-medium">Knowledge Documents</h2>
					<p className="mt-1 text-sm text-slate-600">Nahravej PDF/DOC/TXT metadata a uc chat pres ingest frontu.</p>
				</article>
			</section>
			<section className="mt-6 grid gap-4 md:grid-cols-2">
				<article className="rounded-xl border border-slate-200 bg-white p-4">
					<h2 className="mb-3 font-semibold">Connector Settings</h2>
					<div className="grid gap-2 text-sm">
						<label className="grid gap-1">
							<span>Platform</span>
							<select className="rounded border border-slate-300 p-2" value={platform} onChange={(event) => setPlatform(event.target.value)}>
								<option value="prestashop">PrestaShop 8.2.0</option>
								<option value="custom-feed">Custom feed/API</option>
								<option value="shoptet">Shoptet</option>
								<option value="woocommerce">WooCommerce</option>
								<option value="shopify">Shopify</option>
							</select>
						</label>
						<label className="grid gap-1">
							<span>PrestaShop API key alias</span>
							<input className="rounded border border-slate-300 p-2" value={prestashopApiKeyAlias} onChange={(event) => setPrestashopApiKeyAlias(event.target.value)} />
						</label>
						<label className="grid gap-1">
							<span>Product feed URL</span>
							<input className="rounded border border-slate-300 p-2" placeholder="https://example.com/feed.xml" value={feedUrl} onChange={(event) => setFeedUrl(event.target.value)} />
						</label>
						<label className="grid gap-1">
							<span>Product API URL</span>
							<input className="rounded border border-slate-300 p-2" placeholder="https://example.com/api/products" value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} />
						</label>
						<label className="flex items-center gap-2">
							<input checked={shoptetPremium} type="checkbox" onChange={(event) => setShoptetPremium(event.target.checked)} />
							<span>Shoptet premium aktivni</span>
						</label>
					</div>
				</article>
				<article className="rounded-xl border border-slate-200 bg-white p-4">
					<h2 className="mb-3 font-semibold">LLM Provider and Model</h2>
					<div className="grid gap-2 text-sm">
						<label className="grid gap-1">
							<span>Provider</span>
							<select className="rounded border border-slate-300 p-2" value={provider} onChange={(event) => setProvider(event.target.value as Provider)}>
								<option value="openai">OpenAI</option>
								<option value="gemini">Gemini</option>
								<option value="claude">Claude</option>
							</select>
						</label>
						<label className="grid gap-1">
							<span>Model</span>
							<input className="rounded border border-slate-300 p-2" value={model} onChange={(event) => setModel(event.target.value)} />
						</label>
						<label className="grid gap-1">
							<span>API key alias</span>
							<input className="rounded border border-slate-300 p-2" value={apiKeyAlias} onChange={(event) => setApiKeyAlias(event.target.value)} />
						</label>
					</div>
				</article>
			</section>
			<section className="mt-6 grid gap-4 md:grid-cols-2">
				<article className="rounded-xl border border-slate-200 bg-white p-4">
					<div className="mb-2 flex items-center gap-2 font-semibold">
						<MessageSquareDashed className="h-4 w-4" />
						<span>Chat Preview Sandbox</span>
					</div>
					<textarea className="h-24 w-full rounded border border-slate-300 p-2 text-sm" value={previewInput} onChange={(event) => setPreviewInput(event.target.value)} />
					<button className="mt-2 rounded bg-emerald-700 px-3 py-2 text-sm font-medium text-white" onClick={runPreview} type="button">
						Otestovat chat odpoved
					</button>
					<p className="mt-3 rounded bg-slate-100 p-2 text-sm text-slate-700">{previewOutput || 'Preview odpoved se zobrazi tady.'}</p>
				</article>
				<article className="rounded-xl border border-slate-200 bg-white p-4">
					<div className="mb-2 flex items-center gap-2 font-semibold">
						<ShieldCheck className="h-4 w-4" />
						<span>Abuse Protection Baseline</span>
					</div>
					<ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
						<li>IP limit: 60 req/hod</li>
						<li>Tenant limit: 600 req/hod</li>
						<li>Soft daily budget: 80k tokenu</li>
						<li>Hard daily budget: 120k tokenu</li>
						<li>Graceful fallback pri 429 a provider fail</li>
					</ul>
				</article>
			</section>
			<section className="mt-6 flex flex-wrap gap-2">
				<button className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white" onClick={saveSettings} type="button">
					Ulozit projektove nastaveni
				</button>
				<button className="rounded bg-cyan-700 px-3 py-2 text-sm font-medium text-white" onClick={uploadDocumentMetadata} type="button">
					Pridat dokument do ingest fronty
				</button>
				<p className="self-center text-sm text-slate-600">{saveState}</p>
			</section>
			<section className="mt-6 rounded-2xl border border-slate-200 bg-slate-950 p-4 text-slate-100">
				<h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">Embed Snippet</h2>
				<pre className="mt-3 overflow-x-auto rounded-lg bg-black/30 p-3 text-xs leading-5">{embedSnippet}</pre>
			</section>
		</main>
	);
}
