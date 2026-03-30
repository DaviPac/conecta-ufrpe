import { Component, OnInit, inject, signal, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { GoogleGenerativeAI, ChatSession, FunctionCall, SchemaType } from '@google/generative-ai';
// Importe o seu repositório corretamente
import { StudyRepository } from '../turma-detail/study.repository'; 
import { MarkdownModule } from 'ngx-markdown';
import { SigaaService } from '../../services/sigaaService/sigaa.service';
import { CronogramaItem, Turma, TurmaInfo } from '../../models/sigaa.models';
import { formatarHorarios } from '../../utils/formatters';

interface ChatMessage {
  role: 'user' | 'model' | 'system';
  text: string;
}

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

  @ViewChild('chatContainer') private chatContainer!: ElementRef;

  // Estados
  hasApiKey = signal<boolean>(false);
  apiKeyInput = signal<string>('');
  
  messages = signal<ChatMessage[]>([{ role: 'system', text: 'Olá! Sou seu assistente do SIGAA Lite. Como posso ajudar com suas aulas hoje?' }]);
  userInput = signal<string>('');
  isGenerating = signal<boolean>(false);

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
      this.hasApiKey.set(true);
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
    this.genAI = new GoogleGenerativeAI(apiKey);
    
    // Configuração do modelo e das ferramentas (Function Calling)
    const model = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash", // Use a versão mais recente/rápida para chats
      systemInstruction: `Você é o assistente virtual de alunos do SIGAA Lite. 
      Siga estas regras estritamente:
      1. Seja direto, conciso e amigável.
      2. Quando consultar o calendário, responda APENAS o que o usuário perguntou.
      3. TRADUÇÃO DE TERMOS: Para os alunos, "férias" ou "recesso" também significa o intervalo entre o fim de um semestre letivo e o início do próximo. Se perguntarem sobre "próximas férias", SEMPRE verifique primeiro quando o semestre atual termina e informe esse período de descanso.
      4. NUNCA liste todos os feriados ou datas do ano, a menos que o usuário peça.
      5. Se o usuário perguntar sobre "recesso" e não houver essa palavra no calendário, informe de forma resumida apenas as férias discentes mais próximas.
      6. Você está falando com um DISCENTE. Não forneça informações sobre DOSCENTES a menos que seja explicitamente solicitado.
      7. Use negrito para destacar datas importantes.`,
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
            description: "Consulta as turmas disponíveis para o aluno e seus dados, como cronograma e avaliações.",
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
          }
        ]
      }]
    });

    this.chatSession = model.startChat({
      history: [],
    });
  }

  async sendMessage() {
    const text = this.userInput().trim();
    if (!text || this.isGenerating()) return;

    this.messages.update(m => [...m, { role: 'user', text }]);
    this.userInput.set('');
    this.isGenerating.set(true);

    this.messages.update(m => [...m, { role: 'model', text: '' }]);

    try {
      const dataAtual = new Date().toLocaleDateString('pt-BR');
      const horaAtual = new Date().toLocaleTimeString('pt-BR');
      const promptEnriquecido = `[Data e hora atual do sistema: ${dataAtual} ${horaAtual}]\n${text}`;
      const result = await this.chatSession.sendMessageStream(promptEnriquecido);
      await this.processStream(result);
    } catch (error) {
      console.error("Erro no chat:", error);
      this.updateLastMessage("\n*[Erro de conexão com a IA]*");
    } finally {
      this.isGenerating.set(false);
    }
  }

  private async processStream(result: any) {
    for await (const chunk of result.stream) {
      // 1. Verifica se a IA decidiu chamar uma função
      const functionCalls = chunk.functionCalls();
      if (functionCalls && functionCalls.length > 0) {
        await this.handleFunctionCall(functionCalls[0]);
        return; // Interrompe este fluxo pois a função retomará a conversa
      }

      // 2. Se for texto normal, adiciona via Stream
      const chunkText = chunk.text();
      if (chunkText) {
        this.updateLastMessage(chunkText);
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
      default:
        functionResponseData = { erro: "Função desconhecida." };
    }

    // Envia a resposta da função de volta para a IA para ela formular a resposta final
    const result = await this.chatSession.sendMessageStream([{
      functionResponse: {
        name: call.name,
        response: functionResponseData
      }
    }]);

    // Limpa o aviso de "buscando" e processa a resposta final
    this.replaceLastMessage(""); 
    await this.processStream(result);
  }

  // Helpers visuais
  private updateLastMessage(text: string) {
    this.messages.update(m => {
      const newMessages = [...m];
      const lastIndex = newMessages.length - 1;
      newMessages[lastIndex].text += text;
      return newMessages;
    });
  }

  private replaceLastMessage(text: string) {
    this.messages.update(m => {
      const newMessages = [...m];
      newMessages[newMessages.length - 1].text = text;
      return newMessages;
    });
  }

  private scrollToBottom() {
    try {
      this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
    } catch(err) { }
  }

  private parseCronograma(cronograma?: CronogramaItem[]) {
    return cronograma?.map(item => { return {titulo: item.titulo, conteudo: item.conteudo, arquivos: item.arquivos?.map(f => f.nome) } });
  }

  private parseTurmaData(turma: Turma) {
    const { info, ...rest } = turma;
    return { ...rest, cronograma: this.parseCronograma(rest.cronograma), horarios: formatarHorarios(rest.horarios) };
  }
}