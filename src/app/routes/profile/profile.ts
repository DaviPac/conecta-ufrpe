import { Component, computed, inject, signal } from '@angular/core';
import { SigaaService } from '../../services/sigaaService/sigaa.service';
import { CommonModule, DecimalPipe } from '@angular/common';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { AtestadoMatricula, ComponenteCurricular, EstruturaCurricular } from '../../models/sigaa.models';
import { buildTabelaHorarios } from '../../utils/horarios.helper';
import { ClickOutsideDirective } from '../../click-outside';

@Component({
  selector: 'app-profile',
  imports: [DecimalPipe, CommonModule, ClickOutsideDirective],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile {
  private sigaaService: SigaaService = inject(SigaaService);
  atestadoDados = signal<AtestadoMatricula | null>(null);
  carga = this.sigaaService.cargaHoraria;
  indices = this.sigaaService.indices;

  // --- NOVOS SIGNALS DE ESTADO ---
  isDownloadingAtestado = signal(false);
  isDownloadingHistorico = signal(false);
  isDownloadingVinculo = signal(false);
  showIndicesDetails = signal(false);


  showMatrizModal = signal(false);
  filtroPeriodo = signal<string | null>(null);
  isCarregandoMatriz = signal(false);
  estruturaCurricular = signal<EstruturaCurricular | null>(null);
  componentesAgrupados = computed(() => {
    const estrutura = this.estruturaCurricular();
    if (!estrutura) return [];

    const grupos = estrutura.componentes.reduce((acc, comp) => {
      const nivel = comp.nivel;
      if (!acc[nivel]) {
        acc[nivel] = [];
      }
      acc[nivel].push(comp);
      return acc;
    }, {} as Record<string, ComponenteCurricular[]>);

    // Retorna um array ordenado (semestres numéricos primeiro, textos depois)
    return Object.keys(grupos)
      .sort((a, b) => {
        const numA = parseInt(a);
        const numB = parseInt(b);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        if (!isNaN(numA)) return -1;
        if (!isNaN(numB)) return 1;
        return a.localeCompare(b);
      })
      .map(key => ({
        nivel: key,
        titulo: this.formatarNivel(key),
        disciplinas: grupos[key]
      }));
  });

  async abrirMatrizCurricular() {
    if (this.estruturaCurricular()) {
      this.showMatrizModal.set(true);
      return;
    }

    try {
      this.isCarregandoMatriz.set(true);
      // Substitua pela chamada real do seu serviço
      const matriz = await this.sigaaService.getMatrizCurricular(); 
      this.estruturaCurricular.set(matriz);
      this.showMatrizModal.set(true);
    } catch (error) {
      console.error('Erro ao buscar matriz', error);
      // Aqui você pode disparar um toast de erro
    } finally {
      this.isCarregandoMatriz.set(false);
    }
  }

  formatarNivel(nivel: string): string {
    if (!isNaN(parseInt(nivel))) {
      return `${nivel}º Período`;
    }
    return nivel.charAt(0).toUpperCase() + nivel.slice(1);
  }


  toastMessage = signal<{ text: string; type: 'success' | 'error' } | null>(null);
  // -------------------------------

  tabelaHorarios = computed(() => buildTabelaHorarios(this.atestadoDados()?.turmas ?? []));

  dataEmissao = computed(() =>
    new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
  );

  toggleIndicesDetails() {
    this.showIndicesDetails.update((value) => !value);
  }

  closeIndicesDetails() {
    this.showIndicesDetails.set(false);
  }

  // Método auxiliar para exibir o Toast e sumir após 3 segundos
  showToast(text: string, type: 'success' | 'error') {
    this.toastMessage.set({ text, type });
    setTimeout(() => this.toastMessage.set(null), 3000);
  }

  async exportarPDF() {
    if (this.isDownloadingAtestado()) return; // Previne múltiplos cliques

    this.isDownloadingAtestado.set(true);

    try {
      const dados = await this.sigaaService.getAtestadoDados();
      this.atestadoDados.set(dados);

      // Transformamos o setTimeout em uma Promise para o bloco finally funcionar corretamente
      await new Promise<void>((resolve, reject) => {
        setTimeout(async () => {
          try {
            const data = document.getElementById('template-atestado-ufrpe');
            if (!data) throw new Error('Template não encontrado');

            const canvas = await html2canvas(data, {
              scale: 3,
              useCORS: true,
              logging: false,
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            let finalWidth = pdfWidth;
            let finalHeight = (canvas.height * pdfWidth) / canvas.width;

            if (finalHeight > pdfHeight) {
              finalHeight = pdfHeight - 10;
              finalWidth = (canvas.width * finalHeight) / canvas.height;
            }

            const xOffset = (pdfWidth - finalWidth) / 2;
            pdf.addImage(imgData, 'PNG', xOffset, 5, finalWidth, finalHeight);
            pdf.save(`Atestado_Matricula_${dados.matricula}.pdf`);

            this.atestadoDados.set(null);
            resolve();
          } catch (e) {
            reject(e);
          }
        }, 100);
      });

      this.showToast('Atestado baixado com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao gerar atestado:', error);
      this.showToast('Erro ao baixar o atestado.', 'error');
    } finally {
      this.isDownloadingAtestado.set(false);
    }
  }

  async emitirHistorico() {
    if (this.isDownloadingHistorico()) return;
    this.isDownloadingHistorico.set(true);

    try {
      const pdfBlob = await this.sigaaService.getHistoricoPdf();
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;

      const matricula = this.atestadoDados()?.matricula || 'Aluno';
      link.download = `Historico_Academico_${matricula}.pdf`;

      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      this.showToast('Histórico baixado com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao baixar o histórico:', error);
      this.showToast('Erro ao baixar o histórico.', 'error');
    } finally {
      this.isDownloadingHistorico.set(false);
    }
  }

  async emitirVinculo() {
    if (this.isDownloadingVinculo()) return;
    this.isDownloadingVinculo.set(true);

    try {
      const pdfBlob = await this.sigaaService.getVinculoPdf();
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;

      const matricula = this.atestadoDados()?.matricula || 'Aluno';
      link.download = `Declaração_Vínculo_${matricula}.pdf`;

      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      this.showToast('Declaração baixada com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao baixar a declaração de vínculo:', error);
      this.showToast('Erro ao baixar a declaração.', 'error');
    } finally {
      this.isDownloadingVinculo.set(false);
    }
  }

  onLogout() {
    this.sigaaService.logout();
  }

  get total(): number {
    return parseFloat(this.carga()?.totalCurriculo || '0') || 0;
  }

  get obgPendente(): number {
    return parseFloat(this.carga()?.obrigatoriaPendente || '0') || 0;
  }

  get optPendente(): number {
    return parseFloat(this.carga()?.optativaPendente || '0') || 0;
  }

  get compPendente(): number {
    return parseFloat(this.carga()?.complementarPendente || '0') || 0;
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
      { label: 'Obrigatória Pendente', horas: this.carga()?.obrigatoriaPendente },
      { label: 'Optativa Pendente', horas: this.carga()?.optativaPendente },
      { label: 'Complementar Pendente', horas: this.carga()?.complementarPendente },
    ];
  }
}
