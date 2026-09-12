import React from 'react';
import { Check, AlertCircle } from 'lucide-react';
import useUsersManager from './users/hooks/useUsersManager';
import UserFilterBar from './users/UserFilterBar';
import UserTable from './users/UserTable';
import UserEditModal from './users/modals/UserEditModal';

export default function UserManagementView() {
  const {
    events, filteredUsers, isLoading, message, errorMsg,
    searchTerm, setSearchTerm, roleFilter, setRoleFilter,
    showCreateModal, setShowCreateModal, isSubmitting, currentUser,
    roleDefinitions, fetchUsersAndEvents, handleCreateUser,
    handleToggleRole, handleAssignEvent, handleToggleStatus, handleDeleteUser,
  } = useUsersManager();

  return (
    <div className="bg-[#121212] p-5 sm:p-7 rounded-[32px] sm:rounded-[36px] border border-neutral-800 shadow-2xl text-white max-w-2xl mx-auto space-y-6 select-none">
      <UserFilterBar
        onOpenCreate={() => setShowCreateModal(true)}
        onRefresh={fetchUsersAndEvents}
        isLoading={isLoading}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        roleFilter={roleFilter}
        onRoleFilterChange={setRoleFilter}
        roleDefinitions={roleDefinitions}
      />

      {message && (
        <div className="bg-emerald-950/60 border border-emerald-800 rounded-2xl p-3 text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{message}</span>
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-950/60 border border-red-800 rounded-2xl p-3 text-xs text-red-300 flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <UserTable
        users={filteredUsers}
        events={events}
        currentUser={currentUser}
        roleDefinitions={roleDefinitions}
        onToggleRole={handleToggleRole}
        onAssignEvent={handleAssignEvent}
        onToggleStatus={handleToggleStatus}
        onDeleteUser={handleDeleteUser}
        isLoading={isLoading}
      />

      <UserEditModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        events={events}
        onSubmit={handleCreateUser}
        isSubmitting={isSubmitting}
        roleDefinitions={roleDefinitions}
      />
    </div>
  );
}