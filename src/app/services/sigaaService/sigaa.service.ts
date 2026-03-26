import { Injectable, Injector, WritableSignal, inject, signal } from '@angular/core';
import {
  Avaliacao,
  CargaHoraria,
  IndicesAcademicos,
  MainDataResponse,
  NotasResponse,
  Turma,
  TurmaDetailResponse,
  AtestadoMatricula,
  Arquivo,
} from '../../models/sigaa.models';
import { Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom } from 'rxjs';

// Chave do cache geral de dados da sessão
const CACHE_KEY = 'sigaa_data_cache';

interface DataCache {
  turmas: Turma[];
  nome: string;
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
  private domain = 'https://sigaa-ufrpe-api-production.up.railway.app';
  private jsessionid: WritableSignal<string> = signal('');
  private viewState: WritableSignal<string> = signal('');

  /** Visível ao template para exibir indicador de reautenticação */
  isReauthenticating: WritableSignal<boolean> = signal(false);

  /**
   * True enquanto os dados estão sendo buscados/renovados da API.
   * Fica false assim que os dados frescos (ou do cache) estiverem prontos.
   */
  isFetchingData: WritableSignal<boolean> = signal(false);

  private injector = inject(Injector);
  private router: Router = inject(Router);

  turmas: WritableSignal<Turma[]> = signal([]);
  nome: WritableSignal<string> = signal('');
  avaliacoes: WritableSignal<Avaliacao[]> = signal([]);
  cargaHoraria: WritableSignal<CargaHoraria | null> = signal(null);
  indices: WritableSignal<IndicesAcademicos | null> = signal(null);
  currentTurma: WritableSignal<Turma | null> = signal(null);
  currentTurmaIdx: WritableSignal<number | null> = signal(null);
  fullyLoaded: WritableSignal<boolean> = signal(false);
  hasOnlineData: WritableSignal<boolean> = signal(false);

  pdfCache: WritableSignal<Uint8Array | undefined> = signal(undefined);

  username: string = '';
  password: string = '';

  private readonly CRED_KEY = 'sigaa_cred';

  constructor() {
    const jsessionid = localStorage.getItem('jsessionid');
    const viewState = localStorage.getItem('viewState');
    if (jsessionid && viewState) {
      this.jsessionid.set(jsessionid);
      this.viewState.set(viewState);
    }
    this.restoreCredentials();

    // Carrega dados do cache imediatamente — UI não fica vazia
    this.loadFromCache();

    // Dispara busca de dados frescos em background
    if (this.jsessionid().length && this.viewState().length) {
      if (navigator.onLine) {
        this.isFetchingData.set(true);
        this.fetchMainData();
      } else {
        this.fullyLoaded.set(true);
      }
    }
  }

  // ─── Cache helpers ─────────────────────────────────────────────────────────

  private saveToCache(): void {
    const cache: DataCache = {
      turmas: this.turmas(),
      nome: this.nome(),
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
      if (cache.avaliacoes?.length) this.avaliacoes.set(cache.avaliacoes);
      if (cache.cargaHoraria) this.cargaHoraria.set(cache.cargaHoraria);
      if (cache.indices) this.indices.set(cache.indices);
      if (cache.fullyLoaded) this.fullyLoaded.set(cache.fullyLoaded);
    } catch {
      localStorage.removeItem(CACHE_KEY);
    }
  }

  private clearCache(): void {
    localStorage.removeItem(CACHE_KEY);
  }

  // ─── Credential helpers ────────────────────────────────────────────────────

  private saveCredentials(username: string, password: string): void {
    const encoded = btoa(JSON.stringify({ username, password }));
    sessionStorage.setItem(this.CRED_KEY, encoded);
  }

  private restoreCredentials(): void {
    const raw = sessionStorage.getItem(this.CRED_KEY);
    if (!raw) return;
    try {
      const { username, password } = JSON.parse(atob(raw));
      this.username = username;
      this.password = password;
    } catch {
      sessionStorage.removeItem(this.CRED_KEY);
    }
  }

  private clearCredentials(): void {
    sessionStorage.removeItem(this.CRED_KEY);
  }

