// OwnerPayments.jsx - Paiements aux propriétaires (COMPAT SUPABASE snake_case + calcul dû)
// ✅ Calcule le "dû propriétaire" à partir des versements chauffeurs (payments) + contrats (contracts) + contrats de gestion (management_contracts)
// ✅ Soustrait les paiements déjà effectués (table owner_payments)
// ✅ Supporte snake_case et camelCase (évite régressions)

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
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const monthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const toYMD = (d) => {
    if (!d) return '';
    if (typeof d === 'string') return d.slice(0, 10); // "YYYY-MM-DD..."
    try {
      const dt = new Date(d);
      if (Number.isNaN(dt.getTime())) return '';
      return dt.toISOString().slice(0, 10);
    } catch {
      return '';
    }
  };

  const contractsById = useMemo(() => {
    const m = new Map();
    (contracts || []).forEach(c => {
      if (c?.id != null) m.set(Number(c.id), c);
    });
    return m;
  }, [contracts]);

  const mgmtNormalized = useMemo(() => {
    return (managementContracts || []).map(mc => {
      const id = Number(mc.id);
      const vehicleId = mc.vehicle_id ?? mc.vehicleId ?? mc.vehicleIdStr ?? '';
      const ownerName = mc.owner_name ?? mc.ownerName ?? '';
      const driverDailyPayment = Number(mc.driver_daily_payment ?? mc.driverDailyPayment ?? 0);
      const ownerDailyShare = Number(mc.owner_daily_share ?? mc.ownerDailyShare ?? 0);
      const companyDailyShare = Number(mc.company_daily_share ?? mc.companyDailyShare ?? 0);
      return {
        id,
        vehicleId,
        ownerName,
        driverDailyPayment,
        ownerDailyShare,
        companyDailyShare
      };
    });
  }, [managementContracts]);

  const ownerPaidByOwnerId = useMemo(() => {
    // Somme payée par owner_id pour la période sélectionnée
    const map = new Map();
    (ownerPayments || []).forEach(op => {
      const ownerId = Number(op.owner_id ?? op.ownerId ?? op.owner_id_fk ?? op.owner ?? op.owner_id_ref ?? op.owner_id2 ?? op.owner_id3 ?? op.owner_id4 ?? op.owner_id5 ?? op.owner_id6 ?? op.owner_id7 ?? op.owner_id8 ?? op.owner_id9 ?? op.owner_id10 ?? op.owner_id11 ?? op.owner_id12 ?? op.owner_id13 ?? op.owner_id14 ?? op.owner_id15 ?? op.owner_id16 ?? op.owner_id17 ?? op.owner_id18 ?? op.owner_id19 ?? op.owner_id20 ?? op.owner_id21 ?? op.owner_id22 ?? op.owner_id23 ?? op.owner_id24 ?? op.owner_id25 ?? op.owner_id26 ?? op.owner_id27 ?? op.owner_id28 ?? op.owner_id29 ?? op.owner_id30 ?? op.owner_id31 ?? op.owner_id32 ?? op.owner_id33 ?? op.owner_id34 ?? op.owner_id35 ?? op.owner_id36 ?? op.owner_id37 ?? op.owner_id38 ?? op.owner_id39 ?? op.owner_id40 ?? op.owner_id41 ?? op.owner_id42 ?? op.owner_id43 ?? op.owner_id44 ?? op.owner_id45 ?? op.owner_id46 ?? op.owner_id47 ?? op.owner_id48 ?? op.owner_id49 ?? op.owner_id50 ?? op.owner_id51 ?? op.owner_id52 ?? op.owner_id53 ?? op.owner_id54 ?? op.owner_id55 ?? op.owner_id56 ?? op.owner_id57 ?? op.owner_id58 ?? op.owner_id59 ?? op.owner_id60 ?? op.owner_id61 ?? op.owner_id62 ?? op.owner_id63 ?? op.owner_id64 ?? op.owner_id65 ?? op.owner_id66 ?? op.owner_id67 ?? op.owner_id68 ?? op.owner_id69 ?? op.owner_id70 ?? op.owner_id71 ?? op.owner_id72 ?? op.owner_id73 ?? op.owner_id74 ?? op.owner_id75 ?? op.owner_id76 ?? op.owner_id77 ?? op.owner_id78 ?? op.owner_id79 ?? op.owner_id80 ?? op.owner_id81 ?? op.owner_id82 ?? op.owner_id83 ?? op.owner_id84 ?? op.owner_id85 ?? op.owner_id86 ?? op.owner_id87 ?? op.owner_id88 ?? op.owner_id89 ?? op.owner_id90 ?? op.owner_id91 ?? op.owner_id92 ?? op.owner_id93 ?? op.owner_id94 ?? op.owner_id95 ?? op.owner_id96 ?? op.owner_id97 ?? op.owner_id98 ?? op.owner_id99 ?? op.owner_id100 ?? op.owner_id101 ?? op.owner_id102 ?? op.owner_id103 ?? op.owner_id104 ?? op.owner_id105 ?? op.owner_id106 ?? op.owner_id107 ?? op.owner_id108 ?? op.owner_id109 ?? op.owner_id110 ?? op.owner_id111 ?? op.owner_id112 ?? op.owner_id113 ?? op.owner_id114 ?? op.owner_id115 ?? op.owner_id116 ?? op.owner_id117 ?? op.owner_id118 ?? op.owner_id119 ?? op.owner_id120 ?? op.owner_id121 ?? op.owner_id122 ?? op.owner_id123 ?? op.owner_id124 ?? op.owner_id125 ?? op.owner_id126 ?? op.owner_id127 ?? op.owner_id128 ?? op.owner_id129 ?? op.owner_id130 ?? op.owner_id131 ?? op.owner_id132 ?? op.owner_id133 ?? op.owner_id134 ?? op.owner_id135 ?? op.owner_id136 ?? op.owner_id137 ?? op.owner_id138 ?? op.owner_id139 ?? op.owner_id140 ?? op.owner_id141 ?? op.owner_id142 ?? op.owner_id143 ?? op.owner_id144 ?? op.owner_id145 ?? op.owner_id146 ?? op.owner_id147 ?? op.owner_id148 ?? op.owner_id149 ?? op.owner_id150 ?? op.owner_id151 ?? op.owner_id152 ?? op.owner_id153 ?? op.owner_id154 ?? op.owner_id155 ?? op.owner_id156 ?? op.owner_id157 ?? op.owner_id158 ?? op.owner_id159 ?? op.owner_id160 ?? op.owner_id161 ?? op.owner_id162 ?? op.owner_id163 ?? op.owner_id164 ?? op.owner_id165 ?? op.owner_id166 ?? op.owner_id167 ?? op.owner_id168 ?? op.owner_id169 ?? op.owner_id170 ?? op.owner_id171 ?? op.owner_id172 ?? op.owner_id173 ?? op.owner_id174 ?? op.owner_id175 ?? op.owner_id176 ?? op.owner_id177 ?? op.owner_id178 ?? op.owner_id179 ?? op.owner_id180 ?? op.owner_id181 ?? op.owner_id182 ?? op.owner_id183 ?? op.owner_id184 ?? op.owner_id185 ?? op.owner_id186 ?? op.owner_id187 ?? op.owner_id188 ?? op.owner_id189 ?? op.owner_id190 ?? op.owner_id191 ?? op.owner_id192 ?? op.owner_id193 ?? op.owner_id194 ?? op.owner_id195 ?? op.owner_id196 ?? op.owner_id197 ?? op.owner_id198 ?? op.owner_id199 ?? op.owner_id200 ?? op.owner_id201 ?? op.owner_id202 ?? op.owner_id203 ?? op.owner_id204 ?? op.owner_id205 ?? op.owner_id206 ?? op.owner_id207 ?? op.owner_id208 ?? op.owner_id209 ?? op.owner_id210 ?? op.owner_id211 ?? op.owner_id212 ?? op.owner_id213 ?? op.owner_id214 ?? op.owner_id215 ?? op.owner_id216 ?? op.owner_id217 ?? op.owner_id218 ?? op.owner_id219 ?? op.owner_id220 ?? op.owner_id221 ?? op.owner_id222 ?? op.owner_id223 ?? op.owner_id224 ?? op.owner_id225 ?? op.owner_id226 ?? op.owner_id227 ?? op.owner_id228 ?? op.owner_id229 ?? op.owner_id230 ?? op.owner_id231 ?? op.owner_id232 ?? op.owner_id233 ?? op.owner_id234 ?? op.owner_id235 ?? op.owner_id236 ?? op.owner_id237 ?? op.owner_id238 ?? op.owner_id239 ?? op.owner_id240 ?? op.owner_id241 ?? op.owner_id242 ?? op.owner_id243 ?? op.owner_id244 ?? op.owner_id245 ?? op.owner_id246 ?? op.owner_id247 ?? op.owner_id248 ?? op.owner_id249 ?? op.owner_id250 ?? op.owner_id251 ?? op.owner_id252 ?? op.owner_id253 ?? op.owner_id254 ?? op.owner_id255 ?? op.owner_id256 ?? op.owner_id257 ?? op.owner_id258 ?? op.owner_id259 ?? op.owner_id260 ?? op.owner_id261 ?? op.owner_id262 ?? op.owner_id263 ?? op.owner_id264 ?? op.owner_id265 ?? op.owner_id266 ?? op.owner_id267 ?? op.owner_id268 ?? op.owner_id269 ?? op.owner_id270 ?? op.owner_id271 ?? op.owner_id272 ?? op.owner_id273 ?? op.owner_id274 ?? op.owner_id275 ?? op.owner_id276 ?? op.owner_id277 ?? op.owner_id278 ?? op.owner_id279 ?? op.owner_id280 ?? op.owner_id281 ?? op.owner_id282 ?? op.owner_id283 ?? op.owner_id284 ?? op.owner_id285 ?? op.owner_id286 ?? op.owner_id287 ?? op.owner_id288 ?? op.owner_id289 ?? op.owner_id290 ?? op.owner_id291 ?? op.owner_id292 ?? op.owner_id293 ?? op.owner_id294 ?? op.owner_id295 ?? op.owner_id296 ?? op.owner_id297 ?? op.owner_id298 ?? op.owner_id299 ?? op.owner_id300 ?? op.owner_id301 ?? op.owner_id302 ?? op.owner_id303 ?? op.owner_id304 ?? op.owner_id305 ?? op.owner_id306 ?? op.owner_id307 ?? op.owner_id308 ?? op.owner_id309 ?? op.owner_id310 ?? op.owner_id311 ?? op.owner_id312 ?? op.owner_id313 ?? op.owner_id314 ?? op.owner_id315 ?? op.owner_id316 ?? op.owner_id317 ?? op.owner_id318 ?? op.owner_id319 ?? op.owner_id320 ?? op.owner_id321 ?? op.owner_id322 ?? op.owner_id323 ?? op.owner_id324 ?? op.owner_id325 ?? op.owner_id326 ?? op.owner_id327 ?? op.owner_id328 ?? op.owner_id329 ?? op.owner_id330 ?? op.owner_id331 ?? op.owner_id332 ?? op.owner_id333 ?? op.owner_id334 ?? op.owner_id335 ?? op.owner_id336 ?? op.owner_id337 ?? op.owner_id338 ?? op.owner_id339 ?? op.owner_id340 ?? op.owner_id341 ?? op.owner_id342 ?? op.owner_id343 ?? op.owner_id344 ?? op.owner_id345 ?? op.owner_id346 ?? op.owner_id347 ?? op.owner_id348 ?? op.owner_id349 ?? op.owner_id350 ?? op.owner_id351 ?? op.owner_id352 ?? op.owner_id353 ?? op.owner_id354 ?? op.owner_id355 ?? op.owner_id356 ?? op.owner_id357 ?? op.owner_id358 ?? op.owner_id359 ?? op.owner_id360 ?? op.owner_id361 ?? op.owner_id362 ?? op.owner_id363 ?? op.owner_id364 ?? op.owner_id365 ?? op.owner_id366 ?? op.owner_id367 ?? op.owner_id368 ?? op.owner_id369 ?? op.owner_id370 ?? op.owner_id371 ?? op.owner_id372 ?? op.owner_id373 ?? op.owner_id374 ?? op.owner_id375 ?? op.owner_id376 ?? op.owner_id377 ?? op.owner_id378 ?? op.owner_id379 ?? op.owner_id380 ?? op.owner_id381 ?? op.owner_id382 ?? op.owner_id383 ?? op.owner_id384 ?? op.owner_id385 ?? op.owner_id386 ?? op.owner_id387 ?? op.owner_id388 ?? op.owner_id389 ?? op.owner_id390 ?? op.owner_id391 ?? op.owner_id392 ?? op.owner_id393 ?? op.owner_id394 ?? op.owner_id395 ?? op.owner_id396 ?? op.owner_id397 ?? op.owner_id398 ?? op.owner_id399 ?? op.owner_id400 ?? op.owner_id401 ?? op.owner_id402 ?? op.owner_id403 ?? op.owner_id404 ?? op.owner_id405 ?? op.owner_id406 ?? op.owner_id407 ?? op.owner_id408 ?? op.owner_id409 ?? op.owner_id410 ?? op.owner_id411 ?? op.owner_id412 ?? op.owner_id413 ?? op.owner_id414 ?? op.owner_id415 ?? op.owner_id416 ?? op.owner_id417 ?? op.owner_id418 ?? op.owner_id419 ?? op.owner_id420 ?? op.owner_id421 ?? op.owner_id422 ?? op.owner_id423 ?? op.owner_id424 ?? op.owner_id425 ?? op.owner_id426 ?? op.owner_id427 ?? op.owner_id428 ?? op.owner_id429 ?? op.owner_id430 ?? op.owner_id431 ?? op.owner_id432 ?? op.owner_id433 ?? op.owner_id434 ?? op.owner_id435 ?? op.owner_id436 ?? op.owner_id437 ?? op.owner_id438 ?? op.owner_id439 ?? op.owner_id440 ?? op.owner_id441 ?? op.owner_id442 ?? op.owner_id443 ?? op.owner_id444 ?? op.owner_id445 ?? op.owner_id446 ?? op.owner_id447 ?? op.owner_id448 ?? op.owner_id449 ?? op.owner_id450 ?? op.owner_id451 ?? op.owner_id452 ?? op.owner_id453 ?? op.owner_id454 ?? op.owner_id455 ?? op.owner_id456 ?? op.owner_id457 ?? op.owner_id458 ?? op.owner_id459 ?? op.owner_id460 ?? op.owner_id461 ?? op.owner_id462 ?? op.owner_id463 ?? op.owner_id464 ?? op.owner_id465 ?? op.owner_id466 ?? op.owner_id467 ?? op.owner_id468 ?? op.owner_id469 ?? op.owner_id470 ?? op.owner_id471 ?? op.owner_id472 ?? op.owner_id473 ?? op.owner_id474 ?? op.owner_id475 ?? op.owner_id476 ?? op.owner_id477 ?? op.owner_id478 ?? op.owner_id479 ?? op.owner_id480 ?? op.owner_id481 ?? op.owner_id482 ?? op.owner_id483 ?? op.owner_id484 ?? op.owner_id485 ?? op.owner_id486 ?? op.owner_id487 ?? op.owner_id488 ?? op.owner_id489 ?? op.owner_id490 ?? op.owner_id491 ?? op.owner_id492 ?? op.owner_id493 ?? op.owner_id494 ?? op.owner_id495 ?? op.owner_id496 ?? op.owner_id497 ?? op.owner_id498 ?? op.owner_id499 ?? op.owner_id500);
      if (!ownerId) return;

      const paymentDate = toYMD(op.payment_date ?? op.paymentDate ?? op.created_at ?? op.createdAt);
      if (!paymentDate.startsWith(monthKey)) return;

      const amt = Number(op.amount ?? 0);
      map.set(ownerId, (map.get(ownerId) || 0) + (Number.isFinite(amt) ? amt : 0));
    });
    return map;
  }, [ownerPayments, monthKey]);

  const monthlyPayments = useMemo(() => {
    const res = [];

    mgmtNormalized.forEach(mc => {
      const vehicleId = mc.vehicleId;
      if (!vehicleId) return;

      // Versements chauffeurs du mois pour ce véhicule
      const vehiclePayments = (payments || []).filter(p => {
        const d = toYMD(p.date ?? p.payment_date ?? p.paymentDate);
        if (!d.startsWith(monthKey)) return false;

        // si la table payments contient directement vehicle_id
        const pVehicle = p.vehicle_id ?? p.vehicleId;
        if (pVehicle && String(pVehicle) === String(vehicleId)) return true;

        const contractId = Number(p.contract_id ?? p.contractId);
        if (!contractId) return false;
        const c = contractsById.get(contractId);
        const cVehicle = c?.vehicle_id ?? c?.vehicleId;
        return cVehicle && String(cVehicle) === String(vehicleId);
      });

      if (vehiclePayments.length === 0) return;

      const numberOfDays = vehiclePayments.length;
      const ownerShare = numberOfDays * (mc.ownerDailyShare || 0);
      const companyShare = numberOfDays * (mc.companyDailyShare || 0);
      const totalCollected = numberOfDays * (mc.driverDailyPayment || 0);

      const paidAlready = ownerPaidByOwnerId.get(Number(mc.id)) || 0;
      const remaining = Math.max(ownerShare - paidAlready, 0);

      res.push({
        id: `${mc.id}-${selectedMonth}-${selectedYear}`,
        ownerId: mc.id,
        ownerName: mc.ownerName,
        vehicleId: mc.vehicleId,
        month: selectedMonth,
        year: selectedYear,
        numberOfDays,
        dailyRate: mc.ownerDailyShare || 0,
        ownerShare,
        companyShare,
        totalCollected,
        paidAlready,
        remaining,
        status: remaining <= 0 ? 'paid' : 'unpaid'
      });
    });

    return res.sort((a, b) => String(a.ownerName || '').localeCompare(String(b.ownerName || '')));
  }, [mgmtNormalized, payments, contractsById, monthKey, ownerPaidByOwnerId, selectedMonth, selectedYear]);

  const totals = useMemo(() => {
    const unpaid = monthlyPayments.filter(x => x.status === 'unpaid').reduce((s, x) => s + x.remaining, 0);
    const paid = monthlyPayments.filter(x => x.status === 'paid').reduce((s, x) => s + x.ownerShare, 0);
    return { unpaid, paid };
  }, [monthlyPayments]);

  const handleMarkAsPaid = async () => {
    if (!showPaymentModal || isSubmitting) return;

    if (!paymentMethod) {
      alert('⚠️ Veuillez sélectionner une méthode de paiement');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        owner_id: Number(showPaymentModal.ownerId),
        owner_name: showPaymentModal.ownerName || '',
        amount: Number(showPaymentModal.remaining), // on paie le reste dû
        payment_date: new Date().toISOString().slice(0, 10),
        month: `${monthNames[selectedMonth - 1]} ${selectedYear}`, // colonne month = varchar
        notes: paymentNotes || null,
        created_by: currentUser?.id ?? null,
        created_by_name: currentUser?.name ?? null
      };

      const { data, error } = await supabase.from('owner_payments').insert([payload]).select('*').single();
      if (error) {
        console.error('Insert owner_payments error:', error);
        alert('❌ Erreur enregistrement paiement propriétaire: ' + error.message);
        return;
      }

      setOwnerPayments([data, ...(ownerPayments || [])]);

      alert(
        `✅ Paiement propriétaire enregistré!\n\n` +
        `Propriétaire: ${showPaymentModal.ownerName}\n` +
        `Véhicule: ${showPaymentModal.vehicleId}\n` +
        `Montant: ${Number(showPaymentModal.remaining).toLocaleString()} FCFA\n` +
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
            {Number(totals.unpaid).toLocaleString()} FCFA
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
            {Number(totals.paid).toLocaleString()} FCFA
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
                  <p className="text-xs text-gray-600">Jours travaillés</p>
                  <p className="text-2xl font-bold">{mp.numberOfDays}</p>
                </div>
                <div className="bg-white p-3 rounded border">
                  <p className="text-xs text-gray-600">Taux journalier</p>
                  <p className="text-2xl font-bold">{Number(mp.dailyRate).toLocaleString()}</p>
                </div>
                <div className="bg-white p-3 rounded border">
                  <p className="text-xs text-gray-600">Déjà payé</p>
                  <p className="text-2xl font-bold">{Number(mp.paidAlready).toLocaleString()}</p>
                </div>
                <div className="bg-green-100 p-3 rounded border border-green-300">
                  <p className="text-xs text-green-700">Reste à payer</p>
                  <p className="text-2xl font-bold text-green-800">
                    {Number(mp.remaining).toLocaleString()}
                  </p>
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
                  <p className="text-sm font-bold text-green-800 mb-1">✅ Paiement effectué</p>
                  <p className="text-xs text-gray-600">
                    (Le dû est à 0 pour cette période)
                  </p>
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
              Astuce: vérifie que tes versements ont une date du type {monthKey}-DD et qu'un contrat de gestion existe (Propriétaires).
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
                {Number(showPaymentModal.remaining).toLocaleString()} FCFA
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
