import { Component, inject, OnInit, signal, WritableSignal } from '@angular/core';
import { SigaaService } from '../../services/sigaaService/sigaa.service';
import { PdfViewerModule } from 'ng2-pdf-viewer';

@Component({
  selector: 'app-calendario',
  templateUrl: './calendario.html',
  styleUrls: ['./calendario.scss'],
  imports: [PdfViewerModule]
})
export class Calendario implements OnInit {
  private sigaaService = inject(SigaaService);

  // Agora guardamos o PDF diretamente na memória em vez de uma URL sanitizada
  pdfSrc: WritableSignal<Uint8Array | undefined> = signal(undefined);
  rawUrlSignal: WritableSignal<string | null> = signal(null);
  
  carregando = signal(true);
  erro = signal(false);
  isDownloading = signal(false);

  ngOnInit() {
    this.carregarCalendario();
  }

  async carregarCalendario() {
    this.erro.set(false);
    this.carregando.set(true);

    try {
      const rawUrl = this.sigaaService.getCalendarioUrl();
      if (!rawUrl) {
        this.erro.set(true);
        return;
      }
      this.rawUrlSignal.set(rawUrl);

      // 1. Verifica o Cache
      const pdfEmCache = this.sigaaService.pdfCache();
      if (pdfEmCache) {
        // O SEGREDO: Passamos uma CÓPIA exata do array para o visualizador.
        // Assim, se o PDF.js consumir o buffer, o cache do serviço continua a salvo!
        this.pdfSrc.set(new Uint8Array(pdfEmCache)); 
        this.carregando.set(false);
        return;
      }

      // 2. Se não tem cache, faz o fetch
      const response = await fetch(rawUrl);
      if (!response.ok) throw new Error('Falha na rede ao buscar o documento');
      
      const buffer = await response.arrayBuffer();
      const pdfData = new Uint8Array(buffer);

      // 3. Salva a versão original no cache do serviço
      this.sigaaService.pdfCache.set(pdfData);
      
      // 4. Passa uma CÓPIA para o componente visualizar
      this.pdfSrc.set(new Uint8Array(pdfData));
      
    } catch (err) {
      console.error('Erro ao carregar calendário:', err);
      this.erro.set(true);
    } finally {
      this.carregando.set(false);
    }
  }

  recarregar() {
    this.pdfSrc.set(undefined);
    // Limpa o cache também caso o usuário force o recarregamento
    this.sigaaService.pdfCache.set(undefined); 
    setTimeout(() => this.carregarCalendario(), 50);
  }

  // O seu método baixarPdf() continua exatamente o mesmo!
  async baixarPdf() {
    // Pega o array de bytes que já está na memória
    const pdfData = this.sigaaService.pdfCache();
    
    if (!pdfData || this.isDownloading()) return;

    this.isDownloading.set(true);

    try {
      // Cria o arquivo PDF instantaneamente a partir da memória
      const blob = new Blob([pdfData.buffer as ArrayBuffer], { type: 'application/pdf' });
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'Calendario_Academico_UFRPE.pdf';
      document.body.appendChild(link);
      
      link.click();
      
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

    } catch (error) {
      console.error('Erro ao processar download:', error);
    } finally {
      this.isDownloading.set(false);
    }
  }
}