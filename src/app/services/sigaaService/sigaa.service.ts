import { Injectable, WritableSignal, inject, signal } from '@angular/core';
import {
  Avaliacao,
  CargaHoraria,
  IndicesAcademicos,
  MainDataResponse,
  NotasResponse,
  Turma,
  TurmaDetailResponse,
  AtestadoMatricula
} from '../../models/sigaa.models';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class SigaaService {
  private domain = 'https://sigaa-ufrpe-api-production.up.railway.app';
  //private domain = 'http://localhost:8080';
  private jsessionid: WritableSignal<string> = signal('');
  private viewState: WritableSignal<string> = signal('');

  /** Visível ao template para exibir indicador de reautenticação */
  isReauthenticating: WritableSignal<boolean> = signal(false);
  
  /** Visível ao template para exibir indicador de busca de novos dados (background) */
  isFetchingData: WritableSignal<boolean> = signal(false);

  private router: Router = inject(Router);

  turmas: WritableSignal<Turma[]> = signal([]);
  nome: WritableSignal<string> = signal('');
  avaliacoes: WritableSignal<Avaliacao[]> = signal([]);
  cargaHoraria: WritableSignal<CargaHoraria | null> = signal(null);
  indices: WritableSignal<IndicesAcademicos | null> = signal(null);
  currentTurma: WritableSignal<Turma | null> = signal(null);
  currentTurmaIdx: WritableSignal<number | null> = signal(null);
  fullyLoaded: WritableSignal<boolean> = signal(false);

  pdfCache: WritableSignal<Uint8Array | undefined> = signal(undefined);

  username: string = '';
  password: string = '';

  private readonly CRED_KEY = 'sigaa_cred';
  private readonly CACHE_KEY = 'sigaa_data_cache'; // Nova chave para o cache de dados

  constructor() {
    const jsessionid = localStorage.getItem('jsessionid');
    const viewState = localStorage.getItem('viewState');
    if (jsessionid && viewState) {
      this.jsessionid.set(jsessionid);
      this.viewState.set(viewState);
    }
    this.restoreCredentials();
    
    // 1. Carrega dados salvos para exibição instantânea
    this.loadCache(); 

    // 2. Dispara a atualização silenciosa em background
    if (this.jsessionid().length && this.viewState().length) {
      this.fetchMainData();
    }
  }

  // ─── Cache de Dados Locais (Stale-while-revalidate) ─────────────────────────

  private saveCache(): void {
    const cacheData = {
      nome: this.nome(),
      avaliacoes: this.avaliacoes(),
      cargaHoraria: this.cargaHoraria(),
      indices: this.indices(),
      turmas: this.turmas()
    };
    localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData));
  }

  private loadCache(): void {
    const cached = localStorage.getItem(this.CACHE_KEY);
    if (!cached) return;

    try {
      const parsed = JSON.parse(cached);
      if (parsed.nome) this.nome.set(parsed.nome);
      if (parsed.avaliacoes) this.avaliacoes.set(parsed.avaliacoes);
      if (parsed.cargaHoraria) this.cargaHoraria.set(parsed.cargaHoraria);
      if (parsed.indices) this.indices.set(parsed.indices);
      if (parsed.turmas) {
        this.turmas.set(parsed.turmas);
        // Se já temos turmas em cache, liberamos a interface principal
        if (parsed.turmas.length > 0) this.fullyLoaded.set(true);
      }
    } catch (e) {
      console.warn('Falha ao restaurar cache local:', e);
      localStorage.removeItem(this.CACHE_KEY);
    }
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
    localStorage.clear(); // Isso apagará jsessionid, viewState e o CACHE_KEY
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
    const storedUsername = localStorage.getItem("username");
    const storedPassword = localStorage.getItem("password");

    const credentials =
      (this.username && this.password)
        ? { username: this.username, password: this.password }
        : (storedUsername && storedPassword)
          ? { username: storedUsername, password: storedPassword }
          : null;

    if (!credentials) {
      return false;
    }
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
    retried = false
  ): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + this.jsessionid(),
      ...(options.headers as Record<string, string> ?? {}),
    };

    const res = await fetch(url, { ...options, headers });

    if (!res.ok && !retried) {
      let errorMessage = '';
      try {
        const cloned = res.clone();
        const data = await cloned.json();
        errorMessage = data?.error ?? '';
      } catch { }

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

      this.isFetchingData.set(true); // Exibe indicador de atualização

      const res = await this.fetchWithAuth(`${this.domain}/main-data`);
      const data = await res.json();
      console.log('fetch main data:', data);

      if (!res.ok || !data.jsessionid) {
        throw new Error(data.error || 'Erro desconhecido na API');
      }

      const mainDataRes = data as MainDataResponse;
      this.avaliacoes.set(mainDataRes.avaliacoes);
      this.cargaHoraria.set(mainDataRes.cargaHoraria);
      this.indices.set(mainDataRes.indices);
      this.jsessionid.set(mainDataRes.jsessionid);
      localStorage.setItem('jsessionid', mainDataRes.jsessionid);
      this.nome.set(mainDataRes.nome);
      
      const currentTurmas = this.turmas();
      
      const mergedTurmas = mainDataRes.turmas.map(newTurma => {
        const cachedTurma = currentTurmas.find(t => t.nome === newTurma.nome);
        
        if (cachedTurma && cachedTurma.isLoaded) {
          return {
            ...cachedTurma, // Preserva dados detalhados em cache (como 'notas', participantes, etc)
            ...newTurma,    // Atualiza os dados básicos recém-baixados
            isLoaded: true  // Força a manutenção da flag de carregamento
          };
        }
        
        // Se for uma turma nova ou que ainda não foi detalhada, seta como false
        return { ...newTurma, isLoaded: false };
      });

      this.turmas.set(mergedTurmas);
      
      this.viewState.set(mainDataRes.viewState);
      localStorage.setItem('viewState', mainDataRes.viewState);
      
      this.saveCache(); // Atualiza o cache com os dados principais frescos
      
      await this.fetchTurmas(); 
      
    } catch (e) {
      const error = e as Error;
      this.isFetchingData.set(false); // Oculta o indicador se der erro na main
      this.logout(); 
      
      if (!this.router.url.includes('login')) {
        alert(error.message);
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

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'erro ao buscar notas');

    const notasData = data as NotasResponse;

    this.turmas.update(prev => {
      notasData.notas.forEach(n => {
        if (!n) return;
        const turma = prev.find(t => t.nome === n?.nome);
        if (turma) turma.notas = n;
        if (turma && turma.nome === this.currentTurma()?.nome)
          this.turmas.update(prev =>
            prev.map(t => {
              const n = notasData.notas.find(x => x?.nome === t.nome);
              return n ? { ...t, notas: n } : t;
            })
          );
      });
      return prev;
    });

    this.jsessionid.set(notasData.jsessionid);
    localStorage.setItem('jsessionid', notasData.jsessionid);
    this.viewState.set(notasData.viewState);
    localStorage.setItem('viewState', notasData.viewState);
  }

  async getTurmaDetail(turma: Turma) {
    if (!this.jsessionid().length || !this.viewState().length)
      throw new Error('jsessionid ou viewstate inválidos');

    const res = await this.fetchWithAuth(`${this.domain}/turma`, {
      method: 'POST',
      body: JSON.stringify({ turma, viewState: this.viewState() }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'erro ao buscar turma');

    const turmaData = data as TurmaDetailResponse;
    this.turmas.update(prev =>
      prev.map(t =>
        t.nome === turma.nome
          ? { ...turmaData.turma, notas: t.notas, isLoaded: true }
          : t
      )
    );

    this.jsessionid.set(turmaData.jsessionid);
    localStorage.setItem('jsessionid', turmaData.jsessionid);
    this.viewState.set(turmaData.viewState);
    localStorage.setItem('viewState', turmaData.viewState);
  }

  async fetchTurmas() {
    try {
      await this.fetchNotas();
      for (const turma of this.turmas()) {
        await this.getTurmaDetail(turma);
        this.saveCache(); // Atualiza o cache a cada turma detalhada recebida (Progressive UX)
      }
      this.fullyLoaded.set(true);
      console.log('fetch turmas resolvido:', this.turmas());
    } finally {
      // Sempre encerra o indicador de update quando finalizar (seja sucesso ou erro nas turmas)
      this.isFetchingData.set(false); 
    }
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
    if (!this.jsessionid() || !this.viewState())
      throw new Error('Sessão inválida ou expirada');

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
    if (!this.jsessionid() || !this.viewState())
      throw new Error('Sessão inválida ou expirada');

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
}