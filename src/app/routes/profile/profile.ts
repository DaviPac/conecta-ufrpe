import { Component, computed, inject, signal } from '@angular/core';
import { SigaaService } from '../../services/sigaaService/sigaa.service';
import { CommonModule, DecimalPipe } from '@angular/common';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { AtestadoMatricula } from '../../models/sigaa.models';
import { buildTabelaHorarios } from '../../utils/horarios.helper';

@Component({
  selector: 'app-profile',
  imports: [DecimalPipe, CommonModule],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile {
  private sigaaService: SigaaService = inject(SigaaService);
  atestadoDados = signal<AtestadoMatricula | null>(null);
  carga = this.sigaaService.cargaHoraria;
  indices = this.sigaaService.indices;

  tabelaHorarios = computed(() =>
  buildTabelaHorarios(this.atestadoDados()?.turmas ?? [])
);

  // No componente
  dataEmissao = computed(() =>
    new Date().toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    })
  );

  async exportarPDF() {
    const dados = await this.sigaaService.getAtestadoDados();
    this.atestadoDados.set(dados);

    setTimeout(async () => {
      const data = document.getElementById('template-atestado-ufrpe');
      if (!data) return;

      const canvas = await html2canvas(data, {
        scale: 3,
        useCORS: true,
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight(); // Altura máxima da página A4

      // Calcula a altura proporcional da imagem
      let finalWidth = pdfWidth;
      let finalHeight = (canvas.height * pdfWidth) / canvas.width;

      // Se a imagem for maior que a página, reduzimos a proporção para caber na altura
      if (finalHeight > pdfHeight) {
        finalHeight = pdfHeight - 10; // Subtraímos 10mm para dar uma margem de respiro
        finalWidth = (canvas.width * finalHeight) / canvas.height;
      }

      // Calcula o eixo X para centralizar a imagem caso ela tenha encolhido na largura
      const xOffset = (pdfWidth - finalWidth) / 2;

      pdf.addImage(imgData, 'PNG', xOffset, 5, finalWidth, finalHeight); // 5mm de margem no topo
      pdf.save(`Atestado_Matricula_${dados.matricula}.pdf`);

      this.atestadoDados.set(null);
    }, 100);
  }

  async emitirHistorico() {
    try {
      // 1. Busca o Blob (arquivo binário) do serviço
      const pdfBlob = await this.sigaaService.getHistoricoPdf();

      // 2. Cria uma URL temporária no navegador para este Blob
      const url = window.URL.createObjectURL(pdfBlob);

      // 3. Cria um link fantasma <a> no DOM
      const link = document.createElement('a');
      link.href = url;
      
      // 4. Define o nome do arquivo (opcional, mas recomendado)
      // Como não temos o nome ou matrícula fácil aqui, podemos usar um genérico ou tentar puxar do signal caso exista
      const matricula = this.atestadoDados()?.matricula || 'Aluno';
      link.download = `Historico_Academico_${matricula}.pdf`; 

      // 5. Simula o clique para iniciar o download
      document.body.appendChild(link);
      link.click();

      // 6. Limpeza (remove o link e revoga a URL para liberar memória)
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Erro ao baixar o histórico:', error);
      // Aqui você pode adicionar um Toast ou Alert avisando o usuário sobre a falha
    }
  }

  async emitirVinculo() {
    try {
      // 1. Busca o Blob (arquivo binário) do serviço
      const pdfBlob = await this.sigaaService.getVinculoPdf();

      // 2. Cria uma URL temporária no navegador para este Blob
      const url = window.URL.createObjectURL(pdfBlob);

      // 3. Cria um link fantasma <a> no DOM
      const link = document.createElement('a');
      link.href = url;
      
      // 4. Define o nome do arquivo (opcional, mas recomendado)
      // Como não temos o nome ou matrícula fácil aqui, podemos usar um genérico ou tentar puxar do signal caso exista
      const matricula = this.atestadoDados()?.matricula || 'Aluno';
      link.download = `Declaração_Vínculo_${matricula}.pdf`; 

      // 5. Simula o clique para iniciar o download
      document.body.appendChild(link);
      link.click();

      // 6. Limpeza (remove o link e revoga a URL para liberar memória)
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Erro ao baixar a declaração de vínculo:', error);
      // Aqui você pode adicionar um Toast ou Alert avisando o usuário sobre a falha
    }
  }

  onLogout() {
    this.sigaaService.logout()
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
