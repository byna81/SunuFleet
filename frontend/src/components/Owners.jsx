// Owners.jsx - Gestion propriétaires AVEC SUPABASE (CRUD + Validation Admin)
// ✅ Insert/Update/Delete en base Supabase
// ✅ Mapping snake_case (DB) <-> camelCase (UI)
// ✅ Refresh DB après chaque action
import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Edit, Trash2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const Owners = ({ managementContracts, setManagementContracts, currentUser, hasPermission, setActiveTab }) => {
  const [showAddContract, setShowAddContract] = useState(false);
  const [editingContract, setEditingContract] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newContract, setNewContract] = useState({
    ownerName: '',
    vehicleId: '',
    driverDailyPayment: '',
    ownerDailyShare: '',
    companyDailyShare: ''
  });

  // --- Helpers mapping ---
  const toNumber = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  // DB -> UI
  const fromDb = (row) => {
    if (!row) return row;
    return {
      id: row.id,
      ownerName: row.owner_name ?? row.ownerName ?? '',
      vehicleId: row.vehicle_id ?? row.vehicleId ?? '',
      driverDailyPayment: row.driver_daily_payment ?? row.driverDailyPayment ?? 0,
      ownerDailyShare: row.owner_daily_share ?? row.ownerDailyShare ?? 0,
      companyDailyShare: row.company_daily_share ?? row.companyDailyShare ?? 0,
      status: row.status ?? null,

      createdBy: row.created_by ?? row.createdBy ?? null,
      createdByName: row.created_by_name ?? row.createdByName ?? '',
      createdAt: row.created_at ?? row.createdAt ?? null,

      validatedBy: row.validated_by ?? row.validatedBy ?? null,
      validatedByName: row.validated_by_name ?? row.validatedByName ?? '',
      validatedAt: row.validated_at ?? row.validatedAt ?? null,

      rejectedBy: row.rejected_by ?? row.rejectedBy ?? null,
      rejectedByName: row.rejected_by_name ?? row.rejectedByName ?? '',
      rejectedAt: row.rejected_at ?? row.rejectedAt ?? null,
      rejectionReason: row.rejection_reason ?? row.rejectionReason ?? null,

      modifiedBy: row.modified_by ?? row.modifiedBy ?? null,
      modifiedByName: row.modified_by_name ?? row.modifiedByName ?? '',
      modifiedAt: row.modified_at ?? row.modifiedAt ?? null,
    };
  };

  // UI -> DB
  const toDbPayload = (ui) => ({
    owner_name: (ui.ownerName || '').trim(),
    vehicle_id: (ui.vehicleId || '').trim(),
    driver_daily_payment: toNumber(ui.driverDailyPayment),
    owner_daily_share: toNumber(ui.ownerDailyShare),
    company_daily_share: toNumber(ui.companyDailyShare),
  });

  const refreshContracts = async () => {
    const { data, error } = await supabase
      .from('management_contracts')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error('Erreur refresh management_contracts:', error);
      return;
    }
    setManagementContracts((data || []).map(fromDb));
  };

  useEffect(() => {
    // Normalise une fois si les données viennent "brutes" (snake_case)
    if (Array.isArray(managementContracts) && managementContracts.length > 0) {
      const seemsAlready = !!managementContracts[0]?.ownerName || !!managementContracts[0]?.driverDailyPayment;
      if (!seemsAlready) setManagementContracts(managementContracts.map(fromDb));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pendingContracts = useMemo(
    () => (managementContracts || []).filter(c => c.status === 'pending'),
    [managementContracts]
  );
  const validatedContracts = useMemo(
    () => (managementContracts || []).filter(c => c.status === 'validated' || !c.status),
    [managementContracts]
  );

  const handleAddContract = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const status = hasPermission('all') ? 'validated' : 'pending';

      const payload = {
        ...toDbPayload(newContract),
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

      const { data, error } = await supabase
        .from('management_contracts')
        .insert([payload])
        .select('*')
        .single();

      if (error) {
        console.error('Insert management_contracts error:', error);
        alert('❌ Erreur création contrat: ' + error.message);
        return;
      }

      setManagementContracts([...(managementContracts || []), fromDb(data)]);
      await refreshContracts();

      alert(
        hasPermission('all')
          ? `✅ Contrat créé et validé!\n${newContract.ownerName} - ${newContract.vehicleId}`
          : `✅ Contrat créé!\nEn attente de validation Admin\n${newContract.ownerName} - ${newContract.vehicleId}`
      );

      setShowAddContract(false);
      setNewContract({
        ownerName: '',
        vehicleId: '',
        driverDailyPayment: '',
        ownerDailyShare: '',
        companyDailyShare: ''
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
        ...toDbPayload(editingContract),
        status: hasPermission('all') ? editingContract.status : 'pending',
        modified_by: currentUser?.id ?? null,
        modified_by_name: currentUser?.name ?? '',
        modified_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('management_contracts')
        .update(payload)
        .eq('id', editingContract.id)
        .select('*')
        .single();

      if (error) {
        console.error('Update management_contracts error:', error);
        alert('❌ Erreur modification contrat: ' + error.message);
        return;
      }

      setManagementContracts((managementContracts || []).map(c => (c.id === editingContract.id ? fromDb(data) : c)));
      await refreshContracts();
      alert('✅ Contrat modifié!');
      setEditingContract(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteContract = async (contractId) => {
    const contract = (managementContracts || []).find(c => c.id === contractId);
    if (!contract) return;

    if (!window.confirm(`Supprimer le contrat de ${contract.ownerName || ''} ?`)) return;

    const { error } = await supabase
      .from('management_contracts')
      .delete()
      .eq('id', contractId);

    if (error) {
      console.error('Delete management_contracts error:', error);
      alert('❌ Erreur suppression contrat: ' + error.message);
      return;
    }

    setManagementContracts((managementContracts || []).filter(c => c.id !== contractId));
    await refreshContracts();
    alert('✅ Contrat supprimé');
  };

  const handleValidateContract = async (contractId) => {
    if (!hasPermission('all')) return;

    const payload = {
      status: 'validated',
      validated_by: currentUser?.id ?? null,
      validated_by_name: currentUser?.name ?? '',
      validated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('management_contracts')
      .update(payload)
      .eq('id', contractId)
      .select('*')
      .single();

    if (error) {
      console.error('Validate management_contracts error:', error);
      alert('❌ Erreur validation: ' + error.message);
      return;
    }

    setManagementContracts((managementContracts || []).map(c => (c.id === contractId ? fromDb(data) : c)));
    await refreshContracts();
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
      rejection_reason: reason
    };

    const { data, error } = await supabase
      .from('management_contracts')
      .update(payload)
      .eq('id', contractId)
      .select('*')
      .single();

    if (error) {
      console.error('Reject management_contracts error:', error);
      alert('❌ Erreur rejet: ' + error.message);
      return;
    }

    setManagementContracts((managementContracts || []).map(c => (c.id === contractId ? fromDb(data) : c)));
    await refreshContracts();
    alert('❌ Contrat rejeté');
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">🏢 Propriétaires particuliers</h1>
        <button
          onClick={() => setShowAddContract(true)}
          className="bg-green-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-green-700"
        >
          <Plus size={20} />
          Ajouter un contrat
        </button>
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
                    <p className="font-bold text-lg">{contract.ownerName}</p>
                    <p className="text-sm text-gray-600">Véhicule: {contract.vehicleId}</p>
                    <p className="text-sm text-gray-600">Créé par: {contract.createdByName}</p>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <p>Chauffeur verse: {(Number(contract.driverDailyPayment) || 0).toLocaleString()} FCFA</p>
                      <p>Proprio reçoit: {(Number(contract.ownerDailyShare) || 0).toLocaleString()} FCFA</p>
                      <p>Société garde: {(Number(contract.companyDailyShare) || 0).toLocaleString()} FCFA</p>
                    </div>
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
            <h2 className="text-2xl font-bold mb-6">Nouveau contrat de gestion</h2>
            <form onSubmit={handleAddContract}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Nom du propriétaire</label>
                <input
                  type="text"
                  value={newContract.ownerName}
                  onChange={(e) => setNewContract({ ...newContract, ownerName: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Véhicule (matricule)</label>
                <input
                  type="text"
                  value={newContract.vehicleId}
                  onChange={(e) => setNewContract({ ...newContract, vehicleId: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="Ex: DK-XXX-YY"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Chauffeur verse par jour (FCFA)</label>
                <input
                  type="number"
                  value={newContract.driverDailyPayment}
                  onChange={(e) => setNewContract({ ...newContract, driverDailyPayment: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Propriétaire reçoit par jour (FCFA)</label>
                <input
                  type="number"
                  value={newContract.ownerDailyShare}
                  onChange={(e) => setNewContract({ ...newContract, ownerDailyShare: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">AutoFleet garde par jour (FCFA)</label>
                <input
                  type="number"
                  value={newContract.companyDailyShare}
                  onChange={(e) => setNewContract({ ...newContract, companyDailyShare: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
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
                <label className="block text-sm font-medium mb-2">Nom du propriétaire</label>
                <input
                  type="text"
                  value={editingContract.ownerName}
                  onChange={(e) => setEditingContract({ ...editingContract, ownerName: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Chauffeur verse par jour (FCFA)</label>
                <input
                  type="number"
                  value={editingContract.driverDailyPayment}
                  onChange={(e) => setEditingContract({ ...editingContract, driverDailyPayment: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Propriétaire reçoit (FCFA)</label>
                <input
                  type="number"
                  value={editingContract.ownerDailyShare}
                  onChange={(e) => setEditingContract({ ...editingContract, ownerDailyShare: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">AutoFleet garde (FCFA)</label>
                <input
                  type="number"
                  value={editingContract.companyDailyShare}
                  onChange={(e) => setEditingContract({ ...editingContract, companyDailyShare: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
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

      {/* Liste des contrats validés */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {validatedContracts.map(contract => (
          <div key={contract.id} className="border-2 border-green-200 rounded-lg p-6 bg-green-50">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-xl text-green-800">{contract.ownerName}</h3>
                <p className="text-sm text-gray-600">Véhicule: {contract.vehicleId}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingContract(contract)}
                  className="text-orange-600 hover:text-orange-800"
                  title="Modifier"
                >
                  <Edit size={20} />
                </button>
                <button
                  onClick={() => handleDeleteContract(contract.id)}
                  className="text-red-600 hover:text-red-800"
                  title="Supprimer"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="p-3 bg-white rounded">
                <p className="text-xs text-gray-600">Chauffeur verse:</p>
                <p className="font-bold">{(Number(contract.driverDailyPayment) || 0).toLocaleString()} FCFA/jour</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-green-100 rounded">
                  <p className="text-xs text-green-700">Proprio reçoit:</p>
                  <p className="font-bold text-green-800">{(Number(contract.ownerDailyShare) || 0).toLocaleString()} FCFA</p>
                </div>
                <div className="p-3 bg-blue-100 rounded">
                  <p className="text-xs text-blue-700">AutoFleet:</p>
                  <p className="font-bold text-blue-800">{(Number(contract.companyDailyShare) || 0).toLocaleString()} FCFA</p>
                </div>
              </div>
            </div>

            {/* Bouton Paiements - NOUVEAU */}
            <button
              onClick={() => {
                localStorage.setItem('selectedOwnerId', String(contract.id));
                setActiveTab('owner-payments');
              }}
              className="mt-4 w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 font-medium"
            >
              💵 Voir les paiements de ce propriétaire
            </button>
          </div>
        ))}
      </div>

      {validatedContracts.length === 0 && pendingContracts.length === 0 && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <div className="text-6xl mb-4">🏢</div>
          <p className="text-gray-600">Aucun contrat de gestion enregistré</p>
        </div>
      )}
    </div>
  );
};

export default Owners;
