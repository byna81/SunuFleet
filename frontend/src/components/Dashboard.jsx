// Dashboard.jsx - Dashboard complet AutoFleet avec Supabase
import React, { useMemo } from 'react';
import {
  DollarSign,
  Users,
  Car,
  FileText,
  TrendingUp,
  Calendar
} from 'lucide-react';

const Dashboard = ({
  payments = [],
  ownerPayments = [],
  drivers = [],
  vehicles = [],
  contracts = [],
  maintenanceSchedule = [],
  currentUser
}) => {

  // ============================
  // Calculs statistiques
  // ============================

  const totalDriverPayments = useMemo(() => {
    return payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }, [payments]);

  const totalOwnerPayments = useMemo(() => {
    return ownerPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }, [ownerPayments]);

  const totalVehicles = vehicles.length;
  const totalDrivers = drivers.length;
  const totalContracts = contracts.length;

  const activeContracts = contracts.filter(c => c.status === 'active').length;

  // ============================
  // Versements récents
  // ============================

  const recentPayments = [...payments]
    .sort((a, b) => new Date(b.recorded_at || b.date) - new Date(a.recorded_at || a.date))
    .slice(0, 5);

  // ============================
  // Graphique simple mensuel
  // ============================

  const paymentsByMonth = useMemo(() => {

    const map = {};

    payments.forEach(p => {

      const date = new Date(p.date);
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`;

      map[key] = (map[key] || 0) + Number(p.amount || 0);

    });

    return Object.entries(map).map(([key, value]) => ({
      month: key,
      amount: value
    }));

  }, [payments]);

  // ============================
  // Maintenances urgentes
  // ============================

  const urgentMaintenance = maintenanceSchedule.filter(m => {

    const due = new Date(m.due_date || m.dueDate);
    const today = new Date();

    const diff = (due - today) / (1000 * 60 * 60 * 24);

    return diff <= 7;

  });

  // ============================
  // UI
  // ============================

  return (
    <div>

      <h1 className="text-3xl font-bold mb-6">
        📊 Tableau de bord AutoFleet
      </h1>

      {/* Cards principales */}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">

        <StatCard
          icon={<DollarSign size={32} />}
          title="Versements chauffeurs"
          value={`${totalDriverPayments.toLocaleString()} FCFA`}
          color="green"
        />

        <StatCard
          icon={<TrendingUp size={32} />}
          title="Payé propriétaires"
          value={`${totalOwnerPayments.toLocaleString()} FCFA`}
          color="blue"
        />

        <StatCard
          icon={<Car size={32} />}
          title="Véhicules"
          value={totalVehicles}
          color="purple"
        />

        <StatCard
          icon={<Users size={32} />}
          title="Chauffeurs"
          value={totalDrivers}
          color="orange"
        />

      </div>

      {/* Deuxième ligne */}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

        <StatCard
          icon={<FileText size={32} />}
          title="Contrats"
          value={totalContracts}
          color="indigo"
        />

        <StatCard
          icon={<FileText size={32} />}
          title="Contrats actifs"
          value={activeContracts}
          color="green"
        />

        <StatCard
          icon={<Calendar size={32} />}
          title="Maintenances urgentes"
          value={urgentMaintenance.length}
          color="red"
        />

      </div>

      {/* Versements récents */}

      <div className="bg-white rounded-xl shadow-lg p-6 mb-8">

        <h2 className="text-xl font-bold mb-4">
          💰 Versements récents
        </h2>

        <table className="w-full">

          <thead>
            <tr className="text-left border-b">
              <th className="py-2">Chauffeur</th>
              <th>Date</th>
              <th>Montant</th>
            </tr>
          </thead>

          <tbody>

            {recentPayments.map(p => (

              <tr key={p.id} className="border-b">

                <td className="py-2">
                  {p.driver_name}
                </td>

                <td>
                  {p.date}
                </td>

                <td className="font-bold text-green-600">
                  {Number(p.amount).toLocaleString()} FCFA
                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

      {/* Graphique simple */}

      <div className="bg-white rounded-xl shadow-lg p-6">

        <h2 className="text-xl font-bold mb-4">
          📈 Versements par mois
        </h2>

        {paymentsByMonth.map(row => (

          <div key={row.month} className="mb-2">

            <div className="flex justify-between text-sm">

              <span>{row.month}</span>

              <span>{row.amount.toLocaleString()} FCFA</span>

            </div>

            <div className="bg-gray-200 h-3 rounded">

              <div
                className="bg-green-600 h-3 rounded"
                style={{
                  width: `${Math.min(row.amount / 10000, 100)}%`
                }}
              />

            </div>

          </div>

        ))}

      </div>

    </div>
  );
};


// ============================
// Composant Card
// ============================

const StatCard = ({ icon, title, value, color }) => {

  const colors = {

    green: "bg-green-50 text-green-700",
    blue: "bg-blue-50 text-blue-700",
    purple: "bg-purple-50 text-purple-700",
    orange: "bg-orange-50 text-orange-700",
    indigo: "bg-indigo-50 text-indigo-700",
    red: "bg-red-50 text-red-700"

  };

  return (

    <div className={`${colors[color]} p-6 rounded-xl shadow`}>

      <div className="flex items-center gap-3 mb-2">
        {icon}
        <h3 className="font-bold">{title}</h3>
      </div>

      <p className="text-2xl font-bold">
        {value}
      </p>

    </div>

  );

};

export default Dashboard;
