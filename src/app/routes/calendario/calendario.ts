import { Component, computed, inject, OnInit, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SigaaService } from '../../services/sigaaService/sigaa.service';
import { Turma } from '../../models/sigaa.models';
import { PdfViewerModule } from 'ng2-pdf-viewer';

// ─── Tipos internos ────────────────────────────────────────────────────────

export type AbaCalendario = 'semana' | 'mensal' | 'academico';

/** Cor semântica atribuída a cada turma */
const CORES_TURMA: string[] = ['blue', 'teal', 'amber', 'purple', 'coral', 'green', 'pink'];

export interface AulaSlot {
  turma: Turma;
  horarioFormatado: string;
  inicio: string; // "HH:MM"
  fim: string; // "HH:MM"
  cor: string;
}

/** Mapa: dia (0=Dom … 6=Sáb) → slots de aula */
export type GradeSemanal = Map<number, AulaSlot[]>;

/**
 * Slots fixos de horário — linhas da grade semanal.
 * Derivados do horariosMap usado em formatarHorarios():
 *   M1–M5 | T1–T6 | N1–N4
 */
export const SLOTS_HORARIO = [
  { label: '08:00', inicio: '08:00', fim: '08:50', turno: 'M', periodo: '1' },
  { label: '09:00', inicio: '09:00', fim: '09:50', turno: 'M', periodo: '2' },
  { label: '10:00', inicio: '10:00', fim: '10:50', turno: 'M', periodo: '3' },
  { label: '11:00', inicio: '11:00', fim: '11:50', turno: 'M', periodo: '4' },
  { label: '12:00', inicio: '12:00', fim: '12:50', turno: 'M', periodo: '5' },
  { label: '13:00', inicio: '13:00', fim: '14:00', turno: 'T', periodo: '1' },
  { label: '14:00', inicio: '14:00', fim: '15:00', turno: 'T', periodo: '2' },
  { label: '15:00', inicio: '15:00', fim: '16:00', turno: 'T', periodo: '3' },
  { label: '16:00', inicio: '16:00', fim: '17:00', turno: 'T', periodo: '4' },
  { label: '17:00', inicio: '17:00', fim: '18:00', turno: 'T', periodo: '5' },
  { label: '18:00', inicio: '18:00', fim: '19:00', turno: 'T', periodo: '6' },
  { label: '18:30', inicio: '18:30', fim: '19:20', turno: 'N', periodo: '1' },
  { label: '19:20', inicio: '19:20', fim: '20:10', turno: 'N', periodo: '2' },
  { label: '20:10', inicio: '20:10', fim: '21:00', turno: 'N', periodo: '3' },
  { label: '21:00', inicio: '21:00', fim: '21:50', turno: 'N', periodo: '4' },
];

// Dias exibidos (seg a sáb)
export const DIAS_SEMANA = [
  { label: 'Seg', jsDay: 1 },
  { label: 'Ter', jsDay: 2 },
  { label: 'Qua', jsDay: 3 },
  { label: 'Qui', jsDay: 4 },
  { label: 'Sex', jsDay: 5 },
  { label: 'Sáb', jsDay: 6 },
];

const MESES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];
const MESES_CURTO = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Parseia o array turma.horarios (ex: ["24T34", "6M12"]) e devolve
 * uma lista de { jsDay, slotIdx } para posicionar na grade semanal.
 *
 * Formato de cada string: <dias><turno><períodos>
 *   dias    → um ou mais dígitos 2–7 (2=Seg … 7=Sáb)
 *   turno   → M | T | N
 *   períodos → um ou mais dígitos indicando quais aulas do turno
 *
 * Exemplos: "24T34" = Seg+Qua, Tarde slots 3 e 4
 *           "6M12"  = Sáb, Manhã slots 1 e 2
 */
function parsearHorarios(horarios: string[]): { jsDay: number; turno: string; periodo: string }[] {
  // Dia SIGAA → jsDay (0=Dom, 1=Seg …)
  const diaParaJs: Record<string, number> = {
    '2': 1,
    '3': 2,
    '4': 3,
    '5': 4,
    '6': 5,
    '7': 6,
  };

  const results: { jsDay: number; turno: string; periodo: string }[] = [];
  const regex = /^([2-7]+)([MTN])([1-9]+)$/;

  for (const horarioStr of horarios) {
    const match = horarioStr.trim().match(regex);
    if (!match) continue;

    const [, diasStr, turno, periodosStr] = match;

    for (const diaChar of diasStr) {
      const jsDay = diaParaJs[diaChar];
      if (jsDay === undefined) continue;

      for (const periodoChar of periodosStr) {
        results.push({ jsDay, turno, periodo: periodoChar });
      }
    }
  }

  return results;
}

/** Encontra o índice em SLOTS_HORARIO pelo turno+período */
function slotIdxPorTurnoPeriodo(turno: string, periodo: string): number {
  return SLOTS_HORARIO.findIndex((s) => s.turno === turno && s.periodo === periodo);
}

/** Retorna o início e fim formatados de um slot */
function slotParaHorario(slotIdx: number): {
  inicio: string;
  fim: string;
  horarioFormatado: string;
} {
  const s = SLOTS_HORARIO[slotIdx];
  if (!s) return { inicio: '', fim: '', horarioFormatado: '' };
  return { inicio: s.inicio, fim: s.fim, horarioFormatado: `${s.inicio} – ${s.fim}` };
}

// ─── Componente ────────────────────────────────────────────────────────────

@Component({
  selector: 'app-calendario',
  standalone: true,
  imports: [CommonModule, PdfViewerModule],
  templateUrl: './calendario.html',
})
export class Calendario implements OnInit {
  private sigaaService = inject(SigaaService);

  // ── Estado da aba ──────────────────────────────────────────────────────
  abaAtiva: WritableSignal<AbaCalendario> = signal('semana');

  // ── Estado do PDF (aba Acadêmico) ─────────────────────────────────────
  carregando: WritableSignal<boolean> = signal(false);
  erro: WritableSignal<boolean> = signal(false);
  pdfSrc: WritableSignal<Uint8Array | null> = signal(null);
  rawUrlSignal: WritableSignal<string> = signal('');
  isDownloading: WritableSignal<boolean> = signal(false);

  // ── Estado do calendário mensal ───────────────────────────────────────
  calMes: WritableSignal<number> = signal(new Date().getMonth());
  calAno: WritableSignal<number> = signal(new Date().getFullYear());
  diaSelecionado: WritableSignal<number> = signal(new Date().getDate());

  // Hoje
  readonly hoje = new Date();
  readonly hojeAno = this.hoje.getFullYear();
  readonly hojeMes = this.hoje.getMonth();
  readonly hojeDia = this.hoje.getDate();
  readonly hojeDiaSemana = this.hoje.getDay(); // 0=Dom

  // ── Constantes expostas ao template ──────────────────────────────────
  readonly SLOTS_HORARIO = SLOTS_HORARIO;
  readonly DIAS_SEMANA = DIAS_SEMANA;
  readonly MESES_PT = MESES_PT;
  readonly MESES_CURTO = MESES_CURTO;

  // ── Computed: grade semanal ───────────────────────────────────────────
  gradeSemanal = computed<GradeSemanal>(() => {
    const turmas = this.sigaaService.turmas();
    const grade = new Map<number, AulaSlot[]>();
    DIAS_SEMANA.forEach((d) => grade.set(d.jsDay, []));

    turmas.forEach((turma, idx) => {
      const cor = CORES_TURMA[idx % CORES_TURMA.length];
      const horarios: string[] = turma.horarios ?? [];
      const ocorrencias = parsearHorarios(horarios);

      ocorrencias.forEach(({ jsDay, turno, periodo }) => {
        const slotIdx = slotIdxPorTurnoPeriodo(turno, periodo);
        if (slotIdx === -1) return;

        const { inicio, fim, horarioFormatado } = slotParaHorario(slotIdx);
        const aulas = grade.get(jsDay) ?? [];
        // Evita duplicata no mesmo slot
        if (!aulas.some((a) => a.turma.nome === turma.nome && a.inicio === inicio)) {
          aulas.push({ turma, horarioFormatado, inicio, fim, cor });
          grade.set(jsDay, aulas);
        }
      });
    });

    return grade;
  });

  /** Legenda de cores: uma entrada por turma */
  legendaCores = computed(() => {
    return this.sigaaService.turmas().map((turma, idx) => ({
      turma,
      cor: CORES_TURMA[idx % CORES_TURMA.length],
    }));
  });

  // ── Computed: dias do mês para o calendário ───────────────────────────
  diasDoMes = computed(() => {
    const ano = this.calAno();
    const mes = this.calMes();
    const primeiroDia = new Date(ano, mes, 1).getDay();
    const totalDias = new Date(ano, mes + 1, 0).getDate();
    const diasAnterior = new Date(ano, mes, 0).getDate();

    const dias: { dia: number; mesAtual: boolean; temAula: boolean }[] = [];

    // Dias do mês anterior
    for (let i = primeiroDia - 1; i >= 0; i--) {
      dias.push({ dia: diasAnterior - i, mesAtual: false, temAula: false });
    }

    // Dias do mês atual
    for (let d = 1; d <= totalDias; d++) {
      const date = new Date(ano, mes, d);
      const jsDay = date.getDay();
      const temAula = (this.gradeSemanal().get(jsDay)?.length ?? 0) > 0;
      dias.push({ dia: d, mesAtual: true, temAula });
    }

    // Completar até múltiplo de 7
    const restante = 7 - (dias.length % 7);
    if (restante < 7) {
      for (let d = 1; d <= restante; d++) {
        dias.push({ dia: d, mesAtual: false, temAula: false });
      }
    }

    return dias;
  });

  /** Aulas do dia selecionado no calendário mensal */
  aulasDodiaSelecionado = computed<AulaSlot[]>(() => {
    const ano = this.calAno();
    const mes = this.calMes();
    const dia = this.diaSelecionado();
    const jsDay = new Date(ano, mes, dia).getDay();
    const aulas = this.gradeSemanal().get(jsDay) ?? [];
    return [...aulas].sort((a, b) => a.inicio.localeCompare(b.inicio));
  });

  /** Célula da grade: retorna a aula naquele dia+slot, ou null */
  aulaEmSlot(jsDay: number, slotIdx: number): AulaSlot | null {
    const aulas = this.gradeSemanal().get(jsDay) ?? [];
    const slot = SLOTS_HORARIO[slotIdx];
    if (!slot) return null;
    return aulas.find((a) => a.inicio === slot.inicio) ?? null;
  }

  // ── Aba Acadêmico: PDF ────────────────────────────────────────────────
  async ngOnInit() {
    await this.carregarPdf();
  }

  async carregarPdf() {
    this.carregando.set(true);
    this.erro.set(false);
    try {
      const url = this.sigaaService.getCalendarioUrl();
      this.rawUrlSignal.set(url);
      const res = await fetch(url, {
        headers: { Authorization: 'Bearer ' + (this.sigaaService as any).jsessionid() },
      });
      if (!res.ok) throw new Error('Falha ao buscar PDF');
      const arrayBuffer = await res.arrayBuffer();
      this.pdfSrc.set(new Uint8Array(arrayBuffer));
    } catch {
      this.erro.set(true);
    } finally {
      this.carregando.set(false);
    }
  }

  recarregar() {
    this.carregarPdf();
  }

  abrirNoNavegador() {
    if (this.rawUrlSignal()) window.open(this.rawUrlSignal(), '_blank');
  }

  async baixarPdf() {
    if (this.isDownloading()) return;
    this.isDownloading.set(true);
    try {
      const url = await this.sigaaService.getOgCalendarioUrl();
      const a = document.createElement('a');
      a.href = url;
      a.download = 'calendario-academico.pdf';
      a.click();
    } catch (e) {
      alert('Erro ao baixar PDF.');
    } finally {
      this.isDownloading.set(false);
    }
  }

  // ── Helpers de calendário mensal ──────────────────────────────────────
  mesAnoLabel = computed(() => `${MESES_PT[this.calMes()]} ${this.calAno()}`);

  mudarMes(delta: number) {
    let m = this.calMes() + delta;
    let a = this.calAno();
    if (m < 0) {
      m = 11;
      a--;
    }
    if (m > 11) {
      m = 0;
      a++;
    }
    this.calMes.set(m);
    this.calAno.set(a);
  }

  selecionarDia(dia: number) {
    this.diaSelecionado.set(dia);
  }

  eHoje(dia: number, mesAtual: boolean): boolean {
    return (
      mesAtual &&
      dia === this.hojeDia &&
      this.calMes() === this.hojeMes &&
      this.calAno() === this.hojeAno
    );
  }

  eSelecionado(dia: number, mesAtual: boolean): boolean {
    return mesAtual && dia === this.diaSelecionado();
  }

  diaSelecionadoLabel = computed(() => {
    const d = this.diaSelecionado();
    const m = MESES_CURTO[this.calMes()];
    return `${d} de ${m}`;
  });

  // ── Nome curto da turma para o pill da grade ──────────────────────────
  nomeCurto(nome: string): string {
    if (nome.length <= 22) return nome;
    return nome.slice(0, 20) + '…';
  }

  // ── Dia da semana de hoje para highlight na grade ─────────────────────
  isHoje(jsDay: number): boolean {
    return jsDay === this.hojeDiaSemana;
  }

  // ── Label da data para o header da grade semanal ─────────────────────
  datasDaSemana = computed(() => {
    const hoje = new Date();
    // Início da semana atual (segunda)
    const diaSemana = hoje.getDay(); // 0=Dom
    const diffParaSeg = diaSemana === 0 ? -6 : 1 - diaSemana;
    const seg = new Date(hoje);
    seg.setDate(hoje.getDate() + diffParaSeg);

    return DIAS_SEMANA.map((d, i) => {
      const dt = new Date(seg);
      dt.setDate(seg.getDate() + i);
      return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
    });
  });
}
