import { Component, inject, OnInit, signal, WritableSignal } from '@angular/core';
import { SafeResourceUrl, DomSanitizer } from '@angular/platform-browser';
import { SigaaService } from '../../services/sigaaService/sigaa.service';

@Component({
  selector: 'app-calendario',
  templateUrl: './calendario.html',
  styleUrls: ['./calendario.scss'],
})
export class Calendario implements OnInit {
  private sigaaService = inject(SigaaService);
  private sanitizer = inject(DomSanitizer);

  calendarioUrl: WritableSignal<SafeResourceUrl | null> = signal(null);
  carregando = signal(true);
  iframeLoading: WritableSignal<boolean> = signal(true);

  onIframeLoad = () => this.iframeLoading.set(false)

  async ngOnInit() {
    try {
      this.iframeLoading.set(true)
      const rawUrl = await this.sigaaService.getCalendarioUrl();
      if (rawUrl) {
        const viewer = `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(rawUrl)}`;
        this.calendarioUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(viewer));
      }
    } catch (err) {
      console.error('Erro ao carregar calendário:', err);
    } finally {
      this.carregando.set(false);
    }
  }
}
