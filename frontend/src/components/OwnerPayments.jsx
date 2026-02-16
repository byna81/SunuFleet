// OwnerPayments.jsx - Gestion des paiements aux propriétaires particuliers (SUPABASE)
// ✅ Calcule automatiquement ce qui est dû à partir des versements chauffeurs
// ✅ Compatible snake_case (DB) + camelCase (UI) pour éviter les régressions
// ✅ Marquer comme payé => insert/update en base (table owner_payments)

import React, { useMemo, useState } from 'react';
import { DollarSign, CheckCircle, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const OwnerPayments = ({
  payments,
  ownerPayments,
  setOwnerPayments,
  currentUser,
  managementContracts,
  contracts,
  vehicles,
}) => {
  const now = new Date();
  const [showPaymentModal, setShowPaymentModal] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  // --- helpers compat snake/camel ---
  const getContractId = (p) => Number(p.contract_id ?? p.contractId);
  const getPaymentDate = (p) => String(p.date ?? '');
  const getMgmtVehicleId = (mc) => String(mc.vehicle_id ?? mc.vehicleId ?? '');
  const getMgmtOwnerName = (mc) => String(mc.owner_name ?? mc.ownerName ?? '');
  const getMgmtOwnerDailyShare = (mc) => Number(mc.owner_daily_share ?? mc.ownerDailyShare ?? 0);
  const getMgmtCompanyDailyShare = (mc) => Number(mc.company_daily_share ?? mc.companyDailyShare ?? 0);
  const getMgmtDriverDailyPayment = (mc) => Number(mc.driver_daily_payment ?? mc.driverDailyPayment ?? 0);

  const contractById = useMemo(() => {
    const map = new Map();
    (contracts || []).forEach(c => {
      map.set(Number(c.id), c);
    });
    return map;
  }, [contracts]);

  const ownerPayByKey = useMemo(() => {
    // key = vehicleId-month-year
    const map = new Map();
    (ownerPayments || []).forEach(op => {
      const vehicleId = String(op.vehicle_id ?? op.vehicleId ?? '');
      const m = Number(op.month ?? 0);
      const y = Number(op.year ?? 0);
      if (vehicleId && m && y) map.set(`${vehicleId}-${m}-${y}`, op);
    });
    return map;
  }, [ownerPayments]);

  const monthlyPayments = useMemo(() => {
    const calculated = [];
    const monthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

    // on ne calcule que pour les contrats de gestion validés (ou sans status)
    const mgmts = (managementContracts || []).filter(mc => {
      const st = (mc.status ?? '').toLowerCase();
      return st === '' || st === 'validated' || st === 'active';
    });

    mgmts.forEach(mgmtContract => {
      const vehicleId = getMgmtVehicleId(mgmtContract);
      if (!vehicleId) return;

      // Filtrer les versements chauffeurs pour ce véhicule sur le mois
      const vehiclePayments = (payments || []).filter(p => {
        const cid = getContractId(p);
        const c = contractById.get(cid);
        const cVehicleId = String(c?.vehicle_id ?? c?.vehicleId ?? '');
        return cVehicleId === vehicleId && getPaymentDate(p).startsWith(monthKey);
      });

      if (vehiclePayments.length === 0) return;

      const numberOfDays = vehiclePayments.length;
      const ownerDailyShare = getMgmtOwnerDailyShare(mgmtContract);
      const companyDailyShare = getMgmtCompanyDailyShare(mgmtContract);
      const driverDailyPayment = getMgmtDriverDailyPayment(mgmtContract);

      const ownerShare = numberOfDays * ownerDailyShare;
      const companyShare = numberOfDays * companyDailyShare;
      const totalCollected = numberOfDays * driverDailyPayment;

      const existing = ownerPayByKey.get(`${vehicleId}-${selectedMonth}-${selectedYear}`);

      calculated.push({
        id: existing?.id, // id DB si existe
        managementContractId: Number(mgmtContract.id),
        management_contract_id: Number(mgmtContract.id),
        vehicleId,
        vehicle_id: vehicleId,
        ownerName: getMgmtOwnerName(mgmtContract),
        owner_name: getMgmtOwnerName(mgmtContract),
        month: selectedMonth,
        year: selectedYear,
        numberOfDays,
        number_of_days: numberOfDays,
        dailyRate: ownerDailyShare,
        daily_rate: ownerDailyShare,
        ownerShare,
        owner_share: ownerShare,
        companyShare,
        company_share: companyShare,
        totalCollected,
        total_collected: totalCollected,

        status: (existing?.status ?? 'unpaid'),
        paidAt: (existing?.paid_at ?? existing?.paidAt),
        paidBy: (existing?.paid_by ?? existing?.paidBy),
        paidByName: (existing?.paid_by_name ?? existing?.paidByName),
        paymentMethod: (existing?.payment_method ?? existing?.paymentMethod),
        paymentNotes: (existing?.payment_notes ?? existing?.paymentNotes),
      });
    });

    // tri stable
    return calculated.sort((a, b) => (a.vehicleId || '').localeCompare(b.vehicleId || ''));
  }, [payments, managementContracts, selectedMonth, selectedYear, contractById, ownerPayByKey]);

  // --- helpers schema fallback (same pattern) ---
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

  const supabaseUpsertWithFallback = async (table, payload, match = 'id') => {
    let p = { ...payload };
    for (let i = 0; i < 10; i++) {
      const { data, error } = await supabase
        .from(table)
        .upsert([p], { onConflict: match })
        .select('*')
        .single();
      if (!error) return { data, error: null };
      const next = dropUnknownColumnFromError(p, error);
      if (!next) return { data: null, error };
      p = next;
    }
    return { data: null, error: { message: 'Upsert failed after retries' } };
  };

  const handleMarkAsPaid = async () => {
    if (!showPaymentModal) return;
    if (!paymentMethod) {
      alert('⚠️ Veuillez sélectionner une méthode de paiement');
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const payload = {
        id: showPaymentModal.id ?? undefined, // si existe on update sinon insert
        management_contract_id: showPaymentModal.management_contract_id,
        vehicle_id: showPaymentModal.vehicle_id,
        owner_name: showPaymentModal.owner_name,
        month: showPaymentModal.month,
        year: showPaymentModal.year,
        number_of_days: showPaymentModal.number_of_days,
        daily_rate: showPaymentModal.daily_rate,
        owner_share: showPaymentModal.owner_share,
        company_share: showPaymentModal.company_share,
        total_collected: showPaymentModal.total_collected,
        status: 'paid',
        paid_at: new Date().toISOString(),
        paid_by: currentUser?.id ?? null,
        paid_by_name: currentUser?.name ?? '',
        payment_method: paymentMethod,
        payment_notes: paymentNotes,
      };

      const { data, error } = await supabaseUpsertWithFallback('owner_payments', payload, 'id');
      if (error) {
        console.error('Owner payment upsert error:', error);
        alert('❌ Erreur paiement propriétaire: ' + error.message);
        return;
      }

      // update local state
      const next = [...(ownerPayments || [])].filter(op => Number(op.id) !== Number(data.id));
      next.push(data);
      setOwnerPayments(next);

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
            {[2024, 2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Résumé global */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="text-green-600" size={32} />
            <h3 className="font-bold text-green-900">Total à payer</h3>
          </div>
          <p className="text-3xl font-bold text-green-700">
            {monthlyPayments
              .filter(mp => mp.status === 'unpaid')
              .reduce((sum, mp) => sum + Number(mp.ownerShare || 0), 0)
              .toLocaleString()} FCFA
          </p>
          <p className="text-sm text-green-600 mt-1">
            {monthlyPayments.filter(mp => mp.status === 'unpaid').length} paiement(s) en attente
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

      {/* Liste des paiements */}
      <div className="grid grid-cols-1 gap-6">
        {monthlyPayments.length > 0 ? (
          monthlyPayments.map(mp => (
            <div
              key={`${mp.vehicleId}-${mp.month}-${mp.year}`}
              className={`rounded-xl shadow-lg p-6 border-l-4 ${
                mp.status === 'paid'
                  ? 'bg-green-50 border-green-500'
                  : 'bg-yellow-50 border-yellow-500'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-xl flex items-center gap-2">
                    {mp.ownerName}
                    <span className="text-sm font-normal text-gray-600">
                      ({mp.vehicleId})
                    </span>
                  </h3>
                  <p className="text-sm text-gray-600">
                    {monthNames[mp.month - 1]} {mp.year}
                  </p>
                </div>
                <span className={`px-4 py-2 rounded-full font-bold ${
                  mp.status === 'paid'
                    ? 'bg-green-200 text-green-800'
                    : 'bg-yellow-200 text-yellow-800'
                }`}>
                  {mp.status === 'paid' ? '✅ Payé' : '⏳ À payer'}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-white p-3 rounded border">
                  <p className="text-xs text-gray-600">Jours payés</p>
                  <p className="text-2xl font-bold">{mp.numberOfDays}</p>
                </div>
                <div className="bg-white p-3 rounded border">
                  <p className="text-xs text-gray-600">Taux journalier</p>
                  <p className="text-2xl font-bold">{Number(mp.dailyRate).toLocaleString()}</p>
                </div>
                <div className="bg-white p-3 rounded border">
                  <p className="text-xs text-gray-600">Total collecté</p>
                  <p className="text-2xl font-bold">{Number(mp.totalCollected).toLocaleString()}</p>
                </div>
                <div className="bg-green-100 p-3 rounded border border-green-300">
                  <p className="text-xs text-green-700">Part propriétaire</p>
                  <p className="text-2xl font-bold text-green-800">{Number(mp.ownerShare).toLocaleString()}</p>
                </div>
              </div>

              {mp.status === 'unpaid' ? (
                <button
                  onClick={() => setShowPaymentModal(mp)}
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700"
                >
                  💰 Marquer comme payé
                </button>
              ) : (
                <div className="bg-white p-4 rounded border border-green-300">
                  <p className="text-sm font-bold text-green-800 mb-2">✅ Paiement effectué</p>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                    <p><strong>Par:</strong> {mp.paidByName}</p>
                    <p><strong>Date:</strong> {mp.paidAt ? new Date(mp.paidAt).toLocaleDateString('fr-FR') : '—'}</p>
                    <p><strong>Méthode:</strong> {mp.paymentMethod}</p>
                    {mp.paymentNotes && (
                      <p className="col-span-2"><strong>Notes:</strong> {mp.paymentNotes}</p>
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
              Astuce: si vous venez d&apos;enregistrer un versement en {now.getFullYear()}, sélectionnez {now.getFullYear()}.
            </p>
          </div>
        )}
      </div>

      {/* Modal Marquer comme payé */}
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
              <label className="block text-sm font-medium mb-2">Notes (optionnel)</label>
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
                onClick={() => {
                  setShowPaymentModal(null);
                  setPaymentMethod('');
                  setPaymentNotes('');
                }}
                className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400"
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