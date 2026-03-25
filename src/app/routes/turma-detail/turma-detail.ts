import { Component, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { formatarHorarios, parseFaltas } from '../../utils/formatters';
import { SigaaService } from '../../services/sigaaService/sigaa.service';
import { LinkifyPipe } from '../../utils/linkify.pipe';
import { StudyAssistantComponent } from './study-assistant.component'; // <-- novo

@Component({
  selector: 'app-turma-detalhes',
  standalone: true,
  imports: [CommonModule, RouterModule, LinkifyPipe, StudyAssistantComponent], // <-- adicionado
  templateUrl: './turma-detail.html',
})
export class TurmaDetail implements OnInit {
  private sigaaService: SigaaService = inject(SigaaService);
  private router: Router = inject(Router);
  
  formatarHorarios = formatarHorarios;
  parseFaltas = parseFaltas;
  Number = Number;

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
    if (this.sigaaService.currentTurmaIdx() === null) {
      this.router.navigate(['/']);
    }
  }

  get hasNotas(): boolean {
    const notas = this.turma()?.notas?.notas;
    return !!notas && Object.keys(notas).length > 0;
  }

  get faltasDisplay(): string | number {
    const faltas = this.turma()?.faltas;
    return faltas !== undefined ? this.parseFaltas(faltas) : 'não lançada';
  }

  get hasMuitasFaltas(): boolean {
    const faltas = this.turma()?.faltas;
    return typeof faltas === 'number' && faltas > 10;
  }

  get hasCronograma(): boolean {
    const cronograma = this.turma()?.cronograma;
    return !!cronograma && cronograma.length > 0;
  }

  get isLoading(): boolean {
    return this.turma() ? !this.turma()!.isLoaded : true;
  }
}