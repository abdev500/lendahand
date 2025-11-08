import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../api/axios'
import './Moderation.css'

function Moderation() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [pendingCampaigns, setPendingCampaigns] = useState([])
  const [suspendedCampaigns, setSuspendedCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [showNotesForm, setShowNotesForm] = useState(null)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    const initializeModeration = async () => {
      await checkAuth()
      await fetchCampaigns()
    }

    initializeModeration()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkAuth = async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/login')
      return
    }

    try {
      const response = await api.get('/users/me/')
      const currentUser = response.data
      setUser(currentUser)

      // Check if user is moderator or staff
      if (!currentUser.is_moderator && !currentUser.is_staff) {
        navigate('/dashboard')
        return
      }
    } catch (error) {
      localStorage.removeItem('token')
      navigate('/login')
    }
  }

  const fetchCampaigns = async () => {
    try {
      const [pendingResponse, suspendedResponse] = await Promise.all([
        api.get('/campaigns/?status=pending'),
        api.get('/campaigns/?status=suspended'),
      ])

      const pending = pendingResponse.data.results || pendingResponse.data || []
      const suspended = suspendedResponse.data.results || suspendedResponse.data || []
      setPendingCampaigns(pending)
      setSuspendedCampaigns(suspended)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching campaigns:', error)
      setLoading(false)
    }
  }

  const handleApprove = async (campaignId) => {
    try {
      await api.post(`/campaigns/${campaignId}/approve/`, {
        moderation_notes: notes || ''
      })
      setSuccessMessage(t('moderation.approveSuccess', 'Campaign approved successfully!'))
      setShowNotesForm(null)
      setNotes('')
      fetchCampaigns()
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
      fetchCampaigns()
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
      setSuccessMessage(t('moderation.resumeSuccess', 'Campaign resumed successfully!'))
      fetchCampaigns()
      setTimeout(() => setSuccessMessage(''), 5000)
    } catch (error) {
      console.error('Error resuming campaign:', error)
      const errorMsg = error.response?.data?.error || error.response?.data?.detail || t('moderation.resumeError', 'Error resuming campaign')
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

    if (campaign.stripe_ready || stripe.ready) {
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

  if (loading) {
    return <div className="container">{t('common.loading')}</div>
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

        <div className="moderation-section">
          <h2>{t('moderation.pendingCampaigns', 'Pending Campaigns')}</h2>
          {pendingCampaigns.length > 0 ? (
            <div className="campaigns-list">
              {pendingCampaigns.map((campaign) => {
                const stripeStatus = getStripeStatus(campaign)

                return (
                <div key={campaign.id} className="moderation-campaign-card">
                  <div className="campaign-info">
                    <h3>{campaign.title}</h3>
                    <p className="campaign-creator">
                      <strong>{t('moderation.createdBy', 'Created by')}:</strong> {campaign.created_by?.email || 'Unknown'}
                    </p>
                    <p className="campaign-description">{campaign.short_description}</p>
                    <p className="campaign-target">
                      <strong>{t('moderation.targetAmount', 'Target')}:</strong> €{campaign.target_amount.toLocaleString()}
                    </p>
                    <p className="campaign-date">
                      <strong>{t('moderation.createdAt', 'Created')}:</strong> {new Date(campaign.created_at).toLocaleDateString()}
                    </p>

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
                            onClick={() => handleApprove(campaign.id)}
                            className="btn btn-approve"
                          >
                            <span className="btn-icon">✓</span>
                            <span>{t('moderation.approve', 'Approve')}</span>
                          </button>
                          <button
                            onClick={() => handleReject(campaign.id)}
                            className="btn btn-reject"
                          >
                            <span className="btn-icon">✗</span>
                            <span>{t('moderation.reject', 'Reject')}</span>
                          </button>
                          <button
                            onClick={() => {
                              setShowNotesForm(null)
                              setNotes('')
                            }}
                            className="btn btn-cancel"
                          >
                            <span className="btn-icon">×</span>
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
                )
              })}
            </div>
          ) : (
            <p className="empty-message">{t('moderation.noPendingCampaigns', 'No pending campaigns to moderate.')}</p>
          )}
        </div>
        <div className="moderation-section">
          <h2>{t('moderation.suspendedCampaigns', 'Suspended Campaigns')}</h2>
          {suspendedCampaigns.length > 0 ? (
            <div className="campaigns-list">
              {suspendedCampaigns.map((campaign) => {
                const stripeStatus = getStripeStatus(campaign)

                return (
                  <div key={campaign.id} className="moderation-campaign-card">
                    <div className="campaign-info">
                      <h3>{campaign.title}</h3>
                      <p className="campaign-creator">
                        <strong>{t('moderation.createdBy', 'Created by')}:</strong> {campaign.created_by?.email || 'Unknown'}
                      </p>
                      <p className="campaign-description">{campaign.short_description}</p>
                      <p className="campaign-target">
                        <strong>{t('moderation.targetAmount', 'Target')}:</strong> €{campaign.target_amount.toLocaleString()}
                      </p>
                      <p className="campaign-date">
                        <strong>{t('moderation.createdAt', 'Created')}:</strong> {new Date(campaign.created_at).toLocaleDateString()}
                      </p>

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
                    <div className="campaign-actions">
                      <Link to={`/campaign/${campaign.id}`} className="btn btn-view">
                        <span className="btn-icon">👁</span>
                        <span>{t('moderation.viewDetails', 'View Details')}</span>
                      </Link>
                      <button
                        onClick={() => handleResume(campaign.id)}
                        className="btn btn-resume"
                      >
                        <span className="btn-icon">↻</span>
                        <span>{t('moderation.resume', 'Resume')}</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="empty-message">{t('moderation.noSuspendedCampaigns', 'No suspended campaigns.')}</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default Moderation
