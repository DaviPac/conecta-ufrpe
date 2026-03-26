// study.repository.ts

export interface StudyMaterial {
  id: string;
  turmaNome: string; // Adicionado para facilitar a busca no banco
  name: string;
  content: string;
  type: 'note' | 'document' | 'exam';
  addedAt: number;
}

const DB_NAME = 'StudyAssistantDB';
const DB_VERSION = 1;
const STORE_MATERIALS = 'materials';
const STORE_SETTINGS = 'settings';
const API_KEY_ID = 'gemini_api_key';

export class StudyRepository {
  private dbPromise: Promise<IDBDatabase>;

  constructor() {
    // Inicializa a conexão com o banco de dados
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      // onupgradeneeded roda quando o banco é criado pela primeira vez ou muda de versão
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Tabela de materiais (Chave primária: id)
        if (!db.objectStoreNames.contains(STORE_MATERIALS)) {
          const materialStore = db.createObjectStore(STORE_MATERIALS, { keyPath: 'id' });
          // Cria um índice para podermos buscar os materiais por turma rapidamente
          materialStore.createIndex('turmaNome', 'turmaNome', { unique: false });
        }

        // Tabela de configurações genéricas (Sem chave primária fixa, tipo chave-valor)
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async addMaterial(
    turmaNome: string,
    material: Omit<StudyMaterial, 'id' | 'addedAt' | 'turmaNome'>,
  ): Promise<StudyMaterial> {
    const db = await this.dbPromise;
    const newMaterial: StudyMaterial = {
      ...material,
      turmaNome,
      id: crypto.randomUUID(),
      addedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MATERIALS, 'readwrite');
      const store = tx.objectStore(STORE_MATERIALS);
      const request = store.put(newMaterial); // put insere ou atualiza

      request.onsuccess = () => resolve(newMaterial);
      request.onerror = () => reject(request.error);
    });
  }

  // Com o IndexedDB, não precisamos do nome da turma para deletar, pois o 'id' é único
  async removeMaterial(materialId: string): Promise<void> {
    const db = await this.dbPromise;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MATERIALS, 'readwrite');
      const store = tx.objectStore(STORE_MATERIALS);
      const request = store.delete(materialId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getMaterials(turmaNome: string): Promise<StudyMaterial[]> {
    const db = await this.dbPromise;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MATERIALS, 'readonly');
      const store = tx.objectStore(STORE_MATERIALS);
      const index = store.index('turmaNome');

      // Busca todos os registros que batem com o nome da turma
      const request = index.getAll(turmaNome);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveApiKey(key: string): Promise<void> {
    const db = await this.dbPromise;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SETTINGS, 'readwrite');
      const store = tx.objectStore(STORE_SETTINGS);
      // Aqui passamos o valor e explicitamos a chave logo depois
      const request = store.put(key, API_KEY_ID);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getApiKey(): Promise<string> {
    const db = await this.dbPromise;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SETTINGS, 'readonly');
      const store = tx.objectStore(STORE_SETTINGS);
      const request = store.get(API_KEY_ID);

      request.onsuccess = () => resolve(request.result || '');
      request.onerror = () => reject(request.error);
    });
  }
}
