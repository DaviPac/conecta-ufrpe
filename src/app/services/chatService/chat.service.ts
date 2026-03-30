import { Injectable, signal } from '@angular/core';
import { ChatSession, GoogleGenerativeAI } from '@google/generative-ai';
import { Arquivo } from '../../models/sigaa.models'; // Ajuste o caminho

export interface ChatMessage {
  role: 'user' | 'model' | 'system';
  text: string;
  arquivosAnexos?: { arquivo: Arquivo; turmaNome: string }[];
}

@Injectable({
  providedIn: 'root' // Isso garante que o serviço sobreviva às trocas de rota
})
export class ChatStateService {
  // Estados que precisam persistir
  hasApiKey = signal<boolean>(false);
  messages = signal<ChatMessage[]>([{ 
    role: 'system', 
    text: 'Olá! Sou seu assistente do SIGAA Lite. Como posso ajudar hoje?' 
  }]);
  isGenerating = signal<boolean>(false);

  // Instâncias da IA
  genAI: GoogleGenerativeAI | null = null;
  chatSession: ChatSession | null = null;

  // Helpers para facilitar a atualização das mensagens
  addMessage(message: ChatMessage) {
    this.messages.update(m => [...m, message]);
  }

  appendTextoUltimaMensagem(text: string) {
    this.messages.update(m => {
      const newMessages = [...m];
      const lastIndex = newMessages.length - 1;
      newMessages[lastIndex].text += text;
      return newMessages;
    });
  }

  replaceTextoUltimaMensagem(text: string) {
    this.messages.update(m => {
      const newMessages = [...m];
      newMessages[newMessages.length - 1].text = text;
      return newMessages;
    });
  }

  removeBuscando() {
    this.messages.update(m => {
      const newMessages = [...m];
      const lastIndex = newMessages.length - 1;
      newMessages[lastIndex].text = newMessages[lastIndex].text.replace("\n*[Buscando dados no sistema...]*\n", "");
      return newMessages;
    });
  }

  addArquivos(arquivosEncontrados: { arquivo: Arquivo; turmaNome: string }[]) {
    this.messages.update(m => {
        const newMessages = [...m];
        newMessages[newMessages.length - 1].arquivosAnexos = arquivosEncontrados;
        return newMessages;
    });
  }

  sendMessageStream(messages: any[]) {
    this.chatSession?.sendMessageStream(messages);
  }

  limparHistorico() {
    this.messages.set([{ 
      role: 'system', 
      text: 'Olá! Sou seu assistente do SIGAA Lite. Como posso ajudar hoje?' 
    }]);
    this.chatSession = null; 
  }
}