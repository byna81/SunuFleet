// Users.jsx - Gestion des utilisateurs (Admin uniquement) - AVEC SUPABASE (INSERT/DELETE + vérification email/username)
import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const Users = ({ allUsers, setAllUsers, currentUser }) => {
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    name: '',
    email: '',
    phone: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      const avatars = ['👨🏿‍💼', '👩🏿‍💼', '👨🏿', '👩🏿', '👨🏿‍🔧', '👩🏿‍🔧'];
      const randomAvatar = avatars[Math.floor(Math.random() * avatars.length)];

      const payload = {
        username: (newUser.username || '').trim(),
        password: (newUser.password || '').trim(),
        name: (newUser.name || '').trim(),
        email: (newUser.email || '').1trim?.() || (newUser.email || '').trim(),
        phone: (newUser.phone || '').trim(),
        role: 'Gestionnaire',
        avatar: randomAvatar,
        permissions: ['drivers', 'contracts', 'payments', 'vehicles', 'maintenance', 'alerts'],
        must_change_password: false,
      };

      // Vérifier email déjà utilisé
      const { data: existingEmail } = await supabase
        .from('users')
        .select('id')
        .eq('email', payload.email)
        .maybeSingle();

      if (existingEmail) {
        alert("❌ Cet email est déjà utilisé. Mets un autre email.");
        return;
      }

      // Vérifier username déjà utilisé
      const { data: existingUsername } = await supabase
        .from('users')
        .select('id')
        .eq('username', payload.username)
        .maybeSingle();

      if (existingUsername) {
        alert("❌ Ce nom d'utilisateur est déjà utilisé. Choisis-en un autre.");
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .insert([payload])
        .select('*')
        .single();

      if (error) {
        console.error('Insert user error:', error);
        alert('❌ Erreur création utilisateur: ' + error.message);
        return;
      }

      setAllUsers([data, ...allUsers]);
      alert(`✅ Utilisateur créé!\n${data.name} - Gestionnaire`);

      setShowAddUser(false);
      setNewUser({ username: '', password: '', name: '', email: '', phone: '' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;

    if (user.role === 'Administrateur') {
      alert('Impossible de supprimer un administrateur');
      return;
    }

    if (!confirm(`Supprimer ${user.name} ?`)) return;

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (error) {
      console.error('Delete user error:', error);
      alert('❌ Erreur suppression: ' + error.message);
      return;
    }

    setAllUsers(allUsers.filter(u => u.id !== userId));
    alert(`✅ ${user.name} supprimé`);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">👤 Gestion des utilisateurs</h1>
        <button
          onClick={() => setShowAddUser(true)}
          className="bg-green-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-green-700"
        >
          <Plus size={20} />
          Ajouter un gestionnaire
        </button>
      </div>

      {showAddUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-6">Nouveau gestionnaire</h2>
            <form onSubmit={handleAddUser}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Nom complet</label>
                <input type="text" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Nom d'utilisateur</label>
                <input type="text" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Mot de passe</label>
                <input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Email</label>
                <input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Téléphone</label>
                <input type="tel" value={newUser.phone} onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required />
              </div>

              <div className="flex gap-2">
                <button type="submit" disabled={isSubmitting} className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-60">
                  {isSubmitting ? 'Création...' : 'Créer'}
                </button>
                <button type="button" onClick={() => setShowAddUser(false)} className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg">
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {allUsers.map(user => (
          <div key={user.id} className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="text-5xl">{user.avatar || '👤'}</div>
                <div>
                  <h3 className="font-bold text-xl">{user.name}</h3>
                  <p className="text-sm text-gray-600">{user.role}</p>
                  <p className="text-xs text-gray-500 mt-1">@{user.username}</p>
                </div>
              </div>
              {user.role !== 'Administrateur' && (
                <button onClick={() => handleDeleteUser(user.id)} className="text-red-600 hover:text-red-800">
                  <Trash2 size={20} />
                </button>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 text-sm">
              <p className="text-gray-600">📧 {user.email}</p>
              <p className="text-gray-600">📱 {user.phone}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Users;
