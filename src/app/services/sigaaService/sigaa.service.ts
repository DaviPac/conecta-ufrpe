import { Injectable, Injector, WritableSignal, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom } from 'rxjs';

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

@Injectable({
  providedIn: 'root',
})
export class SigaaService {
  private readonly domain = 'https://sigaa-ufrpe-api-production.up.railway.app';
  private readonly CRED_KEY = 'sigaa_cred';

  private injector = inject(Injector);
  private router = inject(Router);

  // ─── Signals Privados ──────────────────────────────────────────────────────
  private jsessionid: WritableSignal<string> = signal('');
  private viewState: WritableSignal<string> = signal('');

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

  // ─── Inicialização e Cache ─────────────────────────────────────────────────

  private init(): void {
    const jsessionid = localStorage.getItem('jsessionid');
    const viewState = localStorage.getItem('viewState');
    
    if (jsessionid && viewState) {
      this.jsessionid.set(jsessionid);
      this.viewState.set(viewState);
    }
    
    this.restoreCredentials();
    this.loadFromCache();

    // Dispara busca de dados frescos em background
    if (this.isAuthenticated()) {
      if (navigator.onLine) {
        this.isFetchingData.set(true);
        this.fetchMainData();
      } else {
        this.fullyLoaded.set(true);
      }
    }
  }

  private updateSession(newJsessionId?: string, newViewState?: string): void {
    if (newJsessionId) {
      this.jsessionid.set(newJsessionId);
      localStorage.setItem('jsessionid', newJsessionId);
    }
    if (newViewState) {
      this.viewState.set(newViewState);
      localStorage.setItem('viewState', newViewState);
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
      // localStorage cheio — ignora silenciosamente
    }
  }

