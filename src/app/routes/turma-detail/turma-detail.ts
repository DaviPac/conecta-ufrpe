import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { formatarHorarios, parseFaltas } from '../../utils/formatters';
import { SigaaService } from '../../services/sigaaService/sigaa.service';
import { LinkifyPipe } from '../../utils/linkify.pipe';
import { StudyAssistantComponent } from './study-assistant.component'; // <-- novo
import { Arquivo } from '../../models/sigaa.models';
import { TurmaLocalService } from './turma-local.service';

@Component({
  selector: 'app-turma-detalhes',
  standalone: true,
  imports: [CommonModule, RouterModule, LinkifyPipe, StudyAssistantComponent], // <-- adicionado
  templateUrl: './turma-detail.html',
})
export class TurmaDetail implements OnInit {
  private sigaaService: SigaaService = inject(SigaaService);
  private router: Router = inject(Router);
  private indexedDbService = inject(TurmaLocalService);

  formatarHorarios = formatarHorarios;
  parseFaltas = parseFaltas;
  Number = Number;
  downloadingFiles = signal<Set<string>>(new Set<string>());
  toastMessage = signal<{ text: string, type: 'success' | 'error' } | null>(null);
  isEditingLocal = signal(false);
  customLocal = signal<string | null>(null);

  async carregarLocalCustomizado() {
    const turmaId = this.turma()?.nome;
    if (turmaId) {
      // Substitua pela sua chamada real ao IndexedDB
      const salvo = await this.indexedDbService.getLocalTurma(turmaId);
      this.customLocal.set(salvo || null);
    }
  }

  iniciarEdicaoLocal() {
    this.isEditingLocal.set(true);
  }

  cancelarEdicaoLocal() {
    this.isEditingLocal.set(false);
  }

  async salvarLocal(novoLocal: string) {
    const valor = novoLocal.trim();
    const turmaId = this.turma()?.nome;
    
    if (!turmaId) return;

    if (valor === '') {
      await this.removerLocalCustomizado();
      return;
    }

    // Salva no IndexedDB
    await this.indexedDbService.salvarLocalTurma(turmaId, valor);
    this.customLocal.set(valor);
    this.isEditingLocal.set(false);
    
    // Opcional: exibir toast
    // this.exibirToast('Local atualizado com sucesso!', 'success');
  }

  async removerLocalCustomizado() {
    const turmaId = this.turma()?.nome;
    if (turmaId) {
      await this.indexedDbService.removerLocalTurma(turmaId);
      this.customLocal.set(null);
      this.isEditingLocal.set(false);
    }
  }

  turma = computed(() => {
    const turmas = this.sigaaService.turmas();
    const idx = this.sigaaService.currentTurmaIdx();
    if (idx === null) return turmas[0];
    return turmas[idx];
  });

  avaliacoesDaTurma = computed(() => {
    const turmaAtual = this.turma();
    const todasAvaliacoes = this.sigaaService.avaliacoes();
    if (!turmaAtual || !todasAvaliacoes) return [];
    return todasAvaliacoes.filter((av) => av.turmaNome === turmaAtual.nome);
  });

  ngOnInit(): void {
    this.carregarLocalCustomizado();
    if (this.sigaaService.currentTurmaIdx() === null) {
      this.router.navigate(['/']);
    }
  }

  get hasNotas(): boolean {
    const notas = this.turma()?.notas?.notas;
    return !!notas && Object.keys(notas).length > 0;
  }

  get cargaHorariaTotal(): number {
    const horarios = this.turma()?.horarios || [];
    let aulasSemanais = 0;

    for (const h of horarios) {
      // Pega todos os padrões tipo "2T45", "46M123" na string atual
      const matches = h.matchAll(/([2-7]+)[MTN]([1-6]+)/g);
      for (const match of matches) {
        const dias = match[1].length;
        const slots = match[2].length;
        aulasSemanais += dias * slots;
      }
    }

    // 1 aula semanal = 15h no semestre (ex: 4 aulas/sem = 60h)
    return aulasSemanais * 15;
  }

  get maxFaltas(): number {
    // Pode-se faltar no máximo 25% da carga horária
    return this.cargaHorariaTotal * 0.25;
  }

  get faltasPercent(): number {
    const faltas = this.turma()?.faltas;
    if (faltas === undefined || faltas === -1) return 0;

    const max = this.maxFaltas;
    if (max === 0) return 0; // Evita divisão por zero

    const pct = (faltas / max) * 100;
    return pct > 100 ? 100 : pct;
  }

  get faltasRestantes(): number | null {
    const faltas = this.turma()?.faltas;
    if (faltas === undefined || faltas < 0) return null;

    const restantes = this.maxFaltas - faltas;
    return restantes < 0 ? 0 : Math.round(restantes);
  }

  get faltasDisplay(): string | number {
    const faltas = this.turma()?.faltas;
    return faltas !== undefined ? this.parseFaltas(faltas) : 'Não lançada';
  }

  get hasMuitasFaltas(): boolean {
    return this.faltasPercent > 70;
  }

  get hasCronograma(): boolean {
    const cronograma = this.turma()?.cronograma;
    return !!cronograma && cronograma.length > 0;
  }

  get isLoading(): boolean {
    return this.turma() ? !this.turma()!.isLoaded : true;
  }

  async baixarArquivo(arquivo: Arquivo): Promise<void> {  
    // Ativa o spinner/loading na interface
    this.downloadingFiles.update(set => {
      const newSet = new Set(set);
      newSet.add(arquivo.id);
      return newSet;
    });

    try {
      await this.sigaaService.baixarArquivoTurma(this.turma(), arquivo);
      
      // 2. O service vai terminar com um window.location.href
      // O PWA/Navegador vai assumir a partir daqui silenciosamente.
      this.showToast('Download iniciado!', 'success');
      
    } catch (err: any) {
      console.error(err);
      this.showToast('Falha ao baixar: ' + err.message, 'error');
    } finally {
      // Remove o spinner/loading da interface
      this.downloadingFiles.update(set => {
        const newSet = new Set(set);
        newSet.delete(arquivo.id);
        return newSet;
      });
    }
  }

  private showToast(text: string, type: 'success' | 'error') {
    this.toastMessage.set({ text, type });
    setTimeout(() => {
      this.toastMessage.set(null);
    }, 3000);
  }
}
