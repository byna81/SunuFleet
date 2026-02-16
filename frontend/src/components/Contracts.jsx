// Contracts.jsx - Gestion contrats AVEC SUPABASE (CRUD + Validation Admin) - DEBUG + REFRESH
import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    // Permet de vérifier que tu utilises bien CE fichier sur Vercel
    // (tu dois voir ce log dans la console du navigateur)
    console.log('[Contracts] SUPABASE version loaded ✅');
  }, []);

  const pendingContracts = contracts?.filter(c => c.status === 'pending') || [];
  const activeContracts = contracts?.filter(c => c.status === 'active' || !c.status) || [];

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
    for (let i = 0; i < 12; i++) {
      const res = await supabase.from(table).insert([p]).select('*').single();
      if (!res.error) return res;
      const next = dropUnknownColumnFromError(p, res.error);
      if (!next) return res;
      p = next;
    }
    return { data: null, error: { message: 'Insert failed after retries' } };
  };

  const supabaseUpdateWithFallback = async (table, id, payload) => {
    let p = { ...payload };
    for (let i = 0; i < 12; i++) {
      const res = await supabase.from(table).update(p).eq('id', id).select('*').single();
      if (!res.error) return res;
      const next = dropUnknownColumnFromError(p, res.error);
      if (!next) return res;
      p = next;
    }
    return { data: null, error: { message: 'Update failed after retries' } };
  };

  const refreshContractsFromDb = async () => {
    const { data, error } = await supabase.from('contracts').select('*').order('id', { ascending: false });
    if (error) {
      console.error('[Contracts] refresh error:', error);
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

      const payload = {
        driverId: parseInt(newContract.driverId),
        vehicleId: newContract.vehicleId,
        type: newContract.type,
        startDate: newContract.startDate,
        endDate: newContract.endDate,
        dailyAmount: parseFloat(newContract.dailyAmount),
        deposit: parseFloat(newContract.deposit),
        totalAmount: parseFloat(newContract.totalAmount),
        restDay: newContract.restDay,
        status,

        // meta (si colonnes existent)
        driverName: driver?.name || '',
        createdBy: currentUser?.id ?? null,
        createdByName: currentUser?.name ?? '',
        createdAt: new Date().toISOString(),
      };

      if (hasPermission('all')) {
        payload.validatedBy = currentUser?.id ?? null;
        payload.validatedByName = currentUser?.name ?? '';
        payload.validatedAt = new Date().toISOString();
      }

      console.log('[Contracts] Insert payload =>', payload);

      const { data, error } = await supabaseInsertWithFallback('contracts', payload);

      if (error) {
        console.error('[Contracts] Insert error:', error);
        alert('❌ Erreur création contrat: ' + error.message);
        return;
      }

      console.log('[Contracts] Insert OK ✅ Row =>', data);

      // Refresh DB (pour être 100% sûr que c'est en base)
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
      const driver = drivers.find(d => d.id === parseInt(editingContract.driverId));
      const payload = {
        ...editingContract,
        driverId: parseInt(editingContract.driverId),
        driverName: driver?.name || editingContract.driverName,
        dailyAmount: parseFloat(editingContract.dailyAmount),
        deposit: parseFloat(editingContract.deposit),
        totalAmount: parseFloat(editingContract.totalAmount),
        status: hasPermission('all') ? editingContract.status : 'pending',
        modifiedBy: currentUser?.id ?? null,
        modifiedByName: currentUser?.name ?? '',
        modifiedAt: new Date().toISOString(),
      };

      const { data, error } = await supabaseUpdateWithFallback('contracts', editingContract.id, payload);
      if (error) {
        console.error('[Contracts] Update error:', error);
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
    const contract = (contracts || []).find(c => c.id === contractId);
    if (!contract) return;

    if (!window.confirm(`Supprimer le contrat de ${contract.driverName || ''} ?`)) return;

    const { error } = await supabase.from('contracts').delete().eq('id', contractId);
    if (error) {
      console.error('[Contracts] Delete error:', error);
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
      validatedBy: currentUser?.id ?? null,
      validatedByName: currentUser?.name ?? '',
      validatedAt: new Date().toISOString(),
    };

    const { error } = await supabaseUpdateWithFallback('contracts', contractId, payload);
    if (error) {
      console.error('[Contracts] Validate error:', error);
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
      rejectedBy: currentUser?.id ?? null,
      rejectedByName: currentUser?.name ?? '',
      rejectedAt: new Date().toISOString(),
      rejectionReason: reason,
    };

    const { error } = await supabaseUpdateWithFallback('contracts', contractId, payload);
    if (error) {
      console.error('[Contracts] Reject error:', error);
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

      {/* (UI identique à ta version; modals add/edit/validate/reject + liste) */}
      {/* Pour gagner du temps ici, garde ta UI actuelle et remplace seulement les handlers si tu préfères. */}

      {/* --- Tout ton rendu actuel peut rester identique --- */}
      {/* IMPORTANT: ce patch est surtout pour le CRUD supabase + refresh + debug log */}
    </div>
  );
};

export default Contracts;
