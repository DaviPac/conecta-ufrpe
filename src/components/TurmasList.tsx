import { type Turma } from '../interfaces/sigaa';
import { parseFaltas, formatarNotas, formatarHorarios } from '../utils/formatters';

interface TurmasListProps {
  turmas: Turma[];
  onVerDetalhe: (turma: Turma, index: number) => Promise<void>;
  loadingIndex: number | null; // Recebe o índice que está carregando
}

function TurmasList({ turmas, onVerDetalhe, loadingIndex }: TurmasListProps) {
  return (
    // Container da lista com espaçamento entre os cards
    <ul className="space-y-4 mt-6">
      
      {/* Verifica se a lista de turmas está vazia */}
      {turmas.length === 0 && (
        <li className="text-center text-gray-500 p-4 bg-white rounded-lg shadow-sm">
          Nenhuma turma encontrada.
        </li>
      )}

      {turmas.map((t, index) => {
        const isLoading = loadingIndex === index;
        
        return (
          // Cada item da lista agora é um "card"
          <li 
            key={t.nome + index} 
            className="bg-white p-4 rounded-lg shadow-sm 
                       flex flex-col sm:flex-row sm:items-center sm:justify-between
                       border border-gray-200"
          >
            {/* Informações da Turma */}
            <div className="flex-grow mb-4 sm:mb-0">
              <p className="text-lg font-semibold text-gray-800">{t.nome}</p>
              <div className="text-sm font-medium text-gray-700 mt-1">
                {formatarHorarios(t.horarios)}
              </div>
              <div className="text-sm text-gray-600 mt-1 space-x-4">
                <span>
                  <strong>Faltas:</strong> {parseFaltas(t.faltas)}
                </span>
                <span className="opacity-50">|</span>
                <span>
                  <strong>Notas:</strong> {formatarNotas(t.notas)}
                </span>
              </div>
            </div>
            
            {/* Botão de Ação */}
            <button 
              onClick={() => onVerDetalhe(t, index)}
              disabled={isLoading}
              // Define uma largura mínima para o botão não "pular" ao mudar o texto
              className="min-w-[100px] px-4 py-2 text-sm font-medium text-white 
                         bg-blue-600 rounded-md shadow-sm
                         hover:bg-blue-700
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                         disabled:bg-gray-400 disabled:cursor-not-allowed
                         transition-colors duration-150"
            >
              {isLoading ? "Carregando..." : "Detalhes"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default TurmasList;