  // ─── Auth ──────────────────────────────────────────────────────────────────

  isAuthenticated() {
    return this.jsessionid().length > 0 && this.viewState().length > 0;
  }

  logout() {
    const hasAcceptedPrivacy = localStorage.getItem('privacyAccepted');
    this.turmas.set([]);
    this.nome.set('');
    this.avaliacoes.set([]);
    this.cargaHoraria.set(null);
    this.indices.set(null);
    this.currentTurma.set(null);
    this.viewState.set('');
    this.currentTurma.set(null);
    this.currentTurmaIdx.set(null);
    this.jsessionid.set('');
    this.fullyLoaded.set(false);
    this.isFetchingData.set(false);
    this.clearCredentials();
    this.clearCache();
    localStorage.clear();
    this.router.navigate(['/login']);
    localStorage.setItem('privacyAccepted', hasAcceptedPrivacy ?? 'false');
  }

  async login(username: string, password: string) {
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

    this.jsessionid.set(data.jsessionid);
    localStorage.setItem('jsessionid', data.jsessionid);
    this.username = username;
    this.password = password;
    this.saveCredentials(username, password);
    return data.jsessionid;
  }

  private async tryReauthenticate(): Promise<boolean> {
    const storedUsername = localStorage.getItem('username');
    const storedPassword = localStorage.getItem('password');

    const credentials =
      this.username && this.password
        ? { username: this.username, password: this.password }
        : storedUsername && storedPassword
          ? { username: storedUsername, password: storedPassword }
          : null;

    if (!credentials) return false;

    try {
      this.isReauthenticating.set(true);
      await this.login(credentials.username, credentials.password);
      await this.fetchMainData();
      return true;
    } catch {
      return false;
    } finally {
      this.isReauthenticating.set(false);
    }
  }

  // ─── Fetch centralizado com retry ─────────────────────────────────────────

