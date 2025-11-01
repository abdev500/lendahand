import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../api/axios'
import RichTextEditor from '../components/RichTextEditor'
import MediaUploader from '../components/MediaUploader'
import './CreateCampaign.css'

function EditCampaign() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    title: '',
    short_description: '',
    description: '',
    target_amount: '',
  })
  const [mediaFiles, setMediaFiles] = useState([])
  const [existingMedia, setExistingMedia] = useState([])
  const [campaign, setCampaign] = useState(null)

  useEffect(() => {
    checkAuth()
    fetchCampaign()
  }, [id])

  const checkAuth = async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/login')
      return
    }

    try {
      await api.get('/users/me/')
    } catch (error) {
      localStorage.removeItem('token')
      navigate('/login')
    }
  }

  const fetchCampaign = async () => {
    try {
      const response = await api.get(`/campaigns/${id}/`)
      if (response.data.created_by.id !== (await api.get('/users/me/')).data.id) {
        navigate('/dashboard')
        return
      }

      setCampaign(response.data)
      setFormData({
        title: response.data.title,
        short_description: response.data.short_description,
        description: response.data.description,
        target_amount: response.data.target_amount,
      })
      setExistingMedia(response.data.media || [])
      setLoading(false)
    } catch (error) {
      console.error('Error fetching campaign:', error)
      navigate('/dashboard')
    }
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleDescriptionChange = (value) => {
    setFormData({
      ...formData,
      description: value,
    })
  }


  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const formDataToSend = new FormData()
      formDataToSend.append('title', formData.title)
      formDataToSend.append('short_description', formData.short_description)
      formDataToSend.append('description', formData.description)
      formDataToSend.append('target_amount', formData.target_amount)

      if (mediaFiles.length > 0) {
        mediaFiles.forEach((file) => {
          formDataToSend.append(`media_files`, file)
        })
      }

      await api.patch(`/campaigns/${id}/`, formDataToSend)

      // Redirect to dashboard with success message
      navigate('/dashboard?campaign_updated=true')
    } catch (err) {
      console.error('Error updating campaign:', err)
      let errorMessage = 'Failed to update campaign. Please try again.'
      
      if (err.response?.data) {
        const data = err.response.data
        if (typeof data === 'string') {
          // Handle string error messages
          errorMessage = data
        } else if (typeof data === 'object') {
          // Handle object error messages
          const errors = Object.values(data).flat()
          errorMessage = errors.length > 0 ? errors.join(', ') : errorMessage
        }
      } else if (err.message) {
        errorMessage = err.message
      }
      
      setError(errorMessage)
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="container">Loading...</div>
  }

  return (
    <div className="create-campaign">
      <div className="container">
        <h1>Edit Campaign</h1>
        {error && <div className="error-message">{error}</div>}
        {campaign?.status && campaign.status === 'approved' && (
          <div className="info-message">
            Note: Editing this campaign will reset it to pending moderation.
          </div>
        )}
        {campaign?.status && campaign.status === 'rejected' && (
          <div className="info-message">
            Note: Editing this campaign will reset it to pending moderation.
          </div>
        )}
        <form onSubmit={handleSubmit} className="campaign-form">
          <div className="form-group">
            <label htmlFor="title">Title *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              placeholder="Enter campaign title"
            />
          </div>

          <div className="form-group">
            <label htmlFor="short_description">Short Description *</label>
            <textarea
              id="short_description"
              name="short_description"
              value={formData.short_description}
              onChange={handleChange}
              required
              rows="3"
              placeholder="Brief description of your campaign"
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Full Description *</label>
            <RichTextEditor
              value={formData.description}
              onChange={handleDescriptionChange}
              placeholder="Write your full campaign description here. You can format text, add links, images, and more..."
            />
            <small>Use the toolbar above to format your text, add links, images, and more</small>
          </div>

          <div className="form-group">
            <label htmlFor="target_amount">Target Amount (USD) *</label>
            <input
              type="number"
              id="target_amount"
              name="target_amount"
              value={formData.target_amount}
              onChange={handleChange}
              required
              min="1"
              step="0.01"
              placeholder="50000"
            />
          </div>

          <div className="form-group">
            <label>Media Files (Images/Videos) - Up to 6 files total</label>
            <MediaUploader
              existingMedia={existingMedia}
              selectedFiles={mediaFiles}
              onFilesChange={setMediaFiles}
              maxFiles={6}
            />
          </div>

          <div className="form-actions">
            <button type="submit" disabled={saving} className="btn-submit">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/campaign/${id}`)}
              className="btn-cancel"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditCampaign

