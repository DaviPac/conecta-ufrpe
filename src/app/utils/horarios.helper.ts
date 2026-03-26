// Adicione este computed no seu component TypeScript
// Ele gera as linhas da tabela de horários a partir dos dados das turmas

// Estrutura de uma linha da tabela
interface LinhaHorario {
  faixa: string;
  slots: string[]; // [dom, seg, ter, qua, qui, sex, sab]
}

/**
 * Mapeamento de turno/dia: a string de horário do SIGAA segue o padrão:
 *   <dia><turno><aulas>  ex: "4T45" = Quarta, Tarde, aulas 4 e 5
 *
 * Dias: 2=Seg 3=Ter 4=Qua 5=Qui 6=Sex 7=Sab
 * Turnos: M=Manhã T=Tarde N=Noite
 * Aulas:
 *   M: 1=07-08 2=08-09 3=09-10 4=10-11 5=11-12 6=12-13
 *   T: 1=13-14 2=14-15 3=15-16 4=16-17 5=17-18 6=18-19
 *   N: 1=18:30-19:20 2=19:20-20:10 3=20:10-21:00 4=21:00-21:50
 */

// Faixas horárias exibidas (na ordem da tabela)
const FAIXAS_MANHA = [
  '07:00 -\n08:00',
  '08:00 -\n09:00',
  '09:00 -\n10:00',
  '10:00 -\n11:00',
  '11:00 -\n12:00',
  '12:00 -\n13:00',
];
const FAIXAS_TARDE = [
  '13:00 -\n14:00',
  '14:00 -\n15:00',
  '15:00 -\n16:00',
  '16:00 -\n17:00',
  '17:00 -\n18:00',
  '18:00 -\n19:00',
];
const FAIXAS_NOITE = ['18:30 -\n19:20', '19:20 -\n20:10', '20:10 -\n21:00', '21:00 -\n21:50'];
export const TODAS_FAIXAS = [...FAIXAS_MANHA, ...FAIXAS_TARDE, ...FAIXAS_NOITE];

// Índice de faixa por turno+aula (0-based dentro de TODAS_FAIXAS)
const FAIXA_INDEX: Record<string, number> = {
  M1: 0,
  M2: 1,
  M3: 2,
  M4: 3,
  M5: 4,
  M6: 5,
  T1: 6,
  T2: 7,
  T3: 8,
  T4: 9,
  T5: 10,
  T6: 11,
  N1: 12,
  N2: 13,
  N3: 14,
  N4: 15,
};

// Índice de coluna por dia (0=Dom … 6=Sab)
const DIA_INDEX: Record<string, number> = {
  '2': 1, // Seg
  '3': 2, // Ter
  '4': 3, // Qua
  '5': 4, // Qui
  '6': 5, // Sex
  '7': 6, // Sab
};

/**
 * Gera a tabela de horários a partir das turmas matriculadas.
 * Use como computed() no componente Angular:
 *
 *   tabelaHorarios = computed(() => buildTabelaHorarios(this.atestadoDados()?.turmas ?? []));
 */
export function buildTabelaHorarios(turmas: { codigo: string; horario: string }[]): LinhaHorario[] {
  // grade[faixaIdx][colIdx] = codigo da turma (ou '---')
  const grade: string[][] = TODAS_FAIXAS.map(() => Array(7).fill('---'));

  for (const turma of turmas) {
    // "3T45 6T23" → ['3T45', '6T23']
    const tokens = turma.horario
      .replace(/\s*\(.*?\)/g, '')
      .trim()
      .split(/\s+/);

    for (const token of tokens) {
      // token ex: "3T45"  dia=3, turno=T, aulas=[4,5]
      const match = token.match(/^(\d)([MTN])(\d+)/);
      if (!match) continue;
      const [, dia, turno, aulasStr] = match;
      const colIdx = DIA_INDEX[dia];
      if (colIdx === undefined) continue;

      for (const aulaChar of aulasStr) {
        const faixaKey = `${turno}${aulaChar}`;
        const faixaIdx = FAIXA_INDEX[faixaKey];
        if (faixaIdx === undefined) continue;
        grade[faixaIdx][colIdx] = turma.codigo;
      }
    }
  }

  return TODAS_FAIXAS.map((faixa, i) => ({ faixa, slots: grade[i] }));
}

// ──────────────────────────────────────────────────────────────────────────────
// No seu componente Angular, adicione:
//
//   tabelaHorarios = computed(() =>
//     buildTabelaHorarios(this.atestadoDados()?.turmas ?? [])
//   );
// ──────────────────────────────────────────────────────────────────────────────
