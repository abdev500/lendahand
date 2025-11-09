import { useCallback, useEffect, useMemo, useState } from 'react'
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
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [stripeStatus, setStripeStatus] = useState(null)
  const [stripeLoading, setStripeLoading] = useState(false)
  const [stripeRefreshLoading, setStripeRefreshLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [activeTab, setActiveTab] = useState('campaigns')
  const [moderationStatusFilter, setModerationStatusFilter] = useState('all')
  const [moderationSubTab, setModerationSubTab] = useState('campaigns')
  const [moderationUsers, setModerationUsers] = useState([])
  const [moderationUsersLoading, setModerationUsersLoading] = useState(false)
  const [moderationUsersLoaded, setModerationUsersLoaded] = useState(false)

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
          await Promise.all([fetchNews(), fetchModerationUsers()])
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
    const tabs = [{ key: 'campaigns', label: t('dashboard.myCampaigns') }]

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

  const fetchModerationUsers = useCallback(async () => {
    setModerationUsersLoading(true)
    try {
      const response = await api.get('/users/')
      const data = response.data
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.results)
          ? data.results
          : []
      setModerationUsers(list)
      setModerationUsersLoaded(true)
    } catch (error) {
      logError(error, 'fetchModerationUsers')
      setModerationUsers([])
      setErrorMessage((prev) => prev || t('moderation.usersLoadError', 'Error loading users.'))
      setTimeout(() => setErrorMessage(''), 5000)
    } finally {
      setModerationUsersLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (
      activeTab === 'moderation' &&
      moderationSubTab === 'users' &&
      !moderationUsersLoaded &&
      !moderationUsersLoading &&
      isModerator
    ) {
      fetchModerationUsers()
    }
  }, [
    activeTab,
    moderationSubTab,
    moderationUsersLoaded,
    moderationUsersLoading,
    isModerator,
    fetchModerationUsers,
  ])

  const fetchCampaigns = async () => {
    try {
      const response = await api.get('/campaigns/?include_history=true')
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

  const getUserActionPermissions = (status) => {
    switch (status) {
      case 'draft':
        return { canSubmitForModeration: true, canSuspend: false, canCancel: true }
      case 'pending':
        return { canSubmitForModeration: false, canSuspend: true, canCancel: true }
      case 'approved':
        return { canSubmitForModeration: false, canSuspend: true, canCancel: false }
      case 'suspended':
        return { canSubmitForModeration: false, canSuspend: false, canCancel: true }
      case 'rejected':
        return { canSubmitForModeration: true, canSuspend: false, canCancel: true }
      case 'cancelled':
        return { canSubmitForModeration: true, canSuspend: false, canCancel: false }
      default:
        return { canSubmitForModeration: false, canSuspend: false, canCancel: false }
    }
  }

  const fetchStripeStatus = async () => {
    try {
      const response = await api.get('/users/stripe/status/')
      setStripeStatus(response.data)
      return true
    } catch (error) {
      logError(error, 'fetchStripeStatus')
      return false
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

  const handleRefreshStripeStatus = async () => {
    setStripeRefreshLoading(true)
    try {
      const stripeSuccess = await fetchStripeStatus()
      await fetchCampaigns()
      if (stripeSuccess) {
        setSuccessMessage(t('dashboard.refreshStripeSuccess', 'Stripe information refreshed.'))
        setTimeout(() => setSuccessMessage(''), 5000)
      } else {
        setErrorMessage(t('dashboard.refreshStripeError', 'Unable to refresh Stripe information. Please try again.'))
        setTimeout(() => setErrorMessage(''), 5000)
      }
    } catch (error) {
      logError(error, 'handleRefreshStripeStatus')
      const errorMsg = extractErrorMessage(
        error,
        t('dashboard.refreshStripeError', 'Unable to refresh Stripe information. Please try again.')
      )
      setErrorMessage(errorMsg)
      setTimeout(() => setErrorMessage(''), 5000)
    } finally {
      setStripeRefreshLoading(false)
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

  const handleSubmitForModeration = async (campaignId) => {
    try {
      await api.patch(`/campaigns/${campaignId}/`, { status: 'pending' })
      setSuccessMessage(t('dashboard.submitForModerationSuccess', 'Campaign submitted for moderation.'))
      await fetchCampaigns()
      setTimeout(() => setSuccessMessage(''), 5000)
    } catch (error) {
      logError(error, 'handleSubmitForModeration')
      const errorMsg = extractErrorMessage(
        error,
        t('dashboard.submitForModerationError', 'Error submitting campaign for moderation.')
      )
      setErrorMessage(errorMsg)
      setTimeout(() => setErrorMessage(''), 5000)
    }
  }

  const handleModeratorApprovePending = async (campaignId) => {
    try {
      await api.post(`/campaigns/${campaignId}/approve/`)
      setSuccessMessage(t('moderation.approveSuccess', 'Campaign approved successfully!'))
      await fetchCampaigns()
      setTimeout(() => setSuccessMessage(''), 5000)
    } catch (error) {
      logError(error, 'handleModeratorApprovePending')
      const errorMsg = extractErrorMessage(error, t('moderation.approveError', 'Error approving campaign'))
      setErrorMessage(errorMsg)
      setTimeout(() => setErrorMessage(''), 5000)
    }
  }

  const handleModeratorRejectPending = async (campaignId) => {
    const notes = window.prompt(
      t('moderation.notesPlaceholder', 'Enter moderation notes (required for rejection)'),
      ''
    )

    if (!notes || !notes.trim()) {
      setErrorMessage(t('moderation.rejectReasonRequired', 'Rejection reason is required'))
      setTimeout(() => setErrorMessage(''), 5000)
      return
    }

    try {
      await api.post(`/campaigns/${campaignId}/reject/`, {
        moderation_notes: notes.trim(),
      })
      setSuccessMessage(t('moderation.rejectSuccess', 'Campaign rejected successfully!'))
      await fetchCampaigns()
      setTimeout(() => setSuccessMessage(''), 5000)
    } catch (error) {
      logError(error, 'handleModeratorRejectPending')
      const errorMsg = extractErrorMessage(error, t('moderation.rejectError', 'Error rejecting campaign'))
      setErrorMessage(errorMsg)
      setTimeout(() => setErrorMessage(''), 5000)
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
      await fetchCampaigns()
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
      setSuccessMessage(t('moderation.approveSuccess', 'Campaign approved successfully!'))
      await fetchCampaigns()
      setTimeout(() => setSuccessMessage(''), 5000)
    } catch (error) {
      logError(error, 'handleModeratorResume')
      const errorMsg = extractErrorMessage(error, t('moderation.approveError', 'Error approving campaign'))
      setErrorMessage(errorMsg)
      setTimeout(() => setErrorMessage(''), 5000)
    }
  }

  const handleToggleUserActive = async (userId, isActive) => {
    try {
      const response = await api.post(`/users/${userId}/set-active/`, {
        is_active: !isActive,
      })
      const updatedUser = response.data
      setModerationUsers((prev) =>
        prev.map((item) => (item.id === userId ? updatedUser : item))
      )
      setSuccessMessage(t('moderation.userStatusUpdated', 'User status updated successfully.'))
      setTimeout(() => setSuccessMessage(''), 5000)
    } catch (error) {
      logError(error, 'handleToggleUserActive')
      const errorMsg =
        error.response?.data?.is_active?.[0] ||
        extractErrorMessage(error, t('moderation.userStatusUpdateError', 'Failed to update user status.'))
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

  const moderationStatusOptions = useMemo(
    () => [
      { value: 'all', label: t('moderation.statusFilterAll', 'All statuses') },
      { value: 'pending', label: t('status.pending', 'Pending Moderation') },
      { value: 'approved', label: t('status.approved', 'Approved') },
      { value: 'rejected', label: t('status.rejected', 'Rejected') },
      { value: 'suspended', label: t('status.suspended', 'Suspended') },
      { value: 'cancelled', label: t('status.cancelled', 'Cancelled') },
      { value: 'draft', label: t('status.draft', 'Draft') },
    ],
    [t]
  )

  const filteredModerationCampaigns = useMemo(() => {
    if (moderationStatusFilter === 'all') {
      return moderationCampaigns
    }
    const normalizedFilter = moderationStatusFilter.toLowerCase()
    return moderationCampaigns.filter((campaign) => {
      const campaignStatus = typeof campaign.status === 'string' ? campaign.status.toLowerCase() : ''
      return campaignStatus === normalizedFilter
    })
  }, [moderationCampaigns, moderationStatusFilter])

  useEffect(() => {
    if (moderationStatusFilter === 'all') {
      return
    }
    const normalizedFilter = moderationStatusFilter.toLowerCase()
    const hasStatus = moderationCampaigns.some((campaign) => {
      const campaignStatus = typeof campaign.status === 'string' ? campaign.status.toLowerCase() : ''
      return campaignStatus === normalizedFilter
    })
    if (!hasStatus) {
      setModerationStatusFilter('all')
    }
  }, [moderationCampaigns, moderationStatusFilter])

  const getUserStripeSummary = useCallback(
    (status) => {
      if (!status) {
        return {
          variant: 'unknown',
          icon: 'ℹ️',
          title: t('dashboard.stripeStatusUnknown', 'Stripe status is currently unavailable.'),
          description: t('dashboard.stripeStatusUnknown', 'Stripe status is currently unavailable.'),
          flags: [],
          requirements: [],
          accountId: null,
          managementUrl: null,
        }
      }

      if (!status.has_account) {
        return {
          variant: 'error',
          icon: '✖️',
          title: t('dashboard.stripeStatusNeedsAttention', 'Account needs attention'),
          description: t(
            'dashboard.stripeNoAccount',
            'Create your Stripe account to submit campaigns and receive donations.'
          ),
          flags: [],
          requirements: [],
          accountId: null,
          managementUrl: null,
        }
      }

      const flags = [
        {
          key: 'charges',
          label: t('moderation.stripeChargesEnabled', 'Charges enabled'),
          value: !!status.charges_enabled,
        },
        {
          key: 'payouts',
          label: t('moderation.stripePayoutsEnabled', 'Payouts enabled'),
          value: !!status.payouts_enabled,
        },
        {
          key: 'details',
          label: t('moderation.stripeDetailsSubmitted', 'Details submitted'),
          value: !!status.details_submitted,
        },
      ]

      if (status.stripe_ready) {
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
          accountId: status.stripe_account_id || null,
          managementUrl: status.dashboard_url || null,
        }
      }

      const requirements = Array.isArray(status.requirements_due)
        ? status.requirements_due.filter(Boolean)
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
        accountId: status.stripe_account_id || null,
        managementUrl: status.dashboard_url || null,
      }
    },
    [t]
  )

  const userStripeSummary = useMemo(
    () => getUserStripeSummary(stripeStatus),
    [getUserStripeSummary, stripeStatus]
  )

  if (loading) {
    return <div className="container">{t('common.loading')}</div>
  }

  const getStatusBadge = (status) => {
    const statusKey = typeof status === 'string' ? status.toLowerCase() : ''
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
          backgroundColor: statusColors[statusKey] || '#6c757d',
          color: statusKey === 'pending' ? '#000' : '#fff'
        }}
      >
        {statusLabels[statusKey] || status}
      </span>
    )
  }

  const getModerationStripeStatus = (campaign) => {
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
          <div className="my-stripe-summary">
            <div className="my-stripe-summary__header">
              <h2>{t('dashboard.stripeConnectionHeading', 'Stripe connection')}</h2>
              <div className="my-stripe-summary__actions">
                {userStripeSummary.managementUrl && (
                  <a
                    href={userStripeSummary.managementUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline"
                  >
                    {t('dashboard.openStripeDashboard', 'Open Stripe dashboard')}
                  </a>
                )}
                <button
                  type="button"
                  className="btn btn-stripe"
                  onClick={handleRefreshStripeStatus}
                  disabled={stripeRefreshLoading}
                >
                  {stripeRefreshLoading
                    ? t('dashboard.refreshingStripe', 'Refreshing Stripe...')
                    : t('dashboard.refreshStripeStatus', 'Refresh Stripe status')}
                </button>
              </div>
            </div>
            <div className={`moderation-stripe-status moderation-stripe-status--${userStripeSummary.variant}`}>
              <div className="moderation-stripe-status__header">
                <span className="moderation-stripe-status__icon">{userStripeSummary.icon}</span>
                <div>
                  <p className="moderation-stripe-status__title">{userStripeSummary.title}</p>
                  <p className="moderation-stripe-status__description">
                    {userStripeSummary.description}
                  </p>
                  {userStripeSummary.accountId && (
                    <p className="moderation-stripe-status__account">
                      <strong>{t('dashboard.stripeAccountId', 'Account ID')}:</strong>{' '}
                      <code>{userStripeSummary.accountId}</code>
                    </p>
                  )}
                </div>
              </div>
              {userStripeSummary.flags.length > 0 && (
                <div className="moderation-stripe-status__flags">
                  {userStripeSummary.flags.map((flag) => (
                    <span
                      key={flag.key}
                      className={`moderation-stripe-flag ${flag.value ? 'moderation-stripe-flag--ok' : 'moderation-stripe-flag--pending'
                        }`}
                    >
                      {flag.value ? '✓' : '•'} {flag.label}
                    </span>
                  ))}
                </div>
              )}
              {userStripeSummary.requirements.length > 0 && (
                <div className="moderation-stripe-status__requirements">
                  <p className="moderation-stripe-status__requirements-title">
                    {t('dashboard.stripeRequirements', 'Outstanding requirements')}
                  </p>
                  <p className="moderation-stripe-status__description">
                    {t(
                      'dashboard.stripeRequirementsHelp',
                      'Complete the following items in Stripe to enable payouts:'
                    )}
                  </p>
                  <ul>
                    {userStripeSummary.requirements.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

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
                      {(() => {
                        const statusKey =
                          typeof campaign.status === 'string' ? campaign.status.toLowerCase() : ''
                        const { canSubmitForModeration, canSuspend, canCancel } =
                          getUserActionPermissions(statusKey)
                        const canEdit = statusKey !== 'cancelled'

                        return (
                          <>
                            {canEdit && (
                              <Link to={`/campaigns/${campaign.id}/edit`} className="btn btn-edit">
                                <span className="btn-icon">✎</span>
                                <span>{t('dashboard.edit')}</span>
                              </Link>
                            )}
                            {canSubmitForModeration && (
                              <button
                                type="button"
                                onClick={() => handleSubmitForModeration(campaign.id)}
                                className="btn btn-submit"
                              >
                                <span className="btn-icon">⇪</span>
                                <span>{t('dashboard.submitForModeration', 'Submit for moderation')}</span>
                              </button>
                            )}
                            {canSuspend && (
                              <button
                                type="button"
                                onClick={() => handleSuspend(campaign.id)}
                                className="btn btn-suspend"
                              >
                                <span className="btn-icon">⏸</span>
                                <span>{t('dashboard.suspend')}</span>
                              </button>
                            )}
                            {canCancel && (
                              <button
                                type="button"
                                onClick={() => handleCancel(campaign.id)}
                                className="btn btn-cancel"
                              >
                                <span className="btn-icon">✕</span>
                                <span>{t('dashboard.cancel')}</span>
                              </button>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p>{t('dashboard.noCampaigns')}</p>
            )}
          </div>
        )}

        {activeTab === 'moderation' && (user?.is_moderator || user?.is_staff) && (
          <div className="moderation-section">
            <div className="moderation-subtabs">
              <button
                type="button"
                className={`moderation-subtab ${moderationSubTab === 'campaigns' ? 'is-active' : ''}`}
                onClick={() => setModerationSubTab('campaigns')}
              >
                {t('moderation.tabCampaigns', 'Campaigns')}
              </button>
              <button
                type="button"
                className={`moderation-subtab ${moderationSubTab === 'users' ? 'is-active' : ''}`}
                onClick={() => setModerationSubTab('users')}
              >
                {t('moderation.tabUsers', 'Users')}
              </button>
            </div>

            {moderationSubTab === 'campaigns' && (
              <>
                <div className="moderation-list-header">
                  <h2 className="moderation-subheading">{t('moderation.allCampaigns', 'All Campaigns')}</h2>
                  {moderationCampaigns.length > 0 && (
                    <div className="moderation-filters">
                      <label className="moderation-filter-label" htmlFor="moderation-status-filter">
                        {t('moderation.statusFilterLabel', 'Filter by status')}
                      </label>
                      <select
                        id="moderation-status-filter"
                        className="moderation-filter-select"
                        value={moderationStatusFilter}
                        onChange={(event) => setModerationStatusFilter(event.target.value)}
                      >
                        {moderationStatusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                {filteredModerationCampaigns.length > 0 ? (
                  <div className="campaigns-list">
                    {filteredModerationCampaigns.map((campaign) => {
                      const statusKey =
                        typeof campaign.status === 'string' ? campaign.status.toLowerCase() : ''
                      const canModerate = statusKey === 'pending'
                      const canSuspend = statusKey === 'approved'
                      const canApprove = statusKey === 'suspended'
                      const stripeInfo = getModerationStripeStatus(campaign)
                      const historyEntries = Array.isArray(campaign.moderation_history)
                        ? campaign.moderation_history
                        : []

                      const resolveModeratorLabel = (entry) => {
                        if (!entry.moderator) {
                          return t('moderation.historyModeratorDeleted', 'Former moderator')
                        }
                        const { email, username, id } = entry.moderator
                        if (email) {
                          return email
                        }
                        if (username) {
                          return username
                        }
                        return id
                      }

                      const resolveActionLabel = (action) => {
                        if (!action) {
                          return t('moderation.historyAction.unknown', 'Unknown action')
                        }
                        return t(
                          `moderation.historyAction.${action}`,
                          action.charAt(0).toUpperCase() + action.slice(1)
                        )
                      }

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
                          </div>
                          <div className={`moderation-stripe-status moderation-stripe-status--${stripeInfo.variant}`}>
                            <div className="moderation-stripe-status__header">
                              <span className="moderation-stripe-status__icon">{stripeInfo.icon}</span>
                              <div>
                                <p className="moderation-stripe-status__title">{stripeInfo.title}</p>
                                <p className="moderation-stripe-status__description">{stripeInfo.description}</p>
                                {stripeInfo.accountId && (
                                  <p className="moderation-stripe-status__account">
                                    {t('moderation.stripeAccountId', 'Account ID')}: <code>{stripeInfo.accountId}</code>
                                  </p>
                                )}
                              </div>
                            </div>
                            {stripeInfo.flags.length > 0 && (
                              <div className="moderation-stripe-status__flags">
                                {stripeInfo.flags.map((flag) => (
                                  <span
                                    key={flag.key}
                                    className={`moderation-stripe-flag ${flag.value ? 'moderation-stripe-flag--ok' : 'moderation-stripe-flag--pending'}`}
                                  >
                                    {flag.value ? '✓' : '•'} {flag.label}
                                  </span>
                                ))}
                              </div>
                            )}
                            {stripeInfo.requirements.length > 0 && (
                              <div className="moderation-stripe-status__requirements">
                                <p className="moderation-stripe-status__requirements-title">
                                  {t('moderation.stripeRequirementsTitle', 'Outstanding requirements')}
                                </p>
                                <ul>
                                  {stripeInfo.requirements.map((item, idx) => (
                                    <li key={idx}>{item}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                          {historyEntries.length > 0 && (
                            <div className="moderation-history">
                              <p className="moderation-history__title">
                                {t('moderation.historyTitle', 'Moderation history')}
                              </p>
                              <ul className="moderation-history__list">
                                {historyEntries.map((entry) => (
                                  <li key={entry.id} className="moderation-history__item">
                                    <div className="moderation-history__meta">
                                      <span className="moderation-history__action">
                                        {resolveActionLabel(entry.action)}
                                      </span>
                                      <span className="moderation-history__date">
                                        {formatDateTime(entry.created_at)}
                                      </span>
                                    </div>
                                    <p className="moderation-history__moderator">
                                      {t('moderation.historyModerator', 'Moderator')}:{' '}
                                      {resolveModeratorLabel(entry)}
                                    </p>
                                    {entry.notes && (
                                      <p className="moderation-history__notes">{entry.notes}</p>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <div className="campaign-actions">
                            <Link to={`/campaign/${campaign.id}`} className="btn btn-view">
                              <span className="btn-icon">👁</span>
                              <span>{t('moderation.viewDetails', 'View Details')}</span>
                            </Link>
                            {canModerate && (
                              <>
                                <button
                                  onClick={() => handleModeratorApprovePending(campaign.id)}
                                  className="btn btn-approve"
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
                                  <span>{t('moderation.approve', 'Approve')}</span>
                                </button>
                                <button
                                  onClick={() => handleModeratorRejectPending(campaign.id)}
                                  className="btn btn-reject"
                                >
                                  <span className="btn-icon">✗</span>
                                  <span>{t('moderation.reject', 'Reject')}</span>
                                </button>
                              </>
                            )}
                            {canSuspend && (
                              <button
                                onClick={() => handleModeratorSuspend(campaign.id)}
                                className="btn btn-suspend"
                              >
                                <span className="btn-icon">⏸</span>
                                <span>{t('moderation.suspend', 'Suspend')}</span>
                              </button>
                            )}
                            {canApprove && (
                              <button
                                onClick={() => handleModeratorResume(campaign.id)}
                                className="btn btn-approve"
                                disabled={!campaign.stripe_ready}
                                title={
                                  campaign.stripe_ready
                                    ? undefined
                                    : t('moderation.resumeRequiresStripe', 'Complete Stripe onboarding before resuming.')
                                }
                              >
                                <span className="btn-icon">✓</span>
                                <span>{t('moderation.approve', 'Approve')}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : moderationCampaigns.length > 0 ? (
                  <p className="empty-message">
                    {t('moderation.noCampaignsForFilter', 'No campaigns match the selected status.')}
                  </p>
                ) : (
                  <p className="empty-message">{t('moderation.noCampaigns', 'No campaigns available.')}</p>
                )}
              </>
            )}

            {moderationSubTab === 'users' && (
              <div className="moderation-users-section">
                <h2>{t('moderation.usersHeading', 'Users')}</h2>
                {moderationUsersLoading ? (
                  <p className="empty-message">{t('common.loading')}</p>
                ) : moderationUsers.length > 0 ? (
                  <div className="moderation-users-table-wrapper">
                    <table className="moderation-users-table">
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
                        {moderationUsers.map((account) => (
                          <tr key={account.id}>
                            <td>
                              <div className="moderation-user-primary">
                                <span className="moderation-user-email">{account.email}</span>
                                {account.username && (
                                  <span className="moderation-user-username">@{account.username}</span>
                                )}
                              </div>
                            </td>
                            <td>
                              <span
                                className={`user-status ${account.is_active ? 'user-status--active' : 'user-status--disabled'}`}
                              >
                                {account.is_active
                                  ? t('moderation.userActive', 'Active')
                                  : t('moderation.userDisabled', 'Disabled')}
                              </span>
                            </td>
                            <td>{formatDateTime(account.date_joined)}</td>
                            <td>{formatDateTime(account.last_login)}</td>
                            <td className="moderation-user-actions">
                              <button
                                type="button"
                                className={`user-toggle-button ${account.is_active ? 'user-toggle-button--disable' : 'user-toggle-button--enable'
                                  }`}
                                onClick={() => handleToggleUserActive(account.id, account.is_active)}
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
