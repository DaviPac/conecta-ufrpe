// study-assistant.component.ts
import {
  Component,
  Input,
  OnInit,
  signal,
  computed,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StudyRepository, StudyMaterial } from './study.repository';
import { StudyAiService, StudyMode } from './study-ai.service';
import * as pdfjsLib from 'pdfjs-dist';
import { MarkdownModule } from 'ngx-markdown';

if (!(Uint8Array.prototype as any).toHex) {
  (Uint8Array.prototype as any).toHex = function () {
    return Array.from(this as Uint8Array)
      .map((b: number) => b.toString(16).padStart(2, '0'))
      .join('');
  };
}

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface ModeOption {
  id: StudyMode;
  label: string;
  icon: string;
  description: string;
  color: string;
}

@Component({
  selector: 'app-study-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule, MarkdownModule],
  templateUrl: './study-assistant.component.html',
})
export class StudyAssistantComponent implements OnInit {
  @Input({ required: true }) turmaNome!: string;
  @Input() cronograma?: { titulo: string; conteudo: string }[];

  private repo = new StudyRepository();
  private aiService = inject(StudyAiService);
  private cdr = inject(ChangeDetectorRef);

  // --- State ---
  isExpanded = signal(false);
  isConfigOpen = signal(false);
  isAddingMaterial = signal(false);
  isGenerating = signal(false);
  parsedResult = signal<any>(null);

  materials = signal<StudyMaterial[]>([]);
  selectedMode = signal<StudyMode>('plano');
  extraContext = signal('');
  generatedContent = signal('');
  errorMessage = signal('');

  // Form para novo material
  newMaterialName = '';
  newMaterialContent = '';
  newMaterialType: StudyMaterial['type'] = 'note';

  // Config
  apiKey = '';


  showAnswers = signal(false);

    // Crie este método na classe para lidar com a troca de modo
  changeMode(modeId: StudyMode): void {
    this.selectedMode.set(modeId);
    this.parsedResult.set(null); // Limpa o resultado para esconder o container
    this.showAnswers.set(false); // Reseta o estado do simulado
  }

  get selectedModeLabel(): string | undefined {
    return this.modes.find(m => m.id === this.selectedMode())?.label;
  }

  readonly modes: ModeOption[] = [
    {
      id: 'plano',
      label: 'Plano de Estudos',
      icon: 'pi-calendar',
      description: 'Cronograma semanal personalizado',
      color: 'blue',
    },
    {
      id: 'simulado',
      label: 'Simulado',
      icon: 'pi-pencil',
      description: 'Questões e prova gerada por IA',
      color: 'violet',
    },
    {
      id: 'atividades',
      label: 'Atividades',
      icon: 'pi-bolt',
      description: 'Exercícios e técnicas de estudo',
      color: 'amber',
    },
    {
      id: 'resumo',
      label: 'Resumo',
      icon: 'pi-book',
      description: 'Síntese inteligente dos materiais',
      color: 'emerald',
    },
  ];

  ngOnInit(): void {
    this.materials.set(this.repo.getMaterials(this.turmaNome));
    this.apiKey = this.repo.getApiKey();
  }

  toggleExpand(): void {
    this.isExpanded.update((v) => !v);
  }

  saveApiKey(): void {
    this.repo.saveApiKey(this.apiKey);
    this.isConfigOpen.set(false);
  }

  async extractTextFromPdf(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    // Itera sobre as páginas para extrair o texto
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
    }

