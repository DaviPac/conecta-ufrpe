export interface Notas {
  codigo: string;
  faltas: string;
  nome: string;
  notas: Record<string, string> | null;
  resultado: string;
  situacao: string;
}

export interface Noticia {
  titulo: string;
  conteudo: string[];
}

export interface CronogramaItem {
  titulo: string;
  conteudo: string;
}

export interface TurmaInfo {
  componentId: string;
  formName: string;
  frontEndId: string;
  nome: string;
}

export interface Turma {
  nome: string;
  faltas: number;
  notas: Notas;
  noticia: Noticia;
  cronograma: CronogramaItem[];
  horarios: string[];
  info: TurmaInfo;
}

export interface Avaliacao {
  data: string;
  nome: string;
  turmaNome: string;
  tipo: string;
}

export interface IndicesAcademicos {
  mc: string;
  ira: string;
  mcn: string;
  iech: string;
  iepl: string;
  iea: string;
  iean: string;
  iechp: string;
}

export interface CargaHoraria {
  obrigatoriaPendente: string;
  optativaPendente: string;
  totalCurriculo: string;
  complementarPendente: string;
}

export interface LoginResponse {
  jsessionid: string;
}

export interface MainDataResponse {
  turmas: Turma[];
  avaliacoes: Avaliacao[];
  nome: string;
  indices: IndicesAcademicos;
  cargaHoraria: CargaHoraria;
  jsessionid: string;
  viewState: string;
}

export interface TurmaDetailResponse {
  turma: Turma;
  jsessionid: string;
  viewState: string;
}

export interface NotasResponse {
  notas: Array<Notas | null>;
  jsessionid: string;
  viewState: string;
}
