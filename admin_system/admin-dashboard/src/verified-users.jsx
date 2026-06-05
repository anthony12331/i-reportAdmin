import { useState, useEffect, useCallback } from 'react';
import { pb } from './pocketbase';
import Sidebar from './Sidebar';
import { ui } from './uiStyles';
import { useMessageBox } from './MessageBox';
import { addAuditLog } from './auditLog';
import { buildVerifiedUsersFilter } from './verified-users/verifiedUsersUtils';
import VerifiedUserCard from './verified-users/VerifiedUserCard';
import {
  SuspendPromptModal,
  SuspendedUsersModal,
  UserImagePreviewModal,
  VerifiedUserDetailsModal,
  VerifiedUserReviewModal,
} from './verified-users/VerifiedUsersModals';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';

const USERS_PER_PAGE = 12;

const getFileUrl = (record, field) => (record && record[field] ? pb.files.getURL(record, record[field]) : null);

export default function VerifiedUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [previewImage, setPreviewImage] = useState(null);
  const [previewUser, setPreviewUser] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showSuspendedPopup, setShowSuspendedPopup] = useState(false);
  const [suspendedUsers, setSuspendedUsers] = useState([]);
  const [pendingSuspendUser, setPendingSuspendUser] = useState(null);
  const [suspendMessage, setSuspendMessage] = useState('');
  const [showSuspendPrompt, setShowSuspendPrompt] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const { confirm } = useMessageBox();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchVerifiedUsers = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    setError(null);

    try {
      const filterString = buildVerifiedUsersFilter(debouncedSearch);
      const records = await pb.collection('users').getList(page, USERS_PER_PAGE, {
        filter: filterString,
        sort: '-user_id',
        requestKey: null,
      });

      setUsers(records.items);
      setTotalPages(records.totalPages || 1);
      setTotalItems(records.totalItems || 0);
    } catch (fetchError) {
      console.error('Error fetching verified users:', fetchError);
      if (!fetchError.isAbort) {
        setError(fetchError.message || 'Failed to load database. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => {
    fetchVerifiedUsers();

    let unsubscribe;
    const setupSubscription = async () => {
      unsubscribe = await pb.collection('users').subscribe('*', () => {
        fetchVerifiedUsers(true);
      });
    };

    setupSubscription();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [fetchVerifiedUsers]);

  const fetchSuspendedUsers = useCallback(async () => {
    try {
      const records = await pb.collection('users').getFullList({
        filter: 'status = "suspended"',
        sort: '-user_id',
        requestKey: null,
      });

      setSuspendedUsers(records);
    } catch (fetchError) {
      console.error('Error fetching suspended users:', fetchError);
      setSuspendedUsers([]);
    }
  }, []);

  const openSuspendedUsersPopup = useCallback(async () => {
    await fetchSuspendedUsers();
    setShowSuspendedPopup(true);
  }, [fetchSuspendedUsers]);

  const closeSuspendedUsersPopup = useCallback(() => {
    setShowSuspendedPopup(false);
  }, []);

  const openUserReview = useCallback((user) => {
    setPreviewUser(user);
  }, []);

  const closeUserReview = useCallback(() => {
    setPreviewUser(null);
  }, []);

  const openUserDetails = useCallback((user) => {
    setPreviewImage(null);
    setSelectedUser(user);
  }, []);

  const closeUserDetails = useCallback(() => {
    setSelectedUser(null);
    setPreviewImage(null);
  }, []);

  const openImagePreview = useCallback((src) => {
    setPreviewImage(src);
  }, []);

  const closeImagePreview = useCallback(() => {
    setPreviewImage(null);
  }, []);

  const openSuspendPrompt = useCallback((user) => {
    setPendingSuspendUser(user);
    setSuspendMessage('');
    setShowSuspendPrompt(true);
  }, []);

  const closeSuspendPrompt = useCallback(() => {
    setShowSuspendPrompt(false);
    setPendingSuspendUser(null);
    setSuspendMessage('');
  }, []);

  const viewSuspendedUser = useCallback((user) => {
    setShowSuspendedPopup(false);
    setPreviewImage(null);
    setSelectedUser(user);
  }, []);

  const handleSuspendVerification = useCallback(async (user, message) => {
    if (!message || !message.trim()) {
      alert('Please enter a suspension reason before continuing.');
      return;
    }

    setIsProcessing(true);
    closeSuspendPrompt();

    try {
      await pb.collection('users').update(user.id, {
        status: 'suspended',
        suspension_reason: message,
      });

      addAuditLog({
        action: 'Verification Suspended',
        target: user.email,
        details: `Admin suspended verification for citizen ID #${user.user_id}. Reason: ${message}`,
        actor: pb.authStore.model?.username || 'Admin',
      });

      closeUserDetails();
      await Promise.all([fetchVerifiedUsers(true), fetchSuspendedUsers()]);
      alert(`User ${user.first_name} ${user.last_name} has been suspended.`);
    } catch (updateError) {
      console.error('Failed to suspend', updateError);
      alert('Error updating user status: ' + (updateError.message || 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  }, [closeSuspendPrompt, closeUserDetails, fetchSuspendedUsers, fetchVerifiedUsers]);

  const handleUnsuspendUser = useCallback(async (user) => {
    const shouldUnsuspend = await confirm(`Are you sure you want to restore verification for ${user.first_name}?`, {
      title: 'Confirm Unsuspend',
      primaryLabel: 'Restore Verification',
      secondaryLabel: 'Cancel',
    });

    if (!shouldUnsuspend) return;

    setIsProcessing(true);

    try {
      await pb.collection('users').update(user.id, {
        status: 'verified',
        suspension_reason: '',
      });

      addAuditLog({
        action: 'Verification Restored',
        target: user.email,
        details: `Admin restored verification for citizen ID #${user.user_id}.`,
        actor: pb.authStore.model?.username || 'Admin',
      });

      closeUserDetails();
      await Promise.all([fetchVerifiedUsers(true), fetchSuspendedUsers()]);
      alert(`User ${user.first_name} ${user.last_name} has been restored.`);
    } catch (updateError) {
      console.error('Failed to unsuspend', updateError);
      alert('Error updating user status: ' + (updateError.message || 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  }, [closeUserDetails, confirm, fetchSuspendedUsers, fetchVerifiedUsers]);

  const previewUserSelfieUrl = getFileUrl(previewUser, 'selfie');
  const previewUserIdPhotoUrl = getFileUrl(previewUser, 'id_photo');
  const selectedUserProfileImageUrl = getFileUrl(selectedUser, 'selfie');
  const selectedUserIdPhotoUrl = getFileUrl(selectedUser, 'id_photo');

  return (
    <div style={ui.shell}>
      <Sidebar />

      <main style={styles.mainContent}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.pageTitle}>Verified Citizens</h1>
            <p style={styles.subtitle}>Official members of the Lagonglong Emergency System. Total: {totalItems}</p>
          </div>

          <div style={styles.actionToolbar}>
            <div style={styles.searchWrapper}>
              <Search size={18} color="#9ca3af" />
              <input
                type="text"
                placeholder="Search Name or ID..."
                style={styles.searchInput}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <button type="button" style={styles.suspendedPopupBtn} onClick={openSuspendedUsersPopup}>
              Suspended Users
            </button>
          </div>
        </header>

        {error ? (
          <div style={styles.errorState}>
            <AlertCircle size={48} color="#ef4444" />
            <p>{error}</p>
            <button onClick={fetchVerifiedUsers} style={styles.retryBtn}>Retry</button>
          </div>
        ) : loading && users.length === 0 ? (
          <div style={styles.emptyState}>Loading database...</div>
        ) : users.length === 0 ? (
          <div style={styles.emptyState}>No citizens found matching your criteria.</div>
        ) : (
          <>
            <div style={styles.grid}>
              {users.map((user) => (
                <VerifiedUserCard
                  key={user.id}
                  user={user}
                  profileImageUrl={getFileUrl(user, 'selfie')}
                  onPreview={openUserReview}
                  onManage={openUserDetails}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div style={styles.paginationWrapper}>
                <button
                  onClick={() => setPage(pageNumber => Math.max(1, pageNumber - 1))}
                  disabled={page === 1 || loading}
                  style={{ ...styles.pageBtn, opacity: page === 1 ? 0.5 : 1 }}
                >
                  <ChevronLeft size={18} /> Prev
                </button>
                <span style={styles.pageInfo}>Page {page} of {totalPages}</span>
                <button
                  onClick={() => setPage(pageNumber => Math.min(totalPages, pageNumber + 1))}
                  disabled={page === totalPages || loading}
                  style={{ ...styles.pageBtn, opacity: page === totalPages ? 0.5 : 1 }}
                >
                  Next <ChevronRight size={18} />
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <UserImagePreviewModal src={previewImage} onClose={closeImagePreview} />

      <VerifiedUserReviewModal
        user={previewUser}
        selfieUrl={previewUserSelfieUrl}
        idPhotoUrl={previewUserIdPhotoUrl}
        onClose={closeUserReview}
      />

      <VerifiedUserDetailsModal
        user={selectedUser}
        profileImageUrl={selectedUserProfileImageUrl}
        idPhotoUrl={selectedUserIdPhotoUrl}
        isProcessing={isProcessing}
        onClose={closeUserDetails}
        onOpenPreview={openImagePreview}
        onRequestSuspend={openSuspendPrompt}
        onRequestUnsuspend={handleUnsuspendUser}
      />

      <SuspendedUsersModal
        isOpen={showSuspendedPopup}
        users={suspendedUsers}
        onClose={closeSuspendedUsersPopup}
        onViewUser={viewSuspendedUser}
      />

      <SuspendPromptModal
        isOpen={showSuspendPrompt}
        user={pendingSuspendUser}
        message={suspendMessage}
        onMessageChange={setSuspendMessage}
        onCancel={closeSuspendPrompt}
        onConfirm={handleSuspendVerification}
        isProcessing={isProcessing}
      />
    </div>
  );
}

const styles = {
  mainContent: ui.main,
  header: { ...ui.header, alignItems: 'center' },
  pageTitle: ui.pageTitle,
  subtitle: ui.subtitle,
  actionToolbar: {
    display: 'flex',
    gap: '15px',
    alignItems: 'center',
  },
  searchWrapper: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: '10px 15px',
    borderRadius: '10px',
    border: '1px solid #e5e7eb',
    width: '280px',
    gap: '10px',
  },
  searchInput: {
    border: 'none',
    outline: 'none',
    width: '100%',
    fontSize: '14px',
    backgroundColor: 'transparent',
  },
  suspendedPopupBtn: {
    padding: '10px 18px',
    borderRadius: '12px',
    border: '1px solid #d1d5db',
    backgroundColor: 'white',
    color: '#111827',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 8px 20px rgba(15, 23, 42, 0.06)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '24px',
  },
  paginationWrapper: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '20px',
    marginTop: '40px',
  },
  pageBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    backgroundColor: 'white',
    cursor: 'pointer',
    fontWeight: '600',
    color: '#475569',
  },
  pageInfo: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#64748b',
  },
  emptyState: {
    textAlign: 'center',
    padding: '100px',
    color: '#9ca3af',
    fontSize: '16px',
  },
  errorState: {
    textAlign: 'center',
    padding: '80px',
    color: '#ef4444',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '15px',
  },
  retryBtn: {
    padding: '10px 24px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
};
