import { useState } from 'react';
import { type Turma } from '../interfaces/sigaa';
import TurmaDetail from './TurmaDetail';
import { parseDataHora, formatarNotas, parseFaltas, formatarHorarios } from '../utils/formatters';
import { useSigaa } from '../contexts/SigaaContext';
import { IndicesAcademicosComponent } from './IndicesAcademicos';
import { CargaHorariaComponent } from './CargaHoraria';

function CalendarPDF() {
	// Estado para o PDF
	const [pdfUrl, setPdfUrl] = useState<string | undefined>();
	// Estado para controlar se o painel está aberto ou fechado
	const [isOpen, setIsOpen] = useState(false);
	// Estado para feedback de carregamento
	const [isLoading, setIsLoading] = useState(false);
	// Estado para exibir erros
	const [error, setError] = useState<string | null>(null);

	/**
	 * Função chamada ao clicar no botão.
	 * Ela alterna a visibilidade e busca o PDF na primeira vez.
	 */
	const handleToggle = async () => {
		// Caso 1: Se estiver fechado e ainda NÃO tivermos o PDF
		if (!isOpen && !pdfUrl) {
			setIsLoading(true);
			setError(null);
			try {
				// Busca o PDF no seu backend (que deve estar com CORS habilitado)
				const response = await fetch("http://localhost:8080/calendario");
				if (!response.ok) {
					throw new Error('Falha ao buscar o calendário. Verifique o servidor.');
				}
				
				// Cria a URL do Blob e armazena
				const blob = await response.blob();
				setPdfUrl(URL.createObjectURL(blob));
				setIsOpen(true); // Abre o painel APÓS o sucesso
			} catch (err) {
				setError(err instanceof Error ? err.message : "Ocorreu um erro desconhecido");
				console.error("Erro ao carregar PDF:", err);
			} finally {
				setIsLoading(false);
			}
		} else {
			// Caso 2: Se o PDF já estiver carregado, apenas alterna a visibilidade
			setIsOpen(!isOpen);
		}
	};

	return (
		// Container estilizado com Tailwind, consistente com os outros
		<section className="rounded-lg bg-white p-6 shadow-lg">
			
			{/* Cabeçalho com Título e Botão */}
			<div className="flex items-center justify-between">
				<h2 className="text-2xl font-bold text-gray-800">
					Calendário Acadêmico
				</h2>
				
				{/* Botão principal para alternar e carregar */}
				<button
					onClick={handleToggle}
					disabled={isLoading}
					className="flex w-44 items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-400"
				>
					{/* Ícone de Loading */}
					{isLoading && (
						<svg className="-ml-1 h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
							<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
							<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
					)}
					
					{/* Ícone de Chevron (seta) que gira */}
					{!isLoading && (
						<svg 
							xmlns="http://www.w3.org/2000/svg" 
							className={`h-5 w-5 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'}`} 
							fill="none" 
							viewBox="0 0 24 24" 
							stroke="currentColor" strokeWidth={2}
						>
							<path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
						</svg>
					)}
					
					{/* Texto dinâmico do botão */}
					<span>
						{isLoading ? 'Carregando...' : (isOpen ? 'Fechar Calendário' : 'Ver Calendário')}
					</span>
				</button>
			</div>

			{/* Mensagem de Erro (se houver) */}
			{error && !isLoading && (
				<div className="mt-4 rounded-md bg-red-100 p-4">
					<p className="text-sm font-medium text-red-700">
						<strong>Erro:</strong> {error}
					</p>
				</div>
			)}

			{/* Container "Sanfona" (Collapsible) */}
			<div 
				className={`transition-all duration-500 ease-in-out overflow-hidden ${isOpen && pdfUrl ? 'mt-6 max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}
			>
				{/* O Iframe só é renderizado se tivermos a URL */}
				{pdfUrl && (
					<iframe
						src={`${pdfUrl}#toolbar=0&navpanes=0`}
						// Classes Tailwind para o iframe
						className="h-[600px] w-full rounded-md border-none"
						title="Calendário Acadêmico"
					>
					</iframe>
				)}
			</div>
		</section>
	);
}

// --- Ícones SVG ---

const ClockIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ExclamationTriangleIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
  </svg>
);

const AcademicCapIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.697 50.697 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5z" />
  </svg>
);

const CalendarDaysIcon = () => (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>
);

