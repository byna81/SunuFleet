// Login.jsx - Page de connexion avec mot de passe oublié
import React from 'react';
import { User, Lock } from 'lucide-react';

const Login = ({ loginForm, setLoginForm, handleLogin, loginError, onForgotPassword }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🚗</div>
          <h1 className="text-4xl font-bold mb-2">
            <span className="text-red-600">Sunu</span><span className="text-gray-900">Fleet</span>
          </h1>
          <p className="text-blue-600 italic font-medium">La gestion intelligente des chauffeurs</p>
          <p className="text-gray-600 text-sm mt-2">🇸🇳 Sénégal</p>
        </div>

        {loginError && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg mb-4 text-center">
            {loginError}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Nom d'utilisateur</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={loginForm.username}
                onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                placeholder="Entrez votre nom d'utilisateur"
                className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Mot de passe</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                placeholder="Entrez votre mot de passe"
                className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors"
          >
            Se connecter
          </button>

          {onForgotPassword && (
            <button
              type="button"
              onClick={onForgotPassword}
              className="w-full text-center text-sm text-blue-600 hover:underline mt-4"
            >
              Mot de passe oublié ?
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

export default Login;
