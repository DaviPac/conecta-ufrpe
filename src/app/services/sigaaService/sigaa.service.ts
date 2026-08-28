import { Injectable, WritableSignal, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { environment } from '../../../environments/environment';

import {
  Avaliacao,
  CargaHoraria,
  IndicesAcademicos,
  MainDataResponse,
  NotasResponse,
  Turma,
  AtestadoMatricula,
  Arquivo,
  EstruturaCurricular,
  MatrizCurricularResponse,
  Notas,
  DetalhesComponenteResponse,
  DetalhesComponente,
} from '../../models/sigaa.models';

const CACHE_KEY = 'sigaa_data_cache';
const JSESSIONID_KEY = 'jsessionid';
const VIEWSTATE_KEY = 'viewState';

interface DataCache {
  turmas: Turma[];
  nome: string;
  matricula: string | null;
  avaliacoes: Avaliacao[];
  cargaHoraria: CargaHoraria | null;
  indices: IndicesAcademicos | null;
  fullyLoaded: boolean;
  savedAt: number;
}

interface ApiOptions {
  method?: 'GET' | 'POST';
  /** Corpo JSON. O `viewState` atual é mesclado no envio (ver `injectViewState`). */
  body?: Record<string, unknown>;
  accept?: string;
  /** Desativa a injeção automática de `viewState`. Default: injeta quando há `body`. */
  injectViewState?: boolean;
}

interface SseEvent {
  type: string;
  data: any;
}

/**
 * Cliente do backend-proxy do SIGAA.
 *
 * ⚠️ O SIGAA é *stateful*: toda resposta autenticada devolve um novo par
 * `jsessionid`/`viewState` que precisa ser usado na requisição seguinte. Duas
 * chamadas em paralelo — ou disparadas sem aguardar a anterior — competem pelo
 * mesmo `viewState` e o backend passa a responder erro (ou dado inconsistente).
 *
 * Por isso **toda** chamada autenticada passa por {@link enqueue}, que as
 * serializa numa fila FIFO. Métodos `_`-prefixados assumem que já rodam dentro
 * de um slot da fila e nunca chamam `enqueue()` de novo (evita deadlock).
 */
@Injectable({ providedIn: 'root' })
export class SigaaService {
  private readonly domain = environment.apiUrl;
  private readonly CRED_KEY = 'sigaa_cred';

  private router = inject(Router);

  // ─── Estado de sessão do SIGAA ────────────────────────────────────────────
  private jsessionid: WritableSignal<string> = signal('');
  private viewState: WritableSignal<string> = signal('');

  /** Fila que serializa as chamadas autenticadas (ver doc da classe). */
  private queue: Promise<unknown> = Promise.resolve();
  /** Cancela o SSE de turmas em andamento (ex.: no logout / novo carregamento). */
  private turmasStreamAbort: AbortController | null = null;

  // ─── Signals Públicos (Estado e UI) ────────────────────────────────────────
  isReauthenticating: WritableSignal<boolean> = signal(false);
  isFetchingData: WritableSignal<boolean> = signal(false);
  fullyLoaded: WritableSignal<boolean> = signal(false);
  hasOnlineData: WritableSignal<boolean> = signal(false);

  // ─── Signals Públicos (Dados do Usuário) ───────────────────────────────────
  matricula: WritableSignal<string | null> = signal(null);
  nome: WritableSignal<string> = signal('');
  turmas: WritableSignal<Turma[]> = signal([]);
  freshTurmas: WritableSignal<Turma[]> = signal([]);
  avaliacoes: WritableSignal<Avaliacao[]> = signal([]);
  cargaHoraria: WritableSignal<CargaHoraria | null> = signal(null);
  indices: WritableSignal<IndicesAcademicos | null> = signal(null);
  notasAnteriores: WritableSignal<(Notas | null)[]> = signal([]);

  // ─── Signals Públicos (Navegação/Contexto) ─────────────────────────────────
  currentTurma: WritableSignal<Turma | null> = signal(null);
  currentTurmaIdx: WritableSignal<number | null> = signal(null);
  pdfCache: WritableSignal<Uint8Array | undefined> = signal(undefined);

  username = '';
  password = '';

  constructor() {
    this.init();
  }

  /** Header `Authorization` pronto para chamadas manuais (ex.: viewer de PDF). */
  get authHeader(): string {
    return `Bearer ${this.jsessionid()}`;
  }

  // ─── Inicialização e Cache ─────────────────────────────────────────────────

  private init(): void {
    const jsessionid = localStorage.getItem(JSESSIONID_KEY);
    const viewState = localStorage.getItem(VIEWSTATE_KEY);
    if (jsessionid && viewState) {
      this.jsessionid.set(jsessionid);
      this.viewState.set(viewState);
    }

    this.restoreCredentials();
    this.loadFromCache();

    if (!this.isAuthenticated()) return;

    // Dispara busca de dados frescos em background.
    if (navigator.onLine) {
      this.isFetchingData.set(true);
      void this.fetchMainData();
    } else {
      this.fullyLoaded.set(true);
    }
  }

  private updateSession(newJsessionId?: string, newViewState?: string): void {
    if (newJsessionId) {
      this.jsessionid.set(newJsessionId);
      localStorage.setItem(JSESSIONID_KEY, newJsessionId);
    }
    if (newViewState) {
      this.viewState.set(newViewState);
      localStorage.setItem(VIEWSTATE_KEY, newViewState);
    }
  }

  private saveToCache(): void {
    const cache: DataCache = {
      turmas: this.turmas(),
      nome: this.nome(),
      matricula: this.matricula(),
      avaliacoes: this.avaliacoes(),
      cargaHoraria: this.cargaHoraria(),
      indices: this.indices(),
      fullyLoaded: this.fullyLoaded(),
      savedAt: Date.now(),
    };
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {
      // localStorage cheio/indisponível — cache é best-effort.
    }
  }

  private loadFromCache(): void {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const cache = JSON.parse(raw) as Partial<DataCache>;

      if (cache.turmas?.length) this.turmas.set(cache.turmas);
      if (cache.nome) this.nome.set(cache.nome);
      if (cache.matricula) this.matricula.set(cache.matricula);
      if (cache.avaliacoes?.length) this.avaliacoes.set(cache.avaliacoes);
      if (cache.cargaHoraria) this.cargaHoraria.set(cache.cargaHoraria);
      if (cache.indices) this.indices.set(cache.indices);
      if (cache.fullyLoaded) this.fullyLoaded.set(true);
    } catch {
      if (raw !== null) localStorage.removeItem(CACHE_KEY);
    }
  }

  // ─── Credenciais e Autenticação ────────────────────────────────────────────

  private saveCredentials(username: string, password: string): void {
    try {
      sessionStorage.setItem(this.CRED_KEY, btoa(JSON.stringify({ username, password })));
    } catch {
      // sessionStorage indisponível — reauth automática ficará desabilitada.
    }
  }

  private restoreCredentials(): void {
    try {
      const raw = sessionStorage.getItem(this.CRED_KEY);
      if (raw) {
        const { username, password } = JSON.parse(atob(raw));
        this.username = username ?? '';
        this.password = password ?? '';
      }
    } catch {
      sessionStorage.removeItem(this.CRED_KEY);
    }

    // Fallback "lembrar de mim" (persiste entre sessões do navegador).
    if (!this.username || !this.password) {
      this.username = localStorage.getItem('username') || this.username;
      this.password = localStorage.getItem('password') || this.password;
    }
  }

  isAuthenticated(): boolean {
    return this.jsessionid().length > 0 && this.viewState().length > 0;
  }

  logout(): void {
    const hasAcceptedPrivacy = localStorage.getItem('privacyAccepted');

    this.turmasStreamAbort?.abort();
    this.turmasStreamAbort = null;

    // Reset signals
    this.turmas.set([]);
    this.freshTurmas.set([]);
    this.nome.set('');
    this.avaliacoes.set([]);
    this.cargaHoraria.set(null);
    this.indices.set(null);
    this.notasAnteriores.set([]);
    this.currentTurma.set(null);
    this.currentTurmaIdx.set(null);
    this.viewState.set('');
    this.jsessionid.set('');
    this.fullyLoaded.set(false);
    this.isFetchingData.set(false);
    this.username = '';
    this.password = '';

    sessionStorage.removeItem(this.CRED_KEY);
    localStorage.clear();
    localStorage.setItem('privacyAccepted', hasAcceptedPrivacy ?? 'false');

    this.router.navigate(['/login']);
  }

  async login(username: string, password: string): Promise<string> {
    const res = await fetch(`${this.domain}/login`, {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      headers: { 'Content-Type': 'application/json' },
    });

    const data = (await res.json().catch(() => ({}))) as { jsessionid?: string; error?: string };
    if (!res.ok || !data.jsessionid) {
      throw new Error(data.error || 'Erro desconhecido na API de login');
    }

    this.updateSession(data.jsessionid);
    this.username = username;
    this.password = password;
    this.saveCredentials(username, password);

    return data.jsessionid;
  }

  /**
   * Refaz login com as credenciais guardadas e renova o `viewState`.
   * Chamado de dentro de um slot da fila (por {@link apiFetch}); por isso usa o
   * `_fetchMainData` interno e **não** redispara o stream de turmas.
   */
  private async tryReauthenticate(): Promise<boolean> {
    if (this.isReauthenticating()) return false;
    if (!this.username || !this.password) this.restoreCredentials();
    if (!this.username || !this.password) return false;

    try {
      this.isReauthenticating.set(true);
      await this.login(this.username, this.password);
      await this._fetchMainData(false);
      return true;
    } catch {
      return false;
    } finally {
      this.isReauthenticating.set(false);
    }
  }

  // ─── Núcleo HTTP ──────────────────────────────────────────────────────────

  /**
   * Serializa `task` na fila FIFO. Toda chamada autenticada precisa passar por
   * aqui para não competir pelo `viewState`. Uma falha numa task não trava a
   * fila; a rejeição continua propagando para quem chamou.
   */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(task, task);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  /**
   * `fetch` autenticado. Injeta o `viewState` **no momento do envio** (inclusive
   * no retry pós-reauth, garantindo valor fresco) e, em caso de sessão expirada,
   * tenta reautenticar uma vez antes de propagar o erro.
   */
  private async apiFetch(path: string, opts: ApiOptions = {}, retried = false): Promise<Response> {
    const { method = 'GET', body, accept, injectViewState = body != null } = opts;

    const headers: Record<string, string> = { Authorization: this.authHeader };
    if (accept) headers['Accept'] = accept;

    let payload: string | undefined;
    if (body != null || injectViewState) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(injectViewState ? { ...body, viewState: this.viewState() } : body);
    }

    const res = await fetch(`${this.domain}${path}`, { method, headers, body: payload });
    if (res.ok || retried) return res;

    let apiError = '';
    try {
      apiError = String((await res.clone().json())?.error ?? '').toLowerCase();
    } catch {
      // resposta não-JSON (PDF/HTML de erro) — sem mensagem estruturada.
    }

    const isSessionError =
      res.status === 401 ||
      res.status === 403 ||
      apiError.includes('sessão expirada') ||
      apiError.includes('sessão inválida') ||
      apiError.includes('session') ||
      (res.status === 500 && (path.includes('/vinculo') || path.includes('/historico')));

    if (!isSessionError) return res;

    if (await this.tryReauthenticate()) {
      return this.apiFetch(path, opts, true);
    }
    this.logout();
    throw new Error('Sessão expirada. Por favor, faça login novamente.');
  }

  /** Extrai `{ error }` de uma resposta JSON de erro, com fallback. */
  private async errorMessage(res: Response, fallback: string): Promise<string> {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return data.error || fallback;
  }

  private handleFetchError(error: Error, context: string): void {
    this.isFetchingData.set(false);
    this.fullyLoaded.set(true);

    const offline = !navigator.onLine || /fetch|network|failed|conex/i.test(error.message);
    if (offline) {
      console.warn(`[sigaa] ${context}: offline, mantendo dados em cache.`);
    } else {
      // Erro de scraping/servidor: NÃO desloga (a sessão pode seguir válida);
      // basta um novo /main-data para renovar o viewState.
      console.error(`[sigaa] ${context}:`, error);
    }
  }

  private validateSession(): void {
    if (!this.isAuthenticated()) throw new Error('Sessão inválida ou expirada');
  }

  // ─── Endpoints SIGAA ─────────────────────────────────────────────────────

  fetchMainData(): Promise<void> {
    return this.enqueue(() => this._fetchMainData(true));
  }

  private async _fetchMainData(triggerStream: boolean): Promise<void> {
    try {
      if (!this.jsessionid()) throw new Error('jsessionid inválido');
      this.isFetchingData.set(true);

      const res = await this.apiFetch('/main-data');
      if (!res.ok) {
        throw new Error(await this.errorMessage(res, 'Erro de conexão ou servidor indisponível.'));
      }

      const data = (await res.json()) as MainDataResponse;
      if (!data.jsessionid) throw new Error('Resposta da API sem jsessionid');

      this.avaliacoes.set(data.avaliacoes ?? []);
      this.cargaHoraria.set(data.cargaHoraria ?? null);
      this.indices.set(data.indices ?? null);
      this.nome.set(data.nome ?? '');
      this.matricula.set(data.matricula ?? null);
      this.updateSession(data.jsessionid, data.viewState);

      // Merge das turmas frescas com o que já estava em cache.
      const cached = this.turmas();
      const frescas = data.turmas ?? [];
      this.freshTurmas.set(frescas);
      this.turmas.set(
        frescas.map((fresh) => {
          const old = cached.find((c) => c.nome === fresh.nome);
          return old ? { ...old, local: fresh.local, isLoaded: true } : { ...fresh, isLoaded: false };
        }),
      );

      this.saveToCache();
      if (triggerStream) void this.enqueue(() => this._fetchTurmasStream());
    } catch (e) {
      this.handleFetchError(e as Error, 'main-data');
    }
  }

  fetchNotas(): Promise<void> {
    this.validateSession();
    return this.enqueue(() => this._fetchNotas());
  }

  private async _fetchNotas(): Promise<void> {
    const res = await this.apiFetch('/notas', { method: 'POST', body: {} });
    if (!res.ok) throw new Error(await this.errorMessage(res, 'Erro de conexão ao buscar notas'));

    const data = (await res.json()) as NotasResponse;
    this.notasAnteriores.set(data.anteriores?.length ? data.anteriores : []);
    this.updateSession(data.jsessionid, data.viewState);

    this.turmas.update((prev) => {
      const next = [...prev];
      for (const nota of data.notas ?? []) {
        if (!nota) continue;
        const turma = next.find((t) => t.nome === nota.nome);
        if (turma) turma.notas = nota;
      }
      return next;
    });
  }

  fetchTurmasStream(): Promise<void> {
    return this.enqueue(() => this._fetchTurmasStream());
  }

  /**
   * Consome o SSE `/turmas-stream`. Enriquece cada turma conforme chega e, no
   * evento `done`, guarda o `jsessionid`/`viewState` finais. Cancelável via
   * {@link turmasStreamAbort} (usado no logout).
   */
  private async _fetchTurmasStream(): Promise<void> {
    this.turmasStreamAbort?.abort();
    const abort = new AbortController();
    this.turmasStreamAbort = abort;

    try {
      await this._fetchNotas();

      const res = await this.apiFetch('/turmas-stream', { method: 'GET', accept: 'text/event-stream' });
      if (!res.ok) throw new Error('Erro de conexão ao iniciar stream de turmas');
      if (!res.body) throw new Error('ReadableStream não é suportado pelo seu navegador.');

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      for (;;) {
        if (abort.signal.aborted) {
          await reader.cancel().catch(() => undefined);
          return;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const evt = this.parseSseEvent(part);
          if (evt) this.handleTurmasStreamEvent(evt);
        }
      }
    } catch (err) {
      if (!abort.signal.aborted) {
        this.handleFetchError(err as Error, 'turmas-stream');
      }
    } finally {
      if (this.turmasStreamAbort === abort) this.turmasStreamAbort = null;
      this.hasOnlineData.set(true);
    }
  }

  private parseSseEvent(raw: string): SseEvent | null {
    if (!raw.trim()) return null;

    let type = 'message';
    let dataStr = '';
    for (const line of raw.split('\n')) {
      if (line.startsWith('event:')) type = line.slice(6).trim();
      else if (line.startsWith('data:')) dataStr = line.slice(5).trim();
    }
    if (!dataStr) return null;

    try {
      return { type, data: JSON.parse(dataStr) };
    } catch {
      // Um evento malformado não deve derrubar o stream inteiro.
      console.warn('[sigaa] evento SSE ignorado (JSON inválido)');
      return null;
    }
  }

  private handleTurmasStreamEvent({ type, data }: SseEvent): void {
    switch (type) {
      case 'start':
        break;
      case 'turma':
        this.turmas.update((prev) =>
          prev.map((t) =>
            t.nome === data.nome ? { ...data, local: t.local, notas: t.notas, isLoaded: true } : t,
          ),
        );
        this.saveToCache();
        break;
      case 'error':
        console.warn('[sigaa] falha ao carregar turma no stream:', data?.error ?? data);
        break;
      case 'done':
        this.updateSession(data.jsessionid, data.viewState);
        this.fullyLoaded.set(true);
        this.isFetchingData.set(false);
        this.saveToCache();
        break;
    }
  }

  getCalendarioUrl(): string {
    return `${this.domain}/calendario`;
  }

  getOgCalendarioUrl(): Promise<string> {
    this.validateSession();
    return this.enqueue(async () => {
      const res = await this.apiFetch('/calendario/url');
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || 'Erro ao buscar URL do calendário');
      return data.url;
    });
  }

  getAtestadoDados(): Promise<AtestadoMatricula> {
    this.validateSession();
    return this.enqueue(async () => {
      const res = await this.apiFetch('/matricula', { method: 'POST', body: {} });
      if (!res.ok) throw new Error(await this.errorMessage(res, 'Erro ao buscar atestado de matrícula'));
      return (await res.json()) as AtestadoMatricula;
    });
  }

  getVinculoPdf(): Promise<Blob> {
    return this.fetchPdf('/vinculo', 'Erro ao baixar declaração de vínculo');
  }

  getHistoricoPdf(): Promise<Blob> {
    return this.fetchPdf('/historico', 'Erro ao baixar histórico');
  }

  private fetchPdf(path: string, fallbackMsg: string): Promise<Blob> {
    this.validateSession();
    return this.enqueue(async () => {
      const res = await this.apiFetch(path, { method: 'POST', body: {} });
      if (!res.ok) throw new Error(await this.errorMessage(res, fallbackMsg));
      return res.blob();
    });
  }

  baixarArquivoTurma(turma: Turma, arquivo: Arquivo): Promise<void> {
    this.validateSession();
    return this.enqueue(async () => {
      const res = await this.apiFetch('/turma/arquivo/preparar', {
        method: 'POST',
        body: { chave: arquivo.chave, id: arquivo.id, turma },
      });
      if (!res.ok) throw new Error(await this.errorMessage(res, 'Erro ao preparar arquivo da turma'));

      const data = (await res.json()) as { ticket: string; newJsessionid?: string; newViewState?: string };
      this.updateSession(data.newJsessionid, data.newViewState);
      if (data.newViewState) this.saveToCache();

      window.location.href = `${this.domain}/turma/arquivo/download?ticket=${encodeURIComponent(data.ticket)}`;
    });
  }

  getMatrizCurricular(): Promise<EstruturaCurricular> {
    this.validateSession();
    return this.enqueue(async () => {
      const res = await this.apiFetch('/curriculo');
      if (!res.ok) throw new Error(await this.errorMessage(res, 'Erro ao buscar matriz curricular'));

      const data = (await res.json()) as MatrizCurricularResponse;
      this.updateSession(data.jsessionid, data.viewState);

      const aprovadas = this.notasAnteriores();
      for (const c of data.estruturaCurricular.componentes) {
        c.concluida = aprovadas.some(
          (n) => n?.codigo === c.codigo && n.situacao.toUpperCase().includes('APROVADO'),
        );
      }
      return data.estruturaCurricular;
    });
  }

  buscarComponenteCurricular(curriculo: string, idComponente: string): Promise<DetalhesComponente> {
    this.validateSession();
    return this.enqueue(async () => {
      const res = await this.apiFetch('/componente', {
        method: 'POST',
        body: { curriculo, idComponente },
      });
      if (!res.ok) throw new Error(await this.errorMessage(res, 'Erro ao buscar componente'));

      const data = (await res.json()) as DetalhesComponenteResponse;
      this.updateSession(data.jsessionid, data.viewState);
      return data.componente;
    });
  }
}
