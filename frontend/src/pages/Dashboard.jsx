import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../api/axios'
import './Dashboard.css'

function Dashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    checkAuth()
    fetchCampaigns()
    
    // Check for success message from URL params
    const campaignCreated = searchParams.get('campaign_created') === 'true'
    const campaignUpdated = searchParams.get('campaign_updated') === 'true'
    
    if (campaignCreated || campaignUpdated) {
      if (campaignCreated) {
        setSuccessMessage('Campaign created successfully! It is now pending moderation and will be visible once approved.')
      } else if (campaignUpdated) {
        setSuccessMessage('Campaign updated successfully! It has been resubmitted for moderation.')
      }
      // Clear the URL params
      setSearchParams({})
      // Refresh campaigns to show new/updated campaign
      setTimeout(() => {
        fetchCampaigns()
      }, 500)
    }
  }, [])

  const checkAuth = async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/login')
      return
    }

    try {
      const response = await api.get('/users/me/')
      setUser(response.data)
    } catch (error) {
      localStorage.removeItem('token')
      navigate('/login')
    }
  }

  const fetchCampaigns = async () => {
    try {
      const response = await api.get('/campaigns/')
      setCampaigns(response.data.results || response.data)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching campaigns:', error)
      setLoading(false)
    }
  }

  const handleSuspend = async (campaignId) => {
    if (!window.confirm('Are you sure you want to suspend this campaign?')) {
      return
    }

    try {
      await api.post(`/campaigns/${campaignId}/suspend/`)
      fetchCampaigns()
    } catch (error) {
      console.error('Error suspending campaign:', error)
      alert('Error suspending campaign')
    }
  }

  const handleCancel = async (campaignId) => {
    if (!window.confirm('Are you sure you want to cancel this campaign?')) {
      return
    }

    try {
      await api.post(`/campaigns/${campaignId}/cancel/`)
      fetchCampaigns()
    } catch (error) {
      console.error('Error cancelling campaign:', error)
      alert('Error cancelling campaign')
    }
  }

  if (loading) {
    return <div className="container">Loading...</div>
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
      'draft': 'Draft',
      'pending': 'Pending Moderation',
      'approved': 'Approved',
      'rejected': 'Rejected',
      'suspended': 'Suspended',
      'cancelled': 'Cancelled',
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
        <h1>My Dashboard</h1>
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
        {user && (
          <div className="user-info">
            <p><strong>Email:</strong> {user.email}</p>
            {user.phone && <p><strong>Phone:</strong> {user.phone}</p>}
            {user.address && <p><strong>Address:</strong> {user.address}</p>}
          </div>
        )}

        <div className="dashboard-actions">
          <Link to="/campaigns/new" className="btn-create">
            + Create New Campaign
          </Link>
        </div>

        <div className="campaigns-section">
          <h2>My Campaigns</h2>
          {campaigns.length > 0 ? (
            <div className="campaigns-list">
              {campaigns.map((campaign) => (
                <div key={campaign.id} className="dashboard-campaign-card">
                  <div className="campaign-info">
                    <h3>{campaign.title}</h3>
                    <p className="campaign-status">
                      Status: {getStatusBadge(campaign.status)}
                      {campaign.status === 'pending' && (
                        <span className="status-note"> - Awaiting moderator approval</span>
                      )}
                    </p>
                    <p className="campaign-progress">
                      ${campaign.current_amount.toLocaleString()} / ${campaign.target_amount.toLocaleString()}
                    </p>
                  </div>
                  <div className="campaign-actions">
                    <Link to={`/campaign/${campaign.id}`} className="btn-view">
                      View
                    </Link>
                    {campaign.status !== 'suspended' && campaign.status !== 'cancelled' && (
                      <Link to={`/campaigns/${campaign.id}/edit`} className="btn-edit">
                        Edit
                      </Link>
                    )}
                    {campaign.status !== 'suspended' && campaign.status !== 'cancelled' && (
                      <>
                        <button
                          onClick={() => handleSuspend(campaign.id)}
                          className="btn-suspend"
                        >
                          Suspend
                        </button>
                        <button
                          onClick={() => handleCancel(campaign.id)}
                          className="btn-cancel"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>You haven't created any campaigns yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard

