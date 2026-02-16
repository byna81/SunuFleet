// OwnerPayments.jsx - AVEC SUPABASE (compat snake_case/camelCase) + calcul automatique
// ✅ Affiche les paiements dus aux propriétaires à partir des versements (payments)
// ✅ Compatible avec colonnes DB en snake_case (vehicle_id, owner_name, driver_daily_payment, ...)
// ✅ Compatible avec anciens objets UI en camelCase (vehicleId, ownerName, driverDailyPayment, ...)

import React, { useMemo, useState } from 'react';
import { DollarSign, CheckCircle, Calendar } from 'lucide-react';

const OwnerPayments = ({
  payments = [],
  ownerPayments = [],
  setOwnerPayments,
  currentUser,
  managementContracts = [],
  contracts = [],
  vehicles = [],
}) => {
  const [showPaymentModal, setShowPaymentModal] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  // --- helpers ---
  const toNumber = (v, def = 0) => {
    const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
    return Number.isFinite(n) ? n : def;
  };

  // retourne YYYY-MM (ex: 2026-02) même si date est un timestamp
  const monthKeyOf = (dateValue) => {
    if (!dateValue) return '';
    // Cas string "2026-02-16"
    if (typeof dateValue === 'string') {
      // Si timestamp iso: "2026-02-16T20:52:00.000Z"
      if (dateValue.includes('T')) return dateValue.slice(0, 7);
      // Si "2026-02-16"
      if (dateValue.length >= 7) return dateValue.slice(0, 7);
    }
    try {
      const d = new Date(dateValue);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 7);
    } catch (_) {}
    return '';
  };

  const getId = (obj, ...keys) => {
    for (const k of keys) {
      if (obj && obj[k] != null) return obj[k];
    }
    return null;
  };

  const contractById = useMemo(() => {
    const map = new Map();
    (contracts || []).forEach(c => {
      const id = toNumber(c?.id, null);
      if (id != null) map.set(id, c);
    });
    return map;
  }, [contracts]);

  const mgmtContractsNormalized = useMemo(() => {
    return (managementContracts || [])
      .map(mc => {
        const vehicleId = getId(mc, 'vehicle_id', 'vehicleId');
        return {
          raw: mc,
          id: getId(mc, 'id'),
          vehicleId: vehicleId,
          ownerName: getId(mc, 'owner_name', 'ownerName') || '—',
          driverDailyPayment: toNumber(getId(mc, 'driver_daily_payment', 'driverDailyPayment')),
          ownerDailyShare: toNumber(getId(mc, 'owner_daily_share', 'ownerDailyShare')),
          companyDailyShare: toNumber(getId(mc, 'company_daily_share', 'companyDailyShare')),
          status: getId(mc, 'status') || 'validated',
        };
      })
      .filter(mc => mc.vehicleId); // véhicule obligatoire
  }, [managementContracts]);

  // owner_payments peuvent être en base (snake_case) ou en mémoire (camelCase)
  const ownerPaymentsNormalized = useMemo(() => {
    return (ownerPayments || []).map(op => ({
      raw: op,
      id: getId(op, 'id'),
      vehicleId: getId(op, 'vehicle_id', 'vehicleId'),
      month: toNumber(getId(op, 'month')),
      year: toNumber(getId(op, 'year')),
      status: getId(op, 'status') || 'unpaid',
      paidAt: getId(op, 'paid_at', 'paidAt'),
      paidBy: getId(op, 'paid_by', 'paidBy'),
      paidByName: getId(op, 'paid_by_name', 'paidByName'),
      paymentMethod: getId(op, 'payment_method', 'paymentMethod'),
      paymentNotes: getId(op, 'payment_notes', 'paymentNotes'),
    }));
  }, [ownerPayments]);

  // Calculer automatiquement les paiements dus pour un mois donné (à partir des versements)
  const monthlyPayments = useMemo(() => {
    const monthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    const res = [];

    mgmtContractsNormalized.forEach(mc => {
      // versements du mois pour les contrats liés au même véhicule
      const relatedPayments = (payments || []).filter(p => {
        const pMonthKey = monthKeyOf(getId(p, 'date'));
        if (pMonthKey !== monthKey) return false;

        const contractId = toNumber(getId(p, 'contract_id', 'contractId'), null);
        if (contractId == null) return false;

        const c = contractById.get(contractId);
        if (!c) return false;

        const contractVehicleId = getId(c, 'vehicle_id', 'vehicleId');
        return String(contractVehicleId) === String(mc.vehicleId);
      });

      if (relatedPayments.length === 0) return;

      const numberOfDays = relatedPayments.length; // 1 versement = 1 jour
      const ownerShare = numberOfDays * mc.ownerDailyShare;
      const companyShare = numberOfDays * mc.companyDailyShare;
      const totalCollected = numberOfDays * mc.driverDailyPayment;

      const existing = ownerPaymentsNormalized.find(
        op => String(op.vehicleId) === String(mc.vehicleId) &&
              op.month === selectedMonth &&
              op.year === selectedYear
      );

      // label véhicule (optionnel)
      const vehicle = (vehicles || []).find(v => String(getId(v, 'id')) === String(mc.vehicleId));

      res.push({
        id: existing?.id || `${mc.id}-${selectedMonth}-${selectedYear}`,
        managementContractId: mc.id,
        vehicleId: mc.vehicleId,
        vehicleLabel: vehicle ? `${getId(vehicle, 'id')} - ${getId(vehicle, 'brand') || ''}` : String(mc.vehicleId),
        ownerName: mc.ownerName,
        month: selectedMonth,
        year: selectedYear,
        numberOfDays,
        dailyRate: mc.ownerDailyShare,
        ownerShare,
        companyShare,
        totalCollected,
        status: existing?.status || 'unpaid',
        paidAt: existing?.paidAt,
        paidBy: existing?.paidBy,
        paidByName: existing?.paidByName,
        paymentMethod: existing?.paymentMethod,
        paymentNotes: existing?.paymentNotes,
      });
    });

    return res;
  }, [
    payments,
    mgmtContractsNormalized,
    ownerPaymentsNormalized,
    contractById,
    selectedMonth,
    selectedYear,
    vehicles
  ]);

  const handleMarkAsPaid = () => {
    if (!paymentMethod) {
      alert('⚠️ Veuillez sélectionner une méthode de paiement');
      return;
    }

    const target = showPaymentModal;
    if (!target) return;

    const updated = [...(ownerPayments || [])];

    // On cherche un paiement existant (en base ou mémoire)
    const idx = updated.findIndex(op => String(getId(op, 'id')) === String(target.id));
    const nowIso = new Date().toISOString();

    const newRow = {
      ...(idx >= 0 ? updated[idx] : {}),
      id: target.id,
      vehicle_id: target.vehicleId,
      month: target.month,
      year: target.year,
      status: 'paid',
      paid_at: nowIso,
      paid_by: currentUser?.id ?? null,
      paid_by_name: currentUser?.name ?? '',
      payment_method: paymentMethod,
      payment_notes: paymentNotes,
    };

    if (idx >= 0) updated[idx] = newRow;
    else updated.push(newRow);

    setOwnerPayments(updated);

    alert(
      `✅ Paiement marqué comme effectué!\n\n` +
      `Propriétaire: ${target.ownerName}\n` +
      `Véhicule: ${target.vehicleId}\n` +
      `Montant: ${toNumber(target.ownerShare).toLocaleString()} FCFA\n` +
      `Méthode: ${paymentMethod}\n` +
      `Par: ${currentUser?.name ?? ''}\n` +
      `Date: ${new Date().toLocaleDateString('fr-FR')}`
    );

    setShowPaymentModal(null);
    setPaymentMethod('');
    setPaymentNotes('');
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
            {monthNames.map((m, idx) => (
              <option key={idx} value={idx + 1}>{m}</option>
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
              .reduce((sum, mp) => sum + toNumber(mp.ownerShare), 0)
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
              .reduce((sum, mp) => sum + toNumber(mp.ownerShare), 0)
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
              key={mp.id}
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
                      ({mp.vehicleLabel || mp.vehicleId})
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
                  <p className="text-xs text-gray-600">Jours travaillés</p>
                  <p className="text-2xl font-bold">{mp.numberOfDays}</p>
                </div>
                <div className="bg-white p-3 rounded border">
                  <p className="text-xs text-gray-600">Taux journalier</p>
                  <p className="text-2xl font-bold">{toNumber(mp.dailyRate).toLocaleString()}</p>
                </div>
                <div className="bg-white p-3 rounded border">
                  <p className="text-xs text-gray-600">Total collecté</p>
                  <p className="text-2xl font-bold">{toNumber(mp.totalCollected).toLocaleString()}</p>
                </div>
                <div className="bg-green-100 p-3 rounded border border-green-300">
                  <p className="text-xs text-green-700">Part propriétaire</p>
                  <p className="text-2xl font-bold text-green-800">{toNumber(mp.ownerShare).toLocaleString()}</p>
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
                    <p><strong>Par:</strong> {mp.paidByName || '—'}</p>
                    <p><strong>Date:</strong> {mp.paidAt ? new Date(mp.paidAt).toLocaleDateString('fr-FR') : '—'}</p>
                    <p><strong>Méthode:</strong> {mp.paymentMethod || '—'}</p>
                    {mp.paymentNotes ? (
                      <p className="col-span-2"><strong>Notes:</strong> {mp.paymentNotes}</p>
                    ) : null}
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

      {/* Modal Marquer comme payé */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-6">💰 Confirmer le paiement</h2>

            <div className="mb-6 p-4 bg-green-50 rounded border border-green-200">
              <p className="font-bold text-lg">{showPaymentModal.ownerName}</p>
              <p className="text-sm text-gray-600">
                {showPaymentModal.vehicleLabel || showPaymentModal.vehicleId} • {monthNames[showPaymentModal.month - 1]} {showPaymentModal.year}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {showPaymentModal.numberOfDays} jours × {toNumber(showPaymentModal.dailyRate).toLocaleString()} FCFA
              </p>
              <p className="text-3xl font-bold text-green-700 mt-3">
                {toNumber(showPaymentModal.ownerShare).toLocaleString()} FCFA
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
                onClick={handleMarkAsPaid}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700"
              >
                ✅ Confirmer le paiement
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
