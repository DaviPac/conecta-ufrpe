import { Component, inject } from '@angular/core';
import { SafeResourceUrl, DomSanitizer } from '@angular/platform-browser';
import { SigaaService } from '../../services/sigaaService/sigaa.service';

@Component({
  selector: 'app-calendario',
  imports: [],
  templateUrl: './calendario.html',
  styleUrl: './calendario.scss',
})
export class Calendario {
  private sigaaService = inject(SigaaService);
  private sanitizer = inject(DomSanitizer);

  calendarioUrl: SafeResourceUrl | null = null;

  constructor() {
    const rawUrl = this.sigaaService.calendarioUrl;
    if (rawUrl) {
      this.calendarioUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
        `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(rawUrl)}`
      );
    }
  }
}