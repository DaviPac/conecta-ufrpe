import { Component, inject } from '@angular/core';
import { SigaaService } from '../../services/sigaaService/sigaa.service';
import { formatarHorarios } from '../../utils/formatters';

@Component({
  selector: 'app-dashboard',
  imports: [],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private sigaaService: SigaaService = inject(SigaaService);
  turmas = this.sigaaService.turmas;
  nome = this.sigaaService.nome;
  formatarHorarios = formatarHorarios;
}
