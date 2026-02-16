// Vehicles.jsx - Gestion véhicules AVEC SUPABASE (CRUD + Validation Admin)
// ✅ Insert/Update/Delete en base Supabase
// ✅ Compatible snake_case (DB) + camelCase (UI)
// ✅ Refresh depuis la DB après chaque action
import React, { useMemo, useState } from 'react';
import { Plus, Edit, Trash2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const toCamelVehicle = (row) => {
  if (!row) return row;
  // Si déjà camelCase, on renvoie tel quel
  if ('ownershipType' in row || 'ownerName' in row) return row;

  return {
    id: row.id,
    brand: row.brand,
    year: row.year,
    ownershipType: row.ownership_type,
    ownerName: row.owner_name,
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
    // optionnel si tu as ces colonnes
    driverId: row.driver_id,
    driverName: row.driver_name,
  };
};

const getVehicleId = (v) => (v?.vehicleId ?? v?.vehicle_id ?? v?.id ?? null);
const getContractId = (p) => (p?.contractId ?? p?.contract_id ?? null);
const getContractVehicleId = (c) => (c?.vehicleId ?? c?.vehicle_id ?? null);

const Vehicles = ({ payments, vehicles, setVehicles, currentUser, hasPermission, managementContracts, contracts, setActiveTab }) => {
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newVehicle, setNewVehicle] = useState({
    id: '',
    brand: '',
    year: '',
    ownershipType: 'Société',
    ownerName: ''
  });

  const uiVehicles = useMemo(() => (vehicles || []).map(toCamelVehicle), [vehicles]);

  const pendingVehicles = uiVehicles.filter(v => v.status === 'pending');
  const validatedVehicles = uiVehicles.filter(v => v.status === 'validated' || !v.status);

  // --- Helpers (fallback si colonnes pas exactement comme prévu) ---
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
    for (let i = 0; i < 8; i++) {
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
    for (let i = 0; i < 8; i++) {
      const { data, error } = await supabase.from(table).update(p).eq('id', id).select('*').single();
      if (!error) return { data, error: null };
      const next = dropUnknownColumnFromError(p, error);
      if (!next) return { data: null, error };
      p = next;
    }
    return { data: null, error: { message: 'Update failed after retries' } };
  };

  const refreshVehiclesFromDb = async () => {
    const { data, error } = await supabase.from('vehicles').select('*').order('id', { ascending: true });
    if (error) {
      console.error('Refresh vehicles error:', error);
      return;
    }
    setVehicles(data || []);
  };

  // --- CRUD ---
  const handleAddVehicle = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const status = hasPermission('all') ? 'validated' : 'pending';

      // ✅ DB attend généralement du snake_case
      const payload = {
        id: (newVehicle.id || '').trim(),
        brand: (newVehicle.brand || '').trim(),
        year: Number(newVehicle.year),
        ownership_type: newVehicle.ownershipType,
        owner_name: newVehicle.ownershipType === 'Particulier' ? (newVehicle.ownerName || '').trim() : null,
        status,
        created_by: currentUser?.id ?? null,
        created_by_name: currentUser?.name ?? null,
        created_at: new Date().toISOString()
      };

      if (hasPermission('all')) {
        payload.validated_by = currentUser?.id ?? null;
        payload.validated_by_name = currentUser?.name ?? null;
        payload.validated_at = new Date().toISOString();
      }

      const { error } = await supabaseInsertWithFallback('vehicles', payload);
      if (error) {
        console.error('Insert vehicle error:', error);
        alert('❌ Erreur ajout véhicule: ' + error.message);
        return;
      }

      await refreshVehiclesFromDb();

      alert(
        hasPermission('all')
          ? `✅ Véhicule ajouté et validé!\n${payload.id} - ${payload.brand}`
          : `✅ Véhicule ajouté!\nEn attente de validation Admin\n${payload.id} - ${payload.brand}`
      );

      setShowAddVehicle(false);
      setNewVehicle({
        id: '',
        brand: '',
        year: '',
        ownershipType: 'Société',
        ownerName: ''
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditVehicle = async (e) => {
    e.preventDefault();
    if (!editingVehicle || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const payload = {
        brand: (editingVehicle.brand || '').trim(),
        year: Number(editingVehicle.year),
        ownership_type: editingVehicle.ownershipType,
        owner_name: editingVehicle.ownershipType === 'Particulier' ? (editingVehicle.ownerName || '').trim() : null,
        status: hasPermission('all') ? editingVehicle.status : 'pending',
        modified_by: currentUser?.id ?? null,
        modified_by_name: currentUser?.name ?? null,
        modified_at: new Date().toISOString()
      };

      const { error } = await supabaseUpdateWithFallback('vehicles', editingVehicle.id, payload);
      if (error) {
        console.error('Update vehicle error:', error);
        alert('❌ Erreur modification véhicule: ' + error.message);
        return;
      }

      await refreshVehiclesFromDb();
      alert('✅ Véhicule modifié!');
      setEditingVehicle(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteVehicle = async (vehicleId) => {
    if (!window.confirm(`Supprimer le véhicule ${vehicleId} ?`)) return;

    const { error } = await supabase.from('vehicles').delete().eq('id', vehicleId);
    if (error) {
      console.error('Delete vehicle error:', error);
      alert('❌ Erreur suppression véhicule: ' + error.message);
      return;
    }

    await refreshVehiclesFromDb();
    alert('✅ Véhicule supprimé');
  };

  const handleValidateVehicle = async (vehicleId) => {
    if (!hasPermission('all')) return;

    const payload = {
      status: 'validated',
      validated_by: currentUser?.id ?? null,
      validated_by_name: currentUser?.name ?? null,
      validated_at: new Date().toISOString()
    };

    const { error } = await supabaseUpdateWithFallback('vehicles', vehicleId, payload);
    if (error) {
      console.error('Validate vehicle error:', error);
      alert('❌ Erreur validation véhicule: ' + error.message);
      return;
    }

    await refreshVehiclesFromDb();
    alert('✅ Véhicule validé');
  };

  const handleRejectVehicle = async (vehicleId) => {
    if (!hasPermission('all')) return;

    const reason = window.prompt('Motif du rejet:');
    if (!reason) return;

    const payload = {
      status: 'rejected',
      rejected_by: currentUser?.id ?? null,
      rejected_by_name: currentUser?.name ?? null,
      rejected_at: new Date().toISOString(),
      rejection_reason: reason
    };

    const { error } = await supabaseUpdateWithFallback('vehicles', vehicleId, payload);
    if (error) {
      console.error('Reject vehicle error:', error);
      alert('❌ Erreur rejet véhicule: ' + error.message);
      return;
    }

    await refreshVehiclesFromDb();
    alert('❌ Véhicule rejeté');
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">🚗 Parc automobile</h1>
        <button
          onClick={() => setShowAddVehicle(true)}
          className="bg-green-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-green-700"
        >
          <Plus size={20} />
          Ajouter un véhicule
        </button>
      </div>

      {/* Validations en attente */}
      {hasPermission('all') && pendingVehicles.length > 0 && (
        <div className="mb-8 bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6">
          <h2 className="text-xl font-bold text-yellow-900 mb-4 flex items-center gap-2">
            <AlertCircle size={24} />
            ⚠️ Validations en attente ({pendingVehicles.length})
          </h2>
          <div className="space-y-3">
            {pendingVehicles.map(vehicle => (
              <div key={vehicle.id} className="bg-white p-4 rounded-lg border border-yellow-200">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-lg">{vehicle.id}</p>
                    <p className="text-sm text-gray-600">{vehicle.brand} ({vehicle.year})</p>
                    <p className="text-sm text-gray-600">Type: {vehicle.ownershipType}</p>
                    {vehicle.ownerName && <p className="text-sm text-gray-600">Propriétaire: {vehicle.ownerName}</p>}
                    <p className="text-sm text-gray-500">Créé par: {vehicle.createdByName}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleValidateVehicle(vehicle.id)}
                      className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-1"
                    >
                      <CheckCircle size={16} />
                      Valider
                    </button>
                    <button
                      onClick={() => handleRejectVehicle(vehicle.id)}
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
      {showAddVehicle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-6">Nouveau véhicule</h2>
            <form onSubmit={handleAddVehicle}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Matricule</label>
                <input
                  type="text"
                  value={newVehicle.id}
                  onChange={(e) => setNewVehicle({ ...newVehicle, id: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="Ex: DK-123-AB"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Marque / Modèle</label>
                <input
                  type="text"
                  value={newVehicle.brand}
                  onChange={(e) => setNewVehicle({ ...newVehicle, brand: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="Ex: Toyota Corolla"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Année</label>
                <input
                  type="number"
                  value={newVehicle.year}
                  onChange={(e) => setNewVehicle({ ...newVehicle, year: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  min="2000"
                  max="2030"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Type de propriété</label>
                <select
                  value={newVehicle.ownershipType}
                  onChange={(e) => setNewVehicle({ ...newVehicle, ownershipType: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="Société">Société</option>
                  <option value="Particulier">Particulier</option>
                </select>
              </div>
              {newVehicle.ownershipType === 'Particulier' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Nom du propriétaire</label>
                  <input
                    type="text"
                    value={newVehicle.ownerName}
                    onChange={(e) => setNewVehicle({ ...newVehicle, ownerName: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    required
                  />
                </div>
              )}
              <div className="flex gap-2">
                <button disabled={isSubmitting} type="submit" className="flex-1 bg-green-600 text-white py-2 rounded-lg disabled:opacity-60">
                  {isSubmitting ? 'Ajout...' : 'Ajouter'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddVehicle(false)}
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
      {editingVehicle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-6">Modifier le véhicule</h2>
            <form onSubmit={handleEditVehicle}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Matricule</label>
                <input
                  type="text"
                  value={editingVehicle.id}
                  className="w-full px-4 py-2 border rounded-lg bg-gray-100"
                  disabled
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Marque / Modèle</label>
                <input
                  type="text"
                  value={editingVehicle.brand}
                  onChange={(e) => setEditingVehicle({ ...editingVehicle, brand: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Année</label>
                <input
                  type="number"
                  value={editingVehicle.year}
                  onChange={(e) => setEditingVehicle({ ...editingVehicle, year: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Type de propriété</label>
                <select
                  value={editingVehicle.ownershipType}
                  onChange={(e) => setEditingVehicle({ ...editingVehicle, ownershipType: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="Société">Société</option>
                  <option value="Particulier">Particulier</option>
                </select>
              </div>
              {editingVehicle.ownershipType === 'Particulier' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Nom du propriétaire</label>
                  <input
                    type="text"
                    value={editingVehicle.ownerName || ''}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, ownerName: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    required
                  />
                </div>
              )}

              <div className="flex gap-2">
                <button disabled={isSubmitting} type="submit" className="flex-1 bg-orange-600 text-white py-2 rounded-lg disabled:opacity-60">
                  {isSubmitting ? 'Modification...' : 'Modifier'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingVehicle(null)}
                  className="flex-1 bg-gray-300 py-2 rounded-lg"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Liste des véhicules avec répartition financière */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {validatedVehicles.map(vehicle => {
          const mgmtContract = (managementContracts || []).find(mc => getVehicleId(mc) === vehicle.id);

          const vehiclePayments = (payments || []).filter(p => {
            const cid = getContractId(p);
            const contract = (contracts || []).find(c => (c.id === cid));
            const vId = contract ? getContractVehicleId(contract) : null;
            const date = p.date || p.payment_date || '';
            return vId === vehicle.id && String(date).startsWith('2025-02');
          });

          const totalCollected = vehiclePayments.reduce((sum, p) => sum + (Number(p.amount) || Number(p.payment_amount) || 0), 0);
          let companyShare, ownerShare;

          if (vehicle.ownershipType === 'Société') {
            companyShare = totalCollected;
            ownerShare = 0;
          } else if (mgmtContract) {
            const ownerDailyShare = mgmtContract.ownerDailyShare ?? mgmtContract.owner_daily_share ?? 0;
            const companyDailyShare = mgmtContract.companyDailyShare ?? mgmtContract.company_daily_share ?? 0;
            ownerShare = vehiclePayments.length * Number(ownerDailyShare);
            companyShare = vehiclePayments.length * Number(companyDailyShare);
          } else {
            ownerShare = 0;
            companyShare = 0;
          }

          const margin = totalCollected > 0 ? ((companyShare / totalCollected) * 100).toFixed(1) : 0;

          return (
            <div
              key={vehicle.id}
              className={`bg-white rounded-xl shadow-lg border-l-4 ${
                vehicle.ownershipType === 'Société' ? 'border-blue-500' : 'border-green-500'
              }`}
            >
              <div className={`p-4 ${vehicle.ownershipType === 'Société' ? 'bg-blue-50' : 'bg-green-50'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-xl">{vehicle.id}</h3>
                    <p className="text-sm text-gray-600">{vehicle.brand} ({vehicle.year})</p>
                    {vehicle.ownershipType === 'Particulier' && (
                      <p className="text-sm text-green-700 font-medium mt-1">
                        Propriétaire: {vehicle.ownerName}
                      </p>
                    )}
                    {vehicle.driverName && (
                      <button
                        onClick={() => setActiveTab('drivers')}
                        className="text-sm text-blue-700 font-medium mt-1 hover:underline cursor-pointer text-left block"
                      >
                        🚗 Chauffeur: {vehicle.driverName}
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2 items-start">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        vehicle.ownershipType === 'Société'
                          ? 'bg-blue-200 text-blue-800'
                          : 'bg-green-200 text-green-800'
                      }`}
                    >
                      {vehicle.ownershipType === 'Société' ? '🏢 Société' : '👤 Particulier'}
                    </span>
                    <button
                      onClick={() => setEditingVehicle(vehicle)}
                      className="text-orange-600 hover:text-orange-800"
                      title="Modifier"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteVehicle(vehicle.id)}
                      className="text-red-600 hover:text-red-800"
                      title="Supprimer"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4">
                <button
                  onClick={() => {
                    localStorage.setItem('selectedVehicleId', vehicle.id);
                    setActiveTab('maintenance');
                  }}
                  className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 mb-4 font-medium"
                >
                  🔧 Voir la maintenance de ce véhicule
                </button>

                <h4 className="font-bold text-sm text-gray-700 mb-3">💰 Février 2025</h4>
                <div className="space-y-2">
                  <div className="flex justify-between p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">Total collecté:</span>
                    <span className="font-bold">{totalCollected.toLocaleString()} FCFA</span>
                  </div>
                  <div className="flex justify-between p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">Jours payés:</span>
                    <span className="font-bold">{vehiclePayments.length}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-blue-50 rounded border border-blue-200">
                    <span className="text-sm font-medium text-blue-900">🏢 Part Société:</span>
                    <span className="font-bold text-blue-700">{companyShare.toLocaleString()} FCFA</span>
                  </div>
                  <div className="flex justify-between p-3 bg-green-50 rounded border border-green-200">
                    <span className="text-sm font-medium text-green-900">👤 Part Propriétaire:</span>
                    <span className="font-bold text-green-700">{ownerShare.toLocaleString()} FCFA</span>
                  </div>
                  <div className="text-center text-xs text-gray-600 mt-2">
                    {vehicle.ownershipType === 'Société' ? 'Marge: 100%' : `Marge société: ${margin}%`}
                  </div>
                </div>

                {mgmtContract && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-600 mb-2">Répartition journalière:</p>
                    <div className="flex justify-between text-xs">
                      <span className="text-green-700">
                        Propriétaire: {(Number(mgmtContract.ownerDailyShare ?? mgmtContract.owner_daily_share ?? 0)).toLocaleString()} FCFA
                      </span>
                      <span className="text-blue-700">
                        Société: {(Number(mgmtContract.companyDailyShare ?? mgmtContract.company_daily_share ?? 0)).toLocaleString()} FCFA
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {validatedVehicles.length === 0 && pendingVehicles.length === 0 && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <div className="text-6xl mb-4">🚗</div>
          <p className="text-gray-600">Aucun véhicule enregistré</p>
        </div>
      )}
    </div>
  );
};

export default Vehicles;
