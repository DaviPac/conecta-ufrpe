import { Component, inject } from '@angular/core';
import { SigaaService } from '../../services/sigaaService/sigaa.service';
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-profile',
  imports: [DecimalPipe],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile {
  private sigaaService: SigaaService = inject(SigaaService)
  carga = this.sigaaService.cargaHoraria()
  indices = this.sigaaService.indices()

  get total(): number {
    return parseFloat(this.carga?.totalCurriculo || '0') || 0;
  }

  get obgPendente(): number {
    return parseFloat(this.carga?.obrigatoriaPendente || '0') || 0;
  }

  get optPendente(): number {
    return parseFloat(this.carga?.optativaPendente || '0') || 0;
  }

  get compPendente(): number {
    return parseFloat(this.carga?.complementarPendente || '0') || 0;
  }

  get totalPendente(): number {
    return this.obgPendente + this.optPendente + this.compPendente;
  }

  get totalConcluido(): number {
    return this.total > this.totalPendente ? this.total - this.totalPendente : 0;
  }

  get percentual(): number {
    return this.total > 0 ? (this.totalConcluido / this.total) * 100 : 0;
  }

  get pendingItemsData() {
    return [
      { label: 'Obrigatória Pendente', horas: this.carga?.obrigatoriaPendente },
      { label: 'Optativa Pendente', horas: this.carga?.optativaPendente },
      { label: 'Complementar Pendente', horas: this.carga?.complementarPendente },
    ];
  }
}