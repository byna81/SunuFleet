// OwnerPayments.jsx - AVEC SUPABASE + compat snake_case/camelCase
// - Calcule les paiements propriétaires à partir des versements (payments) du mois sélectionné
// - Lie payments -> contracts via contract_id/contractId
// - Lie contracts -> véhicule via vehicle_id/vehicleId
// - Lie management_contracts (contrats propriétaires) via vehicle_id/vehicleId
// - CRUD Supabase sur owner_payments (marquer comme payé)

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
  vehicles
}) => {
  const [showPaymentModal, setShowPaymentModal] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // -----------------------------
  // Helpers compat snake/camel
  // -----------------------------
  const get = (obj, ...keys) => {
    for (const k of keys) {
      if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
    }
    return undefined;
  };

  const monthKey = useMemo(
    () => `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`,
    [selectedYear, selectedMonth]
  );

  const contractsById = useMemo(() => {
    const m = new Map();
    (contracts || []).forEach(c => {
      const id = Number(get(c, 'id'));
      if (Number.isFinite(id)) m.set(id, c);
    });
    return m;
  }, [contracts]);

  const vehiclesById = useMemo(() => {
    const m = new Map();
    (vehicles || []).forEach(v => {
      const id = String(get(v, 'id'));
      if (id) m.set(id, v);
    });
    return m;
  }, [vehicles]);

  const mgmtByVehicleId = useMemo(() => {
    // management_contracts table => vehicle_id, owner_name, owner_daily_share, company_daily_share, driver_daily_payment...
    const m = new Map();
    (managementContracts || []).forEach(mc => {
      const vehicleId = String(get(mc, 'vehicle_id', 'vehicleId'));
      if (vehicleId) m.set(vehicleId, mc);
    });
    return m;
  }, [managementContracts]);

  const existingOwnerPayByKey = useMemo(() => {
    // owner_payments: vehicle_id + month + year
    const m = new Map();
    (ownerPayments || []).forEach(op => {
      const vehicleId = String(get(op, 'vehicle_id', 'vehicleId'));
      const mo = Number(get(op, 'month'));
      const yr = Number(get(op, 'year'));
      if (vehicleId && Number.isFinite(mo) && Number.isFinite(yr)) {
        m.set(`${vehicleId}::${yr}-${String(mo).padStart(2, '0')}`, op);
      }
    });
    return m;
  }, [ownerPayments]);

  // -----------------------------
  // Calcul des paiements dus
  // -----------------------------
  const monthlyPayments = useMemo(() => {
    const list = [];
    const paidThisMonth = (payments || []).filter(p => {
      const d = String(get(p, 'date') || '');
      // On attend un format YYYY-MM-DD
      return d.startsWith(monthKey);
    });

    // Regrouper par véhicule (via contracts)
    const countsByVehicle = new Map(); // vehicleId -> {days, totalCollected}
    paidThisMonth.forEach(p => {
      const contractId = Number(get(p, 'contract_id', 'contractId'));
      const c = contractsById.get(contractId);
      const vehicleId = String(get(c, 'vehicle_id', 'vehicleId') || '');
      if (!vehicleId) return;

      const amount = Number(get(p, 'amount') || 0);
      const prev = countsByVehicle.get(vehicleId) || { days: 0, totalCollected: 0 };
      countsByVehicle.set(vehicleId, {
        days: prev.days + 1,
        totalCollected: prev.totalCollected + (Number.isFinite(amount) ? amount : 0)
      });
    });

    // Pour chaque véhicule ayant des versements, trouver le contrat propriétaire (management_contract)
    for (const [vehicleId, agg] of countsByVehicle.entries()) {
      const mgmt = mgmtByVehicleId.get(vehicleId);
      if (!mgmt) {
        // Si pas de contrat propriétaire, on ne calcule pas (véhicule société ou non configuré)
        continue;
      }

      const ownerDailyShare = Number(get(mgmt, 'owner_daily_share', 'ownerDailyShare') || 0);
      const companyDailyShare = Number(get(mgmt, 'company_daily_share', 'companyDailyShare') || 0);
      const driverDailyPayment = Number(get(mgmt, 'driver_daily_payment', 'driverDailyPayment') || 0);

      const numberOfDays = agg.days;
      const ownerShare = numberOfDays * ownerDailyShare;
      const companyShare = numberOfDays * companyDailyShare;
      const totalCollected = driverDailyPayment ? numberOfDays * driverDailyPayment : agg.totalCollected;

      const key = `${vehicleId}::${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
      const existing = existingOwnerPayByKey.get(key);

      list.push({
        // UI model (camelCase) mais on gardera aussi l'id DB si existe
        id: get(existing, 'id') ?? `${vehicleId}-${selectedYear}-${String(selectedMonth).padStart(2, '0')}`,
        ownerPaymentId: get(existing, 'id') ?? null,

        managementContractId: Number(get(mgmt, 'id')) || null,
        vehicleId,
        vehicleName: String(get(vehiclesById.get(vehicleId), 'brand') || ''),
        ownerName: String(get(mgmt, 'owner_name', 'ownerName') || ''),

        month: selectedMonth,
        year: selectedYear,
        numberOfDays,
        dailyRate: ownerDailyShare,

        ownerShare,
        companyShare,
        totalCollected,

        status: String(get(existing, 'status') || 'unpaid'),
        paidAt: get(existing, 'paid_at', 'paidAt'),
        paidBy: get(existing, 'paid_by', 'paidBy'),
        paidByName: get(existing, 'paid_by_name', 'paidByName'),
        paymentMethod: get(existing, 'payment_method', 'paymentMethod'),
        paymentNotes: get(existing, 'payment_notes', 'paymentNotes')
      });
    }

    // tri: unpaid d'abord puis ownerName
    list.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'unpaid' ? -1 : 1;
      return String(a.ownerName).localeCompare(String(b.ownerName));
    });

    return list;
  }, [
    payments,
    monthKey,
    contractsById,
    mgmtByVehicleId,
    vehiclesById,
    existingOwnerPayByKey,
    selectedMonth,
    selectedYear
  ]);

  // -----------------------------
  // Marquer comme payé (DB owner_payments)
  // -----------------------------
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
        management_contract_id: showPaymentModal.managementContractId,
        vehicle_id: showPaymentModal.vehicleId,
        owner_name: showPaymentModal.ownerName,
        month: showPaymentModal.month,
        year: showPaymentModal.year,
        number_of_days: showPaymentModal.numberOfDays,
        daily_rate: showPaymentModal.dailyRate,
        owner_share: showPaymentModal.ownerShare,
        company_share: showPaymentModal.companyShare,
        total_collected: showPaymentModal.totalCollected,

        status: 'paid',
        paid_at: new Date().toISOString(),
        paid_by: currentUser?.id ?? null,
        paid_by_name: currentUser?.name ?? '',
        payment_method: paymentMethod,
        payment_notes: paymentNotes || ''
      };

      let saved;
      if (showPaymentModal.ownerPaymentId) {
        const { data, error } = await supabase
          .from('owner_payments')
          .update(payload)
          .eq('id', showPaymentModal.ownerPaymentId)
          .select('*')
          .single();
        if (error) throw error;
        saved = data;
      } else {
        const { data, error } = await supabase
          .from('owner_payments')
          .insert([payload])
          .select('*')
          .single();
        if (error) throw error;
        saved = data;
      }

      // Mettre à jour l'état
      const next = [...(ownerPayments || [])].filter(op => Number(get(op, 'id')) !== Number(saved.id));
      next.push(saved);
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
    } catch (err) {
      console.error('Owner payment save error:', err);
      alert('❌ Erreur paiement propriétaire: ' + (err?.message || 'Erreur inconnue'));
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
          <p className="text-3xl font-bold text-purple-700">{monthNames[selectedMonth - 1]}</p>
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
                    {mp.ownerName || '—'}
                    <span className="text-sm font-normal text-gray-600">
                      ({mp.vehicleId}{mp.vehicleName ? ` • ${mp.vehicleName}` : ''})
                    </span>
                  </h3>
                  <p className="text-sm text-gray-600">{monthNames[mp.month - 1]} {mp.year}</p>
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
                  <p className="text-2xl font-bold">{Number(mp.dailyRate || 0).toLocaleString()}</p>
                </div>
                <div className="bg-white p-3 rounded border">
                  <p className="text-xs text-gray-600">Total collecté</p>
                  <p className="text-2xl font-bold">{Number(mp.totalCollected || 0).toLocaleString()}</p>
                </div>
                <div className="bg-green-100 p-3 rounded border border-green-300">
                  <p className="text-xs text-green-700">Part propriétaire</p>
                  <p className="text-2xl font-bold text-green-800">{Number(mp.ownerShare || 0).toLocaleString()}</p>
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
                    {mp.paymentNotes ? <p className="col-span-2"><strong>Notes:</strong> {mp.paymentNotes}</p> : null}
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
            <p className="text-xs text-gray-500 mt-2">
              Astuce: pour apparaître ici, il faut (1) un contrat propriétaire (onglet Propriétaires) lié au véhicule,
              et (2) des versements (onglet Versements) avec une date du type {monthKey}-DD.
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
