import { Component, computed, inject, signal } from '@angular/core';
import { SigaaService } from '../../services/sigaaService/sigaa.service';
import { formatarHorarios } from '../../utils/formatters';
import { Router } from '@angular/router';
import { Noticia, Turma } from '../../models/sigaa.models';
import { LinkifyPipe } from '../../utils/linkify.pipe';

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
  currentNoticia = computed((): [Noticia, string] | null => {
    const noticias = this.noticias();
    const idx = this.currentNoticiaIdx();

    if (!noticias.length) return null;
    return noticias[idx] ?? null;
  });
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
    // getDay(): 0 = Dom, 1 = Seg ... 6 = Sáb
    // SIGAA: 1 = Dom, 2 = Seg ... 7 = Sáb
    const hojeSigaa = (new Date().getDay() + 1).toString();
    const agora = new Date();
    const horaAtualEmMinutos = agora.getHours() * 60 + agora.getMinutes();

    // Mapa de minutos do início de cada período baseado no seu utils/formatters
    const startTimes: Record<string, Record<string, number>> = {
      M: { '1': 480, '2': 540, '3': 600, '4': 660, '5': 720 }, // 08:00, 09:00...
      T: { '1': 780, '2': 840, '3': 900, '4': 960, '5': 1020, '6': 1080 }, // 13:00, 14:00...
      N: { '1': 1110, '2': 1160, '3': 1210, '4': 1260 }, // 18:30, 19:20...
    };

    const aulasHoje: any[] = [];

    this.turmas().forEach(turma => {
      if (!turma.horarios) return;

      turma.horarios.forEach(horarioStr => {
        const match = horarioStr.match(/^([2-7]+)([MTN])([1-9]+)$/);
        if (match && match[1].includes(hojeSigaa)) {
          const turno = match[2];
          const inicioPeriodo = match[3][0];
          
          // Pega o horário de início em minutos para poder ordenar e comparar
          const startEmMinutos = startTimes[turno]?.[inicioPeriodo] || 0;

          aulasHoje.push({
            turma: turma,
            horarioFormatado: this.formatarHorarios([horarioStr]),
            startMinutos: startEmMinutos,
            isNext: false, // Será calculado abaixo
            isPast: startEmMinutos < horaAtualEmMinutos // Se já passou da hora de início
          });
        }
      });
    });

    // Ordena as aulas cronologicamente (da mais cedo para a mais tarde)
    aulasHoje.sort((a, b) => a.startMinutos - b.startMinutos);

    // Encontra a primeira aula que AINDA NÃO PASSOU e marca como "Próxima"
    const nextClass = aulasHoje.find(aula => !aula.isPast);
    if (nextClass) {
      nextClass.isNext = true;
    }

    return aulasHoje;
  });
}
