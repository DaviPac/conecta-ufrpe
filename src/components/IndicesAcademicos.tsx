import React from 'react';
import { type IndicesAcademicos } from '../interfaces/sigaa';

// Props que o componente principal receberá
interface IndicesProps {
	indices: IndicesAcademicos;
}

// --- Card Individual para cada Índice ---
// Um sub-componente para manter o código limpo (DRY)
interface CardProps {
	label: string;
	value: string;
}

const IndiceCard: React.FC<CardProps> = ({ label, value }) => (
	<div className="flex flex-col rounded-lg bg-white p-4 shadow-lg">
		<dt className="truncate text-sm font-medium uppercase text-gray-500">
			{label}
		</dt>
		<dd className="truncate mt-1 text-lg font-semibold tracking-tight text-indigo-600">
			{value}
		</dd>
	</div>
);

// --- Componente Principal ---
export const IndicesAcademicosComponent: React.FC<IndicesProps> = ({ indices }) => {
	// Mapeia as chaves da interface para labels (neste caso, as próprias chaves)
	// Você pode alterar os valores aqui se quiser nomes mais longos
	const labels: { [key in keyof IndicesAcademicos]: string } = {
		mc: "MC",
		ira: "IRA",
		mcn: "MCN",
		iech: "IECH",
		iepl: "IEPL",
		iea: "IEA",
		iean: "IEAN",
		iechp: "IECHP",
	};

	// Converte o objeto de índices em um array de [chave, valor]
	// para que possamos usar .map() facilmente
	const indicesArray = Object.entries(indices) as [keyof IndicesAcademicos, string][];

	return (
		<section className="rounded-lg bg-white p-6 shadow-md">
			<div className="flex items-center gap-3 mb-4 border-b border-gray-200 pb-4">
                <h2 className="text-2xl font-semibold text-gray-800">
                    Índices Acadêmicos
                </h2>
            </div>
			
			<dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
				{indicesArray.map(([key, value]) => (
					<IndiceCard 
						key={key} 
						label={labels[key]} 
						value={value} 
					/>
				))}
			</dl>
		</section>
	);
};