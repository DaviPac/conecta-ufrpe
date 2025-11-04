import { Component, inject } from '@angular/core';
import { SigaaService } from '../../services/sigaaService/sigaa.service';
import { formatarHorarios } from '../../utils/formatters';
import { Router } from '@angular/router';
import { Turma } from '../../models/sigaa.models';

@Component({
  selector: 'app-dashboard',
  imports: [],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private sigaaService: SigaaService = inject(SigaaService);
  private router: Router = inject(Router);
  turmas = this.sigaaService.turmas;
  nome = this.sigaaService.nome;
  formatarHorarios = formatarHorarios;
  openTurma = (turma: Turma) => {
    this.sigaaService.currentTurma.set(turma);
    this.router.navigate(['/turma']);
  };
}
