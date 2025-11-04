import { Injectable, WritableSignal, signal } from '@angular/core'
import { Avaliacao, CargaHoraria, IndicesAcademicos, MainDataResponse, Turma } from '../../models/sigaa.models'

@Injectable({
  providedIn: 'root',
})
export class SigaaService {

  private domain = "https://sigaa-ufrpe-api-production.up.railway.app"
  private jsessionid: WritableSignal<string> = signal("")
  private viewState: WritableSignal<string> = signal("")

  private turmas: WritableSignal<Turma[]> = signal([])
  private nome: WritableSignal<string> = signal("")
  private avaliacoes: WritableSignal<Avaliacao[]> = signal([])
  private cargaHoraria: WritableSignal<CargaHoraria | null> = signal(null)
  private indices: WritableSignal<IndicesAcademicos | null> = signal(null)

  async login(username: string, password: string) {
    const headers: HeadersInit = {
      "Content-Type": "application/json"
    }
    const res = await fetch(`${this.domain}/login`, {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      headers: headers
    })
    const data = await res.json()
    console.log(data)

    if (!res.ok || !data.jsessionid) {
      throw new Error(data.error || "Erro desconhecido na API")
    }
    this.jsessionid.set(data.jsessionid)
    return data.jsessionid
  }

  async fetchMainData() {
    if (!this.jsessionid().length) throw new Error("jsessionid inválido")
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      "Authorization": "Bearer" + this.jsessionid()
    }
    const res = await fetch(`${this.domain}/main-data`, {
      headers: headers
    })
    const data = await res.json()
    console.log(data)

    if (!res.ok || !data.jsessionid) {
      throw new Error(data.error || "Erro desconhecido na API")
    }
    const mainDataRes = data as MainDataResponse
    this.avaliacoes.set(mainDataRes.avaliacoes)
    this.cargaHoraria.set(mainDataRes.cargaHoraria)
    this.indices.set(mainDataRes.indices)
    this.jsessionid.set(mainDataRes.jsessionid)
    this.nome.set(mainDataRes.nome)
    this.turmas.set(mainDataRes.turmas)
    this.viewState.set(mainDataRes.viewState)
  }
}
