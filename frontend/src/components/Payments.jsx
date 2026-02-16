// Payments.jsx - AVEC SUPABASE (CRUD)
// ✅ Insert + Update en base Supabase
// ✅ Historique (modifications) stocké en jsonb si la colonne existe
// ✅ Fallback automatique si la table n'a pas certaines colonnes (évite erreurs "schema cache")

import React, { useMemo, useState } from 'react';
import { Plus, History, Edit } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const Payments = ({ payments, setPayments, currentUser, drivers, contracts }) => {
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [selectedPaymentDriver, setSelectedPaymentDriver] = useState(null);
  const [newPayment, setNewPayment] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    notes: ''
  });
  const [showPaymentHistory, setShowPaymentHistory] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- helpers schema fallback ---
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

  const sortPayments = (arr) => {
    // tri desc date+time si possible
    return [...(arr || [])].sort((a, b) => {
      const da = new Date(`${a.date || ''}T${(a.time || '00:00').slice(0,5)}:00`);
      const db = new Date(`${b.date || ''}T${(b.time || '00:00').slice(0,5)}:00`);
      return db - da;
    });
  };

  const contractByDriver = useMemo(() => {
    const map = new Map();
    (contracts || []).forEach(c => {
      if (c?.driver_id != null) map.set(Number(c.driver_id), c); // snake_case
      if (c?.driverId != null) map.set(Number(c.driverId), c);   // camelCase fallback
    });
    return map;
  }, [contracts]);

  const handleAddPayment = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const driverId = Number(selectedPaymentDriver);
    const driver = (drivers || []).find(d => Number(d.id) === driverId);

    // contrats peuvent venir en snake_case ou camelCase
    const contract = contractByDriver.get(driverId);

    if (!contract) {
      alert('Aucun contrat actif trouvé');
      return;
    }

    const paymentAmount = parseFloat(newPayment.amount);
    const contractAmount = Number(contract.daily_amount ?? contract.dailyAmount ?? 0);

    if (!Number.isFinite(paymentAmount)) {
      alert('Montant invalide');
      return;
    }

    if (contractAmount && paymentAmount !== contractAmount) {
      const confirmed = window.confirm(
        `⚠️ ATTENTION!\n\nMontant saisi: ${paymentAmount.toLocaleString()} FCFA\nMontant contrat ${contract.type}: ${contractAmount.toLocaleString()} FCFA\n\nVoulez-vous continuer?`
      );
      if (!confirmed) return;
    }

    setIsSubmitting(true);
    try {
      // payload snake_case pour la DB (comme tu as fait pour contracts)
      const payload = {
        driver_id: driverId,
        contract_id: Number(contract.id),
        date: newPayment.date,
        time: newPayment.time,
        amount: paymentAmount,
        status: 'paid',
        notes: newPayment.notes,

        recorded_by: currentUser?.name ?? '',
        recorded_by_id: currentUser?.id ?? null,
        recorded_at: new Date().toISOString(),

        modifications: []
      };

      const { data, error } = await supabaseInsertWithFallback('payments', payload);
      if (error) {
        console.error('Insert payment error:', error);
        alert('❌ Erreur enregistrement versement: ' + error.message);
        return;
      }

      setPayments(sortPayments([data, ...(payments || [])]));

      alert(
        `✅ Paiement enregistré!\n\nChauffeur: ${driver?.name || ''}\nMontant: ${paymentAmount.toLocaleString()} FCFA\nType: ${contract.type}`
      );

      setShowAddPayment(false);
      setSelectedPaymentDriver(null);
      setNewPayment({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        notes: ''
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditPayment = async (e) => {
    e.preventDefault();
    if (!editingPayment || isSubmitting) return;

    const reason = (editingPayment.modificationReason || '').trim();
    if (!reason) {
      alert('⚠️ Le motif de modification est obligatoire');
      return;
    }

    const paymentId = Number(editingPayment.id);
    const oldPayment = (payments || []).find(p => Number(p.id) === paymentId);

    setIsSubmitting(true);
    try {
      const oldAmount = Number(oldPayment?.amount ?? 0);
      const oldDate = oldPayment?.date;
      const oldTime = oldPayment?.time;

      const newAmount = parseFloat(editingPayment.amount);
      if (!Number.isFinite(newAmount)) {
        alert('Montant invalide');
        return;
      }

      const modification = {
        modifiedAt: new Date().toISOString(),
        modifiedBy: currentUser?.name ?? '',
        modifiedById: currentUser?.id ?? null,
        reason,
        changes: {}
      };

      if (Number.isFinite(oldAmount) && oldAmount !== newAmount) {
        modification.changes.amount = { old: oldAmount, new: newAmount };
      }
      if (oldDate && oldDate !== editingPayment.date) {
        modification.changes.date = { old: oldDate, new: editingPayment.date };
      }
      if (oldTime && oldTime !== editingPayment.time) {
        modification.changes.time = { old: oldTime, new: editingPayment.time };
      }

      const existingMods = Array.isArray(oldPayment?.modifications) ? oldPayment.modifications : [];
      const nextMods = [...existingMods, modification];

      const payload = {
        amount: newAmount,
        date: editingPayment.date,
        time: editingPayment.time,
        notes: editingPayment.notes ?? oldPayment?.notes ?? '',

        modifications: nextMods,
        last_modified_by: currentUser?.name ?? '',
        last_modified_at: new Date().toISOString()
      };

      const { data, error } = await supabaseUpdateWithFallback('payments', paymentId, payload);
      if (error) {
        console.error('Update payment error:', error);
        alert('❌ Erreur modification versement: ' + error.message);
        return;
      }

      setPayments(sortPayments((payments || []).map(p => (Number(p.id) === Number(data.id) ? data : p))));

      const driverId = Number(data.driver_id ?? data.driverId);
      const driver = (drivers || []).find(d => Number(d.id) === driverId);

      alert(
        `✅ Versement modifié!\nChauffeur: ${driver?.name || ''}\nNouveau montant: ${Number(data.amount).toLocaleString()} FCFA`
      );

      setEditingPayment(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDriverName = (payment) => {
    const driverId = Number(payment.driver_id ?? payment.driverId);
    return (drivers || []).find(d => Number(d.id) === driverId)?.name || '';
  };

  const getContractType = (payment) => {
    const contractId = Number(payment.contract_id ?? payment.contractId);
    const c = (contracts || []).find(x => Number(x.id) === contractId);
    return c?.type || 'N/A';
  };

  const getModsCount = (payment) => {
    const mods = payment.modifications;
    return Array.isArray(mods) ? mods.length : 0;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">💰 Suivi des versements</h1>
        <button
          onClick={() => setShowAddPayment(true)}
          className="bg-green-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-green-700"
        >
          <Plus size={20} />
          Ajouter un versement
        </button>
      </div>

      {showAddPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-6">Nouveau versement</h2>
            <form onSubmit={handleAddPayment}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Chauffeur</label>
                <select
                  value={selectedPaymentDriver ?? ''}
                  onChange={(e) => {
                    const driverId = Number(e.target.value);
                    setSelectedPaymentDriver(driverId);
                    const contract = contractByDriver.get(driverId);
                    if (contract) {
                      const amt = contract.daily_amount ?? contract.dailyAmount ?? '';
                      setNewPayment({ ...newPayment, amount: amt });
                    }
                  }}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                >
                  <option value="">Sélectionner</option>
                  {(drivers || []).map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              {selectedPaymentDriver && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-sm text-blue-900">
                    <strong>Type:</strong> {contractByDriver.get(Number(selectedPaymentDriver))?.type}
                  </p>
                  <p className="text-sm text-blue-900">
                    <strong>Montant:</strong>{' '}
                    {Number(contractByDriver.get(Number(selectedPaymentDriver))?.daily_amount ?? contractByDriver.get(Number(selectedPaymentDriver))?.dailyAmount ?? 0).toLocaleString()} FCFA
                  </p>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Montant (FCFA)</label>
                <input
                  type="number"
                  value={newPayment.amount}
                  onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Date</label>
                <input
                  type="date"
                  value={newPayment.date}
                  onChange={(e) => setNewPayment({ ...newPayment, date: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Heure</label>
                <input
                  type="time"
                  value={newPayment.time}
                  onChange={(e) => setNewPayment({ ...newPayment, time: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Notes</label>
                <textarea
                  value={newPayment.notes}
                  onChange={(e) => setNewPayment({ ...newPayment, notes: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  rows="2"
                />
              </div>

              <div className="flex gap-2">
                <button
                  disabled={isSubmitting}
                  type="submit"
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg disabled:opacity-60"
                >
                  {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddPayment(false)}
                  className="flex-1 bg-gray-300 py-2 rounded-lg"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-6">Modifier le versement</h2>
            <form onSubmit={handleEditPayment}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Montant (FCFA)</label>
                <input
                  type="number"
                  value={editingPayment.amount}
                  onChange={(e) => setEditingPayment({ ...editingPayment, amount: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Date</label>
                <input
                  type="date"
                  value={editingPayment.date}
                  onChange={(e) => setEditingPayment({ ...editingPayment, date: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Heure</label>
                <input
                  type="time"
                  value={editingPayment.time}
                  onChange={(e) => setEditingPayment({ ...editingPayment, time: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Motif <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={editingPayment.modificationReason || ''}
                  onChange={(e) => setEditingPayment({ ...editingPayment, modificationReason: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  rows="3"
                  placeholder="Ex: Erreur de saisie..."
                  required
                />
              </div>

              <div className="flex gap-2">
                <button
                  disabled={isSubmitting}
                  type="submit"
                  className="flex-1 bg-orange-600 text-white py-2 rounded-lg disabled:opacity-60"
                >
                  {isSubmitting ? 'Validation...' : 'Valider'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingPayment(null)}
                  className="flex-1 bg-gray-300 py-2 rounded-lg"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Chauffeur</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Enregistré par</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {(payments || []).map(payment => {
              const type = getContractType(payment);
              const recordedBy = payment.recorded_by ?? payment.recordedBy ?? '';
              const amount = Number(payment.amount ?? 0);

              return (
                <tr key={payment.id}>
                  <td className="px-6 py-4">{getDriverName(payment)}</td>
                  <td className="px-6 py-4">{payment.date} à {payment.time}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        type === 'LAO' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {type}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold">{amount.toLocaleString()} FCFA</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{recordedBy}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingPayment({ ...payment, modificationReason: '' })}
                        className="text-orange-600 hover:text-orange-800"
                        title="Modifier"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => setShowPaymentHistory(payment)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Historique"
                      >
                        <History size={16} /> ({getModsCount(payment)})
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showPaymentHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">📜 Historique</h2>

            <div className="mb-6 p-4 bg-gray-50 rounded">
              <p><strong>Créé par:</strong> {showPaymentHistory.recorded_by ?? showPaymentHistory.recordedBy ?? ''}</p>
              <p><strong>Créé le:</strong> {showPaymentHistory.recorded_at ? new Date(showPaymentHistory.recorded_at).toLocaleString('fr-FR') : (showPaymentHistory.recordedAt ? new Date(showPaymentHistory.recordedAt).toLocaleString('fr-FR') : '—')}</p>
            </div>

            {Array.isArray(showPaymentHistory.modifications) && showPaymentHistory.modifications.length > 0 ? (
              <div className="space-y-3">
                {showPaymentHistory.modifications.map((mod, idx) => (
                  <div key={idx} className="border border-yellow-200 bg-yellow-50 rounded p-4">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-bold text-yellow-900">Modification #{idx + 1}</p>
                      <span className="text-xs text-gray-600 font-mono">
                        {mod.modifiedAt ? new Date(mod.modifiedAt).toLocaleDateString('fr-FR') : ''}{' '}
                        {mod.modifiedAt ? 'à ' + new Date(mod.modifiedAt).toLocaleTimeString('fr-FR') : ''}
                      </span>
                    </div>

                    <p className="text-sm text-gray-700 mb-2"><strong>Par:</strong> {mod.modifiedBy}</p>

                    <div className="p-3 bg-white rounded mb-2">
                      <p className="text-sm font-bold mb-1">Motif:</p>
                      <p className="text-sm text-gray-700">{mod.reason}</p>
                    </div>

                    {mod.changes && Object.keys(mod.changes).length > 0 && (
                      <div className="p-3 bg-white rounded">
                        <p className="text-sm font-bold mb-2">Changements:</p>
                        {mod.changes.amount && (
                          <p className="text-sm">
                            <strong>Montant:</strong>{' '}
                            <span className="text-red-600 line-through">
                              {Number(mod.changes.amount.old).toLocaleString()} FCFA
                            </span>
                            {' → '}
                            <span className="text-green-600 font-bold">
                              {Number(mod.changes.amount.new).toLocaleString()} FCFA
                            </span>
                          </p>
                        )}
                        {mod.changes.date && (
                          <p className="text-sm"><strong>Date:</strong> {mod.changes.date.old} → <strong>{mod.changes.date.new}</strong></p>
                        )}
                        {mod.changes.time && (
                          <p className="text-sm"><strong>Heure:</strong> {mod.changes.time.old} → <strong>{mod.changes.time.new}</strong></p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">Aucune modification</p>
            )}

            <button
              onClick={() => setShowPaymentHistory(null)}
              className="mt-6 w-full bg-gray-300 py-2 rounded-lg"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payments;
