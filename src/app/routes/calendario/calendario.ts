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
  rawUrlSignal: WritableSignal<string | null> = signal(null);
  carregando = signal(true);
  iframeLoading: WritableSignal<boolean> = signal(true);
  erro = signal(false);
  
  // Novo sinal para controlar o estado do botão de download
  isDownloading = signal(false);

  onIframeLoad = () => this.iframeLoading.set(false);

  ngOnInit() {
    this.carregarCalendario();
  }

  async carregarCalendario() {
    this.erro.set(false);
    this.carregando.set(true);
    this.iframeLoading.set(true);

    try {
      const rawUrl = this.sigaaService.getCalendarioUrl();
      if (rawUrl) {
        this.rawUrlSignal.set(rawUrl);
        const viewer = `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(rawUrl)}`;
        this.calendarioUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(viewer));
      } else {
        this.erro.set(true);
      }
    } catch (err) {
      console.error('Erro ao carregar calendário:', err);
      this.erro.set(true);
    } finally {
      this.carregando.set(false);
    }
  }

  recarregar() {
    this.calendarioUrl.set(null); 
    setTimeout(() => this.carregarCalendario(), 50);
  }

  // Nova função para forçar o download via Blob
  async baixarPdf() {
    const url = this.rawUrlSignal();
    if (!url || this.isDownloading()) return;

    this.isDownloading.set(true);

    try {
      // Faz a requisição do arquivo
      const response = await fetch(url);
      
      if (!response.ok) throw new Error('Falha na rede ao tentar baixar o arquivo');
      
      // Converte a resposta em um Blob (arquivo binário)
      const blob = await response.blob();
      
      // Cria uma URL local e temporária para o Blob
      const blobUrl = window.URL.createObjectURL(blob);
      
      // Cria um elemento <a> invisível para forçar o download
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'Calendario_Academico_UFRPE.pdf'; // Nome do arquivo a ser salvo
      document.body.appendChild(link);
      
      link.click(); // Simula o clique
      
      // Limpeza da memória
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

    } catch (error) {
      console.error('Erro ao baixar o PDF:', error);
      // Aqui seria um ótimo lugar para chamar aquele Toast de erro!
    } finally {
      this.isDownloading.set(false);
    }
  }
}