import {
  Component, OnInit, inject, signal, ViewChild,
  ElementRef, AfterViewChecked, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { GoogleGenerativeAI, ChatSession, FunctionCall, SchemaType } from '@google/generative-ai';
import { StudyRepository } from '../turma-detail/study.repository';
import { MarkdownModule } from 'ngx-markdown';
import { SigaaService } from '../../services/sigaaService/sigaa.service';
import { Arquivo, AtestadoMatricula, CronogramaItem, Turma } from '../../models/sigaa.models';
import { formatarHorarios } from '../../utils/formatters';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { buildTabelaHorarios } from '../../utils/horarios.helper';
import { ChatStateService } from '../../services/chatService/chat.service';
import { ClassroomService } from '../../services/classroomService/classroom.service';
import { TurmaLocalService } from '../turma-detail/turma-local.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, MarkdownModule],
  templateUrl: './chat.html',
  styleUrls: ['./chat.scss']
})
export class ChatComponent implements OnInit, AfterViewChecked {
  private studyRepo     = new StudyRepository();
  private sigaaService  = inject(SigaaService);
  private classroomService = inject(ClassroomService);
  private turmaLocal    = inject(TurmaLocalService);
  private http          = inject(HttpClient);
  public  chatState     = inject(ChatStateService);

  @ViewChild('chatContainer') private chatContainer!: ElementRef;

  apiKeyInput     = signal<string>('');
  userInput       = signal<string>('');
  atestadoDados   = signal<AtestadoMatricula | null>(null);
  downloadingFiles = signal<Set<string>>(new Set<string>());

  tabelaHorarios = computed(() => buildTabelaHorarios(this.atestadoDados()?.turmas ?? []));
  dataEmissao    = computed(() =>
    new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  );

  // ─────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────

  ngOnInit() { this.checkApiKey(); }
  ngAfterViewChecked() { this.scrollToBottom(); }

  // ─────────────────────────────────────────────
  // Inicialização
  // ─────────────────────────────────────────────

  private async checkApiKey() {
    const key = await this.studyRepo.getApiKey();
    if (key) {
      this.chatState.hasApiKey.set(true);
      this.initGenerativeAI(key);
    }
  }

  async saveApiKey() {
    if (this.apiKeyInput().trim()) {
      await this.studyRepo.saveApiKey(this.apiKeyInput().trim());
      this.checkApiKey();
    }
  }

  private initGenerativeAI(apiKey: string) {
    if (this.chatState.chatSession) return;

    this.chatState.genAI = new GoogleGenerativeAI(apiKey);

    const model = this.chatState.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',

      // ── System prompt compacto ──────────────────────────────────────────
      systemInstruction: `
Assistente do SIGAA Lite. Regras:
- VA = Avaliação (1VA, 2VA, 3VA). 3VA substitui a menor entre 1VA/2VA. Média ≥7 passa direto. Final: média(final, maior2VA) ≥5.
- Seja direto e conciso. Responda APENAS o que foi perguntado.
- Termos: "férias/recesso" = intervalo entre semestres letivos. Não liste todos os feriados salvo pedido explícito.
- Você fala com um DISCENTE. Não forneça dados de docentes sem solicitação.
- Use **negrito** para datas importantes.
- Para montar plano de curso, verifique as turmas atuais, verifique os indices, verifique o curriculo e monte um plano de curso.

FLUXO DE MATERIAIS (obrigatório):
1. Chame consultar_dados(tipo="turmas") para obter cronogramas e nomes de arquivos.
2. Chame buscar_arquivos com os nomes encontrados.
3. Resposta final: apenas "Aqui estão os materiais:". NÃO repita os nomes de arquivos.
   - Exceção: links disponíveis devem ser retornados com breve descrição (não são baixáveis).
4. Para materiais de prova, filtre no cronograma arquivos com data anterior à prova.

Ao retornar URL, descreva brevemente o conteúdo do link.
`.trim(),

      // ── Ferramentas (reduzidas) ──────────────────────────────────────────
      tools: [{
        functionDeclarations: [

          // 1. Calendário
          {
            name: 'consultar_calendario',
            description: 'Consulta o calendário acadêmico (feriados, recessos, períodos de matrícula).',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                termo_busca: { type: SchemaType.STRING, description: 'Opcional. Ex: "recesso", "prova final"' }
              }
            }
          },

          // 2. Dados do aluno — turmas / notas / índices / matrícula unificados
          {
            name: 'consultar_dados',
            description: `Consulta dados do aluno. Use o campo "tipo" para escolher:
- "turmas"   → cronogramas, horários, faltas e dados do Google Classroom vinculado.
- "notas"    → notas das disciplinas.
- "indices"  → IRA, CR e outros índices.
- "matricula"→ dados do atestado de matrícula.
- "curriculo"→ dados da matriz curricular (cadeiras por semestre + optativas, + concluidas).
Prefira uma única chamada por assunto.`,
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                tipo: {
                  type: SchemaType.STRING,
                  description: '"turmas" | "notas" | "indices" | "matricula" | "curriculo"'
                },
                termo_busca: { type: SchemaType.STRING, description: 'Opcional. Nome EXATO da turma requisitada.' }
              },
              required: ['tipo']
            }
          },