const SpinnerIcon = () => (
  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

// --- Componente TurmasList (Refatorado) ---

interface TurmasListProps {
  turmas: Turma[];
  onVerDetalhe: (turma: Turma, index: number) => Promise<void>;
  loadingIndex: number | null;
}

function TurmasList({ turmas, onVerDetalhe, loadingIndex }: TurmasListProps) {
  return (
    <ul className="flow-root">
      {turmas.length === 0 && (
        <li className="text-center text-gray-500 py-4">
          Nenhuma turma encontrada.
        </li>
      )}

      {turmas.map((t, index) => {
        const isLoading = loadingIndex === index;

        return (
          <li 
            key={t.nome + index} 
            className="py-4 border-b border-gray-200 last:border-b-0
                       flex flex-col sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <div className="flex-grow mb-4 sm:mb-0">
              <p className="text-lg font-semibold text-gray-900">{t.nome}</p>
              
              <div className="text-sm font-medium text-gray-600 mt-1 flex items-center gap-1.5">
                <ClockIcon />
                {formatarHorarios(t.horarios)}
              </div>

              <div className="mt-3 flex items-center gap-x-4 gap-y-2 flex-wrap">
                <span className="flex items-center gap-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-full px-3 py-1">
                  <ExclamationTriangleIcon />
                  Faltas: {parseFaltas(t.faltas)}
                </span>
                <span className="flex items-center gap-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-full px-3 py-1">
                  <AcademicCapIcon />
                  Notas: {formatarNotas(t.notas)}
                </span>
              </div>
            </div>
            
            <div className="flex-shrink-0">
              <button 
                onClick={() => onVerDetalhe(t, index)}
                disabled={isLoading || loadingIndex !== null}
                className="w-full sm:w-auto min-w-[110px] px-4 py-2 text-sm font-medium text-white 
                           bg-blue-600 rounded-md shadow-sm
                           flex items-center justify-center
                           hover:bg-blue-700
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                           disabled:bg-gray-400 disabled:cursor-not-allowed
                           transition-colors duration-150"
              >
                {isLoading ? <SpinnerIcon /> : "Ver Detalhes"}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

interface NoticiaAgregada {
  turmaNome: string;
  titulo: string;
  conteudo: string[];
}

const MuralDeNoticias = ({ noticias }: { noticias: NoticiaAgregada[] }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex items-center gap-3 mb-4 border-b border-gray-200 pb-4">
        <h2 className="text-2xl font-semibold text-gray-800">
          Mural de Notícias
        </h2>
      </div>
      
      {noticias.length > 0 ? (
        <ul className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
          {noticias.map((noticia, index) => (
            <li 
              key={`${noticia.turmaNome}-${index}`} 
              className="p-4 border border-blue-200 rounded-lg bg-blue-50"
            >
              <p className="text-base font-semibold text-blue-800">{noticia.titulo}</p>
              <p className="text-xs font-medium text-gray-500 mb-2 italic">{noticia.turmaNome}</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{noticia.conteudo.join("\n")}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500 text-center py-4">Nenhuma notícia recente das turmas.</p>
      )}
    </div>
  );
};

// --- Componente Dashboard (Refatorado) ---

function Dashboard() {
  const sigaa = useSigaa();
  const [selectedTurma, setSelectedTurma] = useState<Turma | null>(null);
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null);

  const todasAsNoticias = (sigaa.mainData?.turmas || [])
    .map(turma => ({
      turmaNome: turma.nome,
      noticia: turma.noticia
    }))
    .filter(item => item.noticia && item.noticia.titulo)
    .map(item => ({
      turmaNome: item.turmaNome,
      titulo: item.noticia.titulo,
      conteudo: item.noticia.conteudo
    }));

  const handleVerDetalhe = async (turmaClicada: Turma, index: number) => {
    setLoadingIndex(index);
    setSelectedTurma(turmaClicada);
    setLoadingIndex(null);
  };

  const handleCloseDetail = () => {
    setSelectedTurma(null);
  };

  return (
    <div className='max-w-7xl mx-auto p-4 md:p-8'>
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Minhas Disciplinas
        </h1>
        <p id="login-status" className="text-lg text-gray-600 mt-1">
          Olá, <strong>{sigaa.mainData?.nome || "Aluno(a)"}</strong>!
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* Coluna Principal: Turmas */}
        <div className='lg:col-span-3 space-y-8'>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-4">
            Turmas Matriculadas
          </h2>
          <TurmasList 
            turmas={sigaa.mainData?.turmas || []} 
            onVerDetalhe={handleVerDetalhe}
            loadingIndex={loadingIndex}
          />
        </div>
        {sigaa.mainData && <CargaHorariaComponent carga={sigaa.mainData.cargaHoraria} />}
        </div>

        <div className="lg:col-span-2 space-y-8">
        {/* Coluna Lateral: Avaliações */}
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center gap-3 mb-4 border-b border-gray-200 pb-4">
            <CalendarDaysIcon />
            <h2 className="text-2xl font-semibold text-gray-800">
              Próximas Avaliações
            </h2>
          </div>
          
          {sigaa.mainData?.avaliacoes && sigaa.mainData.avaliacoes.length > 0 ? (
            <ul className="space-y-4">
              {sigaa.mainData.avaliacoes.map((avaliacao) => {
                const dataFormatada = parseDataHora(avaliacao.data);
                const mes = dataFormatada.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '');
                const dia = dataFormatada.toLocaleDateString('pt-BR', { day: '2-digit' });

                return (
                  <li 
                    key={`${avaliacao.turmaNome}-${avaliacao.nome}-${avaliacao.data}`} 
                    className="p-4 border border-gray-200 rounded-lg flex items-start gap-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-shrink-0 w-12 text-center">
                      <div className="bg-blue-600 text-white text-xs font-bold p-1 rounded-t-md">
                        {mes}
                      </div>
                      <div className="border-x border-b border-gray-300 rounded-b-md p-1 bg-white">
                        <p className="text-2xl font-bold text-gray-800">{dia}</p>
                      </div>
                    </div>
                    
                    <div className="flex-grow">
                      <p className="text-base font-semibold text-blue-700">{avaliacao.nome}</p>
                      <p className="text-sm text-gray-700">{avaliacao.turmaNome}</p>
                      <p className="text-sm text-gray-500 italic mt-1">
                        {avaliacao.tipo} - {dataFormatada.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-gray-500 text-center py-4">Nenhuma avaliação próxima encontrada.</p>
          )}
        </div>
        <MuralDeNoticias noticias={todasAsNoticias} />
        {sigaa.mainData && <IndicesAcademicosComponent indices={sigaa.mainData.indices} />}
        </div>
      </div>

      <div className='py-6'>
      <CalendarPDF />
      </div>
      
      {/* O Modal (TurmaDetail) não foi fornecido, mas a lógica de exibição está aqui */}
      {selectedTurma && (
        <TurmaDetail 
          turma={selectedTurma} 
          onClose={handleCloseDetail} 
        />
      )}
    </div>
  );
}

export default Dashboard;