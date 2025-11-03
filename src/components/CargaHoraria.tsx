import React from 'react';
import { type CargaHoraria } from '../interfaces/sigaa';

// Props que o componente principal receberá
interface CargaHorariaProps {
	carga: CargaHoraria;
}

// Sub-componente para listar cada item pendente
interface PendingItemProps {
	label: string;
	horas: string;
}

const PendingItem: React.FC<PendingItemProps> = ({ label, horas }) => (
	<div className="flex justify-between items-baseline border-b border-gray-100 py-3">
		<span className="text-sm font-medium text-gray-600">{label}</span>
		{/* Usamos uma cor como "warning" (laranja) para o que está pendente */}
		<span className="text-lg font-semibold text-orange-600">{horas}h</span>
	</div>
);


// --- Componente Principal ---
export const CargaHorariaComponent: React.FC<CargaHorariaProps> = ({ carga }) => {
	
    // --- Lógica de Cálculo ---
	// Converte as strings para números, tratando casos de 'NaN'
	const total = parseFloat(carga.totalCurriculo) || 0;
	const obgPendente = parseFloat(carga.obrigatoriaPendente) || 0;
	const optPendente = parseFloat(carga.optativaPendente) || 0;
	const compPendente = parseFloat(carga.complementarPendente) || 0;

	// Calcula o total pendente e o total concluído
	const totalPendente = obgPendente + optPendente + compPendente;
	const totalConcluido = total > totalPendente ? total - totalPendente : 0;
	
	// Calcula o percentual, evitando divisão por zero
	const percentual = total > 0 ? (totalConcluido / total) * 100 : 0;

	// Lista de itens pendentes para o map
	const pendingItemsData = [
		{ label: "Obrigatória Pendente", horas: carga.obrigatoriaPendente },
		{ label: "Optativa Pendente", horas: carga.optativaPendente },
		{ label: "Complementar Pendente", horas: carga.complementarPendente },
	];

	return (
		<section className="rounded-lg bg-white p-6 shadow-lg">
			<h2 className="mb-6 text-2xl font-bold text-gray-800">
				Progresso da Carga Horária
			</h2>

			{/* --- Barra de Progresso Total --- */}
			<div>
				<div className="mb-2 flex justify-between">
					<span className="text-base font-bold text-indigo-700">
						Progresso Total
					</span>
					<span className="text-base font-bold text-indigo-700">
						{percentual.toFixed(1)}%
					</span>
				</div>
				{/* Container da barra */}
				<div className="mb-2 h-4 w-full rounded-full bg-gray-200 shadow-inner">
					{/* Barra de progresso interna */}
					<div 
						className="h-4 rounded-full bg-indigo-600 transition-all duration-500 ease-out"
						style={{ width: `${percentual}%` }}
						role="progressbar"
						aria-valuenow={percentual}
						aria-valuemin={0}
						aria-valuemax={100}
					></div>
				</div>
				<div className="flex justify-between text-sm font-medium text-gray-500">
					<span>{totalConcluido.toFixed(0)}h Concluídas</span>
					<span>{total.toFixed(0)}h Totais</span>
				</div>
			</div>

			{/* --- Divisor --- */}
			<hr className="my-6 border-t border-gray-200" />

			{/* --- Detalhes Pendentes --- */}
			<div>
				<h3 className="mb-4 text-lg font-semibold text-gray-700">
					Horas Pendentes
				</h3>
				<div className="space-y-2">
					{pendingItemsData.map((item) => (
						<PendingItem 
							key={item.label} 
							label={item.label} 
							horas={item.horas} 
						/>
					))}
				</div>
			</div>
		</section>
	);
};