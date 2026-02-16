// OwnerPayments.jsx - Supabase (owner_payments) + calcul automatique des dus
// ✅ Affiche les paiements dus aux propriétaires à partir des versements chauffeurs (payments)
// ✅ "Marquer comme payé" => INSERT dans la table owner_payments (schéma fourni)
// ✅ Compatible snake_case / camelCase (payments, contracts, management_contracts)

import React, { useEffect, useMemo, useState } from 'react';
import { DollarSign, CheckCircle, Clock, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const pad2 = (n) => String(n).padStart(2, '0');
const monthKeyFrom = (y, m) => `${y}-${pad2(m)}`; // ex: 2026-02

const OwnerPayments = ({
  payments,
  ownerPayments,
  setOwnerPayments,
  currentUser,
  managementContracts,
  contracts,
  vehicles
}) => {
  const [showPaymentModal, setShowPaymentModal] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isLoading, setIsLoading] = useState(false);

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const selectedMonthKey = useMemo(
    () => monthKeyFrom(selectedYear, selectedMonth),
    [selectedYear, selectedMonth]
  );

  // --- maps helpers ---
  const contractById = useMemo(() => {
    const map = new Map();
    (contracts || []).forEach(c => map.set(Number(c.id), c));
    return map;
  }, [contracts]);

  const vehicleById = useMemo(() => {
    const map = new Map();
    (vehicles || []).forEach(v => map.set(String(v.id), v));
    return map;
  }, [vehicles]);

  // mgmt contracts: snake_case / camelCase
  const normalizedMgmtContracts = useMemo(() => {
    return (managementContracts || []).map(mc => ({
      id: Number(mc.id),
      ownerName: mc.owner_name ?? mc.ownerName ?? '',
      vehicleId: String(mc.vehicle_id ?? mc.vehicleId ?? ''),
      driverDailyPayment: Number(mc.driver_daily_payment ?? mc.driverDailyPayment ?? 0),
      ownerDailyShare: Number(mc.owner_daily_share ?? mc.ownerDailyShare ?? 0),
      companyDailyShare: Number(mc.company_daily_share ?? mc.companyDailyShare ?? 0),
    }));
  }, [managementContracts]);

  // --- fetch owner_payments pour la période ---
  const loadOwnerPaymentsForPeriod = async () => {
    setIsLoading(true);
    try {
      // month est varchar => on stocke un "monthKey" (YYYY-MM)
      const { data, error } = await supabase
        .from('owner_payments')
        .select('*')
        .eq('month', selectedMonthKey)
        .order('payment_date', { ascending: false });

      if (error) {
        console.error('Erreur Supabase (owner_payments):', error);
        // on garde l'état existant si la requête échoue
        return;
      }

      // on remplace seulement les lignes de cette période (évite doublons si on garde un cache global)
      const others = (ownerPayments || []).filter(op => (op.month ?? '') !== selectedMonthKey);
      setOwnerPayments([...(data || []), ...others]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOwnerPaymentsForPeriod();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonthKey]);

  const isPaymentInSelectedMonth = (dateStr) => {
    if (!dateStr) return false;
    // date Supabase (date) => "YYYY-MM-DD"
    // parfois datetime => "YYYY-MM-DDTHH:mm:ss"
    const s = String(dateStr);
    return s.startsWith(selectedMonthKey); // "YYYY-MM"
  };

  const getPaymentVehicleId = (p) => {
    // 1) via payment.vehicle_id si existe
    const v = p.vehicle_id ?? p.vehicleId;
    if (v) return String(v);

    // 2) via contract_id -> contracts.vehicle_id
    const cid = Number(p.contract_id ?? p.contractId ?? 0);
    if (!cid) return '';
    const c = contractById.get(cid);
    const cv = c?.vehicle_id ?? c?.vehicleId ?? c?.vehicle_id_fk ?? c?.vehicle ?? null;
    return cv ? String(cv) : '';
  };

  const getPaymentDate = (p) => p.date ?? p.payment_date ?? p.created_at ?? '';

  const existingOwnerPaymentByOwnerId = useMemo(() => {
    const map = new Map();
    (ownerPayments || []).forEach(op => {
      // owner_id référence management_contracts.id (schéma fourni)
      const ownerId = Number(op.owner_id ?? op.ownerId ?? op.managementContractId ?? op.management_contract_id ?? 0);
      const month = op.month ?? '';
      if (ownerId && month) map.set(`${ownerId}__${month}`, op);
    });
    return map;
  }, [ownerPayments]);

  // --- Calcul automatique des paiements dus ---
  const monthlyPayments = useMemo(() => {
    const out = [];

    normalizedMgmtContracts.forEach(mc => {
      if (!mc.vehicleId) return;

      // versements chauffeurs pour ce véhicule sur la période
      const vehiclePayments = (payments || []).filter(p => {
        const vehicleId = getPaymentVehicleId(p);
        const dateStr = getPaymentDate(p);
        return vehicleId === mc.vehicleId && isPaymentInSelectedMonth(dateStr);
      });

      if (vehiclePayments.length === 0) return;

      const numberOfDays = vehiclePayments.length; // 1 versement = 1 jour (hypothèse actuelle)
      const ownerShare = numberOfDays * mc.ownerDailyShare;
      const companyShare = numberOfDays * mc.companyDailyShare;
      const totalCollected = numberOfDays * mc.driverDailyPayment;

      const existing = existingOwnerPaymentByOwnerId.get(`${mc.id}__${selectedMonthKey}`);

      out.push({
        id: existing?.id || `${mc.id}-${selectedMonthKey}`,
        managementContractId: mc.id,
        vehicleId: mc.vehicleId,
        ownerName: mc.ownerName,
        monthKey: selectedMonthKey,
        numberOfDays,
        dailyRate: mc.ownerDailyShare,
        ownerShare,
        companyShare,
        totalCollected,

        status: existing ? 'paid' : 'unpaid',
        paidAt: existing?.payment_date ?? existing?.paidAt ?? null,
        paidBy: existing?.created_by ?? existing?.paidBy ?? null,
        paidByName: existing?.created_by_name ?? existing?.paidByName ?? null,
        paymentMethod: existing?.payment_method ?? existing?.paymentMethod ?? null,
        paymentNotes: existing?.notes ?? existing?.paymentNotes ?? null,
      });
    });

    return out;
  }, [normalizedMgmtContracts, payments, existingOwnerPaymentByOwnerId, selectedMonthKey]);

  const totalToPay = useMemo(
    () => monthlyPayments.filter(x => x.status === 'unpaid').reduce((s, x) => s + (x.ownerShare || 0), 0),
    [monthlyPayments]
  );

  const totalPaid = useMemo(
    () => monthlyPayments.filter(x => x.status === 'paid').reduce((s, x) => s + (x.ownerShare || 0), 0),
    [monthlyPayments]
  );

  const handleMarkAsPaid = async () => {
    if (!showPaymentModal) return;

    if (!paymentMethod) {
      alert('⚠️ Veuillez sélectionner une méthode de paiement');
      return;
    }

    // INSERT dans owner_payments (schéma fourni)
    const payload = {
      owner_id: Number(showPaymentModal.managementContractId),
      owner_name: String(showPaymentModal.ownerName || ''),
      amount: Number(showPaymentModal.ownerShare || 0),
      payment_date: new Date().toISOString().split('T')[0], // date
      month: selectedMonthKey,
      notes: paymentNotes || null,
      created_by: currentUser?.id ?? null,
      created_by_name: currentUser?.name ?? null,
    };

    const { data, error } = await supabase
      .from('owner_payments')
      .insert([payload])
      .select('*')
      .single();

    if (error) {
      console.error('Insert owner_payment error:', error);
      alert('❌ Erreur paiement propriétaire: ' + error.message);
      return;
    }

    // mettre à jour l'état local
    const others = (ownerPayments || []).filter(op => Number(op.id) !== Number(data.id));
    setOwnerPayments([data, ...others]);

    alert(
      `✅ Paiement propriétaire enregistré!

` +
      `Propriétaire: ${payload.owner_name}
` +
      `Véhicule: ${showPaymentModal.vehicleId}
` +
      `Montant: ${Number(payload.amount).toLocaleString()} FCFA
` +
      `Période: ${selectedMonthKey}
`
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
          <p className="text-3xl font-bold text-green-700">{Number(totalToPay).toLocaleString()} FCFA</p>
          <p className="text-sm text-green-600 mt-1">
            {monthlyPayments.filter(mp => mp.status === 'unpaid').length} paiement(s) en attente
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="text-blue-600" size={32} />
            <h3 className="font-bold text-blue-900">Déjà payé</h3>
          </div>
          <p className="text-3xl font-bold text-blue-700">{Number(totalPaid).toLocaleString()} FCFA</p>
          <p className="text-sm text-blue-600 mt-1">
            {monthlyPayments.filter(mp => mp.status === 'paid').length} paiement(s) effectué(s)
          </p>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="text-purple-600" size={32} />
            <h3 className="font-bold text-purple-900">Période</h3>
          </div>
          <p className="text-3xl font-bold text-purple-700">{monthNames[selectedMonth - 1]}</p>
          <p className="text-sm text-purple-600 mt-1">{selectedYear} • {selectedMonthKey}</p>
        </div>
      </div>

      {/* Liste des paiements */}
      <div className="grid grid-cols-1 gap-6">
        {isLoading ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <p className="text-gray-600">Chargement...</p>
          </div>
        ) : monthlyPayments.length > 0 ? (
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
                  <p className="text-sm text-gray-600">{monthNames[selectedMonth - 1]} {selectedYear}</p>
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
                    <p><strong>Par:</strong> {mp.paidByName || '—'}</p>
                    <p><strong>Date:</strong> {mp.paidAt ? new Date(mp.paidAt).toLocaleDateString('fr-FR') : '—'}</p>
                    <p><strong>Méthode:</strong> {mp.paymentMethod || '—'}</p>
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
            <p className="text-gray-400 text-sm mt-2">
              Astuce : vérifie qu&apos;il existe un contrat de gestion (Propriétaires) pour le véhicule, et que tes versements ont une date du type {selectedMonthKey}-DD.
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
              <p className="text-sm text-gray-600">{showPaymentModal.vehicleId} • {monthNames[selectedMonth - 1]} {selectedYear}</p>
              <p className="text-sm text-gray-600 mt-1">
                {showPaymentModal.numberOfDays} jours × {Number(showPaymentModal.dailyRate).toLocaleString()} FCFA
              </p>
              <p className="text-3xl font-bold text-green-700 mt-3">{Number(showPaymentModal.ownerShare).toLocaleString()} FCFA</p>
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
