import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { DollarSign, CheckCircle, Calendar } from 'lucide-react';

const OwnerPayments = ({
  ownerPayments,
  setOwnerPayments,
  managementContracts,
  payments,
  contracts,
  currentUser
}) => {

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [showModal, setShowModal] = useState(null);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');

  const monthNames = [
    'Janvier','Février','Mars','Avril','Mai','Juin',
    'Juillet','Août','Septembre','Octobre','Novembre','Décembre'
  ];

  // Charger owner_payments depuis Supabase
  const loadOwnerPayments = async () => {

    const { data, error } = await supabase
      .from('owner_payments')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error)
      setOwnerPayments(data);
  };

  useEffect(() => {
    loadOwnerPayments();
  }, []);

  // Calcul automatique depuis payments
  const calculateDuePayments = () => {

    const result = [];

    managementContracts.forEach(contractMgmt => {

      const vehicleId = contractMgmt.vehicle_id || contractMgmt.vehicleId;

      const vehicleContracts = contracts.filter(
        c => (c.vehicle_id || c.vehicleId) === vehicleId
      );

      const vehiclePayments = payments.filter(p =>
        vehicleContracts.some(c =>
          (p.contract_id || p.contractId) === c.id
        )
      );

      const filtered = vehiclePayments.filter(p => {

        const date = new Date(p.date);

        return (
          date.getMonth() + 1 === selectedMonth &&
          date.getFullYear() === selectedYear
        );
      });

      if (filtered.length === 0) return;

      const ownerShare =
        filtered.length * Number(contractMgmt.owner_daily_share || contractMgmt.ownerDailyShare);

      result.push({

        owner_id: contractMgmt.id,
        owner_name: contractMgmt.owner_name || contractMgmt.ownerName,
        vehicleId,
        days: filtered.length,
        amount: ownerShare
      });
    });

    return result;
  };

  const duePayments = calculateDuePayments();

  // Paiement propriétaire (INSERT Supabase)
  const handlePayOwner = async () => {

    if (!showModal) return;

    const payload = {

      owner_id: showModal.owner_id,
      owner_name: showModal.owner_name,

      amount: showModal.amount,

      payment_date: new Date().toISOString().split('T')[0],

      month: `${monthNames[selectedMonth - 1]} ${selectedYear}`,

      notes,

      created_by: currentUser.id,
      created_by_name: currentUser.name
    };

    const { data, error } =
      await supabase
        .from('owner_payments')
        .insert([payload])
        .select()
        .single();

    if (error) {

      alert("Erreur paiement: " + error.message);
      return;
    }

    setOwnerPayments([data, ...ownerPayments]);

    alert("✅ Paiement propriétaire enregistré");

    setShowModal(null);
    setNotes('');
  };

  return (
    <div>

      <h1 className="text-3xl font-bold mb-6">
        💵 Paiements propriétaires
      </h1>

      {/* Sélection mois */}
      <div className="flex gap-4 mb-6">

        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(Number(e.target.value))}
          className="border p-2 rounded"
        >
          {monthNames.map((m,i) =>
            <option key={i} value={i+1}>{m}</option>
          )}
        </select>

        <select
          value={selectedYear}
          onChange={e => setSelectedYear(Number(e.target.value))}
          className="border p-2 rounded"
        >
          {[2024,2025,2026,2027].map(y =>
            <option key={y}>{y}</option>
          )}
        </select>

      </div>

      {/* Liste */}
      {duePayments.length === 0 &&
        <div className="bg-white p-8 rounded shadow text-center">
          Aucun paiement dû
        </div>
      }

      {duePayments.map(p => (

        <div
          key={p.owner_id}
          className="bg-yellow-50 p-6 rounded shadow mb-4"
        >

          <div className="flex justify-between">

            <div>

              <h3 className="text-xl font-bold">
                {p.owner_name}
              </h3>

              <p>
                {p.days} jours travaillés
              </p>

            </div>

            <div className="text-right">

              <p className="text-2xl font-bold text-green-700">
                {p.amount.toLocaleString()} FCFA
              </p>

              <button
                onClick={() => setShowModal(p)}
                className="bg-green-600 text-white px-4 py-2 rounded mt-2"
              >
                Payer
              </button>

            </div>

          </div>

        </div>

      ))}

      {/* Modal paiement */}
      {showModal &&
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">

          <div className="bg-white p-6 rounded w-96">

            <h2 className="text-xl font-bold mb-4">
              Paiement propriétaire
            </h2>

            <textarea
              placeholder="Notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="border w-full p-2 mb-4"
            />

            <button
              onClick={handlePayOwner}
              className="bg-green-600 text-white px-4 py-2 rounded w-full"
            >
              Confirmer paiement
            </button>

          </div>

        </div>
      }

    </div>
  );
};

export default OwnerPayments;
