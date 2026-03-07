// Sidebar.jsx - Menu avec logo image et taille optimale (+ Contrats / Maintenance / Paiements propriétaires)
import React from 'react';
import { LogOut } from 'lucide-react';

const Sidebar = ({ currentUser, activeTab, setActiveTab, handleLogout, hasPermission, setShowChangePassword }) => {
  return (
    <div className="w-64 bg-gradient-to-b from-red-600 to-red-700 text-white flex flex-col h-screen">
      {/* Header avec logo */}
      <div className="p-4 border-b border-red-500">
        <div className="flex items-center gap-3 mb-2">
          <img
            src="/autofleet-logo.png"
            alt="SunuFleet Logo"
            className="w-16 h-16 object-contain bg-white p-1 rounded-lg"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'block';
            }}
          />
          <span className="text-5xl" style={{ display: 'none' }}>🚗</span>

          <div>
            <h1 className="text-2xl font-bold leading-none">
              <span className="text-red-200">Sunu</span>
              <span className="text-white">Fleet</span>
            </h1>
          </div>
        </div>

        <p className="text-blue-200 text-xs italic">
          La gestion intelligente des chauffeurs
        </p>
      </div>

      {/* Profil utilisateur */}
      <div className="p-3 bg-red-800 mx-3 mt-3 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="text-2xl">{currentUser.avatar}</div>
          <div>
            <p className="font-semibold text-sm">{currentUser.name}</p>
            <p className="text-xs text-red-200">{currentUser.role}</p>
          </div>
        </div>
      </div>

      {/* Menu navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1.5">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`w-full text-left px-3 py-2.5 rounded font-medium ${activeTab === 'dashboard' ? 'bg-red-800' : 'hover:bg-red-800'}`}
        >
          📊 Tableau de bord
        </button>

        <button
          onClick={() => setActiveTab('payments')}
          className={`w-full text-left px-3 py-2.5 rounded font-medium ${activeTab === 'payments' ? 'bg-red-800' : 'hover:bg-red-800'}`}
        >
          💰 Versements
        </button>

        <button
          onClick={() => setActiveTab('drivers')}
          className={`w-full text-left px-3 py-2.5 rounded font-medium ${activeTab === 'drivers' ? 'bg-red-800' : 'hover:bg-red-800'}`}
        >
          👨‍✈️ Chauffeurs
        </button>

        <button
          onClick={() => setActiveTab('contracts')}
          className={`w-full text-left px-3 py-2.5 rounded font-medium ${activeTab === 'contracts' ? 'bg-red-800' : 'hover:bg-red-800'}`}
        >
          📄 Contrats
        </button>

        <button
          onClick={() => setActiveTab('vehicles')}
          className={`w-full text-left px-3 py-2.5 rounded font-medium ${activeTab === 'vehicles' ? 'bg-red-800' : 'hover:bg-red-800'}`}
        >
          🚗 Véhicules
        </button>

        <button
          onClick={() => setActiveTab('maintenance')}
          className={`w-full text-left px-3 py-2.5 rounded font-medium ${activeTab === 'maintenance' ? 'bg-red-800' : 'hover:bg-red-800'}`}
        >
          🔧 Maintenance
        </button>

        <button
          onClick={() => setActiveTab('owners')}
          className={`w-full text-left px-3 py-2.5 rounded font-medium ${activeTab === 'owners' ? 'bg-red-800' : 'hover:bg-red-800'}`}
        >
          🏢 Propriétaires
        </button>

        <button
          onClick={() => setActiveTab('owner-payments')}
          className={`w-full text-left px-3 py-2.5 rounded font-medium ${activeTab === 'owner-payments' ? 'bg-red-800' : 'hover:bg-red-800'}`}
        >
          💵 Paiements propriétaires
        </button>

        {hasPermission('all') && (
          <button
            onClick={() => setActiveTab('users')}
            className={`w-full text-left px-3 py-2.5 rounded font-medium border-t border-red-500 mt-3 pt-3 ${activeTab === 'users' ? 'bg-red-800' : 'hover:bg-red-800'}`}
          >
            👤 Utilisateurs
          </button>
        )}
      </nav>

      {/* Bouton Changer mot de passe */}
      <div className="px-3 pb-2">
        <button
          onClick={() => setShowChangePassword(true)}
          className="w-full text-left px-3 py-2.5 rounded font-medium hover:bg-red-800"
        >
          🔑 Changer mot de passe
        </button>
      </div>

      {/* Bouton déconnexion */}
      <div className="p-3 border-t border-red-500">
        <button
          onClick={handleLogout}
          className="w-full p-2.5 bg-red-900 hover:bg-red-950 rounded-lg flex items-center justify-center gap-2 font-medium"
        >
          <LogOut size={18} />
          Déconnexion
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
