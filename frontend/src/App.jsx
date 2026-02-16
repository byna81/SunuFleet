// App.jsx - Application AVEC SUPABASE (CORRIGÉ LOGIN + UI RESTAURÉE)
import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Payments from './components/Payments';
import Drivers from './components/Drivers';
import Contracts from './components/Contracts';
import Vehicles from './components/Vehicles';
import Owners from './components/Owners';
import Users from './components/Users';
import OwnerPayments from './components/OwnerPayments';
import Maintenance from './components/Maintenance';
import ChangePassword from './components/ChangePassword';
import ForgotPassword from './components/ForgotPassword';

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');

  // États vides - chargés depuis Supabase
  const [allUsers, setAllUsers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [ownerPayments, setOwnerPayments] = useState([]);
  const [managementContracts, setManagementContracts] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [maintenanceSchedule, setMaintenanceSchedule] = useState([]);

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Charger données au démarrage
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setIsLoading(true);

      const { data: usersData, error: usersError } = await supabase.from('users').select('*');
      if (usersError) console.error('Erreur Supabase (users):', usersError);
      if (usersData) setAllUsers(usersData);

      const { data: driversData, error: driversError } = await supabase.from('drivers').select('*');
      if (driversError) console.error('Erreur Supabase (drivers):', driversError);
      if (driversData) setDrivers(driversData);

      const { data: vehiclesData, error: vehiclesError } = await supabase.from('vehicles').select('*');
      if (vehiclesError) console.error('Erreur Supabase (vehicles):', vehiclesError);
      if (vehiclesData) setVehicles(vehiclesData);

      const { data: contractsData, error: contractsError } = await supabase.from('contracts').select('*');
      if (contractsError) console.error('Erreur Supabase (contracts):', contractsError);
      if (contractsData) setContracts(contractsData);

      const { data: mgmtData, error: mgmtError } = await supabase.from('management_contracts').select('*');
      if (mgmtError) console.error('Erreur Supabase (management_contracts):', mgmtError);
      if (mgmtData) setManagementContracts(mgmtData);

      const { data: paymentsData, error: paymentsError } = await supabase.from('payments').select('*');
      if (paymentsError) console.error('Erreur Supabase (payments):', paymentsError);
      if (paymentsData) setPayments(paymentsData);

      const { data: ownerPayData, error: ownerPayError } = await supabase.from('owner_payments').select('*');
      if (ownerPayError) console.error('Erreur Supabase (owner_payments):', ownerPayError);
      if (ownerPayData) setOwnerPayments(ownerPayData);

      const { data: maintenanceData, error: maintenanceError } = await supabase.from('maintenance_schedule').select('*');
      if (maintenanceError) console.error('Erreur Supabase (maintenance_schedule):', maintenanceError);
      if (maintenanceData) setMaintenanceSchedule(maintenanceData);

      setIsLoading(false);
    } catch (error) {
      console.error('Erreur loadAllData:', error);
      setIsLoading(false);
    }
  };

  // ✅ LOGIN CORRIGÉ : interroge directement Supabase
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');

    const username = (loginForm.username || '').trim();
    const password = (loginForm.password || '').trim();

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .maybeSingle();

      if (error) {
        console.error('Erreur Supabase login:', error);
        setLoginError('Erreur Supabase: ' + error.message);
        return;
      }

      if (!data) {
        setLoginError('Identifiants incorrects');
        return;
      }

      setCurrentUser(data);
      setIsLoggedIn(true);
      setLoginError('');
    } catch (err) {
      console.error('Erreur réseau login:', err);
      setLoginError('Erreur réseau / configuration Supabase');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setLoginForm({ username: '', password: '' });
    setActiveTab('dashboard');
  };

  const hasPermission = (permission) => {
    if (!currentUser) return false;
    // permissions est jsonb : souvent tableau. On gère aussi le cas string.
    const perms = Array.isArray(currentUser.permissions)
      ? currentUser.permissions
      : (typeof currentUser.permissions === 'string' ? [currentUser.permissions] : []);
    return perms.includes('all') || perms.includes(permission);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🚗</div>
          <h2 className="text-2xl font-bold mb-2">AutoFleet</h2>
          <p className="text-gray-600">Chargement des données...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    if (showForgotPassword) {
      return (
        <ForgotPassword
          allUsers={allUsers}
          setAllUsers={setAllUsers}
          onBack={() => setShowForgotPassword(false)}
        />
      );
    }

    return (
      <Login
        loginForm={loginForm}
        setLoginForm={setLoginForm}
        handleLogin={handleLogin}
        loginError={loginError}
        onForgotPassword={() => setShowForgotPassword(true)}
      />
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar
        currentUser={currentUser}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        handleLogout={handleLogout}
        hasPermission={hasPermission}
        setShowChangePassword={setShowChangePassword}
      />

      <div className="flex-1 overflow-auto">
        {showChangePassword && (
          <ChangePassword
            currentUser={currentUser}
            allUsers={allUsers}
            setAllUsers={setAllUsers}
            onClose={() => setShowChangePassword(false)}
          />
        )}

        <div className="p-8">
          {activeTab === 'dashboard' && (
            <Dashboard
              payments={payments}
              drivers={drivers}
              vehicles={vehicles}
              managementContracts={managementContracts}
              contracts={contracts}
              maintenanceSchedule={maintenanceSchedule}
              currentUser={currentUser}
              hasPermission={hasPermission}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'payments' && (
            <Payments
              payments={payments}
              setPayments={setPayments}
              currentUser={currentUser}
              drivers={drivers}
              contracts={contracts}
            />
          )}

          {activeTab === 'drivers' && (
            <Drivers
              drivers={drivers}
              setDrivers={setDrivers}
              contracts={contracts}
              vehicles={vehicles}
              currentUser={currentUser}
              hasPermission={hasPermission}
            />
          )}

          {activeTab === 'contracts' && (
            <Contracts
              contracts={contracts}
              setContracts={setContracts}
              drivers={drivers}
              vehicles={vehicles}
              currentUser={currentUser}
              hasPermission={hasPermission}
            />
          )}

          {activeTab === 'vehicles' && (
            <Vehicles
              payments={payments}
              vehicles={vehicles}
              setVehicles={setVehicles}
              currentUser={currentUser}
              hasPermission={hasPermission}
              managementContracts={managementContracts}
              contracts={contracts}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'owners' && (
            <Owners
              managementContracts={managementContracts}
              setManagementContracts={setManagementContracts}
              currentUser={currentUser}
              hasPermission={hasPermission}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'owner-payments' && (
            <OwnerPayments
              payments={payments}
              ownerPayments={ownerPayments}
              setOwnerPayments={setOwnerPayments}
              currentUser={currentUser}
              managementContracts={managementContracts}
              contracts={contracts}
              vehicles={vehicles}
            />
          )}

          {activeTab === 'maintenance' && (
            <Maintenance
              maintenanceSchedule={maintenanceSchedule}
              setMaintenanceSchedule={setMaintenanceSchedule}
              vehicles={vehicles}
              currentUser={currentUser}
              hasPermission={hasPermission}
            />
          )}

          {activeTab === 'users' && hasPermission('all') && (
            <Users
              allUsers={allUsers}
              setAllUsers={setAllUsers}
              currentUser={currentUser}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
