export interface Notas {
  codigo: string;
  faltas: string;
  nome: string;
  notas: Record<string, number> | null;
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

export interface Turma {
  nome: string;
  faltas: number;
  notas: Notas;
  noticia: Noticia;
  cronograma: CronogramaItem[];
  horarios: string[];
  [key: string]: any; 
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

// --- Respostas da API ---

/**
 * Resposta do endpoint /login
 */
export interface LoginResponse {
  jsessionid: string;
  viewState: string;
  nome: string; // Adicionado para facilitar
}

/**
 * Resposta do endpoint /main-data
 */
export interface MainDataResponse {
  turmas: Turma[];
  avaliacoes: Avaliacao[];
  nome: string;
  indices: IndicesAcademicos;
  cargaHoraria: CargaHoraria;
  jsessionid: string;
  viewState: string;
}

/**
 * Resposta do endpoint /turma
 */
export interface TurmaDetailResponse {
  turma: Turma;
  jsessionid: string;
  viewState: string;
}

/**
 * Resposta do endpoint /notas
 */
export interface NotasResponse {

  notas: Array<Notas | null>;
  jsessionid: string;
  viewState: string;
}