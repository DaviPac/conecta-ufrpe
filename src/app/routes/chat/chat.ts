import { Component, OnInit, inject, signal, ViewChild, ElementRef, AfterViewChecked, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { GoogleGenerativeAI, ChatSession, FunctionCall, SchemaType } from '@google/generative-ai';
// Importe o seu repositório corretamente
import { StudyRepository } from '../turma-detail/study.repository'; 
import { MarkdownModule } from 'ngx-markdown';
import { SigaaService } from '../../services/sigaaService/sigaa.service';
import { Arquivo, AtestadoMatricula, CronogramaItem, Turma, TurmaInfo } from '../../models/sigaa.models';
import { formatarHorarios } from '../../utils/formatters';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { buildTabelaHorarios } from '../../utils/horarios.helper';
import { ChatStateService, ChatMessage } from '../../services/chatService/chat.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, MarkdownModule],
  templateUrl: './chat.html',
  styleUrls: ['./chat.scss']
})
export class ChatComponent implements OnInit, AfterViewChecked {
  private studyRepo = new StudyRepository();
  private sigaaService = inject(SigaaService);
  private http = inject(HttpClient);
  public chatState = inject(ChatStateService)

  @ViewChild('chatContainer') private chatContainer!: ElementRef;

  apiKeyInput = signal<string>('');
  
  userInput = signal<string>('');

  atestadoDados = signal<AtestadoMatricula | null>(null);

  downloadingFiles = signal<Set<string>>(new Set<string>());

  tabelaHorarios = computed(() => buildTabelaHorarios(this.atestadoDados()?.turmas ?? []));
  dataEmissao = computed(() =>
    new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
  );

  private genAI!: GoogleGenerativeAI;
  private chatSession!: ChatSession;

