// ChangePassword.jsx - Changement de mot de passe (AVEC SUPABASE)
import React, { useState } from 'react';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const ChangePassword = ({ currentUser, allUsers, setAllUsers, onClose }) => {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validatePassword = (password) => {
    const errs = [];
    if (password.length < 8) errs.push('Au moins 8 caractères');
    if (!/[A-Z]/.test(password)) errs.push('Au moins une majuscule');
    if (!/[a-z]/.test(password)) errs.push('Au moins une minuscule');
    if (!/[0-9]/.test(password)) errs.push('Au moins un chiffre');
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const newErrors = {};

    // Vérifier mot de passe actuel (sur l'utilisateur en session)
    // (Optionnel: on pourrait relire en base, mais ici on reste simple)
    if (formData.currentPassword !== currentUser.password) {
      newErrors.currentPassword = 'Mot de passe actuel incorrect';
    }

    // Valider nouveau mot de passe
    const passwordErrors = validatePassword(formData.newPassword);
    if (passwordErrors.length > 0) {
      newErrors.newPassword = passwordErrors.join(', ');
    }

    // Vérifier confirmation
    if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Les mots de passe ne correspondent pas';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      // ⚠️ Ta table 'users' contient: password, must_change_password (bool)
      // Elle ne contient pas forcément 'passwordChangedAt' / 'mustChangePassword' (camelCase)
      const { data, error } = await supabase
        .from('users')
        .update({
          password: formData.newPassword,
          must_change_password: false,
        })
        .eq('id', currentUser.id)
        .select('*')
        .single();

      if (error) {
        console.error('Update password error:', error);
        alert('❌ Erreur modification mot de passe: ' + error.message);
        return;
      }

      // Mettre à jour la liste locale pour refléter la DB
      const updatedUsers = allUsers.map(u => (u.id === currentUser.id ? data : u));
      setAllUsers(updatedUsers);

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 max-w-md w-full">
        <div className="flex items-center gap-3 mb-6">
          <Lock className="text-blue-600" size={32} />
          <h2 className="text-2xl font-bold">Changer le mot de passe</h2>
        </div>

        {success ? (
          <div className="text-center py-8">
            <CheckCircle className="text-green-600 mx-auto mb-4" size={64} />
            <h3 className="text-xl font-bold text-green-900 mb-2">
              ✅ Mot de passe modifié !
            </h3>
            <p className="text-green-700">Fermeture...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Mot de passe actuel */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Mot de passe actuel
              </label>
              <div className="relative">
                <input
                  type={showPasswords.current ? 'text' : 'password'}
                  value={formData.currentPassword}
                  onChange={(e) => {
                    setFormData({ ...formData, currentPassword: e.target.value });
                    setErrors({ ...errors, currentPassword: '' });
                  }}
                  className="w-full px-4 py-2 border rounded-lg pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                >
                  {showPasswords.current ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.currentPassword && (
                <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                  <AlertCircle size={14} />
                  {errors.currentPassword}
                </p>
              )}
            </div>

            {/* Nouveau mot de passe */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Nouveau mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPasswords.new ? 'text' : 'password'}
                  value={formData.newPassword}
                  onChange={(e) => {
                    setFormData({ ...formData, newPassword: e.target.value });
                    setErrors({ ...errors, newPassword: '' });
                  }}
                  className="w-full px-4 py-2 border rounded-lg pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                >
                  {showPasswords.new ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.newPassword && (
                <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                  <AlertCircle size={14} />
                  {errors.newPassword}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Min 8 caractères, avec majuscule, minuscule et chiffre
              </p>
            </div>

            {/* Confirmer mot de passe */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                Confirmer le mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => {
                    setFormData({ ...formData, confirmPassword: e.target.value });
                    setErrors({ ...errors, confirmPassword: '' });
                  }}
                  className="w-full px-4 py-2 border rounded-lg pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                >
                  {showPasswords.confirm ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                  <AlertCircle size={14} />
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-60"
              >
                {isSubmitting ? 'Modification...' : 'Modifier'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-300 py-2 rounded-lg hover:bg-gray-400"
              >
                Annuler
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ChangePassword;
