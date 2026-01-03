"use client";
import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

interface PasswordChangeModalProps {
  onPasswordChanged: () => void;
  username: string;
}

export default function PasswordChangeModal({ onPasswordChanged, username }: PasswordChangeModalProps) {
  const [newUsername, setNewUsername] = useState(username);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (newUsername.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }

    if (!/^[a-z0-9_]+$/.test(newUsername)) {
      setError("Username can only contain lowercase letters, numbers, and underscores");
      return;
    }

    if (newPassword.length < 5) {
      setError("Password must be at least 5 characters");
      return;
    }

    if (newPassword === "changeme") {
      setError("Please choose a different password than 'changeme'");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      // Update user metadata (skip email update - not needed since we use username for login)
      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          ...user.user_metadata,
          username: newUsername,
          passwordChanged: true
        }
      });

      if (metadataError) throw metadataError;

      onPasswordChanged();
    } catch (err: any) {
      setError(err.message || "Failed to update");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Welcome! Set Up Your Account</h2>
          <p className="text-sm text-gray-600 mt-2">
            Customize your username and change your password from "changeme"
          </p>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-4">
          {error && (
            <div className="bg-red-50 border-2 border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="username" className="block text-sm font-semibold text-gray-700 mb-2">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value.toLowerCase())}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              placeholder="Choose a username"
              required
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Lowercase letters, numbers, and underscores only. Default: <span className="font-mono font-semibold">{username}</span>
            </p>
          </div>

          <div>
            <label htmlFor="newPassword" className="block text-sm font-semibold text-gray-700 mb-2">
              New Password
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              placeholder="Enter new password"
              required
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 mt-1">Minimum 5 characters</p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-2">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              placeholder="Confirm new password"
              required
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Updating..." : "Set Username & Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
