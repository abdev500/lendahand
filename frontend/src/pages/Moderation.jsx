import { Fragment, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/axios'
import './Moderation.css'

function Moderation() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState([])
  const [campaignsLoading, setCampaignsLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [showNotesForm, setShowNotesForm] = useState(null)
  const [notes, setNotes] = useState('')
  const [expandedCampaignId, setExpandedCampaignId] = useState(null)
  const [activeTab, setActiveTab] = useState('campaigns')
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersLoaded, setUsersLoaded] = useState(false)

  useEffect(() => {
    const initializeModeration = async () => {
      await checkAuth()
      await fetchCampaigns()
    }

    initializeModeration()
  }, [checkAuth, fetchCampaigns])

  useEffect(() => {
    if (activeTab === 'users' && !usersLoaded) {
      fetchUsers()
    }
  }, [activeTab, usersLoaded, fetchUsers])

  useEffect(() => {
    if ((user?.is_moderator || user?.is_staff) && !usersLoaded && !usersLoading) {
      fetchUsers()
    }
  }, [user, usersLoaded, usersLoading, fetchUsers])

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/login')
      return
    }

    try {
      const response = await api.get('/users/me/')
      const currentUser = response.data
      setUser(currentUser)

      if (!currentUser.is_moderator && !currentUser.is_staff) {
        navigate('/dashboard')
        return
      }
    } catch (error) {
      localStorage.removeItem('token')
      navigate('/login')
    }
  }, [navigate])

  const fetchCampaigns = useCallback(async () => {
    setCampaignsLoading(true)
    try {
      const response = await api.get('/campaigns/?include_history=true')
      const data = response.data
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.results)
          ? data.results
          : []
      setCampaigns(list)
    } catch (error) {
      console.error('Error fetching campaigns:', error)
      const errorMsg =
        error.response?.data?.error ||
        error.response?.data?.detail ||
        t('moderation.campaignsLoadError', 'Error loading campaigns.')
      setErrorMessage(errorMsg)
      setTimeout(() => setErrorMessage(''), 5000)
    } finally {
      setCampaignsLoading(false)
    }
  }, [t])

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true)
    try {
      const response = await api.get('/users/')
      const data = response.data
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.results)
          ? data.results
          : []
      setUsers(list)
      setUsersLoaded(true)
    } catch (error) {
      console.error('Error fetching users:', error)
      const errorMsg =
        error.response?.data?.error ||
        error.response?.data?.detail ||
        t('moderation.usersLoadError', 'Error loading users.')
      setErrorMessage(errorMsg)
      setTimeout(() => setErrorMessage(''), 5000)
    } finally {
      setUsersLoading(false)
    }
  }, [t])

  const handleApprove = async (campaignId) => {
    try {
      await api.post(`/campaigns/${campaignId}/approve/`, {
        moderation_notes: notes || ''
      })
      setSuccessMessage(t('moderation.approveSuccess', 'Campaign approved successfully!'))
      setShowNotesForm(null)
      setNotes('')
      await fetchCampaigns()
      setTimeout(() => setSuccessMessage(''), 5000)
    } catch (error) {
      console.error('Error approving campaign:', error)
      const errorMsg = error.response?.data?.error || error.response?.data?.detail || t('moderation.approveError', 'Error approving campaign')
      setErrorMessage(errorMsg)
      setTimeout(() => setErrorMessage(''), 5000)
    }
  }

  const handleReject = async (campaignId) => {
    if (!notes.trim()) {
      setErrorMessage(t('moderation.rejectReasonRequired', 'Rejection reason is required'))
      setTimeout(() => setErrorMessage(''), 5000)
      return
    }

    try {
      await api.post(`/campaigns/${campaignId}/reject/`, {
        moderation_notes: notes
      })
      setSuccessMessage(t('moderation.rejectSuccess', 'Campaign rejected successfully!'))
      setShowNotesForm(null)
      setNotes('')
      await fetchCampaigns()
      setTimeout(() => setSuccessMessage(''), 5000)
    } catch (error) {
      console.error('Error rejecting campaign:', error)
      const errorMsg = error.response?.data?.error || error.response?.data?.detail || t('moderation.rejectError', 'Error rejecting campaign')
      setErrorMessage(errorMsg)
      setTimeout(() => setErrorMessage(''), 5000)
    }
  }

  const handleResume = async (campaignId) => {
    try {
      await api.post(`/campaigns/${campaignId}/resume/`)
      setSuccessMessage(t('moderation.approveSuccess', 'Campaign approved successfully!'))
      await fetchCampaigns()
      setTimeout(() => setSuccessMessage(''), 5000)
    } catch (error) {
      console.error('Error resuming campaign:', error)
      const errorMsg =
        error.response?.data?.error ||
        error.response?.data?.detail ||
        t('moderation.approveError', 'Error approving campaign')
      setErrorMessage(errorMsg)
      setTimeout(() => setErrorMessage(''), 5000)
    }
  }

  const handleSuspend = async (campaignId) => {
    const confirmed = window.confirm(
      t('moderation.suspendConfirm', 'Are you sure you want to suspend this campaign?')
    )
    if (!confirmed) {
      return
    }

    try {
      await api.post(`/campaigns/${campaignId}/suspend/`)
      setSuccessMessage(t('moderation.suspendSuccess', 'Campaign suspended successfully!'))
      await fetchCampaigns()
      setTimeout(() => setSuccessMessage(''), 5000)
    } catch (error) {
      console.error('Error suspending campaign:', error)
      const errorMsg =
        error.response?.data?.error ||
        error.response?.data?.detail ||
        t('moderation.suspendError', 'Error suspending campaign')
      setErrorMessage(errorMsg)
      setTimeout(() => setErrorMessage(''), 5000)
    }
  }

  const handleToggleNotesForm = (campaignId) => {
    setShowNotesForm((current) => {
      if (current === campaignId) {
        setNotes('')
        return null
      }
      setNotes('')
      return campaignId
    })
  }

  const toggleCampaignDetails = (campaignId) => {
    setExpandedCampaignId((current) => (current === campaignId ? null : campaignId))
  }

  const handleToggleUser = async (userId, currentStatus) => {
    try {
      const response = await api.post(`/users/${userId}/set-active/`, {
        is_active: !currentStatus,
      })

      const updatedUser = response.data
      setUsers((prev) => prev.map((item) => (item.id === userId ? updatedUser : item)))

      setSuccessMessage(t('moderation.userStatusUpdated', 'User status updated successfully.'))
      setTimeout(() => setSuccessMessage(''), 5000)
    } catch (error) {
      console.error('Error updating user status:', error)
      const errorMsg =
        error.response?.data?.is_active?.[0] ||
        error.response?.data?.error ||
        error.response?.data?.detail ||
        t('moderation.userStatusUpdateError', 'Failed to update user status.')
      setErrorMessage(errorMsg)
      setTimeout(() => setErrorMessage(''), 5000)
    }
  }

  const getStripeStatus = (campaign) => {
    const stripe = campaign.created_by?.stripe
    const accountId = campaign.stripe_account_id || stripe?.stripe_account_id || null

    if (!stripe) {
      return {
        variant: 'unknown',
        icon: 'ℹ️',
        title: t('moderation.stripeStatusUnknown', 'Stripe status unavailable'),
        description: t(
          'moderation.stripeStatusNoData',
          'No Stripe information was returned for this campaign owner.'
        ),
        flags: [],
        requirements: [],
        accountId,
      }
    }

    if (!stripe.has_account) {
      return {
        variant: 'error',
        icon: '✖️',
        title: t('moderation.stripeStatusMissing', 'Stripe account missing'),
        description: t(
          'moderation.stripeStatusMissingDesc',
          'The campaign owner has not connected a Stripe account yet.'
        ),
        flags: [],
        requirements: [],
        accountId,
      }
    }

    const accountReady =
      !!stripe.charges_enabled && !!stripe.payouts_enabled && !!stripe.details_submitted

    const flags = [
      {
        key: 'charges',
        label: t('moderation.stripeChargesEnabled', 'Charges enabled'),
        value: !!stripe.charges_enabled,
      },
      {
        key: 'payouts',
        label: t('moderation.stripePayoutsEnabled', 'Payouts enabled'),
        value: !!stripe.payouts_enabled,
      },
      {
        key: 'details',
        label: t('moderation.stripeDetailsSubmitted', 'Details submitted'),
        value: !!stripe.details_submitted,
      },
    ]

    if (campaign.stripe_ready) {
      return {
        variant: 'ready',
        icon: '✅',
        title: t('moderation.stripeStatusReady', 'Stripe account ready'),
        description: t(
          'moderation.stripeStatusReadyDesc',
          'All checks passed. Donations can be processed.'
        ),
        flags,
        requirements: [],
        accountId,
      }
    }

    const requirements = Array.isArray(stripe.requirements_due)
      ? stripe.requirements_due.filter(Boolean)
      : []

    return {
      variant: 'warning',
      icon: '⚠️',
      title: t('moderation.stripeStatusPending', 'Stripe account needs attention'),
      description:
        requirements.length > 0
          ? t(
            'moderation.stripeStatusPendingDesc',
            'There are outstanding Stripe requirements that need to be completed.'
          )
          : t(
            'moderation.stripeStatusPendingNoList',
            'Stripe has not finished verifying this account yet.'
          ),
      flags,
      requirements,
      accountId,
    }
  }

  const formatDateTime = (value) => {
    if (!value) {
      return '—'
    }
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      return value
    }
    return date.toLocaleString()
  }

  const getNumericValue = (value) => {
    if (typeof value === 'number') {
      return value
    }
    if (typeof value === 'string') {
      const numeric = Number(value)
      return Number.isNaN(numeric) ? 0 : numeric
    }
    return 0
  }

  const formatCurrency = (value) => {
    const amount = getNumericValue(value)
    return `€${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  const getProgressValue = (value) => {
    const numeric = typeof value === 'number' ? value : parseInt(value ?? '0', 10)
    if (Number.isNaN(numeric)) {
      return 0
    }
    return Math.min(100, Math.max(0, numeric))
  }

  const statusMeta = {
    draft: {
      label: t('moderation.statusDraft', 'Draft'),
      variant: 'draft',
    },
    pending: {
      label: t('moderation.statusPending', 'Pending moderation'),
      variant: 'pending',
    },
    approved: {
      label: t('moderation.statusApproved', 'Approved'),
      variant: 'approved',
    },
    rejected: {
      label: t('moderation.statusRejected', 'Rejected'),
      variant: 'rejected',
    },
    suspended: {
      label: t('moderation.statusSuspended', 'Suspended'),
      variant: 'suspended',
    },
    cancelled: {
      label: t('moderation.statusCancelled', 'Cancelled'),
      variant: 'cancelled',
    },
  }

  const getStatusMeta = (status) => {
    if (!status || typeof status !== 'string') {
      return {
        label: t('moderation.statusUnknown', 'Unknown'),
        variant: 'default',
      }
    }
    return statusMeta[status] || {
      label: status.charAt(0).toUpperCase() + status.slice(1),
      variant: 'default',
    }
  }

  const getHistoryActionLabel = (action) => {
    if (!action) {
      return t('moderation.historyAction.unknown', 'Unknown action')
    }
    return t(
      `moderation.historyAction.${action}`,
      action.charAt(0).toUpperCase() + action.slice(1)
    )
  }

  const getHistoryModeratorLabel = (moderator) => {
    if (!moderator) {
      return t('moderation.historyModeratorDeleted', 'Former moderator')
    }
    const { email, username, id } = moderator
    if (email) {
      return email
    }
    if (username) {
      return username
    }
    return id
  }

  return (
    <div className="moderation">
      <div className="container">
        <h1>{t('moderation.title', 'Moderation Dashboard')}</h1>

        {successMessage && (
          <div className="success-message">
            {successMessage}
            <button
              className="close-message"
              onClick={() => setSuccessMessage('')}
            >
              ×
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="error-message">
            {errorMessage}
            <button
              className="close-message"
              onClick={() => setErrorMessage('')}
            >
              ×
            </button>
          </div>
        )}

        <div className="moderation-tabs">
          <button
            type="button"
            className={`moderation-tab ${activeTab === 'campaigns' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('campaigns')}
          >
            {t('moderation.tabCampaigns', 'Campaigns')}
          </button>
          <button
            type="button"
            className={`moderation-tab ${activeTab === 'users' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            {t('moderation.tabUsers', 'Users')}
          </button>
        </div>

        {activeTab === 'campaigns' && (
          <div className="moderation-section">
            <h2>{t('moderation.allCampaigns', 'All Campaigns')}</h2>
            {campaignsLoading ? (
              <p className="empty-message">{t('common.loading')}</p>
            ) : campaigns.length > 0 ? (
              <div className="campaigns-table-wrapper">
                <table className="campaigns-table">
                  <thead>
                    <tr>
                      <th>{t('moderation.campaignColumnCampaign', 'Campaign')}</th>
                      <th>{t('moderation.campaignColumnStatus', 'Status')}</th>
                      <th>{t('moderation.campaignColumnStats', 'Statistics')}</th>
                      <th>{t('moderation.campaignColumnStripe', 'Stripe')}</th>
                      <th>{t('moderation.campaignColumnCreated', 'Created')}</th>
                      <th>{t('moderation.campaignColumnActions', 'Actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((campaign) => {
                      const stripeStatus = getStripeStatus(campaign)
                      const statusInfo = getStatusMeta(campaign.status)
                      const showNotes = showNotesForm === campaign.id
                      const isExpanded = expandedCampaignId === campaign.id
                      const targetAmount = getNumericValue(campaign.target_amount)
                      const currentAmount = getNumericValue(campaign.current_amount)
                      const progress = getProgressValue(campaign.progress_percentage)
                      const statusKey =
                        typeof campaign.status === 'string' ? campaign.status.toLowerCase() : ''
                      const canModerate = statusKey === 'pending'
                      const canSuspend = statusKey === 'approved'
                      const canApprove = statusKey === 'suspended'
                      const historyEntries = Array.isArray(campaign.moderation_history)
                        ? campaign.moderation_history
                        : []

                      return (
                        <Fragment key={campaign.id}>
                          <tr className="campaign-row">
                            <td>
                              <div className="campaign-primary">
                                <span className="campaign-title">{campaign.title}</span>
                                <span className="campaign-meta">
                                  {t('moderation.createdBy', 'Created by')}: {campaign.created_by?.email || 'Unknown'}
                                </span>
                                {campaign.short_description && (
                                  <span className="campaign-meta campaign-meta--muted">
                                    {campaign.short_description}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              <span className={`campaign-status campaign-status--${statusInfo.variant}`}>
                                {statusInfo.label}
                              </span>
                            </td>
                            <td>
                              <div className="campaign-stats-cell">
                                <span className="campaign-amount">
                                  {formatCurrency(currentAmount)} / {formatCurrency(targetAmount)}
                                </span>
                                <span className="campaign-progress">{progress}%</span>
                              </div>
                            </td>
                            <td>
                              <button
                                type="button"
                                className={`campaign-stripe-chip campaign-stripe-chip--${stripeStatus.variant}`}
                                onClick={() => toggleCampaignDetails(campaign.id)}
                              >
                                <span className="campaign-stripe-icon">{stripeStatus.icon}</span>
                                <span>{stripeStatus.title}</span>
                              </button>
                            </td>
                            <td>{formatDateTime(campaign.created_at)}</td>
                            <td>
                              <div className="campaign-row-actions">
                                <Link to={`/campaign/${campaign.id}`} className="btn btn-view">
                                  <span className="btn-icon">👁</span>
                                  <span>{t('moderation.viewDetails', 'View Details')}</span>
                                </Link>
                                {canModerate && (
                                  <button
                                    type="button"
                                    className="btn btn-moderate"
                                    onClick={() => {
                                      if (!campaign.stripe_ready) {
                                        return
                                      }
                                      handleToggleNotesForm(campaign.id)
                                    }}
                                    disabled={!campaign.stripe_ready}
                                    title={
                                      campaign.stripe_ready
                                        ? undefined
                                        : t(
                                          'moderation.approveRequiresStripe',
                                          'Complete Stripe onboarding before approving this campaign.'
                                        )
                                    }
                                  >
                                    <span className="btn-icon">✓</span>
                                    <span>
                                      {showNotes
                                        ? t('common.cancel', 'Cancel')
                                        : t('moderation.moderate', 'Moderate')}
                                    </span>
                                  </button>
                                )}
                                {canSuspend && (
                                  <button
                                    type="button"
                                    className="btn btn-suspend"
                                    onClick={() => handleSuspend(campaign.id)}
                                  >
                                    <span className="btn-icon">⏸</span>
                                    <span>{t('moderation.suspend', 'Suspend')}</span>
                                  </button>
                                )}
                                {canApprove && (
                                  <button
                                    type="button"
                                    className="btn btn-approve"
                                    onClick={() => handleResume(campaign.id)}
                                  >
                                    <span className="btn-icon">✓</span>
                                    <span>{t('moderation.approve', 'Approve')}</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="btn btn-details"
                                  onClick={() => toggleCampaignDetails(campaign.id)}
                                >
                                  <span className="btn-icon">{isExpanded ? '−' : '+'}</span>
                                  <span>
                                    {isExpanded
                                      ? t('moderation.hideDetails', 'Hide details')
                                      : t('moderation.showDetails', 'Show details')}
                                  </span>
                                </button>
                              </div>
                            </td>
                          </tr>
                          {showNotes && (
                            <tr className="campaign-notes-row">
                              <td colSpan={6}>
                                <div className="notes-form-container">
                                  <textarea
                                    className="notes-textarea"
                                    placeholder={t('moderation.notesPlaceholder', 'Enter moderation notes (required for rejection)')}
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={4}
                                  />
                                  <div className="notes-form-actions">
                                    <button
                                      type="button"
                                      onClick={() => handleApprove(campaign.id)}
                                      className="btn btn-approve"
                                    >
                                      <span className="btn-icon">✓</span>
                                      <span>{t('moderation.approve', 'Approve')}</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleReject(campaign.id)}
                                      className="btn btn-reject"
                                    >
                                      <span className="btn-icon">✗</span>
                                      <span>{t('moderation.reject', 'Reject')}</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleNotesForm(campaign.id)}
                                      className="btn btn-cancel"
                                    >
                                      <span className="btn-icon">×</span>
                                      <span>{t('common.cancel', 'Cancel')}</span>
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                          {isExpanded && (
                            <tr className="campaign-details-row">
                              <td colSpan={6}>
                                <div className="campaign-details">
                                  <div className="campaign-stats-panel">
                                    <h3>{t('moderation.statisticsHeading', 'Statistics')}</h3>
                                    <dl>
                                      <div>
                                        <dt>{t('moderation.currentAmount', 'Raised')}</dt>
                                        <dd>{formatCurrency(currentAmount)}</dd>
                                      </div>
                                      <div>
                                        <dt>{t('moderation.targetAmount', 'Target')}</dt>
                                        <dd>{formatCurrency(targetAmount)}</dd>
                                      </div>
                                      <div>
                                        <dt>{t('moderation.progress', 'Progress')}</dt>
                                        <dd>{progress}%</dd>
                                      </div>
                                      <div>
                                        <dt>{t('moderation.moderationNotes', 'Moderation notes')}</dt>
                                        <dd>{campaign.moderation_notes ? campaign.moderation_notes : '—'}</dd>
                                      </div>
                                      <div>
                                        <dt>{t('moderation.updatedAt', 'Last updated')}</dt>
                                        <dd>{formatDateTime(campaign.updated_at)}</dd>
                                      </div>
                                    </dl>
                                  </div>
                                  <div className="campaign-stripe-panel">
                                    <div className={`stripe-status stripe-status--${stripeStatus.variant}`}>
                                      <div className="stripe-status-header">
                                        <span className="stripe-status-icon">{stripeStatus.icon}</span>
                                        <div>
                                          <p className="stripe-status-title">{stripeStatus.title}</p>
                                          <p className="stripe-status-description">{stripeStatus.description}</p>
                                        </div>
                                      </div>
                                      {stripeStatus.accountId && (
                                        <p className="stripe-status-account">
                                          {t('moderation.stripeAccountId', 'Account ID')}: <code>{stripeStatus.accountId}</code>
                                        </p>
                                      )}
                                      {stripeStatus.flags.length > 0 && (
                                        <div className="stripe-status-flags">
                                          {stripeStatus.flags.map((flag) => (
                                            <span
                                              key={flag.key}
                                              className={`stripe-flag ${flag.value ? 'stripe-flag--ok' : 'stripe-flag--pending'}`}
                                            >
                                              {flag.value ? '✓' : '•'} {flag.label}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                      {stripeStatus.requirements.length > 0 && (
                                        <div className="stripe-status-requirements">
                                          <p className="stripe-status-requirements-title">
                                            {t('moderation.stripeRequirementsTitle', 'Outstanding requirements')}
                                          </p>
                                          <ul>
                                            {stripeStatus.requirements.map((item, idx) => (
                                              <li key={idx}>{item}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {historyEntries.length > 0 && (
                                    <div className="campaign-history-panel">
                                      <h3>{t('moderation.historyTitle', 'Moderation history')}</h3>
                                      <ul className="campaign-history-list">
                                        {historyEntries.map((entry) => (
                                          <li key={entry.id} className="campaign-history-item">
                                            <div className="campaign-history-meta">
                                              <span className="campaign-history-action">
                                                {getHistoryActionLabel(entry.action)}
                                              </span>
                                              <span className="campaign-history-date">
                                                {formatDateTime(entry.created_at)}
                                              </span>
                                            </div>
                                            <p className="campaign-history-moderator">
                                              {t('moderation.historyModerator', 'Moderator')}:{' '}
                                              {getHistoryModeratorLabel(entry.moderator)}
                                            </p>
                                            {entry.notes && (
                                              <p className="campaign-history-notes">{entry.notes}</p>
                                            )}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-message">{t('moderation.noCampaignsFound', 'No campaigns found.')}</p>
            )}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="moderation-section">
            <h2>{t('moderation.usersHeading', 'Users')}</h2>
            {usersLoading ? (
              <p className="empty-message">{t('common.loading')}</p>
            ) : users.length > 0 ? (
              <div className="users-table-wrapper">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>{t('moderation.usersEmail', 'Email')}</th>
                      <th>{t('moderation.usersStatus', 'Status')}</th>
                      <th>{t('moderation.usersCreatedAt', 'Created')}</th>
                      <th>{t('moderation.usersLastLogin', 'Last login')}</th>
                      <th>{t('moderation.usersActions', 'Actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((account) => (
                      <tr key={account.id}>
                        <td>
                          <div className="user-primary">
                            <span className="user-email">{account.email}</span>
                            {account.username && (
                              <span className="user-username">@{account.username}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span
                            className={`user-status ${account.is_active ? 'user-status--active' : 'user-status--disabled'
                              }`}
                          >
                            {account.is_active
                              ? t('moderation.userActive', 'Active')
                              : t('moderation.userDisabled', 'Disabled')}
                          </span>
                        </td>
                        <td>{formatDateTime(account.date_joined)}</td>
                        <td>{formatDateTime(account.last_login)}</td>
                        <td className="user-actions">
                          <button
                            type="button"
                            className={`user-toggle-button ${account.is_active
                              ? 'user-toggle-button--disable'
                              : 'user-toggle-button--enable'
                              }`}
                            onClick={() => handleToggleUser(account.id, account.is_active)}
                            disabled={account.id === user?.id}
                          >
                            {account.is_active
                              ? t('moderation.disableUser', 'Disable')
                              : t('moderation.enableUser', 'Enable')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-message">{t('moderation.noUsersFound', 'No users found.')}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Moderation
