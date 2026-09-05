import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Copy, Check, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { Dialog } from '@/components/common/Dialog';
import { getTools, TOOL_PREFIX } from '@/services/mcp/toolRegistry';

/**
 * Verbindingsgegevens-dialoog voor de MCP-bridge (AI-ribbontab → groep Verbinding).
 *
 * De ribbon is te ondiep voor een volledige koppelregel — die werd daar afgekapt. Alles wat een
 * client nodig heeft staat daarom hier: endpoint, auth-header en een kant-en-klaar
 * configuratiefragment. Bewust **provider-neutraal**: dit is een gewone MCP-server over
 * streamable HTTP, dus de UI noemt geen enkel product en toont geen CLI-commando van één client.
 *
 * Het token wordt standaard gemaskeerd getoond (toon/verberg-knop); de kopieerknoppen kopiëren
 * altijd de ECHTE waarde, ook wanneer het scherm maskeert — anders plakt de gebruiker bolletjes.
 */

export interface AiConnectionDetailsDialogProps {
  port: number;
  token: string;
  onClose: () => void;
}

/** Maskering voor het token in de weergave (kopiëren gebruikt altijd de echte waarde). */
const MASK = '••••••••••••••••';

/** Servernaam in het configuratiefragment — technische sleutel, geen zichtbare productnaam. */
const SERVER_KEY = 'open-planner-studio';

function buildSnippet(endpoint: string, token: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        [SERVER_KEY]: {
          type: 'http',
          url: endpoint,
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    },
    null,
    2,
  );
}

export function AiConnectionDetailsDialog({ port, token, onClose }: AiConnectionDetailsDialogProps) {
  const { t } = useTranslation('common');
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const endpoint = `http://localhost:${port}/mcp`;
  const authReal = `Authorization: Bearer ${token}`;
  const authShown = `Authorization: Bearer ${showToken ? token : MASK}`;
  const snippetReal = buildSnippet(endpoint, token);
  const snippetShown = showToken ? snippetReal : buildSnippet(endpoint, MASK);

  // Koppelprompt: één alinea die de gebruiker in zijn AI-agent plakt, zodat die zichzelf koppelt.
  // Het toolaantal komt uit de LEVENDE registry (`getTools()`, zelf-registrerend bij module-load),
  // niet uit een hardgecodeerd getal — voegt een baan een tool toe, dan klopt de prompt vanzelf.
  const promptFor = (tok: string) => t('ai.connectPromptText', {
    name: SERVER_KEY,
    url: endpoint,
    token: tok,
    count: getTools().length,
    prefix: TOOL_PREFIX,
  });
  const promptReal = promptFor(token);
  const promptShown = showToken ? promptReal : promptFor(MASK);

  const copy = async (text: string, key: string) => {
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    setCopied(key);
    setTimeout(() => setCopied(c => (c === key ? null : c)), 1500);
  };

  const copyButton = (text: string, key: string) => (
    <button
      type="button"
      onClick={() => { void copy(text, key); }}
      title={t('ai.copy')}
      aria-label={t('ai.copy')}
      className="shrink-0 p-1 border border-border rounded-[8px] hover:bg-surface-hover"
    >
      {copied === key ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );

  const toggleButton = (
    <button
      type="button"
      onClick={() => setShowToken(v => !v)}
      title={showToken ? t('ai.hideToken') : t('ai.showToken')}
      aria-label={showToken ? t('ai.hideToken') : t('ai.showToken')}
      className="shrink-0 p-1 border border-border rounded-[8px] hover:bg-surface-hover"
    >
      {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
    </button>
  );

  const section = (title: string, hint: string, body: ReactNode) => (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-text-primary">{title}</span>
      <span className="text-[11px] text-text-secondary">{hint}</span>
      {body}
    </div>
  );

  const codeLine = (value: string) => (
    <code className="flex-1 min-w-0 px-2 py-1 font-mono text-[11px] bg-surface-alt border border-border rounded-[8px] overflow-x-auto whitespace-nowrap select-all">
      {value}
    </code>
  );

  return (
    <Dialog
      onBackdropClick={onClose}
      onCancel={onClose}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[560px] max-h-[88vh] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-ai-connection-dialog': true }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
        <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
          {t('ai.connectionDetailsTitle')}
        </span>
        <button onClick={onClose} className="p-1 hover:bg-surface-hover rounded-[8px]" aria-label={t('close')}>
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Endpoint */}
        {section(
          t('ai.endpoint'),
          t('ai.endpointHint'),
          <div className="flex items-center gap-2">
            {codeLine(endpoint)}
            {copyButton(endpoint, 'endpoint')}
          </div>,
        )}

        {/* Authenticatie — header-naam + waarde; maskering alleen in de weergave. */}
        {section(
          t('ai.auth'),
          t('ai.authHint'),
          <div className="flex items-center gap-2">
            {codeLine(authShown)}
            {toggleButton}
            {copyButton(authReal, 'auth')}
          </div>,
        )}

        {/* Configuratiefragment — de de-facto standaardvorm die MCP-clients accepteren. */}
        {section(
          t('ai.configSnippet'),
          t('ai.configSnippetHint'),
          <div className="flex items-start gap-2">
            <pre className="flex-1 min-w-0 px-2 py-1 font-mono text-[11px] leading-relaxed bg-surface-alt border border-border rounded-[8px] overflow-x-auto select-all">
              {snippetShown}
            </pre>
            {copyButton(snippetReal, 'snippet')}
          </div>,
        )}

        {/* Kant-en-klare koppelprompt — plakbaar als platte tekst, dus geen markdown-opmaak. */}
        {section(
          t('ai.connectPrompt'),
          t('ai.connectPromptHint'),
          <div className="flex items-start gap-2">
            <p className="flex-1 min-w-0 px-2 py-1 text-[11px] leading-relaxed bg-surface-alt border border-border rounded-[8px] select-all">
              {promptShown}
            </p>
            {copyButton(promptReal, 'prompt')}
          </div>,
        )}

        <div className="flex items-start gap-2 text-[11px] text-text-secondary">
          <AlertTriangle size={14} className="shrink-0 mt-px" style={{ color: 'var(--theme-warning-text)' }} />
          <span>{t('ai.tokenWarning')}</span>
        </div>
      </div>

      <div className="flex justify-end px-4 py-3 border-t border-border">
        <button onClick={onClose} className="btn btn--sm btn--secondary">{t('close')}</button>
      </div>
    </Dialog>
  );
}
