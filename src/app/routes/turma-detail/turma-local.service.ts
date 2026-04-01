import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class TurmaLocalService {
  private dbName = 'SigaaAppDB';
  private storeName = 'locaisTurma';

  // Inicializa e cria o banco/tabela se não existir
  private initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };

      request.onsuccess = (event: any) => resolve(event.target.result);
      request.onerror = (event: any) => reject(event.target.error);
    });
  }

  async getLocalTurma(turmaId: string | number): Promise<string | null> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(turmaId.toString());

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async salvarLocalTurma(turmaId: string | number, local: string): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(local, turmaId.toString()); // Salva o texto usando o ID como chave

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async removerLocalTurma(turmaId: string | number): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(turmaId.toString());

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async salvarClassroomId(turmaNome: string, classroomId: string): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(classroomId, `classroom_${turmaNome}`); // Chave específica para o Classroom ID
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getClassroomId(turmaNome: string): Promise<string | null> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(`classroom_${turmaNome}`);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async removerClassroomId(turmaNome: string): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(`classroom_${turmaNome}`);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}