import { Component, computed, inject, OnInit, Signal, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { formatarHorarios, parseFaltas } from '../../utils/formatters';
import { SigaaService } from '../../services/sigaaService/sigaa.service';
import { LinkifyPipe } from '../../utils/linkify.pipe';
import { StudyAssistantComponent } from './study-assistant.component';
import { Arquivo } from '../../models/sigaa.models';
import { TurmaLocalService } from './turma-local.service';
import { ClassroomService } from '../../services/classroomService/classroom.service';
import { ClassroomCourse, ClassroomAssignment, ClassroomAnnouncement, ClassroomTopic, ClassroomMaterial } from '../../services/classroomService/classroom.models';

@Component({
  selector: 'app-turma-detalhes',
  standalone: true,
  imports: [CommonModule, RouterModule, LinkifyPipe, StudyAssistantComponent],
  templateUrl: './turma-detail.html',
})
export class TurmaDetail implements OnInit {
  private sigaaService: SigaaService = inject(SigaaService);
  private router: Router = inject(Router);
  private indexedDbService = inject(TurmaLocalService);
  private classroomService = inject(ClassroomService); // <-- Serviço Injetado

  formatarHorarios = formatarHorarios;
  parseFaltas = parseFaltas;
  Number = Number;
  
  downloadingFiles = signal<Set<string>>(new Set<string>());
  toastMessage = signal<{ text: string, type: 'success' | 'error' } | null>(null);
  
  isEditingLocal = signal(false);
  customLocal = signal<string | null>(null);
  matricula: Signal<string | null> = this.sigaaService.matricula;

  // --- NOVOS SIGNALS PARA O CLASSROOM ---
  linkedClassroomId = signal<string | null>(null);
  classroomCourses = signal<ClassroomCourse[]>([]); // Lista para o dropdown de vínculo
  classroomAssignments = signal<ClassroomAssignment[]>([]); // Atividades da turma
  classroomAnnouncements = signal<ClassroomAnnouncement[]>([]); // Anúncios da turma
  classroomTopics = signal<ClassroomTopic[]>([]); // Tópicos da turma
  classroomMaterials = signal<ClassroomMaterial[]>([]); // Materiais da turma
  isLinkingClassroom = signal(false); // Controle de UI para o modo de vínculo
  isLoadingClassroom = signal(false);
  classroomError = signal<string | null>(null);
  // --------------------------------------

  turma = computed(() => {
    const turmas = this.sigaaService.turmas();
    const idx = this.sigaaService.currentTurmaIdx();
    if (idx === null) return turmas[0];
    return turmas[idx];
  });

  avaliacoesDaTurma = computed(() => {
    const turmaAtual = this.turma();
    const todasAvaliacoes = this.sigaaService.avaliacoes();
    if (!turmaAtual || !todasAvaliacoes) return [];
    return todasAvaliacoes.filter((av) => av.turmaNome === turmaAtual.nome);
  });

  async ngOnInit(): Promise<void> {
    if (this.sigaaService.currentTurmaIdx() === null) {
      this.router.navigate(['/']);
      return;
    }
    
    await this.carregarLocalCustomizado();
    await this.carregarVinculoClassroom(); // <-- Busca o vínculo ao iniciar
  }

  // ==========================================
  // LÓGICA DO LOCAL CUSTOMIZADO (Mantida)
  // ==========================================
  async carregarLocalCustomizado() {
    const turmaId = this.turma()?.nome;
    if (turmaId) {
      const salvo = await this.indexedDbService.getLocalTurma(turmaId);
      this.customLocal.set(salvo || null);
    }
  }

  iniciarEdicaoLocal() { this.isEditingLocal.set(true); }
  cancelarEdicaoLocal() { this.isEditingLocal.set(false); }

  async salvarLocal(novoLocal: string) {
    const valor = novoLocal.trim();
    const turmaId = this.turma()?.nome;
    if (!turmaId) return;

    if (valor === '') {
      await this.removerLocalCustomizado();
      return;
    }

    await this.indexedDbService.salvarLocalTurma(turmaId, valor);
    this.customLocal.set(valor);
    this.isEditingLocal.set(false);
  }

  async removerLocalCustomizado() {
    const turmaId = this.turma()?.nome;
    if (turmaId) {
      await this.indexedDbService.removerLocalTurma(turmaId);
      this.customLocal.set(null);
      this.isEditingLocal.set(false);
    }
  }

  // ==========================================
  // NOVA LÓGICA: INTEGRAÇÃO CLASSROOM
  // ==========================================

  // 1. Verifica se já existe um vínculo salvo no IndexedDB para esta turma do SIGAA
  async carregarVinculoClassroom() {
    const turmaId = this.turma()?.nome;
    if (!turmaId) return;

    const savedClassroomId = await this.indexedDbService.getClassroomId(turmaId);
    if (savedClassroomId) {
      this.linkedClassroomId.set(savedClassroomId);
      this.carregarAtividadesClassroom(savedClassroomId);
      this.carregarAnunciosClassroom(savedClassroomId);
      this.carregarTopicosClassroom(savedClassroomId);
      this.carregarMateriaisClassroom(savedClassroomId);
    }
  }

  // 2. O usuário clicou em "Vincular ao Classroom"
  iniciarVinculoClassroom() {
    const mat = this.matricula();
    if (!mat) {
      this.showToast('Matrícula não encontrada', 'error');
      return;
    }

    this.isLinkingClassroom.set(true);
    this.isLoadingClassroom.set(true);
    this.classroomError.set(null);

    // Busca as turmas do aluno no Google para ele escolher qual é a correspondente
    this.classroomService.getCourses(mat).subscribe({
      next: (courses) => {
        this.classroomCourses.set(courses);
        this.isLoadingClassroom.set(false);
      },
      error: (err) => {
        this.isLoadingClassroom.set(false);
        if (err.status === 401) {
          this.classroomError.set('necessita_login'); // Flag para mostrar botão de login do Google
        } else {
          this.classroomError.set('Erro ao carregar turmas do Google.');
        }
      }
    });
  }

  // 3. O usuário selecionou a turma do Google no dropdown
  async salvarVinculoClassroom(classroomId: string) {
    const turmaId = this.turma()?.nome;
    if (!turmaId) return;

    await this.indexedDbService.salvarClassroomId(turmaId, classroomId);
    this.linkedClassroomId.set(classroomId);
    this.isLinkingClassroom.set(false);
    
    this.showToast('Turma do Google vinculada!', 'success');
    this.carregarAtividadesClassroom(classroomId);
    this.carregarAnunciosClassroom(classroomId);
    this.carregarTopicosClassroom(classroomId);
    this.carregarMateriaisClassroom(classroomId);
  }

  // 4. Remove o vínculo
  async desvincularClassroom() {
    const turmaId = this.turma()?.nome;
    if (!turmaId) return;

    await this.indexedDbService.removerClassroomId(turmaId);
    this.linkedClassroomId.set(null);
    this.classroomAssignments.set([]);
    this.classroomAnnouncements.set([]);
    this.classroomTopics.set([]);
    this.showToast('Vínculo removido.', 'success');
  }

  // 5. Busca as atividades da turma vinculada
  carregarAtividadesClassroom(classroomId: string) {
    const mat = this.matricula();
    if (!mat) return;

    this.isLoadingClassroom.set(true);
    this.classroomService.getAssignments(mat, classroomId).subscribe({
      next: (assignments) => {
        this.classroomAssignments.set(assignments);
        this.isLoadingClassroom.set(false);
      },
      error: (err) => {
        console.error(err);
        this.classroomError.set('Erro ao carregar atividades do Google.');
        this.isLoadingClassroom.set(false);
      }
    });
  }

  carregarAnunciosClassroom(classroomId: string) {
    const mat = this.matricula();
    if (!mat) return;
    
    this.classroomService.getAnnouncements(mat, classroomId).subscribe({
      next: (announcements) => this.classroomAnnouncements.set(announcements),
      error: (err) => {
        console.error(err);
        this.showToast('Erro ao carregar anúncios do Google.', 'error');
      }
    });
  }

  carregarTopicosClassroom(classroomId: string) {
    const mat = this.matricula();
    if (!mat) return;
    
    this.classroomService.getTopics(mat, classroomId).subscribe({
      next: (topics) => this.classroomTopics.set(topics),
      error: (err) => {
        console.error(err);
        this.showToast('Erro ao carregar tópicos do Google.', 'error');
      }
    });
  }

  carregarMateriaisClassroom(classroomId: string) {
    const mat = this.matricula();
    if (!mat) return;
    
    this.classroomService.getMaterials(mat, classroomId).subscribe({
      next: (materials) => this.classroomMaterials.set(materials),
      error: (err) => {
        console.error(err);
        this.showToast('Erro ao carregar materiais do Google.', 'error');
      }
    });
  }

  // 6. Redireciona para login no Google (Caso retorne 401)
  fazerLoginGoogle() {
    const mat = this.matricula();
    if (!mat) return;

    this.classroomService.getGoogleAuthUrl(mat).subscribe({
      next: (res) => {
        window.location.href = res.auth_url;
      },
      error: () => this.showToast('Erro ao gerar URL do Google', 'error')
    });
  }

  // ==========================================
  // GETTERS DO SIGAA (Mantidos)
  // ==========================================
  get hasNotas(): boolean {
    const notas = this.turma()?.notas?.notas;
    return !!notas && Object.keys(notas).length > 0;
  }

  get cargaHorariaTotal(): number {
    const horarios = this.turma()?.horarios || [];
    let aulasSemanais = 0;
    for (const h of horarios) {
      const matches = h.matchAll(/([2-7]+)[MTN]([1-6]+)/g);
      for (const match of matches) {
        aulasSemanais += match[1].length * match[2].length;
      }
    }
    return aulasSemanais * 15;
  }

  get maxFaltas(): number { return this.cargaHorariaTotal * 0.25; }

  get faltasPercent(): number {
    const faltas = this.turma()?.faltas;
    if (faltas === undefined || faltas === -1) return 0;
    const max = this.maxFaltas;
    if (max === 0) return 0;
    const pct = (faltas / max) * 100;
    return pct > 100 ? 100 : pct;
  }

  get faltasRestantes(): number | null {
    const faltas = this.turma()?.faltas;
    if (faltas === undefined || faltas < 0) return null;
    const restantes = this.maxFaltas - faltas;
    return restantes < 0 ? 0 : Math.round(restantes);
  }

  get faltasDisplay(): string | number {
    const faltas = this.turma()?.faltas;
    return faltas !== undefined ? this.parseFaltas(faltas) : 'Não lançada';
  }

  get hasMuitasFaltas(): boolean { return this.faltasPercent > 70; }

  get hasCronograma(): boolean {
    const cronograma = this.turma()?.cronograma;
    return !!cronograma && cronograma.length > 0;
  }

  get isLoading(): boolean { return this.turma() ? !this.turma()!.isLoaded : true; }

  async baixarArquivo(arquivo: Arquivo): Promise<void> {  
    this.downloadingFiles.update(set => new Set(set).add(arquivo.id));
    try {
      await this.sigaaService.baixarArquivoTurma(this.turma(), arquivo);
      this.showToast('Download iniciado!', 'success');
    } catch (err: any) {
      this.showToast('Falha ao baixar: ' + err.message, 'error');
    } finally {
      this.downloadingFiles.update(set => {
        const newSet = new Set(set);
        newSet.delete(arquivo.id);
        return newSet;
      });
    }
  }

  private showToast(text: string, type: 'success' | 'error') {
    this.toastMessage.set({ text, type });
    setTimeout(() => { this.toastMessage.set(null); }, 3000);
  }
}