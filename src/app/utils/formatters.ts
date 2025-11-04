import { Notas } from "../models/sigaa.models";

/**
 * Converte o código de faltas em texto legível.
 */
export function parseFaltas(faltas: number): string | number {
  switch (faltas) {
    case -2: return "carregando...";
    case -1: return "não lançada";
    default: return faltas;
  }
}

/**
 * Formata o objeto de notas em uma string legível.
 */
export function formatarNotas(notasObj: Notas | null | undefined): string {
  if (notasObj === null || notasObj === undefined || !notasObj.notas) {
    return "carregando...";
  }
  
  const entries = Object.entries(notasObj.notas);
  
  if (entries.length === 0) {
    return "Nenhuma nota lançada";
  }
  
  return entries
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');
}

// Em ../utils/formatters.ts

// --- Mapas de Tradução ---
const diasMap: Record<string, string> = {
  '2': 'Seg',
  '3': 'Ter',
  '4': 'Qua',
  '5': 'Qui',
  '6': 'Sex',
  '7': 'Sáb',
};

const turnoMap: Record<string, string> = {
  'M': 'Manhã',
  'T': 'Tarde',
  'N': 'Noite',
};

// --- (Seus imports e funções parseFaltas/formatarNotas existentes) ---
// ...
// ...


// ===================================================================
//          INÍCIO DA LÓGICA DE FORMATAÇÃO DE HORÁRIOS
// ===================================================================

interface HorarioDetalhado {
  start: string;
  end: string;
}

/**
 * -----------------------------------------------------------------
 * ⬇️ AJUSTE ESTE MAPA COM OS HORÁRIOS CORRETOS DA SUA INSTITUIÇÃO ⬇️
 * -----------------------------------------------------------------
 * Mapeia Turno + Período para um horário de início e fim.
 * Ex: 'M1' => Manhã, 1º horário
 * 'T3' => Tarde, 3º horário
 */
const horariosMap: Record<string, Record<string, HorarioDetalhado>> = {
  'M': {
    '1': { start: '08:00', end: '08:50' },
    '2': { start: '09:00', end: '09:50' },
    '3': { start: '10:00', end: '10:50' },
    '4': { start: '11:00', end: '11:50' },
    '5': { start: '12:00', end: '12:50' },
  },
  'T': {
    '1': { start: '13:00', end: '14:00' },
    '2': { start: '14:00', end: '15:00' },
    '3': { start: '15:00', end: '16:00' },
    '4': { start: '16:00', end: '17:00' },
    '5': { start: '17:00', end: '18:00' },
  },
  'N': {
    '1': { start: '19:00', end: '19:50' },
    '2': { start: '20:00', end: '20:50' },
    '3': { start: '21:00', end: '21:50' },
    '4': { start: '22:00', end: '22:50' },
  },
};

/**
 * Formata uma única string de horário (ex: "24T34")
 * para um formato legível (ex: "Seg, Qua (15:00 - 16:50)")
 */
function parseHorarioString(horarioStr: string): string {
  const regex = /^([2-7]+)([MTN])([1-9]+)$/;
  const match = horarioStr.match(regex);

  if (!match) {
    return horarioStr; // Retorna original se não bater com o padrão
  }

  const [, diasStr, turnoStr, horasStr] = match;

  // Formata os dias: "24" -> "Seg, Qua"
  const diasFormatados = diasStr
    .split('')
    .map(dia => diasMap[dia] || '?')
    .join(', ');

  // --- Lógica de busca de horário ---
  
  // Pega o primeiro e o último período. Ex: "345" -> '3' e '5'
  const primeiroPeriodo = horasStr[0];
  const ultimoPeriodo = horasStr[horasStr.length - 1];

  // Busca os horários no mapa
  const turnoHorarios = horariosMap[turnoStr];
  const horarioInicio = turnoHorarios?.[primeiroPeriodo]?.start;
  const horarioFim = turnoHorarios?.[ultimoPeriodo]?.end;

  // Se encontrou início e fim, formata (Ex: "Seg, Qua (15:00 - 16:50)")
  if (horarioInicio && horarioFim) {
    return `${diasFormatados} (${horarioInicio} - ${horarioFim})`;
  }

  // --- Fallback (se não encontrar no mapa) ---
  // Se falhar, retorna o formato antigo (Ex: "Seg, Qua Tarde (3, 4)")
  const turnoFormatado = turnoMap[turnoStr] || '?';
  const horasFormatadas = horasStr.split('').join(', ');
  
  return `${diasFormatados} ${turnoFormatado} (${horasFormatadas})`;
}

/**
 * Formata o array de horários da turma para exibição.
 */
export function formatarHorarios(horarios: string[] | undefined | null): string {
  if (!horarios || horarios.length === 0) {
    return 'Horário não definido';
  }

  // Mapeia cada string de horário (ex: "24T34") para seu formato legível
  // e junta todas as strings com " / " caso haja mais de uma.
  return horarios.map(parseHorarioString).join(' / ');
}

// ===================================================================
//          FIM DA LÓGICA DE FORMATAÇÃO DE HORÁRIOS
// ===================================================================

export function parseDataHora(str: string): Date {
  const limpo = str.replace(/\s*\(.*\)\s*/g, "").trim();
  const [dataStr, horaStr] = limpo.split(" ");

  const [dia, mes, ano] = dataStr.split("/").map(Number);

  let hora = 0;
  let minuto = 0;

  if (horaStr) {
    [hora, minuto] = horaStr.split(":").map(Number);
  }

  return new Date(ano, mes - 1, dia, hora, minuto);
}