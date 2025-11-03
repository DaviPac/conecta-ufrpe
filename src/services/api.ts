import { 
  type LoginResponse, 
  type MainDataResponse, 
  type Turma, 
  type TurmaDetailResponse, 
  type NotasResponse, 
} from '../interfaces/sigaa';

class SigaaAPI {
    #jsessionid = "";
    #viewState = "";
    #baseURL = "";
    #requestChain = Promise.resolve();

    constructor(baseURL: string) {
        this.#baseURL = baseURL;
    }

    async #request<T>(endpoint: string, method: string, body: any, needsAuth = true): Promise<T> {
        const url = this.#baseURL + endpoint;
        const headers: HeadersInit = {
            "Content-Type": "application/json"
        };

        if (needsAuth) {
            headers["Authorization"] = "Bearer " + this.#jsessionid;
        }

        const config: RequestInit = {
            method: method,
            headers: headers
        };

        if (body) {
            config.body = JSON.stringify(body);
        }

        try {
            const res = await fetch(url, config);
            const data = await res.json();
            console.log(data);

            if (!res.ok) {
                throw new Error(data.error || "Erro desconhecido na API");
            }

            if (data.jsessionid) {
                this.#jsessionid = data.jsessionid;
            }
            if (data.viewState) {
                this.#viewState = data.viewState;
            }

            return data as T;
        } catch (err) {
            console.error(`Erro na API [${method} ${endpoint}]:`, err);
            throw err;
        }
    }

    #enqueueStatefulRequest<T>(requestFunction: () => Promise<T>): Promise<T> {
        const resultPromise = this.#requestChain.then(() => {
            return requestFunction();
        });

        this.#requestChain = resultPromise.catch(() => {}) as Promise<void>;

        return resultPromise;
    }

    async login(username: string, password: string): Promise<LoginResponse> {
        this.#requestChain = Promise.resolve();
        return this.#request<LoginResponse>("/login", "POST", { username, password }, false);
    }

    async getMainData(): Promise<MainDataResponse> {
        return this.#enqueueStatefulRequest(() => 
            this.#request<MainDataResponse>("/main-data", "GET", null, true)
        );
    }

    async getTurmaDetail(turma: Turma): Promise<TurmaDetailResponse> {
        return this.#enqueueStatefulRequest(() => 
            this.#request<TurmaDetailResponse>("/turma", "POST", { turma, viewState: this.#viewState }, true)
        );
    }

    async baixarNotas(): Promise<NotasResponse> {
        return this.#enqueueStatefulRequest(() => 
            this.#request<NotasResponse>("/notas", "POST", { viewState: this.#viewState }, true)
        );
    }
}

export const api = new SigaaAPI("http://localhost:8080");