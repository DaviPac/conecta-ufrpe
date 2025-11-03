import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { useSigaa } from './contexts/SigaaContext';

function App() {

  const sigaa = useSigaa();

  // Renderização condicional
  if (!sigaa.isAuthenticated) {
    return (
      <Login />
    );
  }

  return (
    <Dashboard />
  );
}

export default App;