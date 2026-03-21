import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { SigaaService } from '../../services/sigaaService/sigaa.service';
import { formatarHorarios } from '../../utils/formatters';
import { Router } from '@angular/router';
import { Noticia, Turma } from '../../models/sigaa.models';
import { LinkifyPipe } from '../../utils/linkify.pipe';

interface ActionLink {
  url: string;
  platform: string;
  icon: string;
  label: string;
  colorClass: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [LinkifyPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private sigaaService: SigaaService = inject(SigaaService);
  private router: Router = inject(Router);
  private uid = 0;
  private destroyRef = inject(DestroyRef);

  id = () => this.uid++;
  turmas = this.sigaaService.turmas;
  nome = this.sigaaService.nome;
  avaliacoes = this.sigaaService.avaliacoes
  noticias = computed(() => {
    return this.sigaaService.turmas()
      .filter(t => t.noticia?.titulo)
      .map(t => [t.noticia, t.nome] as [Noticia, string]);
  });
  currentNoticiaIdx = signal(0)
  now = signal(new Date());
  currentNoticia = computed((): [Noticia, string] | null => {
    const noticias = this.noticias();
    const idx = this.currentNoticiaIdx();

    if (!noticias.length) return null;
    return noticias[idx] ?? null;
  });

  actionLinksForCurrentNoticia = computed<ActionLink[]>(() => {
    const noticiaTuple = this.currentNoticia();
    if (!noticiaTuple) return [];
    
    // Junta todos os parágrafos para buscar os links
    const conteudoCompleto = noticiaTuple[0].conteudo.join(' ');
    
    // Regex para extrair URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = conteudoCompleto.match(urlRegex) || [];
    
    const links: ActionLink[] = [];
    const seenUrls = new Set<string>(); // Evita botões duplicados para o mesmo link

    for (let url of matches) {
      // Limpa pontuações que possam ter ficado grudadas no final da URL
      url = url.replace(/[.,;!?)$]+$/, '');
      
      if (seenUrls.has(url)) continue;
      seenUrls.add(url);

      if (url.includes('classroom.google.com')) {
        links.push({ url, platform: 'Classroom', icon: 'pi-book', label: 'Entrar no Classroom', colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' });
      } else if (url.includes('t.me') || url.includes('telegram.org')) {
        links.push({ url, platform: 'Telegram', icon: 'pi-telegram', label: 'Entrar no Telegram', colorClass: 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100' });
      } else if (url.includes('discord.gg') || url.includes('discord.com')) {
        links.push({ url, platform: 'Discord', icon: 'pi-discord', label: 'Entrar no Discord', colorClass: 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100' });
      } else if (url.includes('chat.whatsapp.com')) {
        links.push({ url, platform: 'WhatsApp', icon: 'pi-whatsapp', label: 'Entrar no Grupo', colorClass: 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100' });
      } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
        links.push({ url, platform: 'YouTube', icon: 'pi-youtube', label: 'Assistir Vídeo', colorClass: 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' });
      }
    }

    return links;
  });


  constructor() {
    // Atualiza o relógio interno a cada 60 segundos
    const timer = setInterval(() => this.now.set(new Date()), 60000);
    // Limpa o timer se o componente for destruído (boa prática)
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }


  showNextNoticia() {
    const len = this.noticias().length;
    if (!len) return;

    this.currentNoticiaIdx.update(prev => (prev + 1) % len);
  }

  showPassedNoticia() {
    const len = this.noticias().length;
    if (!len) return;

    this.currentNoticiaIdx.update(prev => (prev - 1 + len) % len);
  }
  noticiasPageStr = computed(() => {
    const currentNoticiaIdx = this.currentNoticiaIdx()
    const noticias = this.noticias()
    const len = noticias.length

    if (!len) return "Nenhuma notícia"

    return `${currentNoticiaIdx + 1}/${len}`
  })
  formatarHorarios = formatarHorarios;
  openTurma = (turma: Turma) => {
    this.sigaaService.currentTurma.set(turma);
    this.sigaaService.currentTurmaIdx.set(this.turmas().findIndex(t => t.nome === turma.nome))
    this.router.navigate(['/turma']);
  };

  dataDeHojeStr = new Intl.DateTimeFormat('pt-BR', { 
    weekday: 'long', 
    day: '2-digit', 
    month: '2-digit' 
  }).format(new Date());

  aulasDeHoje = computed(() => {
    // Usamos this.now() em vez de new Date() para que o Angular saiba que
    // essa função deve ser recalculada a cada minuto!
    const agora = this.now(); 
    const hojeSigaa = (agora.getDay() + 1).toString();
    const horaAtualEmMinutos = agora.getHours() * 60 + agora.getMinutes();

    const startTimes: Record<string, Record<string, number>> = {
      M: { '1': 480, '2': 540, '3': 600, '4': 660, '5': 720 },
      T: { '1': 780, '2': 840, '3': 900, '4': 960, '5': 1020, '6': 1080 },
      N: { '1': 1110, '2': 1160, '3': 1210, '4': 1260 },
    };

    const aulasHoje: any[] = [];

    this.turmas().forEach(turma => {
      if (!turma.horarios) return;

      turma.horarios.forEach(horarioStr => {
        const match = horarioStr.match(/^([2-7]+)([MTN])([1-9]+)$/);
        if (match && match[1].includes(hojeSigaa)) {
          const turno = match[2];
          const periodos = match[3];
          
          const inicioPeriodo = periodos[0]; 
          const fimPeriodo = periodos[periodos.length - 1]; 
          
          const startEmMinutos = startTimes[turno]?.[inicioPeriodo] || 0;
          const startDoUltimo = startTimes[turno]?.[fimPeriodo] || startEmMinutos;
          const duracaoBloco = turno === 'N' ? 50 : 60;
          const endEmMinutos = startDoUltimo + duracaoBloco;

          const isPast = horaAtualEmMinutos > endEmMinutos;
          const isNow = horaAtualEmMinutos >= startEmMinutos && horaAtualEmMinutos <= endEmMinutos;

          let progresso = 0;
          let minutosRestantes = 0;
          let tempoRestanteFormatado = ''; // <-- NOVA VARIÁVEL

          if (isNow) {
            const duracaoTotal = endEmMinutos - startEmMinutos;
            const tempoDecorrido = horaAtualEmMinutos - startEmMinutos;
            progresso = Math.min(100, Math.max(0, (tempoDecorrido / duracaoTotal) * 100));
            minutosRestantes = endEmMinutos - horaAtualEmMinutos;

            // <-- NOVA LÓGICA DE FORMATAÇÃO -->
            if (minutosRestantes >= 60) {
              const horas = Math.floor(minutosRestantes / 60);
              const mins = minutosRestantes % 60;
              tempoRestanteFormatado = mins > 0 ? `${horas}h ${mins}m` : `${horas}h`;
            } else {
              tempoRestanteFormatado = `${minutosRestantes} min`;
            }
          }

          aulasHoje.push({
            turma: turma,
            horarioFormatado: this.formatarHorarios([horarioStr]),
            startMinutos: startEmMinutos,
            isNext: false,
            isPast: isPast,
            isNow: isNow,
            progresso: progresso,
            minutosRestantes: minutosRestantes, 
            tempoRestanteFormatado: tempoRestanteFormatado // <-- ENVIANDO PARA O HTML
          });
        }
      });
    });

    aulasHoje.sort((a, b) => a.startMinutos - b.startMinutos);

    const nextClass = aulasHoje.find(aula => !aula.isPast && !aula.isNow);
    if (nextClass) {
      nextClass.isNext = true;
      
      const minutosAteProxima = nextClass.startMinutos - horaAtualEmMinutos;
      nextClass.minutosAteProxima = minutosAteProxima;
      
      if (minutosAteProxima >= 60) {
        const horas = Math.floor(minutosAteProxima / 60);
        const mins = minutosAteProxima % 60;
        nextClass.tempoAteProximaFormatado = mins > 0 ? `${horas}h ${mins}m` : `${horas}h`;
      } else {
        nextClass.tempoAteProximaFormatado = `${minutosAteProxima} min`;
      }
    }

    return aulasHoje;
  });
}
