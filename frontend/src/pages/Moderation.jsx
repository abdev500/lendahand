import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../api/axios'
import './Moderation.css'

function Moderation() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [showNotesForm, setShowNotesForm] = useState(null)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    const initializeModeration = async () => {
      await checkAuth()
      await fetchPendingCampaigns()
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

  const fetchPendingCampaigns = async () => {
    try {
      const response = await api.get('/campaigns/?status=pending')
      const allCampaigns = response.data.results || response.data
      setCampaigns(allCampaigns)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching pending campaigns:', error)
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
      fetchPendingCampaigns()
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
      fetchPendingCampaigns()
      setTimeout(() => setSuccessMessage(''), 5000)
    } catch (error) {
      console.error('Error rejecting campaign:', error)
      const errorMsg = error.response?.data?.error || error.response?.data?.detail || t('moderation.rejectError', 'Error rejecting campaign')
      setErrorMessage(errorMsg)
      setTimeout(() => setErrorMessage(''), 5000)
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
          {campaigns.length > 0 ? (
            <div className="campaigns-list">
              {campaigns.map((campaign) => (
                <div key={campaign.id} className="moderation-campaign-card">
                  <div className="campaign-info">
                    <h3>{campaign.title}</h3>
                    <p className="campaign-creator">
                      <strong>{t('moderation.createdBy', 'Created by')}:</strong> {campaign.created_by?.email || 'Unknown'}
                    </p>
                    <p className="campaign-description">{campaign.short_description}</p>
                    <p className="campaign-target">
                      <strong>{t('moderation.targetAmount', 'Target')}:</strong> ${campaign.target_amount.toLocaleString()}
                    </p>
                    <p className="campaign-date">
                      <strong>{t('moderation.createdAt', 'Created')}:</strong> {new Date(campaign.created_at).toLocaleDateString()}
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
              ))}
            </div>
          ) : (
            <p className="empty-message">{t('moderation.noPendingCampaigns', 'No pending campaigns to moderate.')}</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default Moderation

