// Contracts.jsx - Gestion contrats AVEC SUPABASE (CRUD + Validation Admin) - FIX snake_case
import React, { useMemo, useState } from 'react';
import { FileText, Calendar, DollarSign, AlertCircle, Plus, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const toCamel = (row) => {
  if (!row) return row;
  return {
    id: row.id,
    driverId: row.driver_id,
    driverName: row.driver_name,
    vehicleId: row.vehicle_id,
    type: row.type,
    startDate: row.start_date,
    endDate: row.end_date,
    dailyAmount: row.daily_amount,
    deposit: row.deposit,
    totalAmount: row.total_amount,
    restDay: row.rest_day,
    status: row.status,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    validatedBy: row.validated_by,
    validatedByName: row.validated_by_name,
    validatedAt: row.validated_at,
    rejectedBy: row.rejected_by,
    rejectedByName: row.rejected_by_name,
    rejectedAt: row.rejected_at,
    rejectionReason: row.rejection_reason,
  };
};

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

  // Normalise les contrats venant de Supabase (snake_case) -> camelCase pour l'UI
  const uiContracts = useMemo(() => (contracts || []).map(toCamel), [contracts]);

  const pendingContracts = uiContracts.filter(c => c.status === 'pending');
  const activeContracts = uiContracts.filter(c => c.status === 'active' || !c.status);

  const refreshContractsFromDb = async () => {
    const { data, error } = await supabase.from('contracts').select('*').order('id', { ascending: false });
    if (error) {
      console.error('Refresh contracts error:', error);
      return;
    }
    setContracts(data || []);
  };

  const handleAddContract = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const driver = drivers.find(d => d.id === parseInt(newContract.driverId));
      const status = hasPermission('all') ? 'active' : 'pending';

      // ✅ IMPORTANT: ta table est en snake_case
      const payload = {
        driver_id: parseInt(newContract.driverId),
        driver_name: driver?.name || '',
        vehicle_id: newContract.vehicleId || null,
        type: newContract.type,
        start_date: newContract.startDate,
        end_date: newContract.endDate,
        daily_amount: Number(newContract.dailyAmount),
        deposit: Number(newContract.deposit),
        total_amount: Number(newContract.totalAmount),
        rest_day: newContract.restDay,
        status,
        created_by: currentUser?.id ?? null,
        created_by_name: currentUser?.name ?? null,
      };

      if (hasPermission('all')) {
        payload.validated_by = currentUser?.id ?? null;
        payload.validated_by_name = currentUser?.name ?? null;
        payload.validated_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('contracts')
        .insert([payload])
        .select('*')
        .single();

      if (error) {
        console.error('Insert contract error:', error);
        alert('❌ Erreur création contrat: ' + error.message);
        return;
      }

      await refreshContractsFromDb();

      alert(
        hasPermission('all')
          ? `✅ Contrat créé et validé!\n${driver?.name || ''} - ${data.type}`
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
      const payload = {
        daily_amount: Number(editingContract.dailyAmount),
        rest_day: editingContract.restDay,
        ...(hasPermission('all') ? {} : { status: 'pending' }),
      };

      const { error } = await supabase
        .from('contracts')
        .update(payload)
        .eq('id', editingContract.id);

      if (error) {
        console.error('Update contract error:', error);
        alert('❌ Erreur modification contrat: ' + error.message);
        return;
      }

      await refreshContractsFromDb();
      alert('✅ Contrat modifié!');
      setEditingContract(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteContract = async (contractId) => {
    const contract = uiContracts.find(c => c.id === contractId);
    if (!contract) return;

    if (!window.confirm(`Supprimer le contrat de ${contract.driverName || ''} ?`)) return;

    const { error } = await supabase.from('contracts').delete().eq('id', contractId);
    if (error) {
      console.error('Delete contract error:', error);
      alert('❌ Erreur suppression contrat: ' + error.message);
      return;
    }

    await refreshContractsFromDb();
    alert('✅ Contrat supprimé');
  };

  const handleValidateContract = async (contractId) => {
    if (!hasPermission('all')) return;

    const payload = {
      status: 'active',
      validated_by: currentUser?.id ?? null,
      validated_by_name: currentUser?.name ?? null,
      validated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('contracts')
      .update(payload)
      .eq('id', contractId);

    if (error) {
      console.error('Validate contract error:', error);
      alert('❌ Erreur validation: ' + error.message);
      return;
    }

    await refreshContractsFromDb();
    alert('✅ Contrat validé');
  };

  const handleRejectContract = async (contractId) => {
    if (!hasPermission('all')) return;

    const reason = window.prompt('Motif du rejet:');
    if (!reason) return;

    const payload = {
      status: 'rejected',
      rejected_by: currentUser?.id ?? null,
      rejected_by_name: currentUser?.name ?? null,
      rejected_at: new Date().toISOString(),
      rejection_reason: reason,
    };

    const { error } = await supabase
      .from('contracts')
      .update(payload)
      .eq('id', contractId);

    if (error) {
      console.error('Reject contract error:', error);
      alert('❌ Erreur rejet: ' + error.message);
      return;
    }

    await refreshContractsFromDb();
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
    return Math.min(Math.max((elapsed / total) * 100, 0), 100);
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
            {activeContracts.filter(c => c.type === 'LAO').length}
          </p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="text-green-600" size={32} />
            <h3 className="font-bold text-green-900">Contrats Location</h3>
          </div>
          <p className="text-3xl font-bold text-green-700">
            {activeContracts.filter(c => c.type === 'Location').length}
          </p>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="text-purple-600" size={32} />
            <h3 className="font-bold text-purple-900">Revenus journaliers</h3>
          </div>
          <p className="text-3xl font-bold text-purple-700">
            {activeContracts.reduce((sum, c) => sum + (Number(c.dailyAmount) || 0), 0).toLocaleString()} FCFA
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
                    <p className="font-bold text-lg">{contract.driverName}</p>
                    <p className="text-sm text-gray-600">Type: {contract.type}</p>
                    <p className="text-sm text-gray-600">Véhicule: {contract.vehicleId}</p>
                    <p className="text-sm text-gray-600">
                      Montant: {(Number(contract.dailyAmount) || 0).toLocaleString()} FCFA/jour
                    </p>
                    <p className="text-sm text-gray-500">Créé par: {contract.createdByName}</p>
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
                  {drivers.map(d => (
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
                  {vehicles.map(v => (
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
                  value={editingContract.dailyAmount}
                  onChange={(e) => setEditingContract({ ...editingContract, dailyAmount: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Jour de repos</label>
                <select
                  value={editingContract.restDay}
                  onChange={(e) => setEditingContract({ ...editingContract, restDay: e.target.value })}
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
                  <p className="font-bold text-lg">{selectedContract.driverName}</p>
                </div>
                <div className="p-4 bg-green-50 rounded">
                  <p className="text-sm text-green-700">Véhicule</p>
                  <p className="font-bold text-lg">{selectedContract.vehicleId}</p>
                </div>
              </div>

              <div className="p-4 bg-purple-50 rounded border border-purple-200">
                <p className="text-sm text-purple-700 mb-1">Type de contrat</p>
                <span className={`px-3 py-1 rounded-full font-bold ${
                  selectedContract.type === 'LAO'
                    ? 'bg-blue-200 text-blue-800'
                    : 'bg-green-200 text-green-800'
                }`}>
                  {selectedContract.type}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded">
                  <p className="text-sm text-gray-600">Début</p>
                  <p className="font-bold">{new Date(selectedContract.startDate).toLocaleDateString('fr-FR')}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded">
                  <p className="text-sm text-gray-600">Fin</p>
                  <p className="font-bold">{new Date(selectedContract.endDate).toLocaleDateString('fr-FR')}</p>
                </div>
              </div>

              <div className="p-4 bg-yellow-50 rounded border border-yellow-200">
                <p className="text-sm text-yellow-700">Montant journalier</p>
                <p className="text-2xl font-bold text-yellow-900">
                  {(Number(selectedContract.dailyAmount) || 0).toLocaleString()} FCFA
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded">
                  <p className="text-sm text-gray-600">Caution versée</p>
                  <p className="font-bold">{(Number(selectedContract.deposit) || 0).toLocaleString()} FCFA</p>
                </div>
                <div className="p-4 bg-gray-50 rounded">
                  <p className="text-sm text-gray-600">Montant total</p>
                  <p className="font-bold">{(Number(selectedContract.totalAmount) || 0).toLocaleString()} FCFA</p>
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded border border-blue-200">
                <p className="text-sm text-blue-700">Jour de repos</p>
                <p className="font-bold text-blue-900">{selectedContract.restDay}</p>
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
          const daysRemaining = calculateDaysRemaining(contract.endDate);
          const progress = calculateProgress(contract.startDate, contract.endDate);
          const isExpiringSoon = daysRemaining <= 30 && daysRemaining > 0;
          const isExpired = daysRemaining <= 0;

          return (
            <div
              key={contract.id}
              className={`bg-white rounded-xl shadow-lg border-l-4 ${
                contract.type === 'LAO' ? 'border-blue-500' : 'border-green-500'
              }`}
            >
              <div className={`p-4 ${
                contract.type === 'LAO' ? 'bg-blue-50' : 'bg-green-50'
              }`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-xl">{contract.driverName}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        contract.type === 'LAO'
                          ? 'bg-blue-200 text-blue-800'
                          : 'bg-green-200 text-green-800'
                      }`}>
                        {contract.type}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">🚗 {contract.vehicleId}</p>
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
                    <p className="font-bold text-lg">{(Number(contract.dailyAmount) || 0).toLocaleString()} FCFA</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Caution</p>
                    <p className="font-bold text-lg">{(Number(contract.deposit) || 0).toLocaleString()} FCFA</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Jour de repos</p>
                    <p className="font-bold text-lg flex items-center gap-1">
                      <Calendar size={16} />
                      {contract.restDay}
                    </p>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>{new Date(contract.startDate).toLocaleDateString('fr-FR')}</span>
                    <span>{new Date(contract.endDate).toLocaleDateString('fr-FR')}</span>
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
                    <span className="font-bold text-lg">{(Number(contract.totalAmount) || 0).toLocaleString()} FCFA</span>
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
