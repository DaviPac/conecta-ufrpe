// src/contexts/SigaaContext.tsx
import { 
    createContext, 
    useContext, 
    useState, 
    useCallback, 
    useMemo, 
    type ReactNode 
} from 'react';
import { api } from '../services/api';
import { type MainDataResponse } from '../interfaces/sigaa';

interface SigaaContextType {
  api: typeof api;
  isAuthenticated: boolean;
  mainData: MainDataResponse | null;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const SigaaContext = createContext<SigaaContextType | undefined>(undefined);

export const SigaaProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mainData, setMainData] = useState<MainDataResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await api.login(username, password);
      setIsAuthenticated(true);

      const data = await api.getMainData();
      setMainData(data);
      const faltasData = await api.baixarNotas();
      faltasData.notas.forEach(n => {
        if (!n) return;
        const t = data.turmas.find(turma => turma.nome === n?.nome);
        if (!t) return;
        t.notas = n;
      });
      setMainData(data);
      data?.turmas.forEach(async t => {
        const turmaData = await api.getTurmaDetail(t);
        const turmaIdx = data.turmas.findIndex(oldT => oldT.nome === t.nome);
        if (turmaIdx === -1) return;
        data.turmas[turmaIdx] = {...turmaData.turma, notas: data.turmas[turmaIdx].notas};
        setMainData({...data});
      })

    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido no login");
      setIsAuthenticated(false);
      setMainData(null);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setMainData(null);
    setError(null);
  }, []);

  const contextValue = useMemo(() => ({
    api,
    isAuthenticated,
    mainData,
    isLoading,
    error,
    login,
    logout
  }), [isAuthenticated, mainData, isLoading, error, login, logout]);

  return (
    <SigaaContext.Provider value={contextValue}>
      {children}
    </SigaaContext.Provider>
  );
};

export const useSigaa = () => {
  const context = useContext(SigaaContext);
  if (context === undefined) {
    throw new Error('useSigaa deve ser usado dentro de um SigaaProvider');
  }
  return context;
};