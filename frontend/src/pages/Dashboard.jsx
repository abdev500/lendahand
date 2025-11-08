import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/axios'
import ErrorMessage from '../components/ErrorMessage'
import { extractErrorMessage, logError } from '../utils/errorHandler'
import './Dashboard.css'

function Dashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [campaigns, setCampaigns] = useState([])
  const [moderationCampaigns, setModerationCampaigns] = useState([])
  const [news, setNews] = useState([])
  const [pendingCampaigns, setPendingCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [stripeStatus, setStripeStatus] = useState(null)
  const [stripeLoading, setStripeLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [activeTab, setActiveTab] = useState('campaigns')
  const [showNotesForm, setShowNotesForm] = useState(null)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    const initializeDashboard = async () => {
      await checkAuth()

      // Wait for user to be set before proceeding
      // Note: checkAuth() already fetched user data, so use that
      let currentUser = user
      // Only fetch again if checkAuth() failed and user is still null
      if (!currentUser) {
        console.warn('[Dashboard] User not set after checkAuth(), trying again...')
        try {
          const userResponse = await api.get('/users/me/')
          currentUser = userResponse.data
          setUser(currentUser)
        } catch (error) {
          console.error('[Dashboard] Error fetching user again:', error)
          setLoading(false)
          return
        }
      }

      await fetchCampaigns()
      await fetchStripeStatus()

      // Fetch news and pending campaigns if user is moderator/staff
      if (currentUser && (currentUser.is_moderator || currentUser.is_staff)) {
        console.log('User is moderator/staff, fetching news and pending campaigns...', {
          email: currentUser.email,
          is_moderator: currentUser.is_moderator,
          is_staff: currentUser.is_staff
        })
        try {
          await Promise.all([fetchNews(), fetchPendingCampaigns()])
        } catch (error) {
          console.error('Error fetching moderator data:', error)
        } finally {
          setLoading(false)
        }
      } else {
        console.log('User is not moderator/staff', {
          user: currentUser ? {
            email: currentUser.email,
            is_moderator: currentUser.is_moderator,
            is_staff: currentUser.is_staff
          } : 'no user'
        })
        setLoading(false)
      }

      // Check for success message from URL params
      const campaignCreated = searchParams.get('campaign_created') === 'true'
      const campaignUpdated = searchParams.get('campaign_updated') === 'true'
      const newsCreated = searchParams.get('news_created') === 'true'
      const newsUpdated = searchParams.get('news_updated') === 'true'
      const moderationTab = searchParams.get('tab') === 'moderation'
      const stripePending = searchParams.get('stripe_pending') === 'true'
      const stripeError = searchParams.get('stripe_error') === 'true'
      let shouldClearParams = false

      if (moderationTab && (currentUser?.is_moderator || currentUser?.is_staff)) {
        setActiveTab('moderation')
      }

      if (campaignCreated || campaignUpdated) {
        if (campaignCreated) {
          setSuccessMessage(t('dashboard.createdSuccess'))
        } else if (campaignUpdated) {
          setSuccessMessage(t('dashboard.updatedSuccess'))
        }
        shouldClearParams = true
        // Refresh campaigns to show new/updated campaign
        setTimeout(() => {
          fetchCampaigns()
        }, 500)
      }

      if (newsCreated || newsUpdated) {
        if (newsCreated) {
          setSuccessMessage(t('news.createdSuccess', 'News article created successfully!'))
        } else if (newsUpdated) {
          setSuccessMessage(t('news.updatedSuccess', 'News article updated successfully!'))
        }
        shouldClearParams = true
        // Refresh news if user is moderator
        if (currentUser && (currentUser.is_moderator || currentUser.is_staff)) {
          setTimeout(() => {
            fetchNews()
          }, 500)
        }
      }

      if (stripePending) {
        setErrorMessage(
          t('dashboard.stripePendingNotice', 'Finish Stripe onboarding to enable moderation and donations for your campaign.')
        )
        shouldClearParams = true
      }

      if (stripeError) {
        setErrorMessage(
          t('dashboard.stripeErrorNotice', 'We could not start Stripe onboarding. Please try again from the dashboard.')
        )
        shouldClearParams = true
      }

      if (shouldClearParams) {
        setSearchParams({})
      }
    }

    initializeDashboard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isModerator = user?.is_moderator || user?.is_staff

  const availableTabs = useMemo(() => {
    const tabs = [
      { key: 'campaigns', label: t('dashboard.myCampaigns') },
      { key: 'stripe', label: t('dashboard.stripeTab', 'Stripe Overview') },
    ]

    if (isModerator) {
      tabs.push(
        { key: 'moderation', label: t('moderation.title', 'Moderation') },
        { key: 'news', label: t('dashboard.newsManagement', 'News Management') },
      )
    }

    return tabs
  }, [isModerator, t])

  useEffect(() => {
    if (!availableTabs.some((tab) => tab.key === activeTab)) {
      setActiveTab(availableTabs[0]?.key || 'campaigns')
    }
  }, [availableTabs, activeTab])

  const checkAuth = async () => {
    let token = null
    try {
      token = localStorage.getItem('token')
    } catch (e) {
      console.error('[Dashboard] Error accessing localStorage:', e)
      navigate('/login')
      return
    }

    if (!token) {
      console.warn('[Dashboard] No token found in localStorage')
      navigate('/login')
      return
    }

    try {
      console.log('[Dashboard] Fetching user data with token:', token.substring(0, 10) + '...')
      const response = await api.get('/users/me/')
      setUser(response.data)
    } catch (error) {
      console.error('[Dashboard] Error fetching user data:', error)
      if (error.response) {
        console.error('[Dashboard] Response status:', error.response.status)
        console.error('[Dashboard] Response data:', error.response.data)
        console.error('[Dashboard] Response headers:', error.response.headers)
      }
      localStorage.removeItem('token')
      navigate('/login')
    }
  }

  const fetchCampaigns = async () => {
    try {
      const response = await api.get('/campaigns/')
      // Ensure we always have an array
      const allCampaignsData = response.data.results || response.data || []
      const allCampaigns = Array.isArray(allCampaignsData) ? allCampaignsData : []

      // Get current user ID - use user state if available, otherwise fetch it
      let currentUserId
      let isCurrentUserModerator = user?.is_moderator || user?.is_staff
      if (user) {
        currentUserId = user.id
      } else {
        const userResponse = await api.get('/users/me/')
        currentUserId = userResponse.data.id
        isCurrentUserModerator = userResponse.data.is_moderator || userResponse.data.is_staff
        setUser((prev) => prev || userResponse.data)
      }

      // Filter to show only campaigns created by the current user
      const myCampaigns = allCampaigns.filter(
        (campaign) => campaign.created_by && campaign.created_by.id === currentUserId
      )
      setCampaigns(myCampaigns)
      if (isCurrentUserModerator) {
        setModerationCampaigns(allCampaigns)
      } else {
        setModerationCampaigns([])
      }
      if (!user || (!user.is_moderator && !user.is_staff)) {
        setLoading(false)
      }
    } catch (error) {
      logError(error, 'fetchCampaigns')
      setCampaigns([]) // Set empty array on error
      setModerationCampaigns([])
      if (!user || (!user.is_moderator && !user.is_staff)) {
        setLoading(false)
      }
    }
  }

  const fetchStripeStatus = async () => {
    try {
      const response = await api.get('/users/stripe/status/')
      setStripeStatus(response.data)
    } catch (error) {
      logError(error, 'fetchStripeStatus')
    }
  }

  const handleResumeStripeOnboarding = async () => {
    setStripeLoading(true)
    try {
      const response = await api.post('/users/stripe/onboard/')
      const data = response.data || {}

      if (data.stripe_ready) {
        setSuccessMessage(t('dashboard.stripeReady', 'Stripe onboarding complete!'))
        await fetchStripeStatus()
        setTimeout(() => setSuccessMessage(''), 5000)
        return
      }

      if (data.onboarding_url) {
        window.location.href = data.onboarding_url
        return
      }

      setErrorMessage(
        t('dashboard.stripePendingMessage', 'Stripe onboarding is still required before donations can be collected.')
      )
      setTimeout(() => setErrorMessage(''), 5000)
    } catch (error) {
      logError(error, 'handleResumeStripeOnboarding')
      const errorMsg = extractErrorMessage(
        error,
        t('dashboard.stripeResumeError', 'Unable to start Stripe onboarding. Please try again.')
      )
      setErrorMessage(errorMsg)
      setTimeout(() => setErrorMessage(''), 5000)
    } finally {
      setStripeLoading(false)
    }
  }

  const fetchNews = async () => {
    try {
      const response = await api.get('/news/')
      const allNews = response.data.results || response.data
      // Moderators can see all news (including unpublished)
      console.log('Fetched news:', allNews.length, 'items', allNews)
      setNews(allNews)
    } catch (error) {
      logError(error, 'fetchNews')
      setNews([])
    }
  }

  const fetchPendingCampaigns = async () => {
    try {
      const response = await api.get('/campaigns/?status=pending')
      // Ensure we always have an array
      const allCampaignsData = response.data.results || response.data || []
      const allCampaigns = Array.isArray(allCampaignsData) ? allCampaignsData : []
      console.log('Fetched pending campaigns:', allCampaigns.length, 'items')
      setPendingCampaigns(allCampaigns)
    } catch (error) {
      logError(error, 'fetchPendingCampaigns')
      setPendingCampaigns([])
    }
  }

  const handleSuspend = async (campaignId) => {
    if (!window.confirm(t('dashboard.suspendConfirm'))) {
      return
    }

    try {
      await api.post(`/campaigns/${campaignId}/suspend/`)
      setSuccessMessage(t('dashboard.suspendSuccess', 'Campaign suspended successfully!'))
      fetchCampaigns()
      setTimeout(() => setSuccessMessage(''), 5000)
    } catch (error) {
      logError(error, 'handleSuspend')
      const errorMsg = extractErrorMessage(error, t('dashboard.suspendError', 'Error suspending campaign'))
      setErrorMessage(errorMsg)
      setTimeout(() => setErrorMessage(''), 5000)
    }
  }

  const handleCancel = async (campaignId) => {
    if (!window.confirm(t('dashboard.cancelConfirm'))) {
      return
    }

    try {
      await api.post(`/campaigns/${campaignId}/cancel/`)
      setSuccessMessage(t('dashboard.cancelSuccess', 'Campaign cancelled successfully!'))
      fetchCampaigns()
      setTimeout(() => setSuccessMessage(''), 5000)
    } catch (error) {
      logError(error, 'handleCancel')
      const errorMsg = extractErrorMessage(error, t('dashboard.cancelError', 'Error cancelling campaign'))
      setErrorMessage(errorMsg)
      setTimeout(() => setErrorMessage(''), 5000)
    }
  }

  const handleModeratorSuspend = async (campaignId) => {
    const confirmed = window.confirm(
      t('moderation.suspendConfirm', 'Are you sure you want to suspend this campaign?')
    )
    if (!confirmed) {
      return
    }

    try {
      await api.post(`/campaigns/${campaignId}/suspend/`)
      setSuccessMessage(t('moderation.suspendSuccess', 'Campaign suspended successfully!'))
      await Promise.all([fetchCampaigns(), fetchPendingCampaigns()])
      setTimeout(() => setSuccessMessage(''), 5000)
    } catch (error) {
      logError(error, 'handleModeratorSuspend')
      const errorMsg = extractErrorMessage(error, t('moderation.suspendError', 'Error suspending campaign'))
      setErrorMessage(errorMsg)
      setTimeout(() => setErrorMessage(''), 5000)
    }
  }

  const handleModeratorResume = async (campaignId) => {
    const confirmed = window.confirm(
      t('moderation.resumeConfirm', 'Are you sure you want to resume this campaign?')
    )
    if (!confirmed) {
      return
    }

    try {
      await api.post(`/campaigns/${campaignId}/resume/`)
      setSuccessMessage(t('moderation.resumeSuccess', 'Campaign resumed successfully!'))
      await Promise.all([fetchCampaigns(), fetchPendingCampaigns()])
      setTimeout(() => setSuccessMessage(''), 5000)
    } catch (error) {
      logError(error, 'handleModeratorResume')
      const errorMsg = extractErrorMessage(error, t('moderation.resumeError', 'Error resuming campaign'))
      setErrorMessage(errorMsg)
      setTimeout(() => setErrorMessage(''), 5000)
    }
  }

  const handleToggleNews = async (newsId, published) => {
    try {
      await api.patch(`/news/${newsId}/`, { published })
      setSuccessMessage(
        published
          ? t('news.publishedSuccess', 'News article published successfully!')
          : t('news.unpublishedSuccess', 'News article unpublished successfully!')
      )
      fetchNews()
      setTimeout(() => setSuccessMessage(''), 5000)
    } catch (error) {
      logError(error, 'handleToggleNews')
      const errorMsg = extractErrorMessage(error, t('news.toggleError', 'Error updating news status. Please try again.'))
      setErrorMessage(errorMsg)
      setTimeout(() => setErrorMessage(''), 5000)
    }
  }

  const handleDeleteNews = async (newsId, newsTitle) => {
    const confirmMessage = t('news.deleteConfirm', 'Are you sure you want to delete "{title}"? This action cannot be undone.').replace('{title}', newsTitle)
    if (!window.confirm(confirmMessage)) {
      return
    }

    try {
      await api.delete(`/news/${newsId}/`)
      setSuccessMessage(t('news.deletedSuccess', 'News article deleted successfully!'))
      fetchNews()
      setTimeout(() => setSuccessMessage(''), 5000)
    } catch (error) {
      logError(error, 'handleDeleteNews')
      const errorMsg = extractErrorMessage(error, t('news.deleteError', 'Error deleting news article. Please try again.'))
      setErrorMessage(errorMsg)
      setTimeout(() => setErrorMessage(''), 5000)
    }
  }

  const handleApproveCampaign = async (campaignId) => {
    try {
      await api.post(`/campaigns/${campaignId}/approve/`, {
        moderation_notes: notes || ''
      })
      setSuccessMessage(t('moderation.approveSuccess', 'Campaign approved successfully!'))
      setShowNotesForm(null)
      setNotes('')
      fetchPendingCampaigns()
      setTimeout(() => setSuccessMessage(''), 5000)
    } catch (error) {
      logError(error, 'handleApproveCampaign')
      const errorMsg = extractErrorMessage(error, t('moderation.approveError', 'Error approving campaign'))
      setErrorMessage(errorMsg)
      setTimeout(() => setErrorMessage(''), 5000)
    }
  }

  const handleRejectCampaign = async (campaignId) => {
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
      fetchPendingCampaigns()
      setTimeout(() => setSuccessMessage(''), 5000)
    } catch (error) {
      logError(error, 'handleRejectCampaign')
      const errorMsg = extractErrorMessage(error, t('moderation.rejectError', 'Error rejecting campaign'))
      setErrorMessage(errorMsg)
      setTimeout(() => setErrorMessage(''), 5000)
    }
  }

  const stripeFlags = useMemo(() => {
    if (!stripeStatus) {
      return []
    }
    return [
      {
        key: 'charges',
        label: t('dashboard.stripeChargesEnabled', 'Charges enabled'),
        value: !!stripeStatus.charges_enabled,
      },
      {
        key: 'payouts',
        label: t('dashboard.stripePayoutsEnabled', 'Payouts enabled'),
        value: !!stripeStatus.payouts_enabled,
      },
      {
        key: 'details',
        label: t('dashboard.stripeDetailsSubmitted', 'Details submitted'),
        value: !!stripeStatus.details_submitted,
      },
    ]
  }, [stripeStatus, t])

  if (loading) {
    return <div className="container">{t('common.loading')}</div>
  }

  const getStatusBadge = (status) => {
    const statusColors = {
      'draft': '#6c757d',
      'pending': '#ffc107',
      'approved': '#28a745',
      'rejected': '#dc3545',
      'suspended': '#ff9800',
      'cancelled': '#6c757d',
    }

    const statusLabels = {
      'draft': t('status.draft'),
      'pending': t('status.pending'),
      'approved': t('status.approved'),
      'rejected': t('status.rejected'),
      'suspended': t('status.suspended'),
      'cancelled': t('status.cancelled'),
    }

    return (
      <span
        className="status-badge"
        style={{
          backgroundColor: statusColors[status] || '#6c757d',
          color: status === 'pending' ? '#000' : '#fff'
        }}
      >
        {statusLabels[status] || status}
      </span>
    )
  }

  return (
    <div className="dashboard">
      <div className="container">
        <h1>{t('dashboard.title')}</h1>
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
        <ErrorMessage
          message={errorMessage}
          onClose={() => setErrorMessage('')}
          autoHide={true}
          duration={5000}
        />
        {stripeStatus && !stripeStatus.stripe_ready && (
          <div className="stripe-alert">
            <p>
              {stripeStatus.has_account
                ? t(
                    'dashboard.stripeAlert',
                    'Stripe onboarding is required before your campaigns can be moderated or accept donations.'
                  )
                : t(
                    'dashboard.stripeNoAccount',
                    'Create your Stripe account to submit campaigns and receive donations.'
                  )}
            </p>
            <div className="stripe-actions">
              <button
                className="btn btn-stripe"
                onClick={handleResumeStripeOnboarding}
                disabled={stripeLoading}
              >
                {stripeLoading
                  ? t('dashboard.stripeLoading', 'Preparing Stripe...')
                  : t('dashboard.resumeStripe', 'Resume Stripe setup')}
              </button>
            </div>
          </div>
        )}
        {user && (
          <div className="user-info">
            <p><strong>{t('dashboard.email')}:</strong> {user.email}</p>
            {user.phone && <p><strong>{t('dashboard.phone')}:</strong> {user.phone}</p>}
            {user.address && <p><strong>{t('dashboard.address')}:</strong> {user.address}</p>}
          </div>
        )}

        {availableTabs.length > 1 && (
          <div className="dashboard-tabs">
            {availableTabs.map((tab) => (
              <button
                key={tab.key}
                className={`tab-button ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <div className="dashboard-actions">
          {activeTab === 'campaigns' && (
            <Link to="/campaigns/new" className="btn-create">
              {t('campaign.createNew')}
            </Link>
          )}
          {activeTab === 'news' && (
            <Link to="/news/new" className="btn-create">
              {t('news.createNew', '+ Create New News')}
            </Link>
          )}
        </div>

        {activeTab === 'campaigns' && (
          <div className="campaigns-section">
            <h2>{t('dashboard.myCampaigns')}</h2>
            {campaigns.length > 0 ? (
              <div className="campaigns-list">
                {campaigns.map((campaign) => (
                  <div key={campaign.id} className="dashboard-campaign-card">
                    <div className="campaign-info">
                      <h3>{campaign.title}</h3>
                      <p className="campaign-status">
                        {t('dashboard.status')}: {getStatusBadge(campaign.status)}
                        {campaign.status === 'pending' && (
                          <span className="status-note"> - {t('status.awaitingApproval')}</span>
                        )}
                      </p>
                      <p className="campaign-progress">
                        €{campaign.current_amount.toLocaleString()} / €{campaign.target_amount.toLocaleString()}
                      </p>
                      {!campaign.stripe_ready && (
                        <p className="stripe-status-note">
                          {t(
                            'dashboard.campaignStripePending',
                            'Stripe onboarding incomplete — this campaign cannot be moderated or accept donations yet.'
                          )}
                        </p>
                      )}
                      {campaign.moderation_notes && (
                        <div className="moderation-notes">
                          <strong>{t('dashboard.moderationNotes', 'Moderator Comments')}:</strong>
                          <p className="notes-content">{campaign.moderation_notes}</p>
                        </div>
                      )}
                    </div>
                    <div className="campaign-actions">
                      <Link to={`/campaign/${campaign.id}`} className="btn btn-view">
                        <span className="btn-icon">👁</span>
                        <span>{t('dashboard.view')}</span>
                      </Link>
                      {campaign.status !== 'suspended' && campaign.status !== 'cancelled' && (
                        <Link to={`/campaigns/${campaign.id}/edit`} className="btn btn-edit">
                          <span className="btn-icon">✎</span>
                          <span>{t('dashboard.edit')}</span>
                        </Link>
                      )}
                      {campaign.status !== 'suspended' && campaign.status !== 'cancelled' && (
                        <>
                          <button
                            onClick={() => handleSuspend(campaign.id)}
                            className="btn btn-suspend"
                          >
                            <span className="btn-icon">⏸</span>
                            <span>{t('dashboard.suspend')}</span>
                          </button>
                          <button
                            onClick={() => handleCancel(campaign.id)}
                            className="btn btn-cancel"
                          >
                            <span className="btn-icon">✕</span>
                            <span>{t('dashboard.cancel')}</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p>{t('dashboard.noCampaigns')}</p>
            )}
          </div>
        )}

        {activeTab === 'stripe' && (
          <div className="stripe-overview">
            <h2>{t('dashboard.stripeOverviewHeading', 'Stripe Overview')}</h2>
            <div className="stripe-summary-card">
              <h3>{t('dashboard.stripeAccountSummary', 'Account Summary')}</h3>
              {stripeStatus ? (
                <>
                  <p className={`stripe-summary-status ${stripeStatus.stripe_ready ? 'ready' : 'pending'}`}>
                    {stripeStatus.stripe_ready
                      ? t('dashboard.stripeStatusReady', 'Account ready for payouts')
                      : t('dashboard.stripeStatusNeedsAttention', 'Account needs attention')}
                  </p>
                  {stripeStatus.stripe_account_id && (
                    <p className="stripe-summary-id">
                      <strong>{t('dashboard.stripeAccountId', 'Account ID')}:</strong>{' '}
                      <code>{stripeStatus.stripe_account_id}</code>
                    </p>
                  )}
                  <div className="stripe-summary-flags">
                    {stripeFlags.map((flag) => (
                      <span
                        key={flag.key}
                        className={`stripe-flag ${flag.value ? 'stripe-flag--ok' : 'stripe-flag--pending'}`}
                      >
                        {flag.value ? '✓' : '•'} {flag.label}
                      </span>
                    ))}
                  </div>
                  <div className="stripe-summary-requirements">
                    <h4>{t('dashboard.stripeRequirements', 'Outstanding requirements')}</h4>
                    {Array.isArray(stripeStatus.requirements_due) && stripeStatus.requirements_due.length > 0 ? (
                      <>
                        <p className="stripe-requirements-help">
                          {t(
                            'dashboard.stripeRequirementsHelp',
                            'Complete the following items in Stripe to enable payouts:'
                          )}
                        </p>
                        <ul>
                          {stripeStatus.requirements_due.map((item, index) => (
                            <li key={`${item}-${index}`}>{item}</li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <p>{t('dashboard.stripeNoRequirements', 'No outstanding requirements.')}</p>
                    )}
                  </div>
                </>
              ) : (
                <p>{t('dashboard.stripeStatusUnknown', 'Stripe status is currently unavailable.')}</p>
              )}
            </div>

            <div className="stripe-campaigns-card">
              <h3>{t('dashboard.stripeCampaignsHeading', 'Campaign Stripe Status')}</h3>
              {campaigns.length > 0 ? (
                <div className="stripe-campaigns-list">
                  {campaigns.map((campaign) => (
                    <div key={campaign.id} className="stripe-campaign-item">
                      <div className="stripe-campaign-header">
                        <h4>{campaign.title}</h4>
                        {getStatusBadge(campaign.status)}
                      </div>
                      <div className="stripe-campaign-meta">
                        <p>
                          <strong>{t('moderation.targetAmount', 'Target')}:</strong>{' '}
                          €{campaign.target_amount.toLocaleString()}
                        </p>
                        <p>
                          <strong>{t('moderation.createdAt', 'Created')}:</strong>{' '}
                          {new Date(campaign.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="stripe-campaign-flags">
                        <span
                          className={`stripe-chip ${campaign.stripe_ready ? 'stripe-chip--ok' : 'stripe-chip--pending'}`}
                        >
                          {campaign.stripe_ready
                            ? t('dashboard.stripeReadyLabel', 'Stripe ready')
                            : t('dashboard.stripeNotReadyLabel', 'Stripe not ready')}
                        </span>
                        {campaign.stripe_account_id && (
                          <span className="stripe-chip stripe-chip--id">
                            {t('dashboard.stripeAccountId', 'Account ID')}: {campaign.stripe_account_id}
                          </span>
                        )}
                      </div>
                      {!campaign.stripe_ready && (
                        <p className="stripe-campaign-warning">
                          {t(
                            'dashboard.stripeCampaignNeedsStripe',
                            'Complete Stripe onboarding to accept donations.'
                          )}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p>{t('dashboard.stripeCampaignsEmpty', 'No campaigns to display yet.')}</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'moderation' && (user?.is_moderator || user?.is_staff) && (
          <div className="moderation-section">
            <h2>{t('moderation.pendingCampaigns', 'Pending Campaigns')}</h2>
            {pendingCampaigns.length > 0 ? (
              <div className="campaigns-list">
                {pendingCampaigns.map((campaign) => (
                  <div key={campaign.id} className="dashboard-campaign-card">
                    <div className="campaign-info">
                      <h3>{campaign.title}</h3>
                      <p className="campaign-creator">
                        <strong>{t('moderation.createdBy', 'Created by')}:</strong>{' '}
                        {campaign.created_by?.email || 'Unknown'}
                      </p>
                      <p className="campaign-description">{campaign.short_description}</p>
                      <p className="campaign-target">
                        <strong>{t('moderation.targetAmount', 'Target')}:</strong>{' '}
                        €{campaign.target_amount.toLocaleString()}
                      </p>
                      <p className="campaign-date">
                        <strong>{t('moderation.createdAt', 'Created')}:</strong>{' '}
                        {new Date(campaign.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="campaign-actions">
                      {showNotesForm === campaign.id ? (
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
                              onClick={() => handleApproveCampaign(campaign.id)}
                              className="btn btn-approve"
                            >
                              <span className="btn-icon">✓</span>
                              <span>{t('moderation.approve', 'Approve')}</span>
                            </button>
                            <button
                              onClick={() => handleRejectCampaign(campaign.id)}
                              className="btn btn-reject"
                            >
                              <span className="btn-icon">✕</span>
                              <span>{t('moderation.reject', 'Reject')}</span>
                            </button>
                            <button
                              onClick={() => {
                                setShowNotesForm(null)
                                setNotes('')
                              }}
                              className="btn btn-cancel"
                            >
                              <span className="btn-icon">✕</span>
                              <span>{t('common.cancel', 'Cancel')}</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <Link to={`/campaign/${campaign.id}`} className="btn btn-view">
                            <span className="btn-icon">👁</span>
                            <span>{t('moderation.viewDetails', 'View Details')}</span>
                          </Link>
                          <button
                            onClick={() => setShowNotesForm(campaign.id)}
                            className="btn btn-moderate"
                          >
                            <span className="btn-icon">✓</span>
                            <span>{t('moderation.moderate', 'Moderate')}</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-message">
                {t('moderation.noPendingCampaigns', 'No pending campaigns to moderate.')}
              </p>
            )}

            <h2 className="moderation-subheading">{t('moderation.allCampaigns', 'All Campaigns')}</h2>
            {moderationCampaigns.length > 0 ? (
              <div className="campaigns-list">
                {moderationCampaigns.map((campaign) => {
                  const canSuspend = !['suspended', 'cancelled'].includes(campaign.status)
                  const canResume = ['suspended', 'cancelled'].includes(campaign.status)

                  return (
                    <div key={campaign.id} className="dashboard-campaign-card">
                      <div className="campaign-info">
                        <h3>{campaign.title}</h3>
                        <p className="campaign-creator">
                          <strong>{t('moderation.createdBy', 'Created by')}:</strong>{' '}
                          {campaign.created_by?.email || 'Unknown'}
                        </p>
                        <p className="campaign-status">
                          {t('dashboard.status')}: {getStatusBadge(campaign.status)}
                        </p>
                        <p className="campaign-target">
                          <strong>{t('moderation.targetAmount', 'Target')}:</strong>{' '}
                          €{campaign.target_amount.toLocaleString()}
                        </p>
                        <p className="campaign-date">
                          <strong>{t('moderation.createdAt', 'Created')}:</strong>{' '}
                          {new Date(campaign.created_at).toLocaleDateString()}
                        </p>
                        {campaign.stripe_account_id && (
                          <p className="campaign-stripe-id">
                            <strong>{t('dashboard.stripeAccountId', 'Account ID')}:</strong>{' '}
                            <code>{campaign.stripe_account_id}</code>
                          </p>
                        )}
                        {!campaign.stripe_ready && (
                          <p className="stripe-status-note">
                            {t(
                              'moderation.campaignNeedsStripe',
                              'Stripe onboarding incomplete — donations are disabled.'
                            )}
                          </p>
                        )}
                      </div>
                      <div className="campaign-actions">
                        <Link to={`/campaign/${campaign.id}`} className="btn btn-view">
                          <span className="btn-icon">👁</span>
                          <span>{t('moderation.viewDetails', 'View Details')}</span>
                        </Link>
                        {canSuspend && (
                          <button
                            onClick={() => handleModeratorSuspend(campaign.id)}
                            className="btn btn-suspend"
                          >
                            <span className="btn-icon">⏸</span>
                            <span>{t('moderation.suspend', 'Suspend')}</span>
                          </button>
                        )}
                        {canResume && (
                          <button
                            onClick={() => handleModeratorResume(campaign.id)}
                            className="btn btn-resume"
                            disabled={!campaign.stripe_ready}
                            title={
                              campaign.stripe_ready
                                ? undefined
                                : t('moderation.resumeRequiresStripe', 'Complete Stripe onboarding before resuming.')
                            }
                          >
                            <span className="btn-icon">↻</span>
                            <span>{t('moderation.resume', 'Resume')}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="empty-message">{t('moderation.noCampaigns', 'No campaigns available.')}</p>
            )}
          </div>
        )}

        {activeTab === 'news' && (
          <div className="news-section">
            <h2>{t('dashboard.newsManagement', 'News Management')}</h2>
            {news.length > 0 ? (
              <div className="news-list">
                {news.map((item) => (
                  <div key={item.id} className="dashboard-news-card">
                    <div className="news-info">
                      <h3>{item.title}</h3>
                      <p className="news-status">
                        <span className={`status-badge ${item.published ? 'published' : 'unpublished'}`}>
                          {item.published ? t('news.published', 'Published') : t('news.unpublished', 'Unpublished')}
                        </span>
                      </p>
                      <p className="news-date">
                        {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="news-actions">
                      <Link to={`/news/${item.id}`} className="btn btn-view">
                        <span className="btn-icon">👁</span>
                        <span>{t('dashboard.view')}</span>
                      </Link>
                      <Link to={`/news/${item.id}/edit`} className="btn btn-edit">
                        <span className="btn-icon">✎</span>
                        <span>{t('dashboard.edit')}</span>
                      </Link>
                      <button
                        onClick={() => handleToggleNews(item.id, !item.published)}
                        className={`btn btn-toggle ${item.published ? 'btn-unpublish' : 'btn-publish'}`}
                      >
                        <span className="btn-icon">{item.published ? '🔓' : '🔒'}</span>
                        <span>{item.published ? t('news.unpublish', 'Unpublish') : t('news.publish', 'Publish')}</span>
                      </button>
                      <button
                        onClick={() => handleDeleteNews(item.id, item.title)}
                        className="btn btn-delete"
                      >
                        <span className="btn-icon">🗑</span>
                        <span>{t('news.delete', 'Delete')}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p>{t('news.noNews', 'No news articles yet.')}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
