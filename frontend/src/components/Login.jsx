// Login.jsx - Page de connexion SunuFleet (version professionnelle)
import React from 'react';
import { User, Lock } from 'lucide-react';

const Login = ({ loginForm, setLoginForm, handleLogin, loginError, onForgotPassword }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl p-8 md:p-10 max-w-md w-full border border-red-100">
        {/* Header */}
        <div className="text-center mb-8">
          <img
            src="/autofleet-logo.png"
            alt="SunuFleet"
            className="w-40 md:w-44 mx-auto mb-5 object-contain"
          />

          <p className="text-blue-600 italic font-medium text-lg">
            La gestion intelligente des chauffeurs
          </p>

          <p className="text-gray-600 text-sm mt-1">🇸🇳 Sénégal</p>
        </div>

        {/* Erreur */}
        {loginError && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-xl mb-5 text-center text-sm">
            {loginError}
          </div>
        )}

        {/* Formulaire */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-800">
              Nom d'utilisateur
            </label>
            <div className="relative">
              <User
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={20}
              />
              <input
                type="text"
                value={loginForm.username}
                onChange={(e) =>
                  setLoginForm({ ...loginForm, username: e.target.value })
                }
                placeholder="Entrez votre nom d'utilisateur"
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-800">
              Mot de passe
            </label>
            <div className="relative">
              <Lock
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={20}
              />
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) =>
                  setLoginForm({ ...loginForm, password: e.target.value })
                }
                placeholder="Entrez votre mot de passe"
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-red-600 text-white py-3.5 rounded-xl font-semibold hover:bg-red-700 transition-colors shadow-sm"
          >
            Se connecter
          </button>

          {onForgotPassword && (
            <button
              type="button"
              onClick={onForgotPassword}
              className="w-full text-center text-sm text-blue-600 hover:underline"
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