          // 3. Documentos oficiais
          {
            name: 'baixar_documento',
            description: 'Baixa documentos oficiais do aluno.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                tipo_documento: {
                  type: SchemaType.STRING,
                  description: '"historico" | "vinculo" | "atestado"'
                }
              },
              required: ['tipo_documento']
            }
          },

          // 4. Botões de download de materiais
          {
            name: 'buscar_arquivos',
            description: 'Exibe botões de download de materiais. Sempre use após consultar_dados(tipo="turmas") quando o usuário pedir materiais.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                nomes_arquivo: {
                  type: SchemaType.ARRAY,
                  description: 'Nomes exatos dos arquivos obtidos no cronograma.',
                  items: { type: SchemaType.STRING }
                }
              },
              required: ['nomes_arquivo']
            }
          },

          // 5. Download do calendário completo
          {
            name: 'baixar_calendario',
            description: 'Baixa o calendário acadêmico completo em PDF. Use APENAS se o usuário pedir o calendário inteiro.'
          }
        ]
      }]
    });

    this.chatState.chatSession = model.startChat({ history: [] });
  }

  // ─────────────────────────────────────────────
  // Envio de mensagem
  // ─────────────────────────────────────────────

  async sendMessage() {
    if (!this.chatState.chatSession) {
      await this.checkApiKey();
      const apiKey = await this.studyRepo.getApiKey();
      if (!apiKey) return;
      this.initGenerativeAI(apiKey);
    }

    const text = this.userInput().trim();
    if (!text || this.chatState.isGenerating()) return;

    this.chatState.addMessage({ role: 'user', text });
    this.apiKeyInput.set('');
    this.chatState.isGenerating.set(true);
    this.chatState.addMessage({ role: 'model', text: '' });

    try {
      const dataAtual = new Date().toLocaleDateString('pt-BR');
      const horaAtual = new Date().toLocaleTimeString('pt-BR');
      const result = await this.chatState.chatSession!.sendMessageStream(
        `[Data e hora: ${dataAtual} ${horaAtual}]\n${text}`
      );
      await this.processStream(result);
    } catch (error) {
      console.error('Erro no chat:', error);
      this.chatState.appendTextoUltimaMensagem('\n*[Erro de conexão com a IA]*');
    } finally {
      this.chatState.isGenerating.set(false);
    }
    this.userInput.set('');
  }

  // ─────────────────────────────────────────────
  // Processamento de stream / function calls
  // ─────────────────────────────────────────────

  private async processStream(result: any) {
    for await (const chunk of result.stream) {
      const calls = chunk.functionCalls();
      if (calls?.length) {
        await this.handleFunctionCall(calls[0]);
        return;
      }
      const txt = chunk.text();
      if (txt) this.chatState.appendTextoUltimaMensagem(txt);
    }
  }

  private async handleFunctionCall(call: FunctionCall) {
    this.chatState.appendTextoUltimaMensagem('\n*[Buscando dados no sistema...]*\n');

    let response: object = {};

    switch (call.name) {

      // ── Calendário ─────────────────────────────────────────────────────
      case 'consultar_calendario':
        try {
          const cal = await firstValueFrom(this.http.get('/calendario.json'));
          response = { resultado: cal };
        } catch {
          response = { erro: 'Não foi possível carregar o calendário.' };
        }
        break;

      // ── Dados unificados do aluno ───────────────────────────────────────
      case 'consultar_dados':
        response = await this.handleConsultarDados(call.args as { tipo: string; termo_busca?: string });
        break;

      // ── Download de documentos ──────────────────────────────────────────
      case 'baixar_documento':
        response = await this.handleBaixarDocumento((call.args as { tipo_documento: string }).tipo_documento);
        break;

      // ── Botões de materiais ─────────────────────────────────────────────
      case 'buscar_arquivos': {
        const { nomes_arquivo } = call.args as { nomes_arquivo: string[] };
        const encontrados: { arquivo: Arquivo; turmaNome: string }[] = [];

        for (const turma of this.sigaaService.turmas()) {
          for (const item of turma.cronograma ?? []) {
            for (const arq of item.arquivos ?? []) {
              if (nomes_arquivo.includes(arq.nome)) {
                encontrados.push({ arquivo: arq, turmaNome: turma.nome });
              }
            }
          }
        }

        if (encontrados.length) this.chatState.addArquivos(encontrados);
        response = {
          resultado: `${encontrados.length} arquivo(s) encontrado(s). Botões de download exibidos ao usuário.`
        };
        break;
      }

      // ── Download do calendário ──────────────────────────────────────────
      case 'baixar_calendario':
        try {
          const url   = this.sigaaService.getCalendarioUrl();
          const blob  = await (await fetch(url)).blob();
          const blobUrl = URL.createObjectURL(blob);
          const a = Object.assign(document.createElement('a'), {
            href: blobUrl, download: 'calendario-academico.pdf', style: 'display:none'
          });
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
          response = { resultado: 'Download do calendário iniciado.' };
        } catch {
          response = { erro: 'Erro ao baixar o calendário (CORS ou link indisponível).' };
        }
        break;

      default:
        response = { erro: 'Função desconhecida.' };
    }

    this.chatState.removeBuscando();

    const next = await this.chatState.chatSession!.sendMessageStream([{
      functionResponse: { name: call.name, response }
    }]);
    await this.processStream(next);
  }

  // ─────────────────────────────────────────────
  // Handlers especializados
  // ─────────────────────────────────────────────

  /** Retorna dados conforme o tipo solicitado pela IA */
  private async handleConsultarDados(args: { tipo: string; termo_busca?: string }): Promise<object> {
    let turmas = args.termo_busca ? this.sigaaService.turmas().filter(t => t.nome.toLowerCase() === args.termo_busca?.toLowerCase()) : this.sigaaService.turmas();
    if (args.termo_busca && turmas?.length === 0) {
      turmas = this.sigaaService.turmas()
    }
    switch (args.tipo) {

      case 'turmas': {
        const turmasFinal = await Promise.all(
          turmas.map(t => this.parseTurmaComClassroom(t))
        );
        return {
          resultado: {
            turmasFinal,
            avaliacoes: this.sigaaService.avaliacoes()
          }
        };
      }

      case 'notas':
        return {
          resultado: turmas.map(t => ({
            turma: t.nome,
            notas: t.notas
          }))
        };

      case 'indices':
        return { resultado: { indices: this.sigaaService.indices(), cargaHoraria: this.sigaaService.cargaHoraria() } };

      case 'matricula':
        try {
          return { resultado: await this.sigaaService.getAtestadoDados() };
        } catch {
          return { erro: 'Não foi possível consultar os dados da matrícula.' };
        }

      case 'curriculo':
        try {
          const curriculo = await this.sigaaService.getMatrizCurricular();
          return { resultado: curriculo };
        } catch {
          return { erro: 'Não foi possível consultar os dados da matriz curricular.' };
        }
        
      default:
        return { erro: `Tipo desconhecido: "${args.tipo}". Use turmas, notas, indices ou matricula.` };
    }
  }

  /** Monta os dados de uma turma incluindo informações do Classroom vinculado */
  private async parseTurmaComClassroom(turma: Turma): Promise<object> {
    const base = this.parseTurmaData(turma);

    // Tenta buscar o classroom_id sem bloquear em caso de erro
    try {
      const classroomId = await this.turmaLocal.getClassroomId(turma.nome);
      if (!classroomId) return base;

      const matricula = this.sigaaService.matricula(); // adapte ao seu serviço

      // Busca em paralelo: atividades, materiais e anúncios
      const [assignments, materials, announcements] = matricula ? await Promise.allSettled([
        firstValueFrom(this.classroomService.getAssignments(matricula, classroomId)),
        firstValueFrom(this.classroomService.getMaterials(matricula, classroomId)),
        firstValueFrom(this.classroomService.getAnnouncements(matricula, classroomId))
      ]) : [undefined, undefined, undefined];

      return {
        ...base,
        classroom: {
          // Atividades: título, prazo e link (sem descrições longas)
          atividades: assignments?.status === 'fulfilled'
            ? assignments.value.map(a => ({
                titulo:    a.title,
                prazo:     a.due_date ?? null,
                link:      a.alternateLink ?? null
              }))
            : [],

          // Materiais: título, link e data
          materiais: materials?.status === 'fulfilled'
            ? materials.value.map(m => ({
                titulo: m.title,
                link:   m.alternateLink,
                data:   m.creationTime
              }))
            : [],

          // Anúncios: texto (truncado em 300 chars) + link
          anuncios: announcements?.status === 'fulfilled'
            ? announcements.value.map(a => ({
                texto: a.text.slice(0, 300),
                data:  a.creationTime,
                link:  a.alternateLink ?? null
              }))
            : []
        }
      };
    } catch {
      // Classroom não configurado ou offline — retorna só os dados do SIGAA
      return base;
    }
  }

  private async handleBaixarDocumento(tipo: string): Promise<object> {
    try {
      if (tipo === 'historico') {
        const blob = await this.sigaaService.getHistoricoPdf();
        this.baixarBlobNoNavegador(blob, 'Historico_Academico.pdf');
        return { resultado: 'Download do histórico iniciado.' };
      }
      if (tipo === 'vinculo') {
        const blob = await this.sigaaService.getVinculoPdf();
        this.baixarBlobNoNavegador(blob, 'Declaracao_Vinculo.pdf');
        return { resultado: 'Download do vínculo iniciado.' };
      }
      if (tipo === 'atestado') {
        return await this.lidarComAtestado();
      }
      return { erro: 'Tipo de documento inválido. Use: historico, vinculo ou atestado.' };
    } catch (e: any) {
      return { erro: `Falha ao baixar o documento: ${e.message}` };
    }
  }

  // ─────────────────────────────────────────────
  // Helpers de parsing
  // ─────────────────────────────────────────────

  /** Serializa cronograma enviando apenas os campos usados pela IA */
  private parseCronograma(cronograma?: CronogramaItem[]) {
    return cronograma?.map(item => ({
      titulo:   item.titulo,
      conteudo: item.conteudo,
      arquivos: item.arquivos?.map(f => ({ id: f.id, nome: f.nome }))
    }));
  }

  private parseFaltas(faltas: number): string {
    if (faltas === -2) return 'Carregando';
    if (faltas === -1) return 'Não lançada';
    return faltas.toString();
  }

  /** Retorna apenas os campos relevantes para a IA (sem `info` e campos redundantes) */
  private parseTurmaData(turma: Turma) {
    return {
      nome:       turma.nome,
      horarios:   formatarHorarios(turma.horarios),
      faltas:     this.parseFaltas(turma.faltas),
      cronograma: this.parseCronograma(turma.cronograma)
    };
  }

  // ─────────────────────────────────────────────
  // Helpers de UI / download
  // ─────────────────────────────────────────────

  private scrollToBottom() {
    try {
      this.chatContainer.nativeElement.scrollTop =
        this.chatContainer.nativeElement.scrollHeight;
    } catch { }
  }

  private baixarBlobNoNavegador(blob: Blob, nome: string) {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), {
      href: url, download: nome
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private async lidarComAtestado(): Promise<object> {
    const dados = await this.sigaaService.getAtestadoDados();
    this.atestadoDados.set(dados);

    await new Promise<void>((resolve, reject) => {
      setTimeout(async () => {
        try {
          const el = document.getElementById('template-atestado-ufrpe');
          if (!el) throw new Error('Template não encontrado');

          const canvas = await html2canvas(el, { scale: 3, useCORS: true, logging: false });
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pw = pdf.internal.pageSize.getWidth();
          const ph = pdf.internal.pageSize.getHeight();

          let w = pw;
          let h = (canvas.height * pw) / canvas.width;
          if (h > ph) { h = ph - 10; w = (canvas.width * h) / canvas.height; }

          pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pw - w) / 2, 5, w, h);
          pdf.save(`Atestado_Matricula_${dados.matricula}.pdf`);
          this.atestadoDados.set(null);
          resolve();
        } catch (e) { reject(e); }
      }, 100);
    });

    return { resultado: 'Download do atestado de matrícula iniciado.' };
  }

  // ─────────────────────────────────────────────
  // Ações públicas (template)
  // ─────────────────────────────────────────────

  async baixarArquivo(turmaNome: string, arquivo: Arquivo): Promise<void> {
    const turma = this.sigaaService.turmas().find(t => t.nome === turmaNome);
    if (!turma) { alert('Turma não encontrada.'); return; }

    this.downloadingFiles.update(s => new Set([...s, arquivo.id]));
    try {
      await this.sigaaService.baixarArquivoTurma(turma, arquivo);
    } catch {
      alert('Erro ao baixar o arquivo.');
    } finally {
      this.downloadingFiles.update(s => { const n = new Set(s); n.delete(arquivo.id); return n; });
    }
  }

  async limparConversa() {
    this.chatState.limparHistorico();
    await this.checkApiKey();
  }
}