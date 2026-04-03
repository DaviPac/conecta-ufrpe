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

export interface Arquivo {
  nome: string;
  chave: string;
  id: string;
}

export interface CronogramaItem {
  titulo: string;
  conteudo: string;
  arquivos?: Arquivo[];
}

export interface TurmaInfo {
  componentId: string;
  formName: string;
  frontEndId: string;
  nome: string;
}

export interface Turma {
  nome: string;
  local: string;
  faltas: number;
  notas?: Notas;
  noticia: Noticia;
  cronograma?: CronogramaItem[];
  horarios: string[];
  info: TurmaInfo;
  isLoaded: boolean;
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
  matricula: string;
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
  anteriores: Array<Notas | null>;
  jsessionid: string;
  viewState: string;
}

export interface TurmaMatricula {
  codigo: string;
  nome: string;
  professor: string;
  local: string;
  tipo: string;
  status: 'MATRICULADO' | 'INDEFERIDO' | string;
  horario: string;
}

export interface AtestadoMatricula {
  periodoLetivo: string;
  matricula: string;
  vinculo: string;
  nome: string;
  nivel: string;
  curso: string;
  turmas: TurmaMatricula[];
  codigoVerificacao: string;
}

export interface ComponenteCurricular {
	codigo: string;
  id: string;
  nome: string;
  cargaHoraria: string;
  tipo: string;  // Obrigatória, Optativa, Complementar
  nivel: string; // Ex: "1", "2", "optativas", "complementares"
  concluida?: boolean;
}

export interface EstruturaCurricular {
	codigo: string;
	matrizCurricular: string;
	periodoVigor: string;
	cargaHorariaTotalMin: string;
	cargaHorariaOptativaMin: string;
	cargaHorariaObrigatoria: string;
	prazoMinimoSemestres: string;
	prazoMedioSemestres: string;
	prazoMaximoSemestres: string;
	componentes: ComponenteCurricular[];
}

export interface MatrizCurricularResponse {
  estruturaCurricular: EstruturaCurricular;
  jsessionid: string;
  viewState: string;
}

export interface DetalhesComponenteResponse {
  componente: DetalhesComponente;
  jsessionid: string;
  viewState: string;
}

export interface DetalhesComponente {
  codigo: string;
  nome: string;
  tipo: string;       // Ex: MÓDULO
  modalidade: string; // Ex: PRESENCIAL
  unidade: string;    // Ex: DEPARTAMENTO DE COMPUTAÇÃO-DC - RECIFE - 11.01.60
  ementa: string;
  cargaHorariaTotal: string; // Ex: 60h
  preRequisitos: string[];
  equivalencias: string[];
}
