// OwnerPayments.jsx - FIX Supabase snake_case + compat camelCase
import React, { useMemo, useState } from 'react';
import { DollarSign, CheckCircle, Calendar } from 'lucide-react';

const OwnerPayments = ({
  payments = [],
  ownerPayments = [],
  setOwnerPayments,
  currentUser,
  managementContracts = [],
  contracts = [],
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

  // Helpers compat snake_case/camelCase
  const getPaymentDate = (p) => String(p.date ?? p.payment_date ?? '');
  const getPaymentContractId = (p) => Number(p.contract_id ?? p.contractId ?? 0);

  const getContractVehicleId = (c) => String(c.vehicle_id ?? c.vehicleId ?? '');
  const getMgmtVehicleId = (m) => String(m.vehicle_id ?? m.vehicleId ?? '');
  const getMgmtOwnerName = (m) => String(m.owner_name ?? m.ownerName ?? '');
  const getMgmtOwnerDailyShare = (m) => Number(m.owner_daily_share ?? m.ownerDailyShare ?? 0);
  const getMgmtCompanyDailyShare = (m) => Number(m.company_daily_share ?? m.companyDailyShare ?? 0);
  const getMgmtDriverDailyPayment = (m) => Number(m.driver_daily_payment ?? m.driverDailyPayment ?? 0);

  const monthKey = useMemo(() => {
    return `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`; // "2026-02"
  }, [selectedYear, selectedMonth]);

  // Index contracts by id
  const contractById = useMemo(() => {
    const map = new Map();
    (contracts || []).forEach((c) => {
      map.set(Number(c.id), c);
    });
    return map;
  }, [contracts]);

  // Index ownerPayments by (vehicleId + month + year) for status paid/unpaid
  const ownerPaymentByKey = useMemo(() => {
    const map = new Map();
    (ownerPayments || []).forEach((op) => {
      const vehicleId = String(op.vehicle_id ?? op.vehicleId ?? '');
      const month = Number(op.month);
      const year = Number(op.year);
      if (!vehicleId || !month || !year) return;
      map.set(`${vehicleId}|${month}|${year}`, op);
    });
    return map;
  }, [ownerPayments]);

  // Calculer automatiquement les paiements dus pour le mois sélectionné
  const monthlyPayments = useMemo(() => {
    const calculated = [];

    (managementContracts || []).forEach((mgmt) => {
      const mgmtVehicleId = getMgmtVehicleId(mgmt);
      if (!mgmtVehicleId) return;

      // Filtrer les versements du mois pour ce véhicule (via contrat -> vehicle_id)
      const vehiclePayments = (payments || []).filter((p) => {
        const pDate = getPaymentDate(p);
        if (!pDate || !pDate.startsWith(monthKey)) return false;

        const contractId = getPaymentContractId(p);
        const contract = contractById.get(contractId);
        if (!contract) return false;

        const vehicleId = getContractVehicleId(contract);
        return vehicleId === mgmtVehicleId;
      });

      if (vehiclePayments.length === 0) return;

      const numberOfDays = vehiclePayments.length;
      const ownerDailyShare = getMgmtOwnerDailyShare(mgmt);
      const companyDailyShare = getMgmtCompanyDailyShare(mgmt);
      const driverDailyPayment = getMgmtDriverDailyPayment(mgmt);

      const ownerShare = numberOfDays * ownerDailyShare;
      const companyShare = numberOfDays * companyDailyShare;
      const totalCollected = numberOfDays * driverDailyPayment;

      const key = `${mgmtVehicleId}|${selectedMonth}|${selectedYear}`;
      const existing = ownerPaymentByKey.get(key);

      calculated.push({
        id: existing?.id ?? `${mgmt.id}-${selectedMonth}-${selectedYear}`,
        managementContractId: mgmt.id,
        vehicleId: mgmtVehicleId,
        ownerName: getMgmtOwnerName(mgmt),
        month: selectedMonth,
        year: selectedYear,
        numberOfDays,
        dailyRate: ownerDailyShare,
        ownerShare,
        companyShare,
        totalCollected,
        status: existing?.status ?? 'unpaid',
        paidAt: existing?.paid_at ?? existing?.paidAt,
        paidBy: existing?.paid_by ?? existing?.paidBy,
        paidByName: existing?.paid_by_name ?? existing?.paidByName,
        paymentMethod: existing?.payment_method ?? existing?.paymentMethod,
        paymentNotes: existing?.payment_notes ?? existing?.paymentNotes,
      });
    });

    return calculated;
  }, [
    managementContracts,
    payments,
    contractById,
    ownerPaymentByKey,
    monthKey,
    selectedMonth,
    selectedYear,
  ]);

  const handleMarkAsPaid = () => {
    if (!paymentMethod) {
      alert('⚠️ Veuillez sélectionner une méthode de paiement');
      return;
    }

    const target = showPaymentModal;
    if (!target) return;

    const updated = (ownerPayments || []).map((op) => {
      const opId = op.id;
      if (String(opId) === String(target.id)) {
        return {
          ...op,
          status: 'paid',
          paid_at: new Date().toISOString(),
          paid_by: currentUser?.id ?? null,
          paid_by_name: currentUser?.name ?? '',
          payment_method: paymentMethod,
          payment_notes: paymentNotes,
        };
      }
      return op;
    });

    const exists = (ownerPayments || []).some((op) => String(op.id) === String(target.id));
    if (!exists) {
      updated.push({
        id: target.id,
        management_contract_id: target.managementContractId,
        vehicle_id: target.vehicleId,
        owner_name: target.ownerName,
        month: target.month,
        year: target.year,
        number_of_days: target.numberOfDays,
        owner_share: target.ownerShare,
        company_share: target.companyShare,
        total_collected: target.totalCollected,
        status: 'paid',
        paid_at: new Date().toISOString(),
        paid_by: currentUser?.id ?? null,
        paid_by_name: currentUser?.name ?? '',
        payment_method: paymentMethod,
        payment_notes: paymentNotes,
      });
    }

    setOwnerPayments(updated);

    alert(
      `✅ Paiement marqué comme effectué!\n\n` +
      `Propriétaire: ${target.ownerName}\n` +
      `Véhicule: ${target.vehicleId}\n` +
      `Montant: ${Number(target.ownerShare).toLocaleString()} FCFA\n` +
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
            {monthNames.map((month, idx) => (
              <option key={idx} value={idx + 1}>{month}</option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            className="px-4 py-2 border rounded-lg"
          >
            {[2024, 2025, 2026, 2027].map((y) => (
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
              key={mp.id}
              className={`rounded-xl shadow-lg p-6 border-l-4 ${
                mp.status === 'paid' ? 'bg-green-50 border-green-500' : 'bg-yellow-50 border-yellow-500'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-xl flex items-center gap-2">
                    {mp.ownerName}
                    <span className="text-sm font-normal text-gray-600">({mp.vehicleId})</span>
                  </h3>
                  <p className="text-sm text-gray-600">
                    {monthNames[mp.month - 1]} {mp.year}
                  </p>
                </div>

                <span className={`px-4 py-2 rounded-full font-bold ${
                  mp.status === 'paid' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'
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
              Astuce: un versement doit avoir une date "YYYY-MM-DD" (ex: {monthKey}-15) et un contrat lié à un véhicule sous contrat de gestion.
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
