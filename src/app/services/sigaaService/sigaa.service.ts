import { Injectable, WritableSignal, inject, signal } from '@angular/core';
import {
  Avaliacao,
  CargaHoraria,
  IndicesAcademicos,
  MainDataResponse,
  NotasResponse,
  Turma,
  TurmaDetailResponse,
} from '../../models/sigaa.models';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class SigaaService {
  private domain = 'https://sigaa-ufrpe-api-production.up.railway.app';
  private jsessionid: WritableSignal<string> = signal('');
  private viewState: WritableSignal<string> = signal('');

  private router: Router = inject(Router)

  turmas: WritableSignal<Turma[]> = signal([]);
  nome: WritableSignal<string> = signal('');
  avaliacoes: WritableSignal<Avaliacao[]> = signal([]);
  cargaHoraria: WritableSignal<CargaHoraria | null> = signal(null);
  indices: WritableSignal<IndicesAcademicos | null> = signal(null);
  currentTurma: WritableSignal<Turma | null> = signal(null);

  constructor() {
    const jsessionid = localStorage.getItem("jsessionid")
    const viewState = localStorage.getItem("viewState")
    if (jsessionid && viewState) {
      this.jsessionid.set(jsessionid)
      this.viewState.set(viewState)
    }
    if (this.jsessionid().length && this.viewState().length) this.fetchMainData()
  }

  isAuthenticated() {
    return this.jsessionid().length > 0 && this.viewState().length > 0;
  }

  logout() {
    this.turmas.set([])
    this.nome.set('')
    this.avaliacoes.set([])
    this.cargaHoraria.set(null)
    this.indices.set(null)
    this.currentTurma.set(null)
    this.viewState.set('')
    this.currentTurma.set(null)
    this.jsessionid.set('')
    localStorage.clear()
    this.router.navigate(['/login'])
  }

  async login(username: string, password: string) {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    const res = await fetch(`${this.domain}/login`, {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      headers: headers,
    });
    const data = await res.json();
    console.log(data);

    if (!res.ok || !data.jsessionid) {
      throw new Error(data.error || 'Erro desconhecido na API');
    }
    this.jsessionid.set(data.jsessionid);
    localStorage.setItem("jsessionid", data.jsessionid)
    return data.jsessionid;
  }

  async fetchMainData() {
    try {
      if (!this.jsessionid().length) throw new Error('jsessionid inválido');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + this.jsessionid(),
      };
      const res = await fetch(`${this.domain}/main-data`, {
        headers: headers,
      });
      const data = await res.json();
      console.log('fetch main data:');
      console.log(data);

      if (!res.ok || !data.jsessionid) {
        throw new Error(data.error || 'Erro desconhecido na API');
      }
      const mainDataRes = data as MainDataResponse;
      this.avaliacoes.set(mainDataRes.avaliacoes);
      this.cargaHoraria.set(mainDataRes.cargaHoraria);
      this.indices.set(mainDataRes.indices);
      this.jsessionid.set(mainDataRes.jsessionid);
      localStorage.setItem("jsessionid", mainDataRes.jsessionid)
      this.nome.set(mainDataRes.nome);
      this.turmas.set(mainDataRes.turmas);
      this.viewState.set(mainDataRes.viewState);
      localStorage.setItem("viewState", mainDataRes.viewState)
      this.fetchTurmas();
    } catch (e) {
      const error = e as Error
      localStorage.removeItem('jsessionid')
      localStorage.removeItem('viewState')
      this.jsessionid.set('')
      this.viewState.set('')
      alert(error.message)
      this.router.navigate(['/login'])
    }
  }

  async fetchNotas() {
    if (!this.jsessionid().length || !this.viewState().length)
      throw new Error('jsessionid ou viewstate inválidos');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + this.jsessionid(),
    };
    const res = await fetch(`${this.domain}/notas`, {
      method: 'POST',
      body: JSON.stringify({ viewState: this.viewState() }),
      headers: headers,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'erro ao buscar turma');
    const notasData = data as NotasResponse
    console.log(data)
    this.turmas.update(prev => {
      notasData.notas.forEach(n => {
        if (!n) return
        const turma = prev.find(t => t.nome === n?.nome)
        if (turma) {
          turma.notas = n
        }
        if (turma && turma.nome === this.currentTurma()?.nome)
          this.currentTurma.update(prevT => {
          if (prevT) prevT.notas = n
          return prevT
        });
      })
      return prev
    })
    this.jsessionid.set(notasData.jsessionid)
    localStorage.setItem("jsessionid", notasData.jsessionid)
    this.viewState.set(notasData.viewState)
    localStorage.setItem("viewState", notasData.viewState)
  }

  getCalendarioUrl(): string {
    return `${this.domain}/calendario`;
  }

  async getTurmaDetail(turma: Turma) {
    if (!this.jsessionid().length || !this.viewState().length)
      throw new Error('jsessionid ou viewstate inválidos');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + this.jsessionid(),
    };
    const res = await fetch(`${this.domain}/turma`, {
      method: 'POST',
      body: JSON.stringify({ turma, viewState: this.viewState() }),
      headers: headers,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'erro ao buscar turma');
    const turmaData = data as TurmaDetailResponse;
    this.turmas.update((prev) => {
      const oldTurmaIdx = prev.findIndex((t) => t.nome === turma.nome);
      if (oldTurmaIdx === -1) throw new Error('erro ao buscar turma: turma não encontrada');
      prev[oldTurmaIdx] = { ...turmaData.turma, notas: prev[oldTurmaIdx].notas };
      if (prev[oldTurmaIdx].nome === this.currentTurma()?.nome)
        this.currentTurma.set(prev[oldTurmaIdx]);
      return prev;
    });
    this.jsessionid.set(turmaData.jsessionid);
    localStorage.setItem("jsessionid", turmaData.jsessionid)
    this.viewState.set(turmaData.viewState);
    localStorage.setItem("viewState", turmaData.viewState)
  }

  async fetchTurmas() {
    await this.fetchNotas()
    for (const turma of this.turmas()) {
      await this.getTurmaDetail(turma);
    }
    console.log('fetch turmas:');
    console.log(this.turmas());
  }
}
