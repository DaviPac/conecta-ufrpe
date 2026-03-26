import {
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
  ElementRef,
  ViewChild,
  effect,
  AfterViewInit,
} from '@angular/core';
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

// Criamos uma interface para facilitar o uso no HTML
interface NoticiaView {
  noticia: Noticia;
  nomeTurma: string;
  links: ActionLink[];
}

@Component({
  selector: 'app-dashboard',
  imports: [LinkifyPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements AfterViewInit {
  private sigaaService: SigaaService = inject(SigaaService);
  private router: Router = inject(Router);
  private uid = 0;
  private destroyRef = inject(DestroyRef);
  private isProgrammaticScroll = false;
  private scrollTimeout: any;

  // Referência ao container que fará o scroll horizontal
  @ViewChild('scrollContainer') scrollContainer!: ElementRef<HTMLDivElement>;

  @ViewChild('aulasContainer') aulasContainer!: ElementRef<HTMLDivElement>;
  private hasScrolledToAula = false;

  fullyLoaded = this.sigaaService.fullyLoaded;
  id = () => this.uid++;
  turmas = this.sigaaService.turmas;
  nome = this.sigaaService.nome;
  avaliacoes = this.sigaaService.avaliacoes;
  noticias = computed<NoticiaView[]>(() => {
    return this.sigaaService
      .turmas()
      .filter((t) => t.noticia?.titulo)
      .map((t) => ({
        noticia: t.noticia as Noticia,
        nomeTurma: t.nome,
        links: this.extrairLinks(t.noticia as Noticia),
      }));
  });

  noticiasComClones = computed<NoticiaView[]>(() => {
    const arr = this.noticias();
    if (arr.length <= 1) return arr;
    return [arr[arr.length - 1], ...arr, arr[0]];
  });

  currentNoticiaIdx = signal(0);
  now = signal(new Date());

  constructor() {
    const timer = setInterval(() => this.now.set(new Date()), 60000);
    this.destroyRef.onDestroy(() => clearInterval(timer));
    effect(() => {
      const temClones = this.noticiasComClones().length > 1;

      if (temClones) {
        setTimeout(() => this.ajustarScrollInicial(), 50);
      }
    });
    effect(() => {
      const aulas = this.aulasDeHoje();
      // O scroll só é disparado se existirem aulas carregadas e ainda não tivermos focado
      if (aulas.length > 0 && !this.hasScrolledToAula) {
        // Usamos setTimeout para dar tempo de o @for renderizar as divs na tela
        setTimeout(() => this.focarAulaAtual(aulas), 100);
      }
    });
  }

  private focarAulaAtual(aulas: any[]) {
    const container = this.aulasContainer?.nativeElement;
    if (!container) return;

    // Em telas Desktop (md:), a listagem vira um grid estático sem overflow.
    // Ignoramos a rolagem nesse caso para evitar quebra de layout.
    if (window.innerWidth >= 768) {
      this.hasScrolledToAula = true;
      return;
    }

    // Acha o índice da aula "Em Andamento" ou da "Próxima"
    const targetIndex = aulas.findIndex(a => a.isNow || a.isNext);

    if (targetIndex !== -1) {
      // Pega exatamente a div HTML da aula correspondente
      const card = container.children[targetIndex] as HTMLElement;
      
      if (card) {
        // Cálculo para deixar o card no meio da tela no Mobile
        const centralizerOffset = (container.clientWidth - card.clientWidth) / 2;
        const scrollPos = card.offsetLeft - container.offsetLeft - centralizerOffset;
        
        container.scrollTo({ left: Math.max(0, scrollPos), behavior: 'smooth' });
      }
    }

    // Trava a flag (mesmo que não encontre aula) para não tentar rolar 
    // novamente a cada minuto quando o relógio (this.now) se atualizar.
    this.hasScrolledToAula = true;
  }

  ngAfterViewInit() {
    this.ajustarScrollInicial();
  }

  private ajustarScrollInicial() {
    const el = this.scrollContainer?.nativeElement;

    // Se a div não existir no HTML ainda, aborta
    if (!el) return;

    const adjust = () => {
      // Se a largura for 0, o layout ainda não foi calculado pelo navegador. Tenta no próximo frame.
      if (el.clientWidth === 0) {
        requestAnimationFrame(adjust);
        return;
      }

      // Se estiver travado no clone inicial (0), teletransporta para a primeira notícia real (1)
      if (el.scrollLeft === 0) {
        this.teleportScroll(1);
      }
    };

    requestAnimationFrame(adjust);
  }

  private extrairLinks(noticia: Noticia): ActionLink[] {
    const conteudoCompleto = noticia.conteudo.join(' ');
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = conteudoCompleto.match(urlRegex) || [];

    const links: ActionLink[] = [];
    const seenUrls = new Set<string>();

    for (let url of matches) {
      url = url.replace(/[.,;!?)$]+$/, '');
      if (seenUrls.has(url)) continue;
      seenUrls.add(url);

      if (url.includes('classroom.google.com')) {
        links.push({
          url,
          platform: 'Classroom',
          icon: 'pi-book',
          label: 'Entrar no Classroom',
          colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
        });
      } else if (url.includes('t.me') || url.includes('telegram.org')) {
        links.push({
          url,
          platform: 'Telegram',
          icon: 'pi-telegram',
          label: 'Entrar no Telegram',
          colorClass: 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100',
        });
      } else if (url.includes('discord.gg') || url.includes('discord.com')) {
        links.push({
          url,
          platform: 'Discord',
          icon: 'pi-discord',
          label: 'Entrar no Discord',
          colorClass: 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100',
        });
      } else if (url.includes('chat.whatsapp.com')) {
        links.push({
          url,
          platform: 'WhatsApp',
          icon: 'pi-whatsapp',
          label: 'Entrar no Grupo',
          colorClass: 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100',
        });
      } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
        links.push({
          url,
          platform: 'YouTube',
          icon: 'pi-youtube',
          label: 'Assistir Vídeo',
          colorClass: 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100',
        });
      }
    }
    return links;
  }

  onScroll(event: Event) {
    if (this.isProgrammaticScroll) return;

    const target = event.target as HTMLElement;
    const realCount = this.noticias().length;

    if (realCount <= 1) return;

    const indexDom = Math.round(target.scrollLeft / target.clientWidth);

    // 1. Atualiza a bolinha ativa instantaneamente para dar feedback ao usuário
    if (indexDom > 0 && indexDom <= realCount) {
      this.currentNoticiaIdx.set(indexDom - 1);
    }

    // 2. O Segredo: Só faz o teletransporte quando o scroll (e a inércia) PARAR.
    clearTimeout(this.scrollTimeout);
    this.scrollTimeout = setTimeout(() => {
      if (indexDom === 0) {
        // Bateu no clone inicial -> Vai pro final real
        this.teleportScroll(realCount);
      } else if (indexDom === realCount + 1) {
        // Bateu no clone final -> Vai pro início real
        this.teleportScroll(1);
      }
    }, 150); // 150ms de silêncio de scroll significa que o snap terminou de "assentar"
  }

  private teleportScroll(targetDomIndex: number) {
    const el = this.scrollContainer.nativeElement;

    // Força o navegador a ignorar qualquer animação CSS no momento do pulo
    el.style.setProperty('scroll-behavior', 'auto', 'important');
    el.style.setProperty('scroll-snap-type', 'none', 'important');

    // Executa o salto matemático
    el.scrollLeft = el.clientWidth * targetDomIndex;

    // Atualiza o estado
    this.currentNoticiaIdx.set(targetDomIndex - 1);

    // O "Pulo do Gato": Usamos 2 requestAnimationFrames seguidos.
    // Isso garante que o navegador primeiro "pinte" a tela na nova posição crua,
    // e SÓ DEPOIS devolva a capacidade de scroll suave e snap.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.removeProperty('scroll-behavior');
        el.style.removeProperty('scroll-snap-type');
      });
    });
  }

  private performSmoothScroll(targetDomIndex: number) {
    const el = this.scrollContainer.nativeElement;
    const realCount = this.noticias().length;

    this.isProgrammaticScroll = true;

    // Atualiza a bolinha imediatamente ao clicar na seta
    if (targetDomIndex > 0 && targetDomIndex <= realCount) {
      this.currentNoticiaIdx.set(targetDomIndex - 1);
    }

    el.scrollTo({ left: el.clientWidth * targetDomIndex, behavior: 'smooth' });

    clearTimeout(this.scrollTimeout);
    this.scrollTimeout = setTimeout(() => {
      this.isProgrammaticScroll = false;

      // Analisa se o scroll programático nos jogou para um clone e ajusta em silêncio
      if (targetDomIndex === 0) {
        this.teleportScroll(realCount);
      } else if (targetDomIndex === realCount + 1) {
        this.teleportScroll(1);
      }
    }, 500); // 600ms é tempo suficiente para a animação do botão ser concluída
  }

  // Seus métodos de clique agora apenas chamam o scroll programático:
  scrollToIndex(realIndex: number) {
    if (this.noticias().length <= 1) return;
    this.performSmoothScroll(realIndex + 1);
  }

  showNextNoticia() {
    if (this.noticias().length <= 1) return;
    this.performSmoothScroll(this.currentNoticiaIdx() + 1 + 1);
  }

  showPassedNoticia() {
    if (this.noticias().length <= 1) return;
    this.performSmoothScroll(this.currentNoticiaIdx() + 1 - 1);
  }

  noticiasPageStr = computed(() => {
    const currentNoticiaIdx = this.currentNoticiaIdx();
    const noticias = this.noticias();
    const len = noticias.length;

    if (!len) return 'Nenhuma notícia';

    return `${currentNoticiaIdx + 1}/${len}`;
  });
  formatarHorarios = formatarHorarios;
  openTurma = (turma: Turma) => {
    this.sigaaService.currentTurma.set(turma);
    this.sigaaService.currentTurmaIdx.set(this.turmas().findIndex((t) => t.nome === turma.nome));
    this.router.navigate(['/turma']);
  };

  dataDeHojeStr = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
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

    this.turmas().forEach((turma) => {
      if (!turma.horarios) return;

      turma.horarios.forEach((horarioStr) => {
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
            tempoRestanteFormatado: tempoRestanteFormatado, // <-- ENVIANDO PARA O HTML
          });
        }
      });
    });

    aulasHoje.sort((a, b) => a.startMinutos - b.startMinutos);

    const nextClass = aulasHoje.find((aula) => !aula.isPast && !aula.isNow);
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