    return fullText;
  }

  addMaterial(): void {
    if (!this.newMaterialName.trim() || !this.newMaterialContent.trim()) return;
    const added = this.repo.addMaterial(this.turmaNome, {
      name: this.newMaterialName.trim(),
      content: this.newMaterialContent.trim(),
      type: this.newMaterialType,
    });
    this.materials.update((list) => [...list, added]);
    this.newMaterialName = '';
    this.newMaterialContent = '';
    this.newMaterialType = 'note';
    this.isAddingMaterial.set(false);
  }

  removeMaterial(id: string): void {
    this.repo.removeMaterial(this.turmaNome, id);
    this.materials.update((list) => list.filter((m) => m.id !== id));
  }

  async handleFileUpload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      let text = '';
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      
      // Verifica se é PDF para usar o extrator, senão usa o método padrão
      if (isPdf) {
        text = await this.extractTextFromPdf(file);
      } else {
        text = await file.text();
      }

      if (!text || text.trim() === '') {
        throw new Error('O arquivo está vazio ou não pôde ser lido corretamente.');
      }

      this.newMaterialName = file.name;
      this.newMaterialContent = text.slice(0, 200000);
      this.newMaterialType = 'document';
      this.isAddingMaterial.set(true);
      input.value = '';
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      console.error('Erro ao ler o arquivo:', error);
      this.errorMessage.set(`Não foi possível extrair o texto: ${error.message || 'Erro desconhecido'}`);
    }
  }

  async generate(): Promise<void> {
    if (!this.apiKey) {
        this.isConfigOpen.set(true);
        this.errorMessage.set('Configure sua API Key do Gemini para continuar.');
        return;
    }

    this.isGenerating.set(true);
    this.generatedContent.set(''); // Opcional, mantido caso queira debug
    this.parsedResult.set(null); // Reseta o resultado estruturado anterior
    this.errorMessage.set('');
    this.showAnswers.set(false);

    try {
        const responseText = await this.aiService.generateText({
        turmaNome: this.turmaNome,
        cronograma: this.cronograma,
        materials: this.materials(),
        mode: this.selectedMode(),
        extraContext: this.extraContext(),
        apiKey: this.apiKey,
        });
        this.generatedContent.set(responseText);
        let cleanText = responseText.replace(/[\u00A0\u200B-\u200D\uFEFF]/g, ' ').trim();

        // Como usamos responseMimeType="application/json", o parse será direto
        const jsonObj = JSON.parse(cleanText);
        this.parsedResult.set(jsonObj);
        console.log(this.parsedResult());

    } catch (err: any) {
        console.error('Erro de IA:', err);
        this.errorMessage.set(err?.message ?? 'Erro ao gerar conteúdo. Tente novamente.');
    } finally {
        this.isGenerating.set(false);
        this.cdr.detectChanges();
    }
}

  copyContent(): void {
    navigator.clipboard.writeText(this.generatedContent());
  }

  getMaterialTypeLabel(type: StudyMaterial['type']): string {
    return { note: 'Anotação', document: 'Documento', exam: 'Prova Antiga' }[type];
  }

  getMaterialTypeIcon(type: StudyMaterial['type']): string {
    return { note: 'pi-file-edit', document: 'pi-file', exam: 'pi-file-check' }[type];
  }

  getMaterialTypeBadgeClass(type: StudyMaterial['type']): string {
    return {
      note: 'bg-blue-50 text-blue-700 border-blue-200',
      document: 'bg-slate-100 text-slate-600 border-slate-200',
      exam: 'bg-amber-50 text-amber-700 border-amber-200',
    }[type];
  }

  getModeColorClasses(mode: ModeOption, selected: boolean): string {
    const map: Record<string, { active: string; inactive: string }> = {
      blue: {
        active: 'bg-blue-900 text-white border-blue-900',
        inactive: 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-900',
      },
      violet: {
        active: 'bg-violet-700 text-white border-violet-700',
        inactive: 'bg-white text-slate-600 border-slate-200 hover:border-violet-300 hover:text-violet-700',
      },
      amber: {
        active: 'bg-amber-600 text-white border-amber-600',
        inactive: 'bg-white text-slate-600 border-slate-200 hover:border-amber-300 hover:text-amber-600',
      },
      emerald: {
        active: 'bg-emerald-700 text-white border-emerald-700',
        inactive: 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700',
      },
    };
    return selected ? map[mode.color].active : map[mode.color].inactive;
  }
}