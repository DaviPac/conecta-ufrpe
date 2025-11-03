import React, { useState, useEffect } from 'react';
import { type Turma, type Noticia, type CronogramaItem, type Avaliacao } from '../interfaces/sigaa';
import { useSigaa } from '../contexts/SigaaContext';
import { parseFaltas, parseDataHora } from '../utils/formatters';

// --- Ícones SVG ---

interface IconProps {
  className?: string;
}

const IconX: React.FC<IconProps> = ({ className }) => (
  <svg className={className || "h-6 w-6"} fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const IconInfo: React.FC<IconProps> = ({ className }) => (
  <svg className={className || "h-5 w-5"} fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
  </svg>
);

const IconExclamation: React.FC<IconProps> = ({ className }) => (
  <svg className={className || "h-8 w-8 text-orange-500"} fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
  </svg>
);

const IconClipboardList: React.FC<IconProps> = ({ className }) => (
  <svg className={className || "h-5 w-5"} fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 21v-2a2 2 0 00-2-2H5a2 2 0 00-2 2v2m16-17v-2a2 2 0 00-2-2H5a2 2 0 00-2 2v2m16 0h.01M5 5h.01M5 8h.01M5 11h.01M5 14h.01M5 17h.01" />
  </svg>
);

const IconMegaphone: React.FC<IconProps> = ({ className }) => (
  <svg className={className || "h-5 w-5"} fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688 0-1.25-.561-1.25-1.25 0-.688.562-1.25 1.25-1.25s1.25.562 1.25 1.25c0 .688-.562 1.25-1.25 1.25zM10.34 15.84l3.536 3.536M10.34 15.84l-3.536 3.536m0-7.07l3.536-3.535M13.876 12.31l3.536 3.536M6.804 12.31L3.268 15.846m12.31-9.37l3.536 3.536M10.34 15.84l3.536-3.535M10.34 15.84l-3.536-3.535m0 0l3.536 3.535m0 0l-3.536 3.536" />
  </svg>
);

const IconCalendar: React.FC<IconProps> = ({ className }) => (
  <svg className={className || "h-5 w-5"} fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>
);

const IconBell: React.FC<IconProps> = ({ className }) => (
  <svg className={className || "h-5 w-5"} fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.31 5.071 23.847 23.847 0 005.455 1.31m5.714 0a23.927 23.927 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
  </svg>
);


// --- Sub-componentes Refatorados ---

interface SectionHeaderProps {
  icon: React.ReactElement;
  title: string;
}

const SectionHeader = ({ icon, title }: SectionHeaderProps) => (
  <div className="flex items-center gap-2 mb-4">
    {React.cloneElement(icon as any, { className: "h-5 w-5 text-blue-600" })}
    <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
  </div>
);

const TurmaResumo = ({ faltas }: { faltas: number }) => (
  <div>
    <SectionHeader icon={<IconInfo />} title="Resumo Rápido" />
    <div className="p-4 bg-gray-50 rounded-lg shadow-inner">
      <div className="flex items-center gap-4 p-3 bg-white border rounded-md">
        <div className="flex-shrink-0">
          <IconExclamation />
        </div>
        <div>
          <span className="text-sm font-medium text-gray-500">Faltas Registradas</span>
          <span className="block text-3xl font-bold text-gray-800">{parseFaltas(faltas)}</span>
        </div>
      </div>
    </div>
  </div>
);

const TurmaAvaliacoes = ({ avaliacoes }: { avaliacoes: Avaliacao[] }) => {
  if (avaliacoes.length === 0) {
    return null;
  }

  return (
    <div>
      <SectionHeader icon={<IconBell />} title="Próximas Avaliações" />
      <ul className="space-y-3">
        {avaliacoes.map((avaliacao) => {
          const dataFormatada = parseDataHora(avaliacao.data);
          const mes = dataFormatada.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '');
          const dia = dataFormatada.toLocaleDateString('pt-BR', { day: '2-digit' });

          return (
            <li 
              key={`${avaliacao.nome}-${avaliacao.data}`} 
              className="p-3 border border-gray-200 rounded-lg flex items-start gap-4 hover:bg-gray-50"
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
                <p className="font-semibold text-blue-700">{avaliacao.nome}</p>
                <p className="text-sm text-gray-500 italic mt-1">
                  {avaliacao.tipo} - {dataFormatada.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const NotasDetalhes = ({ notas }: { notas: Record<string, number> | null }) => {
  const entradas = notas ? Object.entries(notas) : [];

  return (
    <div>
      <SectionHeader icon={<IconClipboardList />} title="Notas" />
      {entradas.length > 0 ? (
        <ul className="divide-y divide-gray-200 border rounded-md">
          {entradas.map(([unidade, nota]) => (
            <li key={unidade} className="flex justify-between items-center p-3 bg-white even:bg-gray-50">
              <span className="font-medium text-gray-600">{unidade}: </span>
              <span className="text-base font-bold text-blue-800 bg-blue-100 px-3 py-0.5 rounded-full">
                {nota}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500 italic px-2">Nenhuma nota detalhada foi lançada.</p>
      )}
    </div>
  );
};

const TurmaNoticia = ({ noticia }: { noticia: Noticia | null }) => {
  if (!noticia || !noticia.titulo) return null;

  return (
    <div>
      <SectionHeader icon={<IconMegaphone />} title="Última Notícia" />
      <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
        <h4 className="font-bold text-blue-800">{noticia.titulo}</h4>
        <p className="mt-2 text-gray-700 whitespace-pre-wrap">{noticia.conteudo}</p>
      </div>
    </div>
  );
};

const TurmaCronograma = ({ cronograma }: { cronograma: CronogramaItem[] | null }) => {
  if (!cronograma || cronograma.length === 0) return null;

  return (
    <div>
      <SectionHeader icon={<IconCalendar />} title="Cronograma" />
      <div className="space-y-3 max-h-60 overflow-y-auto pr-2 border rounded-lg p-4 bg-gray-50">
        {cronograma.map((item, index) => (
          <div key={index} className="p-3 border rounded-md bg-white shadow-sm">
            <h4 className="font-semibold text-gray-800">{item.titulo}</h4>
            <p className="mt-1 text-gray-600 whitespace-pre-wrap">{item.conteudo}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Componente Principal Refatorado ---

interface TurmaDetailProps {
  turma: Turma;
  onClose: () => void;
}

function TurmaDetail({ turma, onClose }: TurmaDetailProps) {
  const [isVisible, setIsVisible] = useState(false);
  const sigaa = useSigaa();
  
  // Lógica para Animação de Entrada/Saída
  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Duração da animação (300ms)
  };

  // Lógica para filtrar avaliações (NOVO)
  const now = new Date();
  const avaliacoesDaTurma = (sigaa.mainData?.avaliacoes || []).filter(avaliacao => {
    const dataAvaliacao = parseDataHora(avaliacao.data);
    return avaliacao.turmaNome === turma.nome && dataAvaliacao >= now;
  }).sort((a, b) => parseDataHora(a.data).getTime() - parseDataHora(b.data).getTime());

  return (
    <div 
      className={`fixed inset-0 z-40 flex justify-end 
                  transition-opacity duration-300 ease-in-out
                  ${isVisible ? 'bg-black bg-opacity-60' : 'bg-opacity-0'}`}
      onClick={handleClose} 
      aria-modal="true"
      role="dialog"
    >
      <div 
        className={`w-full max-w-2xl h-full bg-white shadow-2xl z-50 
                    flex flex-col
                    transform transition-transform duration-300 ease-in-out
                    ${isVisible ? 'translate-x-0' : 'translate-x-full'}`}
        onClick={(e) => e.stopPropagation()} 
      >
        {/* Cabeçalho Fixo */}
        <div className="flex-shrink-0 flex justify-between items-center p-6 border-b sticky top-0 bg-white z-10">
          <h2 className="text-2xl font-bold text-gray-800 max-w-[90%] truncate" title={turma.nome}>
            {turma.nome}
          </h2>
          <button 
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-800 rounded-full p-1
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Fechar"
          >
            <IconX />
          </button>
        </div>

        {/* Conteúdo Rolável */}
        <div className="flex-grow p-6 lg:p-8 space-y-8 overflow-y-auto">
          <TurmaResumo faltas={turma.faltas} />
          
          <TurmaAvaliacoes avaliacoes={avaliacoesDaTurma} />
          
          <NotasDetalhes notas={turma.notas?.notas} />
          
          <TurmaNoticia noticia={turma.noticia} />
          
          <TurmaCronograma cronograma={turma.cronograma} />

          {/* Dados Brutos (Debug) */}
          <details className="mt-10">
            <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-800">
              Ver dados brutos (JSON)
            </summary>
            <pre className="mt-2 bg-gray-900 text-gray-100 p-4 rounded text-xs overflow-x-auto">
              {JSON.stringify(turma, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
}

export default TurmaDetail;