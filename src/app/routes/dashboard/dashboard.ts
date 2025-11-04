import { Component, inject } from '@angular/core';
import { SigaaService } from '../../services/sigaaService/sigaa.service';

@Component({
  selector: 'app-dashboard',
  imports: [],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private sigaaService: SigaaService = inject(SigaaService)
  turmas = this.sigaaService.turmas
}
