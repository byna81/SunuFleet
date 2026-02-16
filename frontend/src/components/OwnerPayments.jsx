// OwnerPayments.jsx - AVEC SUPABASE + compat snake_case/camelCase
// ✅ Affiche les paiements dus aux propriétaires (contrats de gestion) en fonction des versements chauffeurs
// ✅ Compatibilité: payments/contracts/management_contracts en snake_case OU camelCase
// ✅ Marquer comme payé: persiste dans Supabase (table owner_payments) avec fallback automatique si colonnes manquantes

import React, { useMemo, useState } from 'react';
import { DollarSign, CheckCircle, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const OwnerPayments = ({
  payments,
  ownerPayments,
  setOwnerPayments,
  currentUser,
  managementContracts,
  contracts
}) => {
  const [showPaymentModal, setShowPaymentModal] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(2); // Février
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- helpers schema fallback (évite erreurs "schema cache") ---
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

  // --- normalisation helpers ---
  const getPaymentContractId = (p) => Number(p.contract_id ?? p.contractId);
  const getPaymentDate = (p) => String(p.date ?? '');

  const getContractVehicleId = (c) => String(c.vehicle_id ?? c.vehicleId ?? '');
  const getMgmtVehicleId = (mc) => String(mc.vehicle_id ?? mc.vehicleId ?? '');
  const getMgmtOwnerName = (mc) => String(mc.owner_name ?? mc.ownerName ?? '');
  const getMgmtOwnerDailyShare = (mc) => Number(mc.owner_daily_share ?? mc.ownerDailyShare ?? 0);
  const getMgmtCompanyDailyShare = (mc) => Number(mc.company_daily_share ?? mc.companyDailyShare ?? 0);
  const getMgmtDriverDailyPayment = (mc) => Number(mc.driver_daily_payment ?? mc.driverDailyPayment ?? 0);

  const contractById = useMemo(() => {
    const m = new Map();
    (contracts || []).forEach((c) => {
      if (c?.id != null) m.set(Number(c.id), c);
    });
    return m;
  }, [contracts]);

  const ownerPayIndex = useMemo(() => {
    // index existing owner_payments by vehicle+month+year
    const m = new Map();
    (ownerPayments || []).forEach((op) => {
      const vehicleId = String(op.vehicle_id ?? op.vehicleId ?? '');
      const month = Number(op.month ?? op.payment_month ?? op.paymentMonth);
      const year = Number(op.year ?? op.payment_year ?? op.paymentYear);
      if (!vehicleId || !month || !year) return;
      m.set(`${vehicleId}__${month}__${year}`, op);
    });
    return m;
  }, [ownerPayments]);

  // Calculer automatiquement les paiements dus pour un mois donné
  const monthlyPayments = useMemo(() => {
    const calculated = [];
    const monthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

    (managementContracts || []).forEach((mgmtContract) => {
      const mgmtVehicleId = getMgmtVehicleId(mgmtContract);
      if (!mgmtVehicleId) return;

      // Filtrer les versements pour ce véhicule ce mois-ci
      const vehiclePayments = (payments || []).filter((p) => {
        const contractId = getPaymentContractId(p);
        if (!contractId) return false;

        const c = contractById.get(contractId);
        const contractVehicleId = c ? getContractVehicleId(c) : '';

        return contractVehicleId === mgmtVehicleId && getPaymentDate(p).startsWith(monthKey);
      });

      if (vehiclePayments.length === 0) return;

      const numberOfDays = vehiclePayments.length;
      const ownerShare = numberOfDays * getMgmtOwnerDailyShare(mgmtContract);
      const companyShare = numberOfDays * getMgmtCompanyDailyShare(mgmtContract);
      const totalCollected = numberOfDays * getMgmtDriverDailyPayment(mgmtContract);

      const existingPayment = ownerPayIndex.get(`${mgmtVehicleId}__${selectedMonth}__${selectedYear}`);

      calculated.push({
        id: existingPayment?.id ?? `${mgmtContract.id}-${selectedMonth}-${selectedYear}`,
        owner_payment_id: existingPayment?.id ?? null,
        managementContractId: Number(mgmtContract.id),
        vehicleId: mgmtVehicleId,
        ownerName: getMgmtOwnerName(mgmtContract),
        month: selectedMonth,
        year: selectedYear,
        numberOfDays,
        dailyRate: getMgmtOwnerDailyShare(mgmtContract),
        ownerShare,
        companyShare,
        totalCollected,
        status: (existingPayment?.status ?? existingPayment?.payment_status ?? 'unpaid'),
        paidAt: existingPayment?.paid_at ?? existingPayment?.paidAt,
        paidBy: existingPayment?.paid_by ?? existingPayment?.paidBy,
        paidByName: existingPayment?.paid_by_name ?? existingPayment?.paidByName,
        paymentMethod: existingPayment?.payment_method ?? existingPayment?.paymentMethod,
        paymentNotes: existingPayment?.payment_notes ?? existingPayment?.paymentNotes
      });
    });

    calculated.sort((a, b) => {
      const va = (a.vehicleId || '').localeCompare(b.vehicleId || '');
      if (va !== 0) return va;
      return (a.ownerName || '').localeCompare(b.ownerName || '');
    });

    return calculated;
  }, [managementContracts, payments, contractById, ownerPayIndex, selectedMonth, selectedYear]);

  const handleMarkAsPaid = async () => {
    if (!showPaymentModal || isSubmitting) return;

    if (!paymentMethod) {
      alert('⚠️ Veuillez sélectionner une méthode de paiement');
      return;
    }

    setIsSubmitting(true);
    try {
      const nowIso = new Date().toISOString();

      const payload = {
        management_contract_id: Number(showPaymentModal.managementContractId),
        vehicle_id: String(showPaymentModal.vehicleId),
        owner_name: String(showPaymentModal.ownerName),

        month: Number(showPaymentModal.month),
        year: Number(showPaymentModal.year),

        number_of_days: Number(showPaymentModal.numberOfDays),
        daily_rate: Number(showPaymentModal.dailyRate),
        owner_share: Number(showPaymentModal.ownerShare),
        company_share: Number(showPaymentModal.companyShare),
        total_collected: Number(showPaymentModal.totalCollected),

        status: 'paid',
        paid_at: nowIso,
        paid_by: currentUser?.id ?? null,
        paid_by_name: currentUser?.name ?? '',
        payment_method: paymentMethod,
        payment_notes: paymentNotes
      };

      let saved = null;

      const existingId = Number(showPaymentModal.owner_payment_id ?? showPaymentModal.id);
      const canUpdate = Number.isFinite(existingId) && existingId > 0;

      if (canUpdate) {
        const { data, error } = await supabaseUpdateWithFallback('owner_payments', existingId, payload);
        if (error) {
          console.error('Update owner_payments error:', error);
          alert('❌ Erreur Supabase (update paiement propriétaire): ' + error.message);
          return;
        }
        saved = data;
      } else {
        const { data, error } = await supabaseInsertWithFallback('owner_payments', payload);
        if (error) {
          console.error('Insert owner_payments error:', error);
          alert('❌ Erreur Supabase (insert paiement propriétaire): ' + error.message);
          return;
        }
        saved = data;
      }

      setOwnerPayments((prev) => {
        const arr = Array.isArray(prev) ? [...prev] : [];
        const idx = arr.findIndex((x) => Number(x.id) === Number(saved.id));
        if (idx >= 0) arr[idx] = saved;
        else arr.unshift(saved);
        return arr;
      });

      alert(
        `✅ Paiement marqué comme effectué!\n\n` +
          `Propriétaire: ${showPaymentModal.ownerName}\n` +
          `Véhicule: ${showPaymentModal.vehicleId}\n` +
          `Montant: ${Number(showPaymentModal.ownerShare).toLocaleString()} FCFA\n` +
          `Méthode: ${paymentMethod}\n` +
          `Par: ${currentUser?.name || ''}\n` +
          `Date: ${new Date().toLocaleDateString('fr-FR')}`
      );

      setShowPaymentModal(null);
      setPaymentMethod('');
      setPaymentNotes('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">💵 Paiements aux propriétaires</h1>

        <div className="flex gap-3">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
            className="px-4 py-2 border rounded-lg"
          >
            {monthNames.map((month, idx) => (
              <option key={idx} value={idx + 1}>{month}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="2024">2024</option>
            <option value="2025">2025</option>
            <option value="2026">2026</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="text-green-600" size={32} />
            <h3 className="font-bold text-green-900">Total à payer</h3>
          </div>
          <p className="text-3xl font-bold text-green-700">
            {monthlyPayments
              .filter(mp => mp.status !== 'paid')
              .reduce((sum, mp) => sum + Number(mp.ownerShare || 0), 0)
              .toLocaleString()} FCFA
          </p>
          <p className="text-sm text-green-600 mt-1">
            {monthlyPayments.filter(mp => mp.status !== 'paid').length} paiement(s) en attente
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="text-blue-600" size={32} />
            <h3 className="font-bold text-blue-900">Déjà payé</h3>
          </div>
          <p className="text-3xl font-bold text-blue-700">
            {monthlyPayments
              .filter(mp => mp.status === 'paid')
              .reduce((sum, mp) => sum + Number(mp.ownerShare || 0), 0)
              .toLocaleString()} FCFA
          </p>
          <p className="text-sm text-blue-600 mt-1">
            {monthlyPayments.filter(mp => mp.status === 'paid').length} paiement(s) effectué(s)
          </p>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="text-purple-600" size={32} />
            <h3 className="font-bold text-purple-900">Période</h3>
          </div>
          <p className="text-3xl font-bold text-purple-700">
            {monthNames[selectedMonth - 1]}
          </p>
          <p className="text-sm text-purple-600 mt-1">{selectedYear}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {monthlyPayments.length > 0 ? (
          monthlyPayments.map(monthlyPayment => (
            <div
              key={monthlyPayment.id}
              className={`rounded-xl shadow-lg p-6 border-l-4 ${
                monthlyPayment.status === 'paid'
                  ? 'bg-green-50 border-green-500'
                  : 'bg-yellow-50 border-yellow-500'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-xl flex items-center gap-2">
                    {monthlyPayment.ownerName}
                    <span className="text-sm font-normal text-gray-600">
                      ({monthlyPayment.vehicleId})
                    </span>
                  </h3>
                  <p className="text-sm text-gray-600">
                    {monthNames[monthlyPayment.month - 1]} {monthlyPayment.year}
                  </p>
                </div>
                <span className={`px-4 py-2 rounded-full font-bold ${
                  monthlyPayment.status === 'paid'
                    ? 'bg-green-200 text-green-800'
                    : 'bg-yellow-200 text-yellow-800'
                }`}>
                  {monthlyPayment.status === 'paid' ? '✅ Payé' : '⏳ À payer'}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-white p-3 rounded border">
                  <p className="text-xs text-gray-600">Jours travaillés</p>
                  <p className="text-2xl font-bold">{monthlyPayment.numberOfDays}</p>
                </div>
                <div className="bg-white p-3 rounded border">
                  <p className="text-xs text-gray-600">Taux journalier</p>
                  <p className="text-2xl font-bold">
                    {Number(monthlyPayment.dailyRate).toLocaleString()}
                  </p>
                </div>
                <div className="bg-white p-3 rounded border">
                  <p className="text-xs text-gray-600">Total collecté</p>
                  <p className="text-2xl font-bold">
                    {Number(monthlyPayment.totalCollected).toLocaleString()}
                  </p>
                </div>
                <div className="bg-green-100 p-3 rounded border border-green-300">
                  <p className="text-xs text-green-700">Part propriétaire</p>
                  <p className="text-2xl font-bold text-green-800">
                    {Number(monthlyPayment.ownerShare).toLocaleString()}
                  </p>
                </div>
              </div>

              {monthlyPayment.status !== 'paid' ? (
                <button
                  onClick={() => setShowPaymentModal(monthlyPayment)}
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700"
                >
                  💰 Marquer comme payé
                </button>
              ) : (
                <div className="bg-white p-4 rounded border border-green-300">
                  <p className="text-sm font-bold text-green-800 mb-2">
                    ✅ Paiement effectué
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                    <p><strong>Par:</strong> {monthlyPayment.paidByName}</p>
                    <p><strong>Date:</strong> {monthlyPayment.paidAt ? new Date(monthlyPayment.paidAt).toLocaleDateString('fr-FR') : '—'}</p>
                    <p><strong>Méthode:</strong> {monthlyPayment.paymentMethod || '—'}</p>
                    {monthlyPayment.paymentNotes && (
                      <p className="col-span-2">
                        <strong>Notes:</strong> {monthlyPayment.paymentNotes}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">💵</div>
            <p className="text-gray-600">
              Aucun versement enregistré pour {monthNames[selectedMonth - 1]} {selectedYear}
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Astuce: vérifie que tes versements ont bien une date du type {selectedYear}-{String(selectedMonth).padStart(2,'0')}-DD
            </p>
          </div>
        )}
      </div>

      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-6">💰 Confirmer le paiement</h2>

            <div className="mb-6 p-4 bg-green-50 rounded border border-green-200">
              <p className="font-bold text-lg">{showPaymentModal.ownerName}</p>
              <p className="text-sm text-gray-600">
                {showPaymentModal.vehicleId} • {monthNames[showPaymentModal.month - 1]} {showPaymentModal.year}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {showPaymentModal.numberOfDays} jours × {Number(showPaymentModal.dailyRate).toLocaleString()} FCFA
              </p>
              <p className="text-3xl font-bold text-green-700 mt-3">
                {Number(showPaymentModal.ownerShare).toLocaleString()} FCFA
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Méthode de paiement <span className="text-red-500">*</span>
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
                required
              >
                <option value="">Sélectionner</option>
                <option value="Virement bancaire">Virement bancaire</option>
                <option value="Wave">Wave</option>
                <option value="Orange Money">Orange Money</option>
                <option value="Free Money">Free Money</option>
                <option value="Espèces">Espèces</option>
                <option value="Chèque">Chèque</option>
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                Notes (optionnel)
              </label>
              <textarea
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
                rows="3"
                placeholder="Numéro de transaction, référence bancaire, etc."
              />
            </div>

            <div className="flex gap-2">
              <button
                disabled={isSubmitting}
                onClick={handleMarkAsPaid}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 disabled:opacity-60"
              >
                {isSubmitting ? 'Enregistrement...' : '✅ Confirmer le paiement'}
              </button>
              <button
                disabled={isSubmitting}
                onClick={() => {
                  setShowPaymentModal(null);
                  setPaymentMethod('');
                  setPaymentNotes('');
                }}
                className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 disabled:opacity-60"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerPayments;
