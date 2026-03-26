import { Injectable } from '@angular/core';

export type StudyMode = 'plano' | 'simulado' | 'atividades' | 'resumo';

export interface StudyAiRequest {
  turmaNome: string;
  disciplina?: string;
  cronograma?: { titulo: string; conteudo: string }[];
  materials: { name: string; type: string; content: string }[];
  mode: StudyMode;
  extraContext?: string;
  apiKey: string;
}

// Função auxiliar para injetar o conteúdo real dos materiais no prompt
const formatMaterials = (materials: StudyAiRequest['materials']): string => {
  if (!materials || materials.length === 0) return 'Nenhum material anexado.';
  return materials
    .map(
      (m) =>
        `\n--- Início do material: ${m.name} ---\n${m.content}\n--- Fim do material: ${m.name} ---`,
    )
    .join('\n');
};

const MODE_PROMPTS: Record<StudyMode, (ctx: StudyAiRequest) => string> = {
  plano: (ctx) => `
Você é um tutor acadêmico. Crie um Plano de Estudos detalhado para "${ctx.turmaNome}".
Retorne APENAS um JSON válido seguindo esta estrutura exata:
{
  "semanas": [
    {
      "numero": 1,
      "objetivo": "string",
      "topicos": ["string"],
      "tecnicas": ["string"]
    }
  ]
}
Contexto do Aluno: ${ctx.extraContext || 'Nenhum'}
Ementa: ${JSON.stringify(ctx.cronograma || [])}

Materiais de Referência (Baseie-se neles se fornecidos):
${formatMaterials(ctx.materials)}
`,

  simulado: (ctx) => `
Você é um professor. Crie um Simulado para "${ctx.turmaNome}".
Retorne APENAS um JSON válido seguindo esta estrutura exata:
{
  "questoes": [
    {
      "tipo": "multipla_escolha",
      "enunciado": "string",
      "opcoes": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "respostaCorreta": "string (ex: A)",
      "justificativa": "string"
    },
    {
      "tipo": "dissertativa",
      "enunciado": "string",
      "expectativaResposta": "string"
    }
  ]
}
Contexto do Aluno: ${ctx.extraContext || 'Nenhum'}
Ementa: ${JSON.stringify(ctx.cronograma || [])}

Conteúdo Base para as Questões (Extraia os temas destes materiais):
${formatMaterials(ctx.materials)}
`,

  atividades: (ctx) => `
Você é um educador. Sugira Atividades Práticas para "${ctx.turmaNome}".
Retorne APENAS um JSON válido seguindo esta estrutura exata:
{
  "atividades": [
    {
      "titulo": "string",
      "tipo": "pratica | teoria | grupo",
      "duracaoEstimada": "string",
      "descricao": "string",
      "passoAPasso": ["string"]
    }
  ]
}
Contexto do Aluno: ${ctx.extraContext || 'Nenhum'}

Materiais de Referência:
${formatMaterials(ctx.materials)}
`,

  resumo: (ctx) => `
Você é um especialista em síntese. Crie um Resumo estruturado para "${ctx.turmaNome}" com base EXCLUSIVAMENTE nos materiais abaixo.
Retorne APENAS um JSON válido seguindo esta estrutura exata:
{
  "titulo": "string",
  "introducao": "string",
  "conceitosChave": [
    { "termo": "string", "definicao": "string" }
  ],
  "pontosDeAtencao": ["string"],
  "dicasMemorizacao": ["string"]
}
Contexto Adicional: ${ctx.extraContext || 'Nenhum'}

Materiais para Resumir:
${formatMaterials(ctx.materials)}
`,
};

@Injectable({ providedIn: 'root' })
export class StudyAiService {
  async generateText(request: StudyAiRequest): Promise<string> {
    const prompt = MODE_PROMPTS[request.mode](request);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${request.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
          },
        }),
      },
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message ?? `Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('A IA não retornou um conteúdo válido.');
    }

    return text;
  }
}
