"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";

interface UserData {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
  squad: string;
  weapon?: string;
  gender?: string;
}

export default function AdminDashboard() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserData[]>([]);
  const [message, setMessage] = useState<string>('');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<{id: string, username: string} | null>(null);
  const [customPassword, setCustomPassword] = useState('');
  const [newUser, setNewUser] = useState({
    firstName: '',
    lastName: '',
    role: 'athlete',
    squad: 'mens-epee',
    weapon: 'epee',
    gender: 'male',
    password: ''
  });
  const router = useRouter();

  useEffect(() => {
    const fetchSession = async () => {
      const { data } = await supabase.auth.getSession();
      const currentUser = data.session?.user ?? null;
      setUser(currentUser);

      // Check if user is admin
      if (!currentUser || currentUser.user_metadata.role !== 'admin') {
        router.push('/');
        return;
      }

      setLoading(false);
      fetchUsers();
    };

    fetchSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (!currentUser || currentUser.user_metadata.role !== 'admin') {
        router.push('/');
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [router]);

  const fetchUsers = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) return;

      const response = await fetch('/api/users/list', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const sortedUsers = (data.users || []).sort((a: any, b: any) => {
          // Priority order: admin first, then coach, then everyone else
          const rolePriority: any = { admin: 0, coach: 1 };
          const aPriority = rolePriority[a.role] ?? 2;
          const bPriority = rolePriority[b.role] ?? 2;
          
          if (aPriority !== bPriority) return aPriority - bPriority;
          
          // For non-admin/coach users, sort by squad
          if (aPriority === 2) {
            const squadCompare = (a.squad || '').localeCompare(b.squad || '');
            if (squadCompare !== 0) return squadCompare;
            // Then by role (captain before athlete)
            if (a.role === 'captain' && b.role !== 'captain') return -1;
            if (a.role !== 'captain' && b.role === 'captain') return 1;
          }
          
          // Finally by username
          return (a.username || '').localeCompare(b.username || '');
        });
        setUsers(sortedUsers);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) return;

      const response = await fetch('/api/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(newUser),
      });

      const result = await response.json();

      if (response.ok) {
        setMessage(`✅ User created! Username: ${result.username}, Password: ${result.password}`);
        setShowAddUserModal(false);
        setNewUser({ 
          firstName: '', 
          lastName: '', 
          role: 'athlete', 
          squad: 'mens-epee', 
          weapon: 'epee', 
          gender: 'male',
          password: '' 
        });
        fetchUsers();
        setTimeout(() => setMessage(''), 10000);
      } else {
        setMessage(`❌ ${result.error || 'Failed to create user'}`);
        setTimeout(() => setMessage(''), 5000);
      }
    } catch (error) {
      setMessage('❌ Error creating user');
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) return;

      const response = await fetch('/api/users/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        setMessage(`✅ User "${username}" deleted successfully`);
        fetchUsers();
        setTimeout(() => setMessage(''), 5000);
      } else {
        const result = await response.json();
        setMessage(`❌ ${result.error || 'Failed to delete user'}`);
        setTimeout(() => setMessage(''), 5000);
      }
    } catch (error) {
      setMessage('❌ Error deleting user');
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const handleResetPassword = async (userId: string, username: string) => {
    setResetPasswordUser({ id: userId, username });
    setCustomPassword('');
    setShowResetPasswordModal(true);
  };

  const handleResetPasswordSubmit = async () => {
    if (!resetPasswordUser) return;
    
    const passwordToUse = customPassword.trim() || undefined;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) return;

      const response = await fetch('/api/users/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ 
          userId: resetPasswordUser.id,
          customPassword: passwordToUse 
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setMessage(`✅ Password reset for "${resetPasswordUser.username}". New password: ${result.newPassword}`);
        setShowResetPasswordModal(false);
        setResetPasswordUser(null);
        setCustomPassword('');
        setTimeout(() => setMessage(''), 10000);
      } else {
        setMessage(`❌ ${result.error || 'Failed to reset password'}`);
        setTimeout(() => setMessage(''), 5000);
      }
    } catch (error) {
      setMessage('❌ Error resetting password');
      setTimeout(() => setMessage(''), 5000);
    }
  };

  if (loading) return <p className="p-8">Loading...</p>;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-800 p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="bg-white/10 backdrop-blur-sm rounded-lg shadow-lg p-6 text-white border border-white/20">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-yellow-300">Admin Dashboard</h1>
              <p className="text-yellow-100 mt-1">
                Welcome, {user.user_metadata.firstName} {user.user_metadata.lastName}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-md transition-transform transform hover:scale-105"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className="max-w-7xl mx-auto mb-6">
          <div className={`p-4 rounded-lg text-center font-semibold ${
            message.includes('❌') 
              ? 'bg-red-100 text-red-700 border border-red-300' 
              : 'bg-green-100 text-green-700 border border-green-300'
          }`}>
            {message}
          </div>
        </div>
      )}

      {/* User Management */}
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
            <button
              onClick={() => setShowAddUserModal(true)}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md transition-transform transform hover:scale-105"
            >
              + Add User
            </button>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Username
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Squad
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((userData) => (
                  <tr key={userData.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {userData.firstName} {userData.lastName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {userData.username}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        userData.role === 'coach' ? 'bg-purple-100 text-purple-800' :
                        userData.role === 'captain' ? 'bg-blue-100 text-blue-800' :
                        userData.role === 'admin' ? 'bg-red-100 text-red-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {userData.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {userData.squad}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleResetPassword(userData.id, userData.username)}
                        className="text-blue-600 hover:text-blue-900 font-medium transition"
                      >
                        Reset Password
                      </button>
                      {userData.role !== 'admin' && (
                        <button
                          onClick={() => handleDeleteUser(userData.id, userData.username)}
                          className="text-red-600 hover:text-red-900 font-medium transition"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-20 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Add New User</h3>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input
                  type="text"
                  value={newUser.firstName}
                  onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input
                  type="text"
                  value={newUser.lastName}
                  onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                >
                  <option value="athlete">Athlete</option>
                  <option value="captain">Captain</option>
                  <option value="coach">Coach</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Squad</label>
                <select
                  value={newUser.squad}
                  onChange={(e) => {
                    const value = e.target.value;
                    let weapon = 'epee';
                    let gender = 'male';
                    
                    if (value.includes('epee')) weapon = 'epee';
                    else if (value.includes('foil')) weapon = 'foil';
                    else if (value.includes('saber')) weapon = 'saber';
                    
                    if (value.includes('womens')) gender = 'female';
                    else if (value.includes('mens')) gender = 'male';
                    
                    setNewUser({ ...newUser, squad: value, weapon, gender });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                >
                  <option value="mens-epee">Men's Epee</option>
                  <option value="mens-foil">Men's Foil</option>
                  <option value="mens-saber">Men's Saber</option>
                  <option value="womens-epee">Women's Epee</option>
                  <option value="womens-foil">Women's Foil</option>
                  <option value="womens-saber">Women's Saber</option>
                  <option value="coach">Coach/Staff</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password (leave blank for random)</label>
                <input
                  type="text"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Leave blank to generate random password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1">
                  If left blank, a random password like "apple42" will be generated
                </p>
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md transition-transform transform hover:scale-105"
                >
                  Add User
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded-lg shadow-md transition-transform transform hover:scale-105"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetPasswordModal && resetPasswordUser && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-20 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Reset Password for {resetPasswordUser.username}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Password (leave blank for random)
                </label>
                <input
                  type="text"
                  value={customPassword}
                  onChange={(e) => setCustomPassword(e.target.value)}
                  placeholder="Leave blank to generate random password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  If left blank, a random easy password like "apple42" will be generated
                </p>
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleResetPasswordSubmit}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md transition-transform transform hover:scale-105"
                >
                  Reset Password
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowResetPasswordModal(false);
                    setResetPasswordUser(null);
                    setCustomPassword('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded-lg shadow-md transition-transform transform hover:scale-105"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
