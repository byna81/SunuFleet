// Contracts.jsx - Gestion contrats AVEC SUPABASE (CRUD + Validation Admin)
// ✅ Insert/Update/Delete en base Supabase
// ✅ Compatible snake_case (DB) + camelCase (UI) pour éviter les "Aucun contrat actif trouvé"
// ✅ Fallback automatique si la table n'a pas certaines colonnes (évite erreurs "schema cache")

import React, { useMemo, useState } from 'react';
import { FileText, Calendar, DollarSign, AlertCircle, Plus, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const Contracts = ({ contracts, setContracts, drivers, vehicles, currentUser, hasPermission }) => {
  const [selectedContract, setSelectedContract] = useState(null);
  const [showAddContract, setShowAddContract] = useState(false);
  const [editingContract, setEditingContract] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newContract, setNewContract] = useState({
    driverId: '',
    vehicleId: '',
    type: 'LAO',
    startDate: '',
    endDate: '',
    dailyAmount: '',
    deposit: '',
    totalAmount: '',
    restDay: 'Lundi'
  });

  // --- helpers compat snake/camel ---
  const get = (obj, snake, camel, fallback = undefined) => (obj?.[snake] ?? obj?.[camel] ?? fallback);
  const asNumber = (v) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };

  const normalized = useMemo(() => {
    return (contracts || []).map(c => ({
      ...c,
      // champs normalisés pour l’UI
      _driverId: Number(get(c, 'driver_id', 'driverId', 0)),
      _driverName: String(get(c, 'driver_name', 'driverName', '')),
      _vehicleId: String(get(c, 'vehicle_id', 'vehicleId', '')),
      _type: String(get(c, 'type', 'type', '')),
      _startDate: String(get(c, 'start_date', 'startDate', '')),
      _endDate: String(get(c, 'end_date', 'endDate', '')),
      _dailyAmount: asNumber(get(c, 'daily_amount', 'dailyAmount', 0)),
      _deposit: asNumber(get(c, 'deposit', 'deposit', 0)),
      _totalAmount: asNumber(get(c, 'total_amount', 'totalAmount', 0)),
      _restDay: String(get(c, 'rest_day', 'restDay', '')),
      _status: get(c, 'status', 'status', null),
      _createdByName: String(get(c, 'created_by_name', 'createdByName', '')),
    }));
  }, [contracts]);

  const pendingContracts = normalized.filter(c => c._status === 'pending');
  const activeContracts = normalized.filter(c => c._status === 'active' || c._status === 'validated' || !c._status);

  // --- Helpers: retry si colonne inexistante ---
  const dropUnknownColumnFromError = (payload, err) => {
    const msg = String(err?.message || '');
    const m = msg.match(/Could not find the '([^']+)' column/);
    if (!m) return null;
    const col = m[1];
    if (!(col in payload)) return null;
    const next = { ...payload };
    delete next[col];
    return next;
  };

  const supabaseInsertWithFallback = async (table, payload) => {
    let p = { ...payload };
    for (let i = 0; i < 10; i++) {
      const { data, error } = await supabase.from(table).insert([p]).select('*').single();
      if (!error) return { data, error: null };
      const next = dropUnknownColumnFromError(p, error);
      if (!next) return { data: null, error };
      p = next;
    }
    return { data: null, error: { message: 'Insert failed after retries' } };
  };

  const supabaseUpdateWithFallback = async (table, id, payload) => {
    let p = { ...payload };
    for (let i = 0; i < 10; i++) {
      const { data, error } = await supabase.from(table).update(p).eq('id', id).select('*').single();
      if (!error) return { data, error: null };
      const next = dropUnknownColumnFromError(p, error);
      if (!next) return { data: null, error };
      p = next;
    }
    return { data: null, error: { message: 'Update failed after retries' } };
  };

  // --- CRUD ---
  const handleAddContract = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const driverId = Number(newContract.driverId);
      const vehicleId = String(newContract.vehicleId);

      const driver = (drivers || []).find(d => Number(d.id) === driverId);
      const vehicle = (vehicles || []).find(v => String(v.id) === vehicleId);

      if (!driver) {
        alert('❌ Chauffeur invalide');
        return;
      }
      if (!vehicle) {
        alert('❌ Véhicule invalide');
        return;
      }

      const status = hasPermission('all') ? 'active' : 'pending';

      // ✅ payload SNAKE_CASE (correspond à ta table SQL)
      const payload = {
        driver_id: driverId,
        driver_name: driver?.name || '',
        vehicle_id: vehicleId,
        type: newContract.type,
        start_date: newContract.startDate,
        end_date: newContract.endDate,
        daily_amount: asNumber(newContract.dailyAmount),
        deposit: asNumber(newContract.deposit),
        total_amount: asNumber(newContract.totalAmount),
        rest_day: newContract.restDay,
        status,

        created_by: currentUser?.id ?? null,
        created_by_name: currentUser?.name ?? '',
        created_at: new Date().toISOString(),
      };

      if (hasPermission('all')) {
        payload.validated_by = currentUser?.id ?? null;
        payload.validated_by_name = currentUser?.name ?? '';
        payload.validated_at = new Date().toISOString();
      }

      const { data, error } = await supabaseInsertWithFallback('contracts', payload);
      if (error) {
        console.error('Insert contract error:', error);
        alert('❌ Erreur création contrat: ' + error.message);
        return;
      }

      setContracts([...(contracts || []), data]);

      alert(
        hasPermission('all')
          ? `✅ Contrat créé et activé!\n${driver?.name || ''} - ${data.type}`
          : `✅ Contrat créé!\nEn attente de validation Admin\n${driver?.name || ''} - ${data.type}`
      );

      setShowAddContract(false);
      setNewContract({
        driverId: '',
        vehicleId: '',
        type: 'LAO',
        startDate: '',
        endDate: '',
        dailyAmount: '',
        deposit: '',
        totalAmount: '',
        restDay: 'Lundi'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditContract = async (e) => {
    e.preventDefault();
    if (!editingContract || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const id = Number(editingContract.id);

      const driverId = Number(get(editingContract, 'driver_id', 'driverId', 0));
      const driver = (drivers || []).find(d => Number(d.id) === driverId);

      const payload = {
        // on ne met à jour que ce que le formulaire modifie
        daily_amount: asNumber(editingContract._dailyAmount ?? get(editingContract, 'daily_amount', 'dailyAmount', 0)),
        rest_day: String(editingContract._restDay ?? get(editingContract, 'rest_day', 'restDay', '')),

        // sécurise le driver_name si présent
        driver_name: driver?.name || get(editingContract, 'driver_name', 'driverName', ''),

        status: hasPermission('all') ? get(editingContract, 'status', 'status', 'active') : 'pending',

        modified_by: currentUser?.id ?? null,
        modified_by_name: currentUser?.name ?? '',
        modified_at: new Date().toISOString(),
      };

      const { data, error } = await supabaseUpdateWithFallback('contracts', id, payload);
      if (error) {
        console.error('Update contract error:', error);
        alert('❌ Erreur modification contrat: ' + error.message);
        return;
      }

      setContracts((contracts || []).map(c => (Number(c.id) === Number(data.id) ? data : c)));
      alert('✅ Contrat modifié!');
      setEditingContract(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteContract = async (contractId) => {
    const contract = (contracts || []).find(c => Number(c.id) === Number(contractId));
    if (!contract) return;

    const driverName = contract.driver_name ?? contract.driverName ?? '';
    if (!window.confirm(`Supprimer le contrat de ${driverName} ?`)) return;

    const { error } = await supabase.from('contracts').delete().eq('id', contractId);
    if (error) {
      console.error('Delete contract error:', error);
      alert('❌ Erreur suppression contrat: ' + error.message);
      return;
    }

    setContracts((contracts || []).filter(c => Number(c.id) !== Number(contractId)));
    alert('✅ Contrat supprimé');
  };

  const handleValidateContract = async (contractId) => {
    if (!hasPermission('all')) return;

    const payload = {
      status: 'active',
      validated_by: currentUser?.id ?? null,
      validated_by_name: currentUser?.name ?? '',
      validated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseUpdateWithFallback('contracts', contractId, payload);
    if (error) {
      console.error('Validate contract error:', error);
      alert('❌ Erreur validation: ' + error.message);
      return;
    }

    setContracts((contracts || []).map(c => (Number(c.id) === Number(data.id) ? data : c)));
    alert('✅ Contrat validé');
  };

  const handleRejectContract = async (contractId) => {
    if (!hasPermission('all')) return;

    const reason = window.prompt('Motif du rejet:');
    if (!reason) return;

    const payload = {
      status: 'rejected',
      rejected_by: currentUser?.id ?? null,
      rejected_by_name: currentUser?.name ?? '',
      rejected_at: new Date().toISOString(),
      rejection_reason: reason,
    };

    const { data, error } = await supabaseUpdateWithFallback('contracts', contractId, payload);
    if (error) {
      console.error('Reject contract error:', error);
      alert('❌ Erreur rejet: ' + error.message);
      return;
    }

    setContracts((contracts || []).map(c => (Number(c.id) === Number(data.id) ? data : c)));
    alert('❌ Contrat rejeté');
  };

  const calculateDaysRemaining = (endDate) => {
    const end = new Date(endDate);
    const today = new Date();
    const diffTime = end - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const calculateProgress = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    const total = end - start;
    const elapsed = today - start;
    return total > 0 ? Math.min(Math.max((elapsed / total) * 100, 0), 100) : 0;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">📋 Gestion des contrats</h1>
          <p className="text-gray-600 mt-2">{activeContracts.length} contrat(s) actif(s)</p>
        </div>
        <button
          onClick={() => setShowAddContract(true)}
          className="bg-green-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-green-700"
        >
          <Plus size={20} />
          Ajouter un contrat
        </button>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="text-blue-600" size={32} />
            <h3 className="font-bold text-blue-900">Contrats LAO</h3>
          </div>
          <p className="text-3xl font-bold text-blue-700">
            {activeContracts.filter(c => c._type === 'LAO').length}
          </p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="text-green-600" size={32} />
            <h3 className="font-bold text-green-900">Contrats Location</h3>
          </div>
          <p className="text-3xl font-bold text-green-700">
            {activeContracts.filter(c => c._type === 'Location').length}
          </p>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="text-purple-600" size={32} />
            <h3 className="font-bold text-purple-900">Revenus journaliers</h3>
          </div>
          <p className="text-3xl font-bold text-purple-700">
            {activeContracts.reduce((sum, c) => sum + (Number(c._dailyAmount) || 0), 0).toLocaleString()} FCFA
          </p>
        </div>
      </div>

      {/* Validations en attente - Admin uniquement */}
      {hasPermission('all') && pendingContracts.length > 0 && (
        <div className="mb-8 bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6">
          <h2 className="text-xl font-bold text-yellow-900 mb-4 flex items-center gap-2">
            <AlertCircle size={24} />
            ⚠️ Validations en attente ({pendingContracts.length})
          </h2>
          <div className="space-y-3">
            {pendingContracts.map(contract => (
              <div key={contract.id} className="bg-white p-4 rounded-lg border border-yellow-200">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-lg">{contract._driverName}</p>
                    <p className="text-sm text-gray-600">Type: {contract._type}</p>
                    <p className="text-sm text-gray-600">Véhicule: {contract._vehicleId}</p>
                    <p className="text-sm text-gray-600">
                      Montant: {(Number(contract._dailyAmount) || 0).toLocaleString()} FCFA/jour
                    </p>
                    <p className="text-sm text-gray-500">Créé par: {contract._createdByName}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleValidateContract(contract.id)}
                      className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-1"
                    >
                      <CheckCircle size={16} />
                      Valider
                    </button>
                    <button
                      onClick={() => handleRejectContract(contract.id)}
                      className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 flex items-center gap-1"
                    >
                      <XCircle size={16} />
                      Rejeter
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Ajout */}
      {showAddContract && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">Nouveau contrat</h2>
            <form onSubmit={handleAddContract}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Chauffeur</label>
                <select
                  value={newContract.driverId}
                  onChange={(e) => setNewContract({ ...newContract, driverId: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                >
                  <option value="">Sélectionner</option>
                  {(drivers || []).map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Véhicule</label>
                <select
                  value={newContract.vehicleId}
                  onChange={(e) => setNewContract({ ...newContract, vehicleId: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                >
                  <option value="">Sélectionner</option>
                  {(vehicles || []).map(v => (
                    <option key={v.id} value={v.id}>{v.id} - {v.brand}</option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Type de contrat</label>
                <select
                  value={newContract.type}
                  onChange={(e) => setNewContract({ ...newContract, type: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                >
                  <option value="LAO">LAO</option>
                  <option value="Location">Location</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Date début</label>
                  <input
                    type="date"
                    value={newContract.startDate}
                    onChange={(e) => setNewContract({ ...newContract, startDate: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Date fin</label>
                  <input
                    type="date"
                    value={newContract.endDate}
                    onChange={(e) => setNewContract({ ...newContract, endDate: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Montant journalier (FCFA)</label>
                <input
                  type="number"
                  value={newContract.dailyAmount}
                  onChange={(e) => setNewContract({ ...newContract, dailyAmount: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Caution (FCFA)</label>
                <input
                  type="number"
                  value={newContract.deposit}
                  onChange={(e) => setNewContract({ ...newContract, deposit: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Montant total (FCFA)</label>
                <input
                  type="number"
                  value={newContract.totalAmount}
                  onChange={(e) => setNewContract({ ...newContract, totalAmount: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Jour de repos</label>
                <select
                  value={newContract.restDay}
                  onChange={(e) => setNewContract({ ...newContract, restDay: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                >
                  {['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'].map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <button disabled={isSubmitting} type="submit" className="flex-1 bg-green-600 text-white py-2 rounded-lg disabled:opacity-60">
                  {isSubmitting ? 'Création...' : 'Créer'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddContract(false)}
                  className="flex-1 bg-gray-300 py-2 rounded-lg"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Modification */}
      {editingContract && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">Modifier le contrat</h2>
            <form onSubmit={handleEditContract}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Montant journalier (FCFA)</label>
                <input
                  type="number"
                  value={editingContract._dailyAmount ?? get(editingContract,'daily_amount','dailyAmount','')}
                  onChange={(e) => setEditingContract({ ...editingContract, _dailyAmount: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Jour de repos</label>
                <select
                  value={editingContract._restDay ?? get(editingContract,'rest_day','restDay','Lundi')}
                  onChange={(e) => setEditingContract({ ...editingContract, _restDay: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                >
                  {['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'].map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <button disabled={isSubmitting} type="submit" className="flex-1 bg-orange-600 text-white py-2 rounded-lg disabled:opacity-60">
                  {isSubmitting ? 'Modification...' : 'Modifier'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingContract(null)}
                  className="flex-1 bg-gray-300 py-2 rounded-lg"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Détails */}
      {selectedContract && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">📋 Détails du contrat</h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded">
                  <p className="text-sm text-blue-700">Chauffeur</p>
                  <p className="font-bold text-lg">{selectedContract._driverName}</p>
                </div>
                <div className="p-4 bg-green-50 rounded">
                  <p className="text-sm text-green-700">Véhicule</p>
                  <p className="font-bold text-lg">{selectedContract._vehicleId}</p>
                </div>
              </div>

              <div className="p-4 bg-purple-50 rounded border border-purple-200">
                <p className="text-sm text-purple-700 mb-1">Type de contrat</p>
                <span className={`px-3 py-1 rounded-full font-bold ${
                  selectedContract._type === 'LAO'
                    ? 'bg-blue-200 text-blue-800'
                    : 'bg-green-200 text-green-800'
                }`}>
                  {selectedContract._type}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded">
                  <p className="text-sm text-gray-600">Début</p>
                  <p className="font-bold">{selectedContract._startDate ? new Date(selectedContract._startDate).toLocaleDateString('fr-FR') : '—'}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded">
                  <p className="text-sm text-gray-600">Fin</p>
                  <p className="font-bold">{selectedContract._endDate ? new Date(selectedContract._endDate).toLocaleDateString('fr-FR') : '—'}</p>
                </div>
              </div>

              <div className="p-4 bg-yellow-50 rounded border border-yellow-200">
                <p className="text-sm text-yellow-700">Montant journalier</p>
                <p className="text-2xl font-bold text-yellow-900">
                  {(Number(selectedContract._dailyAmount) || 0).toLocaleString()} FCFA
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded">
                  <p className="text-sm text-gray-600">Caution versée</p>
                  <p className="font-bold">{(Number(selectedContract._deposit) || 0).toLocaleString()} FCFA</p>
                </div>
                <div className="p-4 bg-gray-50 rounded">
                  <p className="text-sm text-gray-600">Montant total</p>
                  <p className="font-bold">{(Number(selectedContract._totalAmount) || 0).toLocaleString()} FCFA</p>
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded border border-blue-200">
                <p className="text-sm text-blue-700">Jour de repos</p>
                <p className="font-bold text-blue-900">{selectedContract._restDay}</p>
              </div>
            </div>

            <button
              onClick={() => setSelectedContract(null)}
              className="mt-6 w-full bg-gray-300 py-2 rounded-lg hover:bg-gray-400"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Liste des contrats */}
      <div className="grid grid-cols-1 gap-6">
        {activeContracts.map(contract => {
          const daysRemaining = calculateDaysRemaining(contract._endDate);
          const progress = calculateProgress(contract._startDate, contract._endDate);
          const isExpiringSoon = daysRemaining <= 30 && daysRemaining > 0;
          const isExpired = daysRemaining <= 0;

          return (
            <div
              key={contract.id}
              className={`bg-white rounded-xl shadow-lg border-l-4 ${
                contract._type === 'LAO' ? 'border-blue-500' : 'border-green-500'
              }`}
            >
              <div className={`p-4 ${
                contract._type === 'LAO' ? 'bg-blue-50' : 'bg-green-50'
              }`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-xl">{contract._driverName}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        contract._type === 'LAO'
                          ? 'bg-blue-200 text-blue-800'
                          : 'bg-green-200 text-green-800'
                      }`}>
                        {contract._type}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">🚗 {contract._vehicleId}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedContract(contract)}
                      className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                    >
                      Détails →
                    </button>
                    <button
                      onClick={() => setEditingContract(contract)}
                      className="text-orange-600 hover:text-orange-800"
                      title="Modifier"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteContract(contract.id)}
                      className="text-red-600 hover:text-red-800"
                      title="Supprimer"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4">
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-600">Montant/jour</p>
                    <p className="font-bold text-lg">{(Number(contract._dailyAmount) || 0).toLocaleString()} FCFA</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Caution</p>
                    <p className="font-bold text-lg">{(Number(contract._deposit) || 0).toLocaleString()} FCFA</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Jour de repos</p>
                    <p className="font-bold text-lg flex items-center gap-1">
                      <Calendar size={16} />
                      {contract._restDay}
                    </p>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>{contract._startDate ? new Date(contract._startDate).toLocaleDateString('fr-FR') : '—'}</span>
                    <span>{contract._endDate ? new Date(contract._endDate).toLocaleDateString('fr-FR') : '—'}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        isExpired ? 'bg-red-500' : isExpiringSoon ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className={`text-xs mt-1 ${
                    isExpired ? 'text-red-600' : isExpiringSoon ? 'text-yellow-700' : 'text-green-700'
                  }`}>
                    {isExpired
                      ? `⚠️ Expiré depuis ${Math.abs(daysRemaining)} jour(s)`
                      : isExpiringSoon
                      ? `⏰ Expire dans ${daysRemaining} jour(s)`
                      : `✅ ${daysRemaining} jour(s) restant(s)`}
                  </p>
                </div>

                <div className="p-3 bg-gray-50 rounded">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Montant total du contrat</span>
                    <span className="font-bold text-lg">{(Number(contract._totalAmount) || 0).toLocaleString()} FCFA</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Contracts;
