// study.repository.ts
// Gerencia materiais de estudo persistidos no localStorage, organizados por turma.

export interface StudyMaterial {
  id: string;
  name: string;
  content: string;
  type: 'note' | 'document' | 'exam';
  addedAt: number;
}

export interface StudyStore {
  materials: StudyMaterial[];
}

const STORAGE_PREFIX = 'study_assistant_';
const API_KEY_STORAGE = 'gemini_api_key';

export class StudyRepository {
  private key(turmaNome: string): string {
    return `${STORAGE_PREFIX}${turmaNome.replace(/\s+/g, '_').toLowerCase()}`;
  }

  getStore(turmaNome: string): StudyStore {
    try {
      const raw = localStorage.getItem(this.key(turmaNome));
      return raw ? JSON.parse(raw) : { materials: [] };
    } catch {
      return { materials: [] };
    }
  }

  private saveStore(turmaNome: string, store: StudyStore): void {
    localStorage.setItem(this.key(turmaNome), JSON.stringify(store));
  }

  addMaterial(turmaNome: string, material: Omit<StudyMaterial, 'id' | 'addedAt'>): StudyMaterial {
    const store = this.getStore(turmaNome);
    const newMaterial: StudyMaterial = {
      ...material,
      id: crypto.randomUUID(),
      addedAt: Date.now(),
    };
    store.materials.push(newMaterial);
    this.saveStore(turmaNome, store);
    return newMaterial;
  }

  removeMaterial(turmaNome: string, materialId: string): void {
    const store = this.getStore(turmaNome);
    store.materials = store.materials.filter((m) => m.id !== materialId);
    this.saveStore(turmaNome, store);
  }

  getMaterials(turmaNome: string): StudyMaterial[] {
    return this.getStore(turmaNome).materials;
  }

  getApiKey(): string {
    return localStorage.getItem(API_KEY_STORAGE) ?? '';
  }

  saveApiKey(key: string): void {
    localStorage.setItem(API_KEY_STORAGE, key);
  }
}