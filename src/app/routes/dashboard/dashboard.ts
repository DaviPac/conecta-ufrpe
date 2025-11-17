import { Component, computed, inject, signal } from '@angular/core';
import { SigaaService } from '../../services/sigaaService/sigaa.service';
import { formatarHorarios } from '../../utils/formatters';
import { Router } from '@angular/router';
import { Noticia, Turma } from '../../models/sigaa.models';

@Component({
  selector: 'app-dashboard',
  imports: [],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private sigaaService: SigaaService = inject(SigaaService);
  private router: Router = inject(Router);
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
}
