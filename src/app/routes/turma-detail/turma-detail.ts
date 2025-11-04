import { Component, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { formatarHorarios, parseFaltas } from '../../utils/formatters';
import { SigaaService } from '../../services/sigaaService/sigaa.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-turma-detalhes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './turma-detail.html',
})
export class TurmaDetail implements OnInit {
  private sigaaService: SigaaService = inject(SigaaService);
  private router: Router = inject(Router)
  turma = this.sigaaService.currentTurma;
  avaliacoes = this.sigaaService.avaliacoes;
  formatarHorarios = formatarHorarios;
  parseFaltas = parseFaltas;
  Number = Number

  ngOnInit(): void {
      if (!this.sigaaService.currentTurma()) this.router.navigate(['/'])
  }

  avaliacoesDaTurma = computed(() => {
    const turmaAtual = this.turma();
    const todasAvaliacoes = this.avaliacoes();
    if (!turmaAtual || !todasAvaliacoes) return [];
    return todasAvaliacoes.filter((av) => av.turmaNome === turmaAtual.nome);
  });

  getSituacaoClass(situacao: string): string {
    switch (situacao.toLowerCase()) {
      case 'aprovado':
        return 'text-green-600';
      case 'reprovado':
        return 'text-red-600';
      case 'em recuperação':
      case 'prova final':
        return 'text-yellow-600';
      default:
        return 'text-gray-700';
    }
  }
}