  ngOnInit() {
    this.checkApiKey();
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

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
    if (this.chatState.chatSession) {
      return; 
    }
    this.chatState.genAI = new GoogleGenerativeAI(apiKey);
    
    // Configuração do modelo e das ferramentas (Function Calling)
    const model = this.chatState.genAI.getGenerativeModel({
      model: "gemini-2.5-flash", // Use a versão mais recente/rápida para chats
      systemInstruction: `Você é o assistente virtual de alunos do SIGAA Lite. 
      Siga estas regras estritamente:
      1. Seja direto, conciso e amigável.
      2. Quando consultar o calendário, responda APENAS o que o usuário perguntou.
      3. TRADUÇÃO DE TERMOS: Para os alunos, "férias" ou "recesso" também significa o intervalo entre o fim de um semestre letivo e o início do próximo.
      4. NUNCA liste todos os feriados ou datas do ano, a menos que o usuário peça.
      5. Se o usuário perguntar sobre "recesso" e não houver essa palavra no calendário, informe de forma resumida apenas as férias discentes mais próximas.
      6. Você está falando com um DISCENTE. Não forneça informações sobre DOCENTES a menos que seja explicitamente solicitado.
      7. Use negrito para destacar datas importantes.
      8. PEDIDOS AMPLOS: Se o usuário pedir 'quero todos os materiais', 'ver todas as notas' ou 'qualquer turma', execute a ferramenta de busca imediatamente.
      9. FLUXO OBRIGATÓRIO PARA MATERIAIS: Se o usuário pedir materiais, conteúdos ou assuntos de uma prova, você DEVE fazer as chamadas em cadeia:
      - Passo 1: Use 'consultar_turmas' para obter o cronograma e descobrir os NOMES dos arquivos relevantes.
      - Passo 2: Imediatamente após receber o resultado, chame a ferramenta 'buscar_arquivos' passando essa lista.
      - Passo 3 (A Resposta Final): Após usar a ferramenta 'buscar_arquivos', **NÃO repita os nomes dos arquivos no texto da sua resposta**. Diga apenas algo curto e direto como "Aqui estão os materiais que encontrei para você baixar logo abaixo:".
      - EXCEÇÃO: Você pode e deve retornar links, caso disponíveis, NÃO informe ao usuário para baixar os links, eles não são baixáveis. Apenas retorne a URL e uma breve descrição do que é o arquivo, se possível.
      10. Para materiais de provas, filtre no cronograma os arquivos disponíveis com datas anteriores à data da prova, depois execute o Passo 2 descrito acima com esses arquivos.
      11. Ao retornar uma URL, SEMPRE descreva o que sabe sobre o conteúdo do link.`,
      tools: [{
        functionDeclarations: [
          {
            name: "consultar_calendario",
            description: "Consulta o calendário acadêmico da universidade para buscar datas de feriados, recessos e períodos de matrícula.",
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                termo_busca: { type: SchemaType.STRING, description: "Opcional. Ex: 'recesso', 'prova final'" }
              }
            }
          },
          {
            name: "consultar_turmas",
            description: "Consulta as turmas disponíveis para o aluno e seus cronogramas. IMPORTANTE: Use esta função PRIMEIRO para descobrir os nomes dos arquivos de uma disciplina antes de usar 'buscar_arquivos'.",
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                termo_busca: { type: SchemaType.STRING, description: "Opcional. Ex: 'Cálculo I', 'Física II'" }
              }
            }
          },
          {
            name: "consultar_notas",
            description: "Consulta as notas do aluno para as turmas em que está matriculado.",
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                termo_busca: { type: SchemaType.STRING, description: "Opcional. Ex: 'Cálculo I', 'todas as notas'" }
              }
            }
          },
          {
            name: "consultar_indices",
            description: "Consulta os índices acadêmicos do aluno, como IRA, CR, etc.",
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                termo_busca: { type: SchemaType.STRING, description: "Opcional. Ex: 'IRA', 'CR'" }
              }
            }
          },
          {
            name: "baixar_documento",
            description: "Inicia o download de documentos oficiais do aluno. Use isso quando o usuário pedir para baixar ou gerar o histórico, vínculo ou atestado.",
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                tipo_documento: { 
                  type: SchemaType.STRING, 
                  description: "O tipo de documento. Valores permitidos: 'historico', 'vinculo', 'atestado'" 
                }
              },
              required: ["tipo_documento"]
            }
          },
          {
            name: "consultar_matricula",
            description: "Consulta dados da matrícula do aluno pelo atestado de matricula.",
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                termo_busca: { type: SchemaType.STRING, description: "Opcional. Ex: 'dados do atestado', 'matrícula'" }
              }
            }
          },
          {
            name: "buscar_arquivos",
            description: "Gera os botões de download de materiais na tela. Você DEVE acionar esta função sempre que encontrar arquivos no cronograma (após usar consultar_turmas) e o usuário tiver pedido materiais.",
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                nomes_arquivo: { 
                  type: SchemaType.ARRAY, 
                  description: "Lista exata dos nomes de arquivos obtidos previamente no cronograma da turma.", 
                  items: { type: SchemaType.STRING } 
                },
              },
              required: ["nomes_arquivo"]
            }
          },
          {
            name: "baixar_calendario",
            description: "Inicia o download do calendário acadêmico completo em PDF. Use isso apenas se o usuário pedir explicitamente para baixar o calendário inteiro."
          }
        ]
      }]
    });

    this.chatState.chatSession = model.startChat({
      history: [],
    });
  }

  async sendMessage() {
    const text = this.userInput().trim();
    if (!text || this.chatState.isGenerating()) return;

    this.chatState.addMessage({ role: 'user', text });
    this.apiKeyInput.set(''); // limpa input
    this.chatState.isGenerating.set(true);

    this.chatState.addMessage({ role: 'model', text: '' });

    try {
      const dataAtual = new Date().toLocaleDateString('pt-BR');
      const horaAtual = new Date().toLocaleTimeString('pt-BR');
      const promptEnriquecido = `[Data e hora atual do sistema: ${dataAtual} ${horaAtual}]\n${text}`;
      const result = await this.chatState.chatSession!.sendMessageStream(promptEnriquecido);
      await this.processStream(result);
    } catch (error) {
      console.error("Erro no chat:", error);
      this.chatState.appendTextoUltimaMensagem("\n*[Erro de conexão com a IA]*");
    } finally {
      this.chatState.isGenerating.set(false);
    }
    this.userInput.set('');
  }

  private async processStream(result: any) {
    for await (const chunk of result.stream) {
      const functionCalls = chunk.functionCalls();
      if (functionCalls && functionCalls.length > 0) {
        await this.handleFunctionCall(functionCalls[0]);
        return; 
      }

      const chunkText = chunk.text();
      if (chunkText) {
        this.chatState.appendTextoUltimaMensagem(chunkText);
      }
    }
  }

  private async handleFunctionCall(call: FunctionCall) {
    this.updateLastMessage("\n*[Buscando dados no sistema...]*\n");
    
    let functionResponseData = {};

    switch (call.name) {
      case "consultar_calendario":
        try {
          // Busca o calendário local
          const calData = await this.http.get('/calendario.json').toPromise();
          // AQUI VOCÊ PODE FILTRAR BASEADO EM call.args.termo_busca se quiser
          functionResponseData = { resultado: calData }; 
        } catch (e) {
          functionResponseData = { erro: "Não foi possível carregar o calendário." };
        }
        break;
      case "consultar_turmas":
        const turmas = this.sigaaService.turmas().map(t => this.parseTurmaData(t));
        functionResponseData = { resultado: {
            turmas: turmas,
            avaliacoes: this.sigaaService.avaliacoes()
          }
        };
        break;
      case "consultar_notas":
        const notas = this.sigaaService.turmas().map(t => ({
          turma: t.nome,
          notas: t.notas
        }));
        functionResponseData = { resultado: notas };
        break;
      case "consultar_indices":
        const indices = this.sigaaService.indices();
        functionResponseData = { resultado: indices };
        break;
      case "baixar_documento":
        const args = call.args as { tipo_documento: string };
        const tipo = args.tipo_documento;
        try {
          if (tipo === 'historico') {
            const blob = await this.sigaaService.getHistoricoPdf();
            this.baixarBlobNoNavegador(blob, 'Historico_Academico.pdf');
            functionResponseData = { resultado: "Sucesso. Informe ao usuário que o download do histórico foi iniciado." };
            
          } else if (tipo === 'vinculo') {
            const blob = await this.sigaaService.getVinculoPdf();
            this.baixarBlobNoNavegador(blob, 'Declaracao_Vinculo.pdf');
            functionResponseData = { resultado: "Sucesso. Informe ao usuário que o download do vínculo foi iniciado." };
            
          } else if (tipo === 'atestado') {
            functionResponseData = await this.lidarComAtestado(); 
          } else {
            functionResponseData = { erro: "Tipo de documento inválido." };
          }
        } catch (e: any) {
          functionResponseData = { erro: `Falha ao tentar baixar o documento: ${e.message}` };
        }
        break;
      case "consultar_matricula":
        try {
          const dadosMatricula = await this.sigaaService.getAtestadoDados();
          functionResponseData = { resultado: dadosMatricula };
        } catch (e) {
          functionResponseData = { erro: "Não foi possível consultar os dados da matrícula." };
        }
        break;
      case "buscar_arquivos":
        const argsBusca = call.args as { nomes_arquivo: string[] };
        const arquivosEncontrados: { arquivo: Arquivo; turmaNome: string }[] = [];

        const turmasParaBuscar = this.sigaaService.turmas();
        for (const turma of turmasParaBuscar) {
          for (const item of turma.cronograma ?? []) {
            for (const arq of item.arquivos ?? []) {
              if (argsBusca.nomes_arquivo.includes(arq.nome)) {
                arquivosEncontrados.push({ arquivo: arq, turmaNome: turma.nome });
              }
            }
          }
        }

        functionResponseData = { 
          resultado: `Foram encontrados ${arquivosEncontrados.length} arquivos. Já foi dito ao usuário que os botões de download estão logo abaixo.` 
        };

        if (arquivosEncontrados.length > 0) {
          this.chatState.addArquivos(arquivosEncontrados)
        }
        break;
      case "baixar_calendario":
    try {
        const url = this.sigaaService.getCalendarioUrl();
        
        // 1. Baixa o arquivo via fetch
        const response = await fetch(url);
        const blob = await response.blob();
        
        // 2. Cria uma URL temporária local para o arquivo
        const blobUrl = window.URL.createObjectURL(blob);
        
        // 3. Cria o link e dispara o download
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = blobUrl;
        a.download = 'calendario-academico.pdf';
        
        // É boa prática adicionar ao DOM antes de clicar
        document.body.appendChild(a); 
        a.click();
        
        // 4. Limpeza
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl); 

        functionResponseData = { resultado: "Sucesso. Informe ao usuário que o download do calendário foi iniciado." };
    } catch (e) {
        console.error("Erro no download:", e);
        functionResponseData = { erro: "Erro ao baixar o calendário. Pode ser um problema de CORS ou link indisponível." };
    }
    break;
    default:
        functionResponseData = { erro: "Função desconhecida." };
    }

    // Envia a resposta da função de volta para a IA para ela formular a resposta final
    const result = await this.chatState.chatSession!.sendMessageStream([{
      functionResponse: {
        name: call.name,
        response: functionResponseData
      }
    }]);

    // Limpa o aviso de "buscando" e processa a resposta final
    this.chatState.removeBuscando();
    await this.processStream(result);
  }

  // Helpers visuais
  private updateLastMessage(text: string) {
    this.chatState.appendTextoUltimaMensagem(text);
  }

  private scrollToBottom() {
    try {
      this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
    } catch(err) { }
  }

  private parseCronograma(cronograma?: CronogramaItem[]) {
  return cronograma?.map(item => { 
    return {
      titulo: item.titulo, 
      conteudo: item.conteudo, 
      arquivos: item.arquivos?.map(f => ({ id: f.id, nome: f.nome })) 
    }; 
  });
}

  private parseFaltas(faltas: number): string {
    return faltas === -2 ? "Carregando" : faltas === -1 ? "Não lançada" : faltas.toString();
  }

  private parseTurmaData(turma: Turma) {
    const { info, ...rest } = turma;
    return { ...rest, cronograma: this.parseCronograma(rest.cronograma), horarios: formatarHorarios(rest.horarios), faltas: this.parseFaltas(rest.faltas) };
  }

  private baixarBlobNoNavegador(blob: Blob, nomeArquivo: string) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  private async lidarComAtestado() {
    const dados = await this.sigaaService.getAtestadoDados();
      this.atestadoDados.set(dados);
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
    return { resultado: "Sucesso. Informe ao usuário que o download do atestado de matrícula foi iniciado." };
  }

  async baixarArquivo(turmaNome: string, arquivo: Arquivo): Promise<void> {
    const turma = this.sigaaService.turmas().find(t => t.nome === turmaNome);
    if (!turma) {
      alert('Turma não encontrada para baixar o arquivo.');
      return;
    }
    this.downloadingFiles.update(set => {
      const newSet = new Set(set);
      newSet.add(arquivo.id);
      return newSet;
    });

    try {
      await this.sigaaService.baixarArquivoTurma(turma, arquivo);
    } catch (error) {
      console.error('Erro ao baixar o arquivo:', error);
      alert('Erro ao baixar o arquivo.');
    } finally {
      this.downloadingFiles.update(set => {
        const newSet = new Set(set);
        newSet.delete(arquivo.id);
        return newSet;
      });
    }
  }

  async limparConversa() {
    this.chatState.limparHistorico();
    await this.checkApiKey(); 
  }
}