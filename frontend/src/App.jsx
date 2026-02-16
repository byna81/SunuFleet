// App.jsx - Application AVEC SUPABASE (CORRIGÉ LOGIN)
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

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setIsLoading(true);
      
      const { data: usersData, error: usersError } = await supabase.from('users').select('*');
      if (usersError) console.error("Erreur users:", usersError);
      if (usersData) setAllUsers(usersData);

      const { data: driversData } = await supabase.from('drivers').select('*');
      if (driversData) setDrivers(driversData);

      const { data: vehiclesData } = await supabase.from('vehicles').select('*');
      if (vehiclesData) setVehicles(vehiclesData);

      const { data: contractsData } = await supabase.from('contracts').select('*');
      if (contractsData) setContracts(contractsData);

      const { data: mgmtData } = await supabase.from('management_contracts').select('*');
      if (mgmtData) setManagementContracts(mgmtData);

      const { data: paymentsData } = await supabase.from('payments').select('*');
      if (paymentsData) setPayments(paymentsData);

      const { data: ownerPayData } = await supabase.from('owner_payments').select('*');
      if (ownerPayData) setOwnerPayments(ownerPayData);

      const { data: maintenanceData } = await supabase.from('maintenance_schedule').select('*');
      if (maintenanceData) setMaintenanceSchedule(maintenanceData);

      setIsLoading(false);
    } catch (error) {
      console.error('Erreur loadAllData:', error);
      setIsLoading(false);
    }
  };

  // LOGIN CORRIGÉ : interroge directement Supabase
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');

    const username = loginForm.username.trim();
    const password = loginForm.password.trim();

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .maybeSingle();

    if (error) {
      console.error("Erreur login:", error);
      setLoginError("Erreur Supabase: " + error.message);
      return;
    }

    if (!data) {
      setLoginError('Identifiants incorrects');
      return;
    }

    setCurrentUser(data);
    setIsLoggedIn(true);
    setLoginError('');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setLoginForm({ username: '', password: '' });
    setActiveTab('dashboard');
  };

  const hasPermission = (permission) => {
    if (!currentUser) return false;
    return currentUser.permissions.includes('all') || currentUser.permissions.includes(permission);
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

  return <div>Application chargée</div>;
};

export default App;
