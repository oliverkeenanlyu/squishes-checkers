"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { useToast } from "@/components/Toast";
import Link from "next/link";

export default function AdminPage() {
  const [newEmail, setNewEmail] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newUserIsAdmin, setNewUserIsAdmin] = useState(false);
  const { showToast, ToastContainer } = useToast();

  const { data: allowedEmails, refetch } = api.allowedEmails.getAll.useQuery();
  const { data: isUserAdmin, isLoading: isCheckingAdmin } = api.allowedEmails.isAdmin.useQuery();
  const addEmailMutation = api.allowedEmails.add.useMutation();
  const removeEmailMutation = api.allowedEmails.remove.useMutation();

  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;

    setIsAdding(true);
    try {
      await addEmailMutation.mutateAsync({ 
        email: newEmail, 
        isAdmin: newUserIsAdmin 
      });
      setNewEmail("");
      setNewUserIsAdmin(false);
      void refetch();
      showToast("Email added successfully!", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to add email", "error");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveEmail = async (id: number) => {
    if (!confirm("Are you sure you want to remove this email?")) return;
    
    try {
      await removeEmailMutation.mutateAsync({ id });
      await refetch();
      showToast("Email removed successfully!", "success");
    } catch (_error) {
      showToast("Failed to remove email", "error");
    }
  };

  // Redirect non-admin users
  if (isCheckingAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-full animate-pulse"></div>
          <p className="text-gray-600">Checking admin permissions...</p>
        </div>
      </div>
    );
  }

  if (!isUserAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <span className="text-2xl">🚫</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">You don&apos;t have admin permissions.</p>
          {/* <a href="/" className="text-indigo-600 hover:text-indigo-500">← Back to Home</a> */}
          <Link href="/" className="text-indigo-600 hover:text-indigo-500">← Back to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <ToastContainer />
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">
              Admin Panel - Manage Allowed Emails
            </h1>
            
            {/* Add Email Form */}
            <div className="mb-8">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Add New Allowed Email
              </h2>
              <form onSubmit={handleAddEmail} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Enter email address"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    required
                  />
                </div>
                <div className="flex items-center">
                  <input
                    id="isAdmin"
                    type="checkbox"
                    checked={newUserIsAdmin}
                    onChange={(e) => setNewUserIsAdmin(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isAdmin" className="ml-2 block text-sm text-gray-900">
                    Grant admin permissions
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={isAdding || !newEmail}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {isAdding ? "Adding..." : "Add Email"}
                </button>
              </form>
            </div>

            {/* Allowed Emails List */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Currently Allowed Emails ({allowedEmails?.length ?? 0})
              </h2>
              
              {allowedEmails && allowedEmails.length > 0 ? (
                <div className="bg-white shadow overflow-hidden sm:rounded-md">
                  <ul role="list" className="divide-y divide-gray-200">
                    {allowedEmails.map((emailRecord) => (
                      <li key={emailRecord.id}>
                        <div className="px-4 py-4 flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                                <span className="text-sm font-medium text-indigo-600">
                                  {emailRecord.email.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            </div>
                            <div className="ml-4 flex-1">
                              <div className="flex items-center space-x-2">
                                <div className="text-sm font-medium text-gray-900">
                                  {emailRecord.email}
                                </div>
                                {emailRecord.isAdmin && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                    Admin
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-500">
                                Added {new Date(emailRecord.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveEmail(emailRecord.id)}
                            disabled={removeEmailMutation.isPending}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-sm text-gray-500">
                    No allowed emails configured. Add some emails to allow users to sign in.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}