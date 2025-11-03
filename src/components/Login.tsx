import React, { useState } from 'react';
import { useSigaa } from '../contexts/SigaaContext';


const LockIcon = () => (
  <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 00-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
  </svg>
);

const EyeIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const EyeOffIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243l-4.243-4.243" />
  </svg>
);

const AlertIcon = () => (
  <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-11a1 1 0 10-2 0v4a1 1 0 102 0v-4zm2-1a1 1 0 011 1v4a1 1 0 11-2 0v-4a1 1 0 011-1z" clipRule="evenodd" />
  </svg>
);

const SpinnerIcon = () => (
  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

function Login() {
  const sigaa = useSigaa();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sigaa.login(username, password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
        
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
          <LockIcon />
        </div>
        
        <h2 className="mt-5 text-center text-3xl font-bold tracking-tight text-gray-900">
          Acessar conta
        </h2>
        
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label 
                htmlFor="username" 
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Usuário
              </label>
              <input 
                type="text" 
                id="username" 
                placeholder="seu.usuario" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={sigaa.isLoading}
                className="w-full px-4 py-3 border border-gray-300 rounded-md 
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                           disabled:bg-gray-50 disabled:opacity-70"
              />
            </div>
            
            <div>
              <label 
                htmlFor="password" 
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Senha
              </label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  id="password" 
                  placeholder="********" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={sigaa.isLoading}
                  className="w-full px-4 py-3 border border-gray-300 rounded-md 
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                             disabled:bg-gray-50 disabled:opacity-70"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={sigaa.isLoading}
                  className="absolute inset-y-0 right-0 flex items-center pr-3
                             text-gray-500 hover:text-gray-700
                             disabled:opacity-50"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>
          </div>
          
          {sigaa.error && (
            <div className="flex items-center gap-x-2 rounded-md bg-red-50 p-3 text-sm text-red-600">
              <AlertIcon />
              <span>{sigaa.error}</span>
            </div>
          )}

          <button 
            id="btn-login" 
            type="submit" 
            disabled={sigaa.isLoading} 
            className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-md 
                       flex items-center justify-center
                       hover:bg-blue-700 
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors duration-200"
          >
            {sigaa.isLoading ? (
              <>
                <SpinnerIcon />
                Autenticando...
              </>
            ) : (
              "Login"
            )}
          </button>
          
        </form>
      </div>
    </div>
  );
}

export default Login;