  private async fetchWithAuth(
    url: string,
    options: RequestInit = {},
    retried = false,
  ): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + this.jsessionid(),
      ...((options.headers as Record<string, string>) ?? {}),
    };

    const res = await fetch(url, { ...options, headers });

    if (!res.ok && !retried) {
      let errorMessage = '';
      try {
        const cloned = res.clone();
        const data = await cloned.json();
        errorMessage = data?.error ?? '';
      } catch {
        /* body não era JSON */
      }

      const isSessionError =
        res.status === 401 ||
        res.status === 403 ||
        errorMessage.toLowerCase().includes('sessão expirada') ||
        errorMessage.toLowerCase().includes('sessão inválida') ||
        errorMessage.toLowerCase().includes('session');

      if (isSessionError) {
        const reauthed = await this.tryReauthenticate();
        if (reauthed) {
          return this.fetchWithAuth(url, options, true);
        } else {
          this.logout();
          throw new Error('Sessão expirada. Por favor, faça login novamente.');
        }
      }
    }

    return res;
  }

  // ─── Métodos de dados ──────────────────────────────────────────────────────

  async fetchMainData() {
    try {
      if (!this.jsessionid().length) throw new Error('jsessionid inválido');

      this.isFetchingData.set(true);

      const res = await this.fetchWithAuth(`${this.domain}/main-data`);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        // Mudamos a mensagem para facilitar a identificação de erro de rede
        throw new Error(errorData.error || 'Erro de conexão ou servidor indisponível.');
      }

      const data = await res.json();
      console.log('fetch main data:', data);

      if (!data.jsessionid) {
        throw new Error('Erro desconhecido na API: jsessionid ausente');
      }

      const mainDataRes = data as MainDataResponse;
      this.avaliacoes.set(mainDataRes.avaliacoes);
      this.cargaHoraria.set(mainDataRes.cargaHoraria);
      this.indices.set(mainDataRes.indices);
      this.jsessionid.set(mainDataRes.jsessionid);
      localStorage.setItem('jsessionid', mainDataRes.jsessionid);
      this.nome.set(mainDataRes.nome);

      const cached = this.turmas();
      const merged = mainDataRes.turmas.map((fresh) => {
        const old = cached.find((c) => c.nome === fresh.nome);
        return old ? { ...old, isLoaded: true } : { ...fresh, isLoaded: false };
      });
      this.turmas.set(merged);

      this.viewState.set(mainDataRes.viewState);
      localStorage.setItem('viewState', mainDataRes.viewState);

      this.saveToCache();

      this.fetchTurmas()
        .catch((err) => {
          console.error('Erro ao buscar turmas após main data:', err);
          this.isFetchingData.set(false);

          // ✅ VERIFICA SE É ERRO DE REDE/OFFLINE
          const isOffline =
            !navigator.onLine || err.message.includes('fetch') || err.message.includes('conexão');

          if (isOffline) {
            console.warn('Conexão perdida ao buscar turmas. Mantendo cache disponível.');
            this.fullyLoaded.set(true); // Libera a UI com o cache parcial/antigo
          } else {
            this.logout();
            if (!this.router.url.includes('login')) {
              alert('Erro ao carregar dados das turmas. Por favor, faça login novamente.');
            }
          }
        })
        .then(() => {
          this.hasOnlineData.set(true);
        });
    } catch (e) {
      const error = e as Error;
      this.isFetchingData.set(false);

      // ✅ VERIFICA SE É ERRO DE REDE/OFFLINE
      const isOffline =
        !navigator.onLine || error.message.includes('fetch') || error.message.includes('conexão');

      if (isOffline) {
        console.warn(
          'Falha de conexão no fetchMainData. O app continuará usando os dados em cache.',
        );
        this.fullyLoaded.set(true); // Libera a UI para mostrar os dados salvos
      } else {
        // Se não for problema de internet, aí sim desloga
        this.logout();
        if (!this.router.url.includes('login')) {
          alert(error.message);
        }
      }
    }
  }

  async fetchNotas() {
    if (!this.jsessionid().length || !this.viewState().length)
      throw new Error('jsessionid ou viewstate inválidos');

    const res = await this.fetchWithAuth(`${this.domain}/notas`, {
      method: 'POST',
      body: JSON.stringify({ viewState: this.viewState() }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Erro de conexão ao buscar notas');
    }

    const data = await res.json();

    const notasData = data as NotasResponse;
    console.log(data);

    this.turmas.update((prev) => {
      notasData.notas.forEach((n) => {
        if (!n) return;
        const turma = prev.find((t) => t.nome === n?.nome);
        if (turma) turma.notas = n;
        if (turma && turma.nome === this.currentTurma()?.nome)
          this.turmas.update((prev) =>
            prev.map((t) => {
              const n = notasData.notas.find((x) => x?.nome === t.nome);
              return n ? { ...t, notas: n } : t;
            }),
          );
      });
      return prev;
    });

    this.jsessionid.set(notasData.jsessionid);
    localStorage.setItem('jsessionid', notasData.jsessionid);
    this.viewState.set(notasData.viewState);
    localStorage.setItem('viewState', notasData.viewState);
  }

  getCalendarioUrl(): string {
    return `${this.domain}/calendario`;
  }

  async getOgCalendarioUrl(): Promise<string> {
    if (!this.jsessionid().length || !this.viewState().length)
      throw new Error('jsessionid ou viewstate inválidos');

    const res = await this.fetchWithAuth(`${this.domain}/calendario/url`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'erro ao buscar url do calendário');
    return data.url as string;
  }

  async getTurmaDetail(turma: Turma) {
    if (!this.jsessionid().length || !this.viewState().length)
      throw new Error('jsessionid ou viewstate inválidos');

    const res = await this.fetchWithAuth(`${this.domain}/turma`, {
      method: 'POST',
      body: JSON.stringify({ turma, viewState: this.viewState() }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Erro de conexão ao buscar turma');
    }

    const data = await res.json();

    const turmaData = data as TurmaDetailResponse;
    this.turmas.update((prev) =>
      prev.map((t) =>
        t.nome === turma.nome ? { ...turmaData.turma, notas: t.notas, isLoaded: true } : t,
      ),
    );

    this.jsessionid.set(turmaData.jsessionid);
    localStorage.setItem('jsessionid', turmaData.jsessionid);
    this.viewState.set(turmaData.viewState);
    localStorage.setItem('viewState', turmaData.viewState);
  }

  async fetchTurmas() {
    await this.fetchNotas();
    for (const turma of this.turmas()) {
      await this.getTurmaDetail(turma);
      // Salva cache incrementalmente a cada turma carregada
      this.saveToCache();
    }
    this.fullyLoaded.set(true);
    this.isFetchingData.set(false);
    // Cache final completo
    this.saveToCache();
    console.log('fetch turmas:', this.turmas());
  }

  async getAtestadoDados(): Promise<AtestadoMatricula> {
    const res = await this.fetchWithAuth(`${this.domain}/matricula`, {
      method: 'POST',
      body: JSON.stringify({ viewState: this.viewState() }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Erro desconhecido ao buscar atestado de matrícula');
    }

    return res.json() as Promise<AtestadoMatricula>;
  }

  async getVinculoPdf(): Promise<Blob> {
    if (!this.jsessionid() || !this.viewState()) throw new Error('Sessão inválida ou expirada');

    const res = await this.fetchWithAuth(`${this.domain}/vinculo`, {
      method: 'POST',
      body: JSON.stringify({ viewState: this.viewState() }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Erro ao baixar declaração de vínculo');
    }

    return res.blob();
  }

  async getHistoricoPdf(): Promise<Blob> {
    if (!this.jsessionid() || !this.viewState()) throw new Error('Sessão inválida ou expirada');

    const res = await this.fetchWithAuth(`${this.domain}/historico`, {
      method: 'POST',
      body: JSON.stringify({ viewState: this.viewState() }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Erro ao baixar histórico');
    }

    return res.blob();
  }

  async baixarArquivoTurma(turma: Turma, arquivo: Arquivo): Promise<void> {
    if (this.isFetchingData()) {
      const isFetching$ = toObservable(this.isFetchingData, { injector: this.injector });
      await firstValueFrom(isFetching$.pipe(filter(isFetching => isFetching === false)));
    }
    
    if (!this.jsessionid() || !this.viewState()) {
      throw new Error('Sessão inválida ou expirada');
    }

    const payload = {
      viewState: this.viewState(),
      chave: arquivo.chave,
      id: arquivo.id,
      turma: turma
    };
    
    const res = await this.fetchWithAuth(`${this.domain}/download`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Erro ao baixar arquivo da turma');
    }
    
    const novoJsessionid = res.headers.get('X-New-Jsessionid');
    const novoViewState = res.headers.get('X-New-Viewstate');

    if (novoJsessionid) {
      this.jsessionid.set(novoJsessionid);
      localStorage.setItem('jsessionid', novoJsessionid);
    }
    if (novoViewState) {
      this.viewState.set(novoViewState);
      localStorage.setItem('viewState', novoViewState);
      this.saveToCache();
    }
    
    let filename = 'arquivo_sigaa';
    const contentDisposition = res.headers.get('Content-Disposition');
    if (contentDisposition && contentDisposition.includes('filename=')) {
      filename = contentDisposition.split('filename=')[1].split(';')[0].replace(/["']/g, '').trim();
    }
    
    const blob = await res.blob();

    // 1. Tenta usar a API nativa de compartilhamento/salvamento do celular (Melhor para PWAs)
    const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
    
    // Verifica se o navegador suporta e permite compartilhar este tipo de arquivo
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: filename,
        });
        return; // Sucesso pelo menu nativo! Interrompe a função aqui.
      } catch (error: any) {
        // Se o usuário apenas cancelar a janela de compartilhamento, não precisamos fazer nada
        if (error.name === 'AbortError') return; 
        console.warn('Falha ao usar navigator.share, caindo para o método tradicional', error);
      }
    }

    // 2. Fallback: Método tradicional (com a correção do setTimeout)
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none'; // Importante esconder a tag
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    
    // CORREÇÃO CRÍTICA: Dá 10 segundos para o SO mobile iniciar o download antes de limpar a RAM
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 10000); 
}
}