  private loadFromCache(): void {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const cache: DataCache = JSON.parse(raw);
      
      if (cache.turmas?.length) this.turmas.set(cache.turmas);
      if (cache.nome) this.nome.set(cache.nome);
      if (cache.matricula) this.matricula.set(cache.matricula);
      if (cache.avaliacoes?.length) this.avaliacoes.set(cache.avaliacoes);
      if (cache.cargaHoraria) this.cargaHoraria.set(cache.cargaHoraria);
      if (cache.indices) this.indices.set(cache.indices);
      if (cache.fullyLoaded) this.fullyLoaded.set(cache.fullyLoaded);
    } catch {
      localStorage.removeItem(CACHE_KEY);
    }
  }

  // ─── Credenciais e Autenticação ────────────────────────────────────────────

  private saveCredentials(username: string, password: string): void {
    sessionStorage.setItem(this.CRED_KEY, btoa(JSON.stringify({ username, password })));
  }

  private restoreCredentials(): void {
    try {
      const raw = sessionStorage.getItem(this.CRED_KEY);
      if (!raw) return;
      const { username, password } = JSON.parse(atob(raw));
      this.username = username;
      this.password = password;
    } catch {
      sessionStorage.removeItem(this.CRED_KEY);
    }
  }

  isAuthenticated(): boolean {
    return this.jsessionid().length > 0 && this.viewState().length > 0;
  }

  logout(): void {
    const hasAcceptedPrivacy = localStorage.getItem('privacyAccepted');
    
    // Reset signals
    this.turmas.set([]);
    this.nome.set('');
    this.avaliacoes.set([]);
    this.cargaHoraria.set(null);
    this.indices.set(null);
    this.currentTurma.set(null);
    this.currentTurmaIdx.set(null);
    this.viewState.set('');
    this.jsessionid.set('');
    this.fullyLoaded.set(false);
    this.isFetchingData.set(false);
    
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
    
    const data = await res.json();
    console.log(data);

    if (!res.ok || !data.jsessionid) {
      throw new Error(data.error || 'Erro desconhecido na API');
    }

    this.updateSession(data.jsessionid);
    this.username = username;
    this.password = password;
    this.saveCredentials(username, password);
    
    return data.jsessionid;
  }

  private async tryReauthenticate(): Promise<boolean> {
    const storedUsername = localStorage.getItem('username');
    const storedPassword = localStorage.getItem('password');

    const creds = (this.username && this.password) 
      ? { u: this.username, p: this.password } 
      : (storedUsername && storedPassword) 
        ? { u: storedUsername, p: storedPassword } 
        : null;

    if (!creds) return false;

    try {
      this.isReauthenticating.set(true);
      await this.login(creds.u, creds.p);
      await this.fetchMainData();
      return true;
    } catch {
      return false;
    } finally {
      this.isReauthenticating.set(false);
    }
  }

  // ─── Fetch Base e Utilitários ──────────────────────────────────────────────

  private async fetchWithAuth(url: string, options: RequestInit = {}, retried = false): Promise<Response> {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.jsessionid()}`,
      ...(options.headers as Record<string, string> || {}),
    };

    const res = await fetch(url, { ...options, headers });

    if (!res.ok && !retried) {
      let errorMessage = '';
      try {
        const data = await res.clone().json();
        errorMessage = (data?.error ?? '').toLowerCase();
      } catch { /* Ignore */ }

      const isSessionError =
        res.status === 401 ||
        res.status === 403 ||
        errorMessage.includes('sessão expirada') ||
        errorMessage.includes('sessão inválida') ||
        errorMessage.includes('session') ||
        (res.status === 500 && (url.includes('/vinculo') || url.includes('/historico')));

      if (isSessionError) {
        if (await this.tryReauthenticate()) {
          // Atualiza o viewState no payload, se aplicável
          if (typeof options.body === 'string' && options.body.includes('viewState')) {
            try {
              const bodyParsed = JSON.parse(options.body);
              if (bodyParsed.viewState) {
                bodyParsed.viewState = this.viewState();
                options.body = JSON.stringify(bodyParsed);
              }
            } catch { console.warn('Falha no parse do body no retry'); }
          }
          return this.fetchWithAuth(url, options, true);
        } else {
          this.logout();
          throw new Error('Sessão expirada. Por favor, faça login novamente.');
        }
      }
    }

    return res;
  }

  private handleOfflineError(error: Error, fallbackMsg: string): void {
    this.isFetchingData.set(false);
    const isOffline = !navigator.onLine || error.message.includes('fetch') || error.message.includes('conexão');

    if (isOffline) {
      console.warn(`Falha de conexão: ${fallbackMsg}. Usando cache.`);
      this.fullyLoaded.set(true);
    } else {
      this.logout();
      if (!this.router.url.includes('login')) {
        alert(error.message || fallbackMsg);
      }
    }
  }

  private validateSession(): void {
    if (!this.isAuthenticated()) throw new Error('Sessão inválida ou expirada');
  }

  // ─── API Endpoints ─────────────────────────────────────────────────────────

  async fetchMainData(): Promise<void> {
    try {
      if (!this.jsessionid()) throw new Error('jsessionid inválido');
      this.isFetchingData.set(true);

      const res = await this.fetchWithAuth(`${this.domain}/main-data`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro de conexão ou servidor indisponível.');
      }

      const data = await res.json() as MainDataResponse;
      console.log('fetch main data:', data);

      if (!data.jsessionid) throw new Error('Erro na API: jsessionid ausente');

      // Atualiza Estado
      this.avaliacoes.set(data.avaliacoes);
      this.cargaHoraria.set(data.cargaHoraria);
      this.indices.set(data.indices);
      this.nome.set(data.nome);
      this.matricula.set(data.matricula);
      this.updateSession(data.jsessionid, data.viewState);

      // Merge Turmas com Cache
      const cached = this.turmas();
      this.freshTurmas.set(data.turmas);
      this.turmas.set(data.turmas.map((fresh) => {
        const old = cached.find((c) => c.nome === fresh.nome);
        return old ? { ...old, local: fresh.local, isLoaded: true } : { ...fresh, isLoaded: false };
      }));

      this.saveToCache();
      this.fetchTurmasStream();
    } catch (e) {
      this.handleOfflineError(e as Error, 'O app continuará usando os dados em cache.');
    }
  }

  async fetchNotas(): Promise<void> {
    this.validateSession();

    const res = await this.fetchWithAuth(`${this.domain}/notas`, {
      method: 'POST',
      body: JSON.stringify({ viewState: this.viewState() }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Erro de conexão ao buscar notas');
    }

    const data = await res.json() as NotasResponse;
    console.log(data);
    
    this.notasAnteriores.set(data.anteriores?.length ? data.anteriores : []);
    this.updateSession(data.jsessionid, data.viewState);

    this.turmas.update((prev) => {
      const novasTurmas = [...prev];
      data.notas.forEach((nota) => {
        if (!nota) return;
        const turma = novasTurmas.find((t) => t.nome === nota.nome);
        if (turma) turma.notas = nota;
      });
      return novasTurmas;
    });
  }

  getCalendarioUrl(): string {
    return `${this.domain}/calendario`;
  }

  async getOgCalendarioUrl(): Promise<string> {
    this.validateSession();
    const res = await this.fetchWithAuth(`${this.domain}/calendario/url`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'erro ao buscar url do calendário');
    return data.url;
  }

  async getAtestadoDados(): Promise<AtestadoMatricula> {
    this.validateSession();
    const res = await this.fetchWithAuth(`${this.domain}/matricula`, {
      method: 'POST',
      body: JSON.stringify({ viewState: this.viewState() }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Erro ao buscar atestado de matrícula');
    }
    return res.json();
  }

  async getVinculoPdf(): Promise<Blob> {
    this.validateSession();
    const res = await this.fetchWithAuth(`${this.domain}/vinculo`, {
      method: 'POST',
      body: JSON.stringify({ viewState: this.viewState() }),
    });

    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Erro ao baixar declaração de vínculo');
    return res.blob();
  }

  async getHistoricoPdf(): Promise<Blob> {
    this.validateSession();
    const res = await this.fetchWithAuth(`${this.domain}/historico`, {
      method: 'POST',
      body: JSON.stringify({ viewState: this.viewState() }),
    });

    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Erro ao baixar histórico');
    return res.blob();
  }

  async baixarArquivoTurma(turma: Turma, arquivo: Arquivo): Promise<void> {
    if (this.isFetchingData()) {
      const isFetching$ = toObservable(this.isFetchingData, { injector: this.injector });
      await firstValueFrom(isFetching$.pipe(filter(isFetching => !isFetching)));
    }
    this.validateSession();

    const res = await this.fetchWithAuth(`${this.domain}/turma/arquivo/preparar`, {
      method: 'POST',
      body: JSON.stringify({ viewState: this.viewState(), chave: arquivo.chave, id: arquivo.id, turma })
    });

    if (!res.ok) throw new Error('Erro ao preparar arquivo da turma');

    const data = await res.json();
    this.updateSession(data.newJsessionid, data.newViewState);
    if (data.newViewState) this.saveToCache();

    window.location.href = `${this.domain}/turma/arquivo/download?ticket=${data.ticket}`;
  }

  async fetchTurmasStream(): Promise<void> {
    try {
      await this.fetchNotas();

      const res = await this.fetchWithAuth(`${this.domain}/turmas-stream`, {
        method: 'GET',
        headers: { 'Accept': 'text/event-stream' },
      });

      if (!res.ok) throw new Error('Erro de conexão ao iniciar stream de turmas');
      if (!res.body) throw new Error('ReadableStream não é suportado pelo seu navegador.');

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          if (!part.trim()) continue;

          let eventType = 'message';
          let dataStr = '';

          part.split('\n').forEach((line) => {
            if (line.startsWith('event:')) eventType = line.substring(6).trim();
            else if (line.startsWith('data:')) dataStr = line.substring(5).trim();
          });

          if (!dataStr) continue;
          const parsedData = JSON.parse(dataStr);

          switch (eventType) {
            case 'start':
              console.log(`Iniciando stream: ${parsedData.total} turmas na fila.`);
              break;
            case 'turma':
              this.turmas.update((prev) =>
                prev.map((t) =>
                  t.nome === parsedData.nome
                    ? { ...parsedData, local: t.local, notas: t.notas, isLoaded: true }
                    : t
                )
              );
              this.saveToCache();
              break;
            case 'error':
              console.error('Falha em uma turma:', parsedData.error);
              break;
            case 'done':
              this.updateSession(parsedData.jsessionid, parsedData.viewState);
              this.fullyLoaded.set(true);
              this.isFetchingData.set(false);
              this.saveToCache();
              console.log('Stream concluído:', this.turmas());
              break;
          }
        }
      }
    } catch (err) {
      console.error('Erro ao consumir stream de turmas:', err);
      this.handleOfflineError(err as Error, 'Erro ao carregar dados das turmas. Por favor, faça login novamente.');
    } finally {
      this.hasOnlineData.set(true);
    }
  }

  async getMatrizCurricular(): Promise<EstruturaCurricular> {
    this.validateSession();
    const res = await this.fetchWithAuth(`${this.domain}/curriculo`);

    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Erro ao buscar matriz curricular');

    const data = await res.json() as MatrizCurricularResponse;
    this.updateSession(data.jsessionid, data.viewState);

    data.estruturaCurricular.componentes.forEach((c) => {
      if (this.notasAnteriores().some((n) => n?.codigo === c.codigo && n.situacao.toUpperCase().includes('APROVADO'))) {
        c.concluida = true;
      }
    });

    return data.estruturaCurricular;
  }

  async buscarComponenteCurricular(curriculo: string, idComponente: string): Promise<DetalhesComponente> {
    this.validateSession();
    const res = await this.fetchWithAuth(`${this.domain}/componente`, {
      method: 'POST',
      body: JSON.stringify({ viewState: this.viewState(), curriculo, idComponente }),
    });

    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Erro ao buscar componente');

    const data = await res.json() as DetalhesComponenteResponse;
    this.updateSession(data.jsessionid, data.viewState);
    return data.componente;
  }